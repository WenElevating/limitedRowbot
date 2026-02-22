import type { Tool, ToolResult, ToolContext, ToolDefinition } from './types.js';
import type { PermissionGuard, PermissionRequest, RiskLevel } from '@robot/permission-system';
import { createToolValidator, type ToolValidator } from './tool-validator.js';
import { createRateLimiter, type RateLimiter } from './rate-limiter.js';

export interface OrchestratorConfig {
  maxParallelCalls?: number;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

export interface ExecutionRequest {
  toolName: string;
  params: Record<string, unknown>;
  context: ToolContext;
}

export interface ExecutionResult {
  success: boolean;
  result?: ToolResult;
  error?: string;
  duration: number;
  retries: number;
}

export interface OrchestratorEvents {
  onBeforeExecute?: (request: ExecutionRequest) => Promise<boolean>;
  onAfterExecute?: (request: ExecutionRequest, result: ExecutionResult) => void;
  onPermissionRequired?: (request: PermissionRequest) => Promise<boolean>;
  onRateLimited?: (toolName: string, retryAfter: number) => void;
}

export interface ToolOrchestrator {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
  executeParallel(requests: ExecutionRequest[]): Promise<ExecutionResult[]>;
  registerTool(tool: Tool): void;
  getToolDefinitions(): ToolDefinition[];
  setPermissionGuard(guard: PermissionGuard): void;
  setEvents(events: OrchestratorEvents): void;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  maxParallelCalls: 5,
  timeout: 30000,
  retryCount: 2,
  retryDelay: 1000,
};

export function createToolOrchestrator(
  config: OrchestratorConfig = {}
): ToolOrchestrator {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const tools = new Map<string, Tool>();
  const validator = createToolValidator(tools);
  const rateLimiter = createRateLimiter();
  
  let permissionGuard: PermissionGuard | null = null;
  let events: OrchestratorEvents = {};
  
  async function checkPermission(
    tool: Tool,
    params: Record<string, unknown>
  ): Promise<boolean> {
    if (!permissionGuard) return true;
    
    const targetValue = params.path ?? params.target ?? params.command;
    const target = typeof targetValue === 'string' ? targetValue : undefined;
    
    const request: PermissionRequest = {
      toolName: tool.name,
      action: tool.name,
      target,
      riskLevel: tool.riskLevel,
      description: tool.description,
      data: params,
    };
    
    const result = await permissionGuard.evaluate(request);
    
    if (!result.granted && events.onPermissionRequired) {
      return events.onPermissionRequired(request);
    }
    
    return result.granted;
  }
  
  async function executeWithRetry(
    request: ExecutionRequest,
    retriesLeft: number
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const tool = tools.get(request.toolName);
    
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${request.toolName}`,
        duration: Date.now() - startTime,
        retries: 0,
      };
    }
    
    const validation = validator.validate(request.toolName, request.params);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
        duration: Date.now() - startTime,
        retries: 0,
      };
    }
    
    const rateLimit = rateLimiter.check(request.toolName);
    if (!rateLimit.allowed) {
      if (events.onRateLimited) {
        events.onRateLimited(request.toolName, rateLimit.retryAfter ?? 1000);
      }
      return {
        success: false,
        error: `Rate limited. Retry after ${rateLimit.retryAfter}ms`,
        duration: Date.now() - startTime,
        retries: 0,
      };
    }
    
    const hasPermission = await checkPermission(tool, request.params);
    if (!hasPermission) {
      return {
        success: false,
        error: 'Permission denied',
        duration: Date.now() - startTime,
        retries: 0,
      };
    }
    
    if (events.onBeforeExecute) {
      const shouldContinue = await events.onBeforeExecute(request);
      if (!shouldContinue) {
        return {
          success: false,
          error: 'Execution cancelled by callback',
          duration: Date.now() - startTime,
          retries: 0,
        };
      }
    }
    
    try {
      rateLimiter.record(request.toolName);
      
      const result = await Promise.race([
        tool.execute(request.params, request.context),
        new Promise<ToolResult>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), finalConfig.timeout)
        ),
      ]);
      
      const executionResult: ExecutionResult = {
        success: result.success,
        result,
        duration: Date.now() - startTime,
        retries: finalConfig.retryCount! - retriesLeft,
      };
      
      if (events.onAfterExecute) {
        events.onAfterExecute(request, executionResult);
      }
      
      return executionResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (retriesLeft > 0 && !errorMessage.includes('Permission') && !errorMessage.includes('Validation')) {
        await new Promise(resolve => setTimeout(resolve, finalConfig.retryDelay));
        return executeWithRetry(request, retriesLeft - 1);
      }
      
      const executionResult: ExecutionResult = {
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
        retries: finalConfig.retryCount! - retriesLeft,
      };
      
      if (events.onAfterExecute) {
        events.onAfterExecute(request, executionResult);
      }
      
      return executionResult;
    }
  }
  
  return {
    async execute(request: ExecutionRequest): Promise<ExecutionResult> {
      return executeWithRetry(request, finalConfig.retryCount!);
    },
    
    async executeParallel(requests: ExecutionRequest[]): Promise<ExecutionResult[]> {
      const batches: ExecutionRequest[][] = [];
      for (let i = 0; i < requests.length; i += finalConfig.maxParallelCalls!) {
        batches.push(requests.slice(i, i + finalConfig.maxParallelCalls!));
      }
      
      const results: ExecutionResult[] = [];
      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map(req => this.execute(req))
        );
        results.push(...batchResults);
      }
      
      return results;
    },
    
    registerTool(tool: Tool): void {
      tools.set(tool.name, tool);
    },
    
    getToolDefinitions(): ToolDefinition[] {
      return Array.from(tools.values()).map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
    },
    
    setPermissionGuard(guard: PermissionGuard): void {
      permissionGuard = guard;
    },
    
    setEvents(newEvents: OrchestratorEvents): void {
      events = { ...events, ...newEvents };
    },
  };
}
