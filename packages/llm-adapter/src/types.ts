export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description?: string;
        enum?: string[];
      }>;
      required?: string[];
    };
  };
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  responseFormat?: { type: 'json_object' | 'text' };
}

export interface ChatCompletionResult {
  id: string;
  model: string;
  message: ChatMessage;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProvider {
  complete(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<ChatCompletionResult>;
  stream?(messages: ChatMessage[], options?: ChatCompletionOptions): AsyncIterable<ChatCompletionChunk>;
  getName(): string;
  getAvailableModels(): string[];
}

export interface ChatCompletionChunk {
  id: string;
  delta: {
    role?: string;
    content?: string;
    toolCalls?: Partial<ToolCall>[];
  };
  finishReason?: string;
}

export interface LLMConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}
