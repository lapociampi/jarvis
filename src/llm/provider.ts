export type LLMMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LLMTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
};

export type LLMToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type LLMResponse = {
  content: string;
  tool_calls: LLMToolCall[];
  usage: { input_tokens: number; output_tokens: number };
  model: string;
  finish_reason: 'stop' | 'tool_use' | 'length' | 'error';
};

export type LLMStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; tool_call: LLMToolCall }
  | { type: 'done'; response: LLMResponse }
  | { type: 'error'; error: string };

export type LLMOptions = {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: LLMTool[];
  stream?: boolean;
};

export interface LLMProvider {
  name: string;
  chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
  stream(messages: LLMMessage[], options?: LLMOptions): AsyncIterable<LLMStreamEvent>;
  listModels(): Promise<string[]>;
}
