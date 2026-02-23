import type { RoleDefinition } from '../roles/types.ts';
import type { LLMMessage, LLMResponse, LLMStreamEvent } from '../llm/provider.ts';
import { LLMManager } from '../llm/manager.ts';
import { AgentInstance } from './agent.ts';
import { AgentHierarchy } from './hierarchy.ts';

export class AgentOrchestrator {
  private hierarchy: AgentHierarchy;
  private llmManager: LLMManager | null;

  constructor() {
    this.hierarchy = new AgentHierarchy();
    this.llmManager = null;
  }

  setLLMManager(llm: LLMManager): void {
    this.llmManager = llm;
  }

  getLLMManager(): LLMManager | null {
    return this.llmManager;
  }

  /**
   * Create the primary agent from a role.
   * No inline system prompt — the AgentService builds a rich dynamic prompt each turn.
   */
  createPrimary(role: RoleDefinition): AgentInstance {
    const existing = this.hierarchy.getPrimary();
    if (existing) {
      throw new Error('Primary agent already exists. Terminate it first.');
    }

    const agent = new AgentInstance(role);
    this.hierarchy.addAgent(agent);
    return agent;
  }

  /**
   * Spawn a sub-agent under a parent
   */
  spawnSubAgent(
    parentId: string,
    role: RoleDefinition,
    opts?: { memory_scope?: string[] }
  ): AgentInstance {
    const parent = this.hierarchy.getAgent(parentId);
    if (!parent) {
      throw new Error(`Parent agent not found: ${parentId}`);
    }

    if (!parent.agent.authority.can_spawn_children) {
      throw new Error('Parent agent does not have authority to spawn children');
    }

    // Create child agent with reduced authority
    const childAuthority = {
      max_authority_level: Math.min(
        role.authority_level,
        parent.agent.authority.max_authority_level - 1
      ),
      allowed_tools: role.tools.filter((tool) =>
        parent.agent.authority.allowed_tools.includes(tool)
      ),
      denied_tools: parent.agent.authority.denied_tools,
      max_token_budget: Math.floor(parent.agent.authority.max_token_budget / 2),
      can_spawn_children: role.sub_roles.length > 0,
    };

    const agent = new AgentInstance(role, {
      parent_id: parentId,
      authority: childAuthority,
      memory_scope: opts?.memory_scope ?? [],
    });

    this.hierarchy.addAgent(agent);

    // Add system message with role context for sub-agents
    agent.addMessage(
      'system',
      `You are ${role.name}, spawned by ${parent.agent.role.name}. ${role.description}\n\nResponsibilities:\n${role.responsibilities.map((r) => `- ${r}`).join('\n')}\n\nYou report to: ${parent.agent.role.name}\n\nCommunication style: ${role.communication_style.tone} tone, ${role.communication_style.verbosity} verbosity, ${role.communication_style.formality} formality.`
    );

    return agent;
  }

  /**
   * Terminate an agent and its children
   */
  terminateAgent(agentId: string): void {
    const agent = this.hierarchy.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Recursively terminate children first
    const children = this.hierarchy.getChildren(agentId);
    for (const child of children) {
      this.terminateAgent(child.id);
    }

    // Terminate this agent
    agent.terminate();
    this.hierarchy.removeAgent(agentId);
  }

  /**
   * Get the primary agent
   */
  getPrimary(): AgentInstance | undefined {
    return this.hierarchy.getPrimary();
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): AgentInstance | undefined {
    return this.hierarchy.getAgent(agentId);
  }

  /**
   * Get all agents
   */
  getAllAgents(): AgentInstance[] {
    return this.hierarchy.getAllAgents();
  }

  /**
   * Get the hierarchy
   */
  getHierarchy(): AgentHierarchy {
    return this.hierarchy;
  }

  /**
   * Process a user message through the primary agent (non-streaming).
   * Caller provides system prompt and user message.
   * Returns the LLM response content string, or a placeholder if no LLM.
   */
  async processMessage(systemPrompt: string, message: string): Promise<string> {
    const primary = this.getPrimary();
    if (!primary) {
      throw new Error('No primary agent exists. Create one first.');
    }

    // Add user message to history
    primary.addMessage('user', message);

    // If no LLM manager, return placeholder
    if (!this.llmManager) {
      const response = `[No LLM configured] Received: ${message}`;
      primary.addMessage('assistant', response);
      return response;
    }

    // Build messages: system prompt + user/assistant history
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...primary.getMessages(),
    ];

    // Call LLM with full message history
    const llmResponse: LLMResponse = await this.llmManager.chat(messages);

    // Add response to history
    primary.addMessage('assistant', llmResponse.content);

    return llmResponse.content;
  }

  /**
   * Stream a message through the primary agent.
   * Caller provides system prompt and user message.
   * Returns an async iterable of LLMStreamEvents.
   */
  async *streamMessage(systemPrompt: string, message: string): AsyncIterable<LLMStreamEvent> {
    const primary = this.getPrimary();
    if (!primary) {
      throw new Error('No primary agent exists. Create one first.');
    }

    // Add user message to history
    primary.addMessage('user', message);

    // If no LLM manager, yield placeholder
    if (!this.llmManager) {
      const response = `[No LLM configured] Received: ${message}`;
      primary.addMessage('assistant', response);
      yield { type: 'text', text: response };
      yield {
        type: 'done',
        response: {
          content: response,
          tool_calls: [],
          usage: { input_tokens: 0, output_tokens: 0 },
          model: 'none',
          finish_reason: 'stop',
        },
      };
      return;
    }

    // Build messages: system prompt + user/assistant history
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...primary.getMessages(),
    ];

    // Stream from LLM
    yield* this.llmManager.stream(messages);
  }

  /**
   * Heartbeat: let the primary agent check for proactive actions.
   * Caller provides the full system prompt (including heartbeat instructions).
   */
  async heartbeat(systemPrompt: string): Promise<string | null> {
    const primary = this.getPrimary();
    if (!primary || !this.llmManager) {
      return null;
    }

    // Build messages: system prompt + history
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...primary.getMessages(),
    ];

    // Call LLM
    const llmResponse: LLMResponse = await this.llmManager.chat(messages);

    // If response is meaningful, add to history and return
    if (llmResponse.content && llmResponse.content.trim().length > 0) {
      primary.addMessage('assistant', llmResponse.content);
      return llmResponse.content;
    }

    return null;
  }
}
