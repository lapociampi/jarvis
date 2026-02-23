/**
 * Agent Service — The Brain
 *
 * Owns the LLM manager, agent orchestrator, and personality state.
 * Builds dynamic system prompts each turn with role context, personality,
 * commitments, and observations.
 */

import type { Service, ServiceStatus } from './services.ts';
import type { JarvisConfig } from '../config/types.ts';
import type { LLMStreamEvent } from '../llm/provider.ts';
import type { RoleDefinition } from '../roles/types.ts';
import type { PersonalityModel } from '../personality/model.ts';

import { LLMManager } from '../llm/manager.ts';
import { AnthropicProvider } from '../llm/anthropic.ts';
import { OpenAIProvider } from '../llm/openai.ts';
import { OllamaProvider } from '../llm/ollama.ts';
import { AgentOrchestrator } from '../agents/orchestrator.ts';
import { loadRole } from '../roles/loader.ts';
import { buildSystemPrompt, type PromptContext } from '../roles/prompt-builder.ts';
import {
  getPersonality,
  savePersonality,
} from '../personality/model.ts';
import {
  getChannelPersonality,
  personalityToPrompt,
} from '../personality/adapter.ts';
import {
  extractSignals,
  applySignals,
  recordInteraction,
} from '../personality/learner.ts';
import { getDueCommitments, getUpcoming } from '../vault/commitments.ts';
import { getRecentObservations } from '../vault/observations.ts';
import { extractAndStore } from '../vault/extractor.ts';

export class AgentService implements Service {
  name = 'agent';
  private _status: ServiceStatus = 'stopped';
  private config: JarvisConfig;
  private llmManager: LLMManager;
  private orchestrator: AgentOrchestrator;
  private role: RoleDefinition | null = null;
  private personality: PersonalityModel | null = null;

  constructor(config: JarvisConfig) {
    this.config = config;
    this.llmManager = new LLMManager();
    this.orchestrator = new AgentOrchestrator();
  }

  async start(): Promise<void> {
    this._status = 'starting';

    try {
      // 1. Create LLM providers from config
      this.registerProviders();

      // 2. Load role YAML
      this.role = this.loadActiveRole();

      // 3. Wire LLM manager to orchestrator
      this.orchestrator.setLLMManager(this.llmManager);

      // 4. Create primary agent
      this.orchestrator.createPrimary(this.role);

      // 5. Load personality
      this.personality = getPersonality();

      this._status = 'running';
      console.log(`[AgentService] Started with role: ${this.role.name}`);
    } catch (error) {
      this._status = 'error';
      throw error;
    }
  }

  async stop(): Promise<void> {
    this._status = 'stopping';
    const primary = this.orchestrator.getPrimary();
    if (primary) {
      this.orchestrator.terminateAgent(primary.id);
    }
    this._status = 'stopped';
    console.log('[AgentService] Stopped');
  }

  status(): ServiceStatus {
    return this._status;
  }

  /**
   * Stream a message through the agent. Returns a stream and an onComplete callback.
   */
  streamMessage(text: string, channel: string = 'websocket'): {
    stream: AsyncIterable<LLMStreamEvent>;
    onComplete: (fullText: string) => Promise<void>;
  } {
    const systemPrompt = this.buildFullSystemPrompt(channel);

    const stream = this.orchestrator.streamMessage(systemPrompt, text);

    const onComplete = async (fullText: string): Promise<void> => {
      // Add assistant response to history
      const primary = this.orchestrator.getPrimary();
      if (primary) {
        primary.addMessage('assistant', fullText);
      }

      // Fire-and-forget: extract knowledge into vault
      this.extractKnowledge(text, fullText).catch((err) =>
        console.error('[AgentService] Extraction error:', err)
      );

      // Fire-and-forget: personality learning
      this.learnFromInteraction(text, fullText, channel).catch((err) =>
        console.error('[AgentService] Personality learning error:', err)
      );
    };

    return { stream, onComplete };
  }

  /**
   * Non-streaming message handler. Returns full response string.
   */
  async handleMessage(text: string, channel: string = 'websocket'): Promise<string> {
    const systemPrompt = this.buildFullSystemPrompt(channel);

    const response = await this.orchestrator.processMessage(systemPrompt, text);

    // Fire-and-forget: extract knowledge into vault
    this.extractKnowledge(text, response).catch((err) =>
      console.error('[AgentService] Extraction error:', err)
    );

    // Fire-and-forget: personality learning
    this.learnFromInteraction(text, response, channel).catch((err) =>
      console.error('[AgentService] Personality learning error:', err)
    );

    return response;
  }

  /**
   * Handle periodic heartbeat. Returns proactive message or null.
   */
  async handleHeartbeat(): Promise<string | null> {
    if (!this.role) return null;

    const systemPrompt = this.buildHeartbeatPrompt();
    return this.orchestrator.heartbeat(systemPrompt);
  }

  // --- Private methods ---

