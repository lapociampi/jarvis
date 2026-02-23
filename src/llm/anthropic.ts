import type {
  LLMProvider,
  LLMMessage,
  LLMOptions,
  LLMResponse,
  LLMStreamEvent,
  LLMTool,
  LLMToolCall,
} from './provider.ts';

type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; [key: string]: unknown }>;
};

type AnthropicToolDef = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

type AnthropicToolUse = {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
};

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | AnthropicToolUse;

type AnthropicResponse = {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'tool_use' | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

type AnthropicStreamEvent =
  | { type: 'message_start'; message: Partial<AnthropicResponse> }
  | { type: 'content_block_start'; index: number; content_block: AnthropicContentBlock }
  | { type: 'content_block_delta'; index: number; delta: { type: 'text_delta'; text: string } | { type: 'input_json_delta'; partial_json: string } }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: { stop_reason: string; usage?: { output_tokens: number } } }
  | { type: 'message_stop' }
  | { type: 'error'; error: { type: string; message: string } };

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private apiKey: string;
  private defaultModel: string;
  private apiUrl = 'https://api.anthropic.com/v1/messages';

  constructor(apiKey: string, defaultModel = 'claude-sonnet-4-5-20250929') {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  async chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const { model = this.defaultModel, temperature, max_tokens = 4096, tools } = options;

    const { system, messages: anthropicMessages } = this.convertMessages(messages);
    const body: Record<string, unknown> = {
      model,
      messages: anthropicMessages,
      max_tokens,
    };

    if (system) body.system = system;
    if (temperature !== undefined) body.temperature = temperature;
    if (tools && tools.length > 0) {
      body.tools = this.convertTools(tools);
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as AnthropicResponse;
    return this.convertResponse(data);
  }

  async *stream(messages: LLMMessage[], options: LLMOptions = {}): AsyncIterable<LLMStreamEvent> {
    const { model = this.defaultModel, temperature, max_tokens = 4096, tools } = options;

    const { system, messages: anthropicMessages } = this.convertMessages(messages);
    const body: Record<string, unknown> = {
      model,
      messages: anthropicMessages,
      max_tokens,
      stream: true,
    };

    if (system) body.system = system;
    if (temperature !== undefined) body.temperature = temperature;
    if (tools && tools.length > 0) {
      body.tools = this.convertTools(tools);
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      yield { type: 'error', error: `Anthropic API error (${response.status}): ${errorText}` };
      return;
    }

    if (!response.body) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    let accumulatedText = '';
    const toolCalls: LLMToolCall[] = [];
    let currentToolCall: { id: string; name: string; input_json: string } | null = null;
    let stopReason: string | null = null;
    let usage = { input_tokens: 0, output_tokens: 0 };
    let responseModel = model;

    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data) as AnthropicStreamEvent;

            if (event.type === 'message_start' && event.message.usage) {
              usage.input_tokens = event.message.usage.input_tokens;
              if (event.message.model) responseModel = event.message.model;
            } else if (event.type === 'content_block_start') {
              if (event.content_block.type === 'tool_use') {
                currentToolCall = {
                  id: event.content_block.id,
                  name: event.content_block.name,
                  input_json: '',
                };
              }
            } else if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                accumulatedText += event.delta.text;
                yield { type: 'text', text: event.delta.text };
              } else if (event.delta.type === 'input_json_delta' && currentToolCall) {
                currentToolCall.input_json += event.delta.partial_json;
              }
            } else if (event.type === 'content_block_stop' && currentToolCall) {
              try {
                const toolCall: LLMToolCall = {
                  id: currentToolCall.id,
                  name: currentToolCall.name,
                  arguments: JSON.parse(currentToolCall.input_json),
                };
                toolCalls.push(toolCall);
                yield { type: 'tool_call', tool_call: toolCall };
              } catch (err) {
                yield { type: 'error', error: `Failed to parse tool call arguments: ${err}` };
              }
              currentToolCall = null;
            } else if (event.type === 'message_delta') {
              stopReason = event.delta.stop_reason;
              if (event.delta.usage) {
                usage.output_tokens = event.delta.usage.output_tokens;
              }
            } else if (event.type === 'error') {
              yield { type: 'error', error: `${event.error.type}: ${event.error.message}` };
              return;
            }
          } catch (err) {
            // Skip invalid JSON lines
            console.error('Failed to parse SSE event:', err);
          }
        }
      }

      const finishReason = this.mapStopReason(stopReason);
      yield {
        type: 'done',
        response: {
          content: accumulatedText,
          tool_calls: toolCalls,
          usage,
          model: responseModel,
          finish_reason: finishReason,
        },
      };
    } catch (err) {
      yield { type: 'error', error: `Stream error: ${err}` };
    }
  }

  async listModels(): Promise<string[]> {
    // Anthropic doesn't have a models endpoint, so return known models
    return [
      'claude-opus-4-6',
      'claude-sonnet-4-5-20250929',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];
  }

  private convertMessages(messages: LLMMessage[]): {
    system?: string;
    messages: AnthropicMessage[];
  } {
    const systemMessages = messages.filter(m => m.role === 'system');
    const system = systemMessages.map(m => m.content).join('\n\n') || undefined;

    const anthropicMessages: AnthropicMessage[] = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role,
        content: m.content,
      }));

    return { system, messages: anthropicMessages };
  }

  private convertTools(tools: LLMTool[]): AnthropicToolDef[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  private convertResponse(response: AnthropicResponse): LLMResponse {
    let content = '';
    const tool_calls: LLMToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        tool_calls.push({
          id: block.id,
          name: block.name,
          arguments: block.input,
        });
      }
    }

    return {
      content,
      tool_calls,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
      model: response.model,
      finish_reason: this.mapStopReason(response.stop_reason),
    };
  }

  private mapStopReason(stopReason: string | null): 'stop' | 'tool_use' | 'length' | 'error' {
    switch (stopReason) {
      case 'end_turn':
        return 'stop';
      case 'tool_use':
        return 'tool_use';
      case 'max_tokens':
        return 'length';
      default:
        return 'stop';
    }
  }
}
