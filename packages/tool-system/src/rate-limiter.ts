export interface RateLimitConfig {
  maxCalls: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface RateLimiter {
  check(toolName: string): RateLimitResult;
  record(toolName: string): void;
  getConfig(toolName: string): RateLimitConfig;
  setConfig(toolName: string, config: RateLimitConfig): void;
}

interface ToolRateState {
  calls: number[];
  config: RateLimitConfig;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxCalls: 100,
  windowMs: 60000,
};

const TOOL_SPECIFIC_CONFIGS: Record<string, RateLimitConfig> = {
  shell_execute: { maxCalls: 20, windowMs: 60000 },
  powershell_execute: { maxCalls: 20, windowMs: 60000 },
  file_read: { maxCalls: 200, windowMs: 60000 },
  file_write: { maxCalls: 50, windowMs: 60000 },
  file_delete: { maxCalls: 20, windowMs: 60000 },
};

export function createRateLimiter(): RateLimiter {
  const toolStates = new Map<string, ToolRateState>();
  
  function getState(toolName: string): ToolRateState {
    if (!toolStates.has(toolName)) {
      toolStates.set(toolName, {
        calls: [],
        config: TOOL_SPECIFIC_CONFIGS[toolName] ?? DEFAULT_CONFIG,
      });
    }
    return toolStates.get(toolName)!;
  }
  
  function cleanOldCalls(state: ToolRateState, now: number): void {
    const windowStart = now - state.config.windowMs;
    state.calls = state.calls.filter(time => time > windowStart);
  }
  
  return {
    check(toolName: string): RateLimitResult {
      const now = Date.now();
      const state = getState(toolName);
      
      cleanOldCalls(state, now);
      
      const windowStart = now - state.config.windowMs;
      const firstCall = state.calls[0];
      const resetTime = firstCall !== undefined
        ? firstCall + state.config.windowMs 
        : now + state.config.windowMs;
      
      if (state.calls.length >= state.config.maxCalls) {
        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter: firstCall !== undefined ? firstCall + state.config.windowMs - now : state.config.windowMs,
        };
      }
      
      return {
        allowed: true,
        remaining: state.config.maxCalls - state.calls.length,
        resetTime,
      };
    },
    
    record(toolName: string): void {
      const state = getState(toolName);
      state.calls.push(Date.now());
    },
    
    getConfig(toolName: string): RateLimitConfig {
      return getState(toolName).config;
    },
    
    setConfig(toolName: string, config: RateLimitConfig): void {
      const state = getState(toolName);
      state.config = config;
    },
  };
}
