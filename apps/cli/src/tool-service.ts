import {
  createToolOrchestrator,
  createToolRegistry,
  registerFileTools,
  registerShellTools,
  type ToolOrchestrator,
  type ExecutionRequest,
  type ExecutionResult,
} from '@robot/tool-system';
import {
  createEnhancedPermissionGuard,
  formatPermissionRequest,
  type PermissionRequest,
  type EnhancedPermissionConfig,
} from '@robot/permission-system';
import { createBrowserAdapter, createBrowserTools } from '@robot/browser-adapter';
import { createFileAdapter, createShellAdapter } from '@robot/windows-adapter';
import type { TerminalUI } from '@robot/cli-ui';

export interface ToolServiceConfig {
  permissionConfig?: EnhancedPermissionConfig;
  workingDirectory?: string;
}

export interface ToolService {
  initialize(): Promise<void>;
  execute(toolName: string, params: Record<string, unknown>, taskId: string): Promise<ExecutionResult>;
  getToolDefinitions(): { name: string; description: string; parameters: unknown }[];
  getOrchestrator(): ToolOrchestrator;
}

export function createToolService(
  ui: TerminalUI,
  config: ToolServiceConfig = {}
): ToolService {
  const registry = createToolRegistry();
  const orchestrator = createToolOrchestrator({
    maxParallelCalls: 3,
    timeout: 30000,
    retryCount: 1,
  });

  const permissionGuard = createEnhancedPermissionGuard(config.permissionConfig);
  
  permissionGuard.setCallback(async (request: PermissionRequest) => {
    const message = formatPermissionRequest(request);
    ui.showStep('权限确认', ` - ${request.toolName}`);
    ui.showStepResult(message);
    
    return new Promise((resolve) => {
      const handleInput = async (input: string) => {
        const confirmed = input.toLowerCase() === 'y' || input.toLowerCase() === 'yes';
        resolve(confirmed);
      };
      
      ui.showStepResult('请输入 Y 确认，或 N 拒绝:');
      
      ui.onInput(async (input) => {
        handleInput(input);
      });
    });
  });

  orchestrator.setPermissionGuard(permissionGuard);
  
  orchestrator.setEvents({
    onBeforeExecute: async (request: ExecutionRequest) => {
      ui.showStep('执行工具', ` - ${request.toolName}`);
      return true;
    },
    onAfterExecute: (request: ExecutionRequest, result: ExecutionResult) => {
      if (result.success) {
        ui.showStepResult(`✓ ${request.toolName} 完成 (${result.duration}ms)`);
      } else {
        ui.showStepResult(`✗ ${request.toolName} 失败: ${result.error}`);
      }
    },
    onRateLimited: (toolName: string, retryAfter: number) => {
      ui.showError(`工具 ${toolName} 被限流，请 ${retryAfter}ms 后重试`);
    },
  });

  let initialized = false;

  return {
    async initialize(): Promise<void> {
      if (initialized) return;
      
      const fileAdapter = createFileAdapter();
      const shellAdapter = createShellAdapter();
      const browserAdapter = createBrowserAdapter();

      registerFileTools(registry, fileAdapter);
      registerShellTools(registry, shellAdapter);

      const browserTools = createBrowserTools();
      for (const tool of browserTools) {
        const boundTool = {
          ...tool,
          execute: async (params: Record<string, unknown>) => {
            if (tool.name === 'browser_open' || tool.name === 'browser_navigate') {
              const result = await browserAdapter.open(params.url as string);
              return {
                success: result.success,
                data: result.data,
                error: result.error,
              };
            }
            return { success: false, error: 'Unknown browser tool' };
          },
        };
        registry.register(boundTool);
        orchestrator.registerTool(boundTool);
      }

      for (const tool of registry.getAll()) {
        orchestrator.registerTool(tool);
      }

      initialized = true;
    },

    async execute(
      toolName: string,
      params: Record<string, unknown>,
      taskId: string
    ): Promise<ExecutionResult> {
      const request: ExecutionRequest = {
        toolName,
        params,
        context: {
          taskId,
          workingDirectory: config.workingDirectory,
        },
      };

      return orchestrator.execute(request);
    },

    getToolDefinitions() {
      return orchestrator.getToolDefinitions().map(def => ({
        name: def.function.name,
        description: def.function.description,
        parameters: def.function.parameters,
      }));
    },

    getOrchestrator() {
      return orchestrator;
    },
  };
}
