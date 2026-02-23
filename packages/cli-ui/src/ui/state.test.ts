import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UIStateManager } from './state.js';

describe('UIStateManager', () => {
  let manager: UIStateManager;

  beforeEach(() => {
    manager = new UIStateManager();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = manager.getState();

      expect(state.header).toEqual([]);
      expect(state.outputBuffer).toEqual([]);
      expect(state.inputValue).toBe('');
      expect(state.cursorPosition).toBe(0);
      expect(state.statusLine).toBe('');
      expect(state.isStreaming).toBe(false);
      expect(state.tokenCount).toBe(0);
      expect(state.startTime).toBeNull();
      expect(state.phase).toBe('idle');
      expect(state.debug).toBe(false);
      expect(state.config).toBeNull();
    });
  });

  describe('setDebug', () => {
    it('should set debug mode', () => {
      manager.setDebug(true);
      expect(manager.getState().debug).toBe(true);

      manager.setDebug(false);
      expect(manager.getState().debug).toBe(false);
    });

    it('should emit state change', () => {
      const subscriber = vi.fn();
      manager.subscribe(subscriber);

      manager.setDebug(true);

      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(subscriber).toHaveBeenCalledWith(expect.objectContaining({ debug: true }));
    });
  });

  describe('setConfig', () => {
    it('should set config', () => {
      manager.setConfig('glm', 'glm-4-flash');

      const config = manager.getState().config;
      expect(config).toEqual({ provider: 'glm', model: 'glm-4-flash' });
    });

    it('should emit state change', () => {
      const subscriber = vi.fn();
      manager.subscribe(subscriber);

      manager.setConfig('openai', 'gpt-4');

      expect(subscriber).toHaveBeenCalledTimes(1);
    });
  });

  describe('setPhase', () => {
    it('should set phase', () => {
      manager.setPhase('conversation');
      expect(manager.getState().phase).toBe('conversation');

      manager.setPhase('idle');
      expect(manager.getState().phase).toBe('idle');
    });
  });

  describe('input handling', () => {
    it('should set input value', () => {
      manager.setInputValue('hello');
      expect(manager.getState().inputValue).toBe('hello');
    });

    it('should set cursor position', () => {
      manager.setCursorPosition(3);
      expect(manager.getState().cursorPosition).toBe(3);
    });

    it('should set input with cursor', () => {
      manager.setInput('test', 2);
      const state = manager.getState();

      expect(state.inputValue).toBe('test');
      expect(state.cursorPosition).toBe(2);
    });

    it('should append to input value', () => {
      manager.setInputValue('hel');
      manager.appendInputValue('lo');
      expect(manager.getState().inputValue).toBe('hello');
    });

    it('should backspace input', () => {
      manager.setInputValue('hello');
      manager.backspace();
      expect(manager.getState().inputValue).toBe('hell');
    });

    it('should clear input and return previous value', () => {
      manager.setInputValue('test');
      const cleared = manager.clearInput();

      expect(cleared).toBe('test');
      expect(manager.getState().inputValue).toBe('');
    });
  });

  describe('streaming', () => {
    it('should start streaming', () => {
      manager.startStreaming();
      const state = manager.getState();

      expect(state.isStreaming).toBe(true);
      expect(state.startTime).not.toBeNull();
      expect(state.tokenCount).toBe(0);
    });

    it('should stop streaming', () => {
      manager.startStreaming();
      manager.stopStreaming();

      expect(manager.getState().isStreaming).toBe(false);
    });

    it('should add tokens', () => {
      manager.addToken(10);
      expect(manager.getState().tokenCount).toBe(10);

      manager.addToken(5);
      expect(manager.getState().tokenCount).toBe(15);
    });

    it('should add default 1 token', () => {
      manager.addToken();
      expect(manager.getState().tokenCount).toBe(1);
    });

    it('should reset token count when starting streaming', () => {
      manager.addToken(100);
      manager.startStreaming();

      expect(manager.getState().tokenCount).toBe(0);
    });
  });

  describe('output handling', () => {
    it('should append output', () => {
      manager.appendOutput('line1');
      manager.appendOutput('line2');

      expect(manager.getState().outputBuffer).toEqual(['line1', 'line2']);
    });

    it('should split output by newlines', () => {
      manager.appendOutput('line1\nline2\nline3');

      expect(manager.getState().outputBuffer).toEqual(['line1', 'line2', 'line3']);
    });

    it('should append to last line', () => {
      manager.appendOutput('hello');
      manager.appendToLastLine(' world');

      expect(manager.getState().outputBuffer).toEqual(['hello world']);
    });

    it('should create new line if buffer is empty', () => {
      manager.appendToLastLine('test');

      expect(manager.getState().outputBuffer).toEqual(['test']);
    });

    it('should add new line', () => {
      manager.appendOutput('line1');
      manager.newLine();

      expect(manager.getState().outputBuffer).toEqual(['line1', '']);
    });

    it('should clear output', () => {
      manager.appendOutput('line1');
      manager.appendOutput('line2');
      manager.clearOutput();

      expect(manager.getState().outputBuffer).toEqual([]);
    });
  });

  describe('status line', () => {
    it('should set status line', () => {
      manager.setStatusLine('thinking');
      expect(manager.getState().statusLine).toBe('thinking');
    });
  });

  describe('elapsed time', () => {
    it('should return 0 if not started', () => {
      expect(manager.getElapsedTime()).toBe(0);
    });

    it('should return elapsed time after starting', () => {
      manager.startStreaming();
      const elapsed = manager.getElapsedTime();

      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('subscribe', () => {
    it('should notify subscribers on state change', () => {
      const subscriber1 = vi.fn();
      const subscriber2 = vi.fn();

      manager.subscribe(subscriber1);
      manager.subscribe(subscriber2);

      manager.setDebug(true);

      expect(subscriber1).toHaveBeenCalledTimes(1);
      expect(subscriber2).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', () => {
      const subscriber = vi.fn();
      const unsubscribe = manager.subscribe(subscriber);

      manager.setDebug(true);
      expect(subscriber).toHaveBeenCalledTimes(1);

      unsubscribe();

      manager.setDebug(false);
      expect(subscriber).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple subscribers', () => {
      const subscribers = [vi.fn(), vi.fn(), vi.fn()];

      subscribers.forEach(s => manager.subscribe(s));

      manager.setPhase('conversation');

      subscribers.forEach(s => {
        expect(s).toHaveBeenCalledTimes(1);
      });
    });
  });
});
