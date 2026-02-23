import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRateLimiter } from './rate-limiter.js';

describe('createRateLimiter', () => {
  let limiter: ReturnType<typeof createRateLimiter>;

  beforeEach(() => {
    limiter = createRateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('check', () => {
    it('should allow first call', () => {
      const result = limiter.check('test_tool');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should return remaining calls', () => {
      const result = limiter.check('test_tool');

      expect(result.remaining).toBe(100);
    });

    it('should return resetTime', () => {
      const now = Date.now();
      const result = limiter.check('test_tool');

      expect(result.resetTime).toBeGreaterThanOrEqual(now);
    });

    it('should deny calls after limit reached', () => {
      for (let i = 0; i < 100; i++) {
        limiter.record('test_tool');
      }

      const result = limiter.check('test_tool');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should return retryAfter when limit reached', () => {
      for (let i = 0; i < 100; i++) {
        limiter.record('test_tool');
      }

      const result = limiter.check('test_tool');

      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('record', () => {
    it('should record a call', () => {
      limiter.record('test_tool');

      const result = limiter.check('test_tool');
      expect(result.remaining).toBe(99);
    });

    it('should track multiple calls', () => {
      limiter.record('test_tool');
      limiter.record('test_tool');
      limiter.record('test_tool');

      const result = limiter.check('test_tool');
      expect(result.remaining).toBe(97);
    });
  });

  describe('getConfig', () => {
    it('should return default config for unknown tool', () => {
      const config = limiter.getConfig('unknown_tool');

      expect(config.maxCalls).toBe(100);
      expect(config.windowMs).toBe(60000);
    });

    it('should return specific config for shell_execute', () => {
      const config = limiter.getConfig('shell_execute');

      expect(config.maxCalls).toBe(20);
      expect(config.windowMs).toBe(60000);
    });

    it('should return specific config for file_read', () => {
      const config = limiter.getConfig('file_read');

      expect(config.maxCalls).toBe(200);
    });

    it('should return specific config for file_write', () => {
      const config = limiter.getConfig('file_write');

      expect(config.maxCalls).toBe(50);
    });

    it('should return specific config for file_delete', () => {
      const config = limiter.getConfig('file_delete');

      expect(config.maxCalls).toBe(20);
    });
  });

  describe('setConfig', () => {
    it('should set custom config', () => {
      limiter.setConfig('custom_tool', { maxCalls: 10, windowMs: 30000 });

      const config = limiter.getConfig('custom_tool');

      expect(config.maxCalls).toBe(10);
      expect(config.windowMs).toBe(30000);
    });

    it('should override existing config', () => {
      limiter.setConfig('shell_execute', { maxCalls: 5, windowMs: 10000 });

      const config = limiter.getConfig('shell_execute');

      expect(config.maxCalls).toBe(5);
      expect(config.windowMs).toBe(10000);
    });
  });

  describe('window expiration', () => {
    it('should allow calls after window expires', () => {
      for (let i = 0; i < 100; i++) {
        limiter.record('test_tool');
      }

      let result = limiter.check('test_tool');
      expect(result.allowed).toBe(false);

      vi.advanceTimersByTime(60001);

      result = limiter.check('test_tool');
      expect(result.allowed).toBe(true);
    });

    it('should clean old calls', () => {
      limiter.record('test_tool');
      limiter.record('test_tool');

      vi.advanceTimersByTime(30000);

      limiter.record('test_tool');

      vi.advanceTimersByTime(31000);

      const result = limiter.check('test_tool');

      expect(result.remaining).toBe(99);
    });
  });

  describe('per-tool isolation', () => {
    it('should track different tools separately', () => {
      limiter.record('tool_a');
      limiter.record('tool_a');
      limiter.record('tool_b');

      const resultA = limiter.check('tool_a');
      const resultB = limiter.check('tool_b');

      expect(resultA.remaining).toBe(98);
      expect(resultB.remaining).toBe(99);
    });

    it('should allow different configs per tool', () => {
      limiter.setConfig('tool_a', { maxCalls: 5, windowMs: 10000 });
      limiter.setConfig('tool_b', { maxCalls: 50, windowMs: 60000 });

      expect(limiter.getConfig('tool_a').maxCalls).toBe(5);
      expect(limiter.getConfig('tool_b').maxCalls).toBe(50);
    });
  });
});
