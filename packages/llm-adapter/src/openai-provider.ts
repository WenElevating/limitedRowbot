import type {
  LLMProvider,
  LLMConfig,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatCompletionChunk,
  ToolDefinition,
} from './types.js';

interface OpenAIChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

function normalizeBaseUrl(url: string): string {
  let normalized = url.trim();
  
  if (normalized.endsWith('/chat/completions')) {
    normalized = normalized.replace(/\/chat\/completions$/, '');
  }
  if (normalized.endsWith('/chat/compleions')) {
    normalized = normalized.replace(/\/chat\/compleions$/, '');
  }
  if (normalized.endsWith('/completions')) {
    normalized = normalized.replace(/\/completions$/, '');
  }
  
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  
  return normalized;
}

function getApiEndpoint(baseUrl: string): string {
  return `${baseUrl}/chat/completions`;
}

export class OpenAICompatibleProvider implements LLMProvider {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private temperature: number;
  private maxTokens: number;
  private timeout: number;

  constructor(config: LLMConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = normalizeBaseUrl(config.baseUrl ?? 'https://api.openai.com/v1');
    this.defaultModel = config.model ?? 'gpt-4o';
    this.temperature = config.temperature ?? 0.95;
    this.maxTokens = config.maxTokens ?? 4096;
    this.timeout = config.timeout ?? 300000;
  }

  getName(): string {
    return 'OpenAI Compatible';
  }

  getAvailableModels(): string[] {
    return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
  }

  async complete(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResult> {
    const model = options.model ?? this.defaultModel;
    const temperature = options.temperature ?? this.temperature;
    const maxTokens = options.maxTokens ?? this.maxTokens;

    const requestBody: Record<string, unknown> = {
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.name && { name: m.name }),
        ...(m.toolCallId && { tool_call_id: m.toolCallId }),
        ...(m.toolCalls && { tool_calls: m.toolCalls }),
      })),
      temperature,
      max_tokens: maxTokens,
    };

    if (options.tools) {
      requestBody.tools = options.tools;
    }

    if (options.toolChoice) {
      requestBody.tool_choice = options.toolChoice;
    }

    if (options.responseFormat) {
      requestBody.response_format = options.responseFormat;
    }

    const apiEndpoint = getApiEndpoint(this.baseUrl);

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as OpenAIChatCompletionResponse;
    const choice = data.choices[0];

    if (!choice) {
      throw new Error('No choices in response');
    }

    return {
      id: data.id,
      model: data.model,
      message: {
        role: 'assistant',
        content: choice.message.content ?? '',
        toolCalls: choice.message.tool_calls?.map(tc => ({
          id: tc.id,
          type: 'function',
          function: tc.function,
        })),
      },
      finishReason: choice.finish_reason as ChatCompletionResult['finishReason'],
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }

  async *stream(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): AsyncIterable<ChatCompletionChunk> {
    const model = options.model ?? this.defaultModel;
    const temperature = options.temperature ?? this.temperature;
    const maxTokens = options.maxTokens ?? this.maxTokens;

    const requestBody: Record<string, unknown> = {
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.name && { name: m.name }),
        ...(m.toolCallId && { tool_call_id: m.toolCallId }),
        ...(m.toolCalls && { tool_calls: m.toolCalls }),
      })),
      temperature,
      max_tokens: maxTokens,
      stream: true,
    };

    if (options.tools) {
      requestBody.tools = options.tools;
    }

    if (options.toolChoice) {
      requestBody.tool_choice = options.toolChoice;
    }

    const apiEndpoint = getApiEndpoint(this.baseUrl);

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6)) as OpenAIStreamChunk;
          const choice = json.choices[0];
          
          if (choice) {
            const toolCalls = choice.delta.tool_calls?.map(tc => ({
              id: tc.id ?? '',
              type: 'function' as const,
              function: {
                name: tc.function?.name ?? '',
                arguments: tc.function?.arguments ?? '',
              },
            }));
            
            yield {
              id: json.id,
              delta: {
                role: choice.delta.role,
                content: choice.delta.content,
                toolCalls,
              },
              finishReason: choice.finish_reason ?? undefined,
            };
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }
}

export function createOpenAIProvider(config: LLMConfig): LLMProvider {
  return new OpenAICompatibleProvider(config);
}
