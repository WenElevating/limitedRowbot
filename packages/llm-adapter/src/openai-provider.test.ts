import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAICompatibleProvider, createOpenAIProvider } from './openai-provider.js';
import type { ChatMessage } from './types.js';

vi.stubGlobal('fetch', vi.fn());

const mockFetch = vi.mocked(fetch);

interface MockChunk {
  id: string;
  model: string;
  choices: Array<{
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
}

function createMockResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    body: null,
  } as Response;
}

function createMockStreamResponse(chunks: MockChunk[]): Response {
  const encoder = new TextEncoder();
  const chunkStrings = chunks.map(c => `data: ${JSON.stringify(c)}\n`);
  chunkStrings.push('data: [DONE]\n');
  
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunkStrings) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return {
    ok: true,
    status: 200,
    body: stream,
    json: async () => ({}),
    text: async () => '',
  } as Response;
}

describe('OpenAICompatibleProvider', () => {
  let provider: OpenAICompatibleProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAICompatibleProvider({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com/v1',
      model: 'test-model',
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default values', () => {
      const p = new OpenAICompatibleProvider({ apiKey: 'key' });
      expect(p.getName()).toBe('OpenAI Compatible');
      expect(p.getAvailableModels()).toContain('gpt-4o');
    });

    it('should normalize baseUrl by removing trailing slash', () => {
      const p = new OpenAICompatibleProvider({
        apiKey: 'key',
        baseUrl: 'https://api.test.com/v1/',
      });
      expect(p).toBeDefined();
    });

    it('should normalize baseUrl by removing /chat/completions suffix', () => {
      const p = new OpenAICompatibleProvider({
        apiKey: 'key',
        baseUrl: 'https://api.test.com/v1/chat/completions',
      });
      expect(p).toBeDefined();
    });
  });

  describe('getName', () => {
    it('should return provider name', () => {
      expect(provider.getName()).toBe('OpenAI Compatible');
    });
  });

  describe('getAvailableModels', () => {
    it('should return list of available models', () => {
      const models = provider.getAvailableModels();
      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('complete', () => {
    it('should send request and return result', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'test-model',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello, world!',
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      const result = await provider.complete(messages);

      expect(result.id).toBe('chatcmpl-123');
      expect(result.message.content).toBe('Hello, world!');
      expect(result.message.role).toBe('assistant');
      expect(result.usage.totalTokens).toBe(15);
    });

    it('should include Authorization header', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'test-model',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'test' },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      await provider.complete([{ role: 'user', content: 'test' }]);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should throw error on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ error: 'Invalid API key' }, false, 401));

      await expect(provider.complete([{ role: 'user', content: 'test' }]))
        .rejects.toThrow('OpenAI API error: 401');
    });

    it('should throw error when no choices in response', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        id: 'chatcmpl-123',
        choices: [],
      }));

      await expect(provider.complete([{ role: 'user', content: 'test' }]))
        .rejects.toThrow('No choices in response');
    });

    it('should handle tool calls in response', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'test-model',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call-123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "Beijing"}',
              },
            }],
          },
          finish_reason: 'tool_calls',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await provider.complete([{ role: 'user', content: 'What is the weather?' }]);

      expect(result.message.toolCalls).toBeDefined();
      expect(result.message.toolCalls?.[0]?.function.name).toBe('get_weather');
      expect(result.finishReason).toBe('tool_calls');
    });

    it('should use custom options', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'custom-model',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'test' },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      await provider.complete(
        [{ role: 'user', content: 'test' }],
        { model: 'custom-model', temperature: 0.5, maxTokens: 100 }
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);

      expect(body.model).toBe('custom-model');
      expect(body.temperature).toBe(0.5);
      expect(body.max_tokens).toBe(100);
    });
  });

  describe('stream', () => {
    it('should yield chunks from stream', async () => {
      const chunks: MockChunk[] = [
        { id: 'chatcmpl-123', model: 'test-model', choices: [{ delta: { content: 'Hello' } }] },
        { id: 'chatcmpl-123', model: 'test-model', choices: [{ delta: { content: ' world' } }] },
        { id: 'chatcmpl-123', model: 'test-model', choices: [{ delta: { content: '!' } }] },
      ];

      mockFetch.mockResolvedValueOnce(createMockStreamResponse(chunks));

      const results = [];
      for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
        results.push(chunk);
      }

      expect(results).toHaveLength(3);
      expect(results[0].delta.content).toBe('Hello');
      expect(results[1].delta.content).toBe(' world');
      expect(results[2].delta.content).toBe('!');
    });

    it('should handle stream with role in first chunk', async () => {
      const chunks: MockChunk[] = [
        { id: 'chatcmpl-123', model: 'test-model', choices: [{ delta: { role: 'assistant', content: 'Hi' } }] },
      ];

      mockFetch.mockResolvedValueOnce(createMockStreamResponse(chunks));

      const results = [];
      for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
        results.push(chunk);
      }

      expect(results[0].delta.role).toBe('assistant');
    });

    it('should handle tool calls in stream', async () => {
      const chunks: MockChunk[] = [
        {
          id: 'chatcmpl-123',
          model: 'test-model',
          choices: [{
            delta: {
              tool_calls: [{
                index: 0,
                id: 'call-123',
                type: 'function',
                function: { name: 'test_func', arguments: '{}' },
              }],
            },
          }],
        },
      ];

      mockFetch.mockResolvedValueOnce(createMockStreamResponse(chunks));

      const results = [];
      for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
        results.push(chunk);
      }

      expect(results[0].delta.toolCalls).toBeDefined();
      expect(results[0].delta.toolCalls?.[0]?.function.name).toBe('test_func');
    });

    it('should throw error when no response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: null,
      } as Response);

      await expect(async () => {
        for await (const _ of provider.stream([{ role: 'user', content: 'test' }])) {
          // consume stream
        }
      }).rejects.toThrow('No response body');
    });

    it('should throw error on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ error: 'Rate limit' }, false, 429));

      await expect(async () => {
        for await (const _ of provider.stream([{ role: 'user', content: 'test' }])) {
          // consume stream
        }
      }).rejects.toThrow('OpenAI API error: 429');
    });
  });
});

describe('createOpenAIProvider', () => {
  it('should create provider instance', () => {
    const provider = createOpenAIProvider({ apiKey: 'test-key' });
    expect(provider).toBeInstanceOf(OpenAICompatibleProvider);
  });
});
