import { describe, it, expect } from 'vitest';
import { GlmProvider, createGlmProvider, GLM_MODELS, GLM_BASE_URL } from './glm-provider.js';

describe('GLM_MODELS', () => {
  it('should contain expected models', () => {
    expect(GLM_MODELS).toContain('glm-4-flash');
    expect(GLM_MODELS).toContain('glm-4-plus');
    expect(GLM_MODELS).toContain('glm-4-long');
    expect(GLM_MODELS.length).toBeGreaterThan(5);
  });
});

describe('GLM_BASE_URL', () => {
  it('should be defined', () => {
    expect(GLM_BASE_URL).toBe('https://open.bigmodel.cn/api/paas/v4');
  });
});

describe('GlmProvider', () => {
  describe('constructor', () => {
    it('should create instance with default config', () => {
      const provider = new GlmProvider({ apiKey: 'test-key' });
      expect(provider).toBeDefined();
    });

    it('should use default GLM base URL', () => {
      const provider = new GlmProvider({ apiKey: 'test-key' });
      expect(provider.getName()).toBe('GLM (智谱 AI)');
    });

    it('should allow custom base URL', () => {
      const provider = new GlmProvider({
        apiKey: 'test-key',
        baseUrl: 'https://custom.glm.api',
      });
      expect(provider).toBeDefined();
    });

    it('should use default model if not specified', () => {
      const provider = new GlmProvider({ apiKey: 'test-key' });
      expect(provider).toBeDefined();
    });

    it('should accept custom model', () => {
      const provider = new GlmProvider({
        apiKey: 'test-key',
        model: 'glm-4-plus',
      });
      expect(provider).toBeDefined();
    });
  });

  describe('getName', () => {
    it('should return GLM provider name', () => {
      const provider = new GlmProvider({ apiKey: 'test-key' });
      expect(provider.getName()).toBe('GLM (智谱 AI)');
    });
  });

  describe('getAvailableModels', () => {
    it('should return all GLM models', () => {
      const provider = new GlmProvider({ apiKey: 'test-key' });
      const models = provider.getAvailableModels();

      expect(models).toEqual([...GLM_MODELS]);
      expect(models.length).toBe(GLM_MODELS.length);
    });

    it('should return a copy of models array', () => {
      const provider = new GlmProvider({ apiKey: 'test-key' });
      const models1 = provider.getAvailableModels();
      const models2 = provider.getAvailableModels();

      expect(models1).not.toBe(models2);
      expect(models1).toEqual(models2);
    });
  });
});

describe('createGlmProvider', () => {
  it('should create GlmProvider instance', () => {
    const provider = createGlmProvider({ apiKey: 'test-key' });
    expect(provider).toBeInstanceOf(GlmProvider);
  });

  it('should return LLMProvider interface', () => {
    const provider = createGlmProvider({ apiKey: 'test-key' });

    expect(provider.getName).toBeDefined();
    expect(provider.getAvailableModels).toBeDefined();
    expect(provider.complete).toBeDefined();
    expect(provider.stream).toBeDefined();
  });
});