  private registerProviders(): void {
    const { llm } = this.config;
    let hasProvider = false;

    // Register Anthropic
    if (llm.anthropic?.api_key) {
      const provider = new AnthropicProvider(
        llm.anthropic.api_key,
        llm.anthropic.model
      );
      this.llmManager.registerProvider(provider);
      hasProvider = true;
      console.log('[AgentService] Registered Anthropic provider');
    }

    // Register OpenAI
    if (llm.openai?.api_key) {
      const provider = new OpenAIProvider(
        llm.openai.api_key,
        llm.openai.model
      );
      this.llmManager.registerProvider(provider);
      hasProvider = true;
      console.log('[AgentService] Registered OpenAI provider');
    }

    // Register Ollama (always available, no API key needed)
    if (llm.ollama) {
      const provider = new OllamaProvider(
        llm.ollama.base_url,
        llm.ollama.model
      );
      this.llmManager.registerProvider(provider);
      hasProvider = true;
      console.log('[AgentService] Registered Ollama provider');
    }

    if (!hasProvider) {
      console.warn('[AgentService] No LLM providers configured. Responses will be placeholders.');
    }

    // Set primary and fallback chain
    if (hasProvider) {
      try {
        this.llmManager.setPrimary(llm.primary);
      } catch {
        // Primary provider not available, first registered is already primary
      }

      // Set fallback chain (only for providers that were registered)
      const registeredFallbacks = llm.fallback.filter(
        (name) => this.llmManager.getProvider(name) !== undefined
      );
      if (registeredFallbacks.length > 0) {
        this.llmManager.setFallbackChain(registeredFallbacks);
      }
    }
  }

  private loadActiveRole(): RoleDefinition {
    const roleName = this.config.active_role;

    // Try multiple locations for role YAML
    const paths = [
      `roles/${roleName}.yaml`,
      `roles/${roleName}.yml`,
      `config/roles/${roleName}.yaml`,
      `config/roles/${roleName}.yml`,
    ];

    for (const rolePath of paths) {
      try {
        const role = loadRole(rolePath);
        console.log(`[AgentService] Loaded role '${role.name}' from ${rolePath}`);
        return role;
      } catch {
        // Try next path
      }
    }

    // Fatal — cannot start without a role
    throw new Error(
      `[AgentService] Could not load role '${roleName}'. Searched: ${paths.join(', ')}`
    );
  }

  private buildFullSystemPrompt(channel: string): string {
    if (!this.role) return '';

    // Build prompt context with live data
    const context = this.buildPromptContext();

    // Build base system prompt from role + context
    const rolePrompt = buildSystemPrompt(this.role, context);

    // Build personality prompt for this channel
    const personality = this.personality ?? getPersonality();
    const channelPersonality = getChannelPersonality(personality, channel);
    const personalityPrompt = personalityToPrompt(channelPersonality);

    return `${rolePrompt}\n\n${personalityPrompt}`;
  }

  private buildHeartbeatPrompt(): string {
    if (!this.role) return '';

    const context = this.buildPromptContext();
    const rolePrompt = buildSystemPrompt(this.role, context);

    // Append heartbeat-specific instructions
    return `${rolePrompt}\n\n# Heartbeat Check\n${this.role.heartbeat_instructions}`;
  }

  private buildPromptContext(): PromptContext {
    const context: PromptContext = {
      currentTime: new Date().toISOString(),
    };

    // Get due commitments
    try {
      const due = getDueCommitments();
      const upcoming = getUpcoming(5);
      const allCommitments = [...due, ...upcoming];

      if (allCommitments.length > 0) {
        context.activeCommitments = allCommitments.map((c) => {
          const dueStr = c.when_due
            ? ` (due: ${new Date(c.when_due).toLocaleString()})`
            : '';
          return `[${c.priority}] ${c.what}${dueStr} — ${c.status}`;
        });
      }
    } catch (err) {
      console.error('[AgentService] Error loading commitments:', err);
    }

    // Get recent observations
    try {
      const observations = getRecentObservations(undefined, 10);
      if (observations.length > 0) {
        context.recentObservations = observations.map((o) => {
          const time = new Date(o.created_at).toLocaleTimeString();
          return `[${time}] ${o.type}: ${JSON.stringify(o.data).slice(0, 200)}`;
        });
      }
    } catch (err) {
      console.error('[AgentService] Error loading observations:', err);
    }

    return context;
  }

  private async extractKnowledge(userMessage: string, assistantResponse: string): Promise<void> {
    // Get the primary provider for extraction
    const provider = this.llmManager.getProvider(this.config.llm.primary)
      ?? this.llmManager.getProvider('anthropic')
      ?? this.llmManager.getProvider('openai');

    await extractAndStore(userMessage, assistantResponse, provider);
  }

  private async learnFromInteraction(
    userMessage: string,
    assistantResponse: string,
    _channel: string
  ): Promise<void> {
    let personality = this.personality ?? getPersonality();

    // Extract signals from the interaction
    const signals = extractSignals(userMessage, assistantResponse);

    // Apply signals if any
    if (signals.length > 0) {
      personality = applySignals(personality, signals);
    }

    // Record the interaction (increments message count, adjusts trust)
    personality = recordInteraction(personality);

    // Save updated personality
    savePersonality(personality);
    this.personality = personality;
  }
}
