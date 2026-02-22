import type { Tool, ToolResult, ToolContext } from './types.js';
import { RiskLevel } from '@robot/permission-system';
import { createShellAdapter, type ShellAdapter } from '@robot/windows-adapter';

interface ShellExecuteParams {
  command: string;
  args?: string[];
  cwd?: string;
  timeout?: number;
}

interface PowerShellExecuteParams {
  script: string;
}

const DANGEROUS_COMMANDS = [
  'format',
  'del /s',
  'rmdir /s',
  'rd /s',
  'erase',
  'cipher',
  'diskpart',
  'bcdedit',
  'reg delete',
];

function isCommandDangerous(command: string): boolean {
  const lowerCommand = command.toLowerCase();
  return DANGEROUS_COMMANDS.some(dangerous => lowerCommand.includes(dangerous));
}

export function createShellTool(shellAdapter: ShellAdapter = createShellAdapter()): Tool<ShellExecuteParams> {
  return {
    name: 'shell_execute',
    description: 'Execute a shell command on the system. Use with caution.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The command to execute',
        },
        args: {
          type: 'array',
          description: 'Arguments to pass to the command',
          items: {
            type: 'string',
            description: 'A single argument',
          },
        },
        cwd: {
          type: 'string',
          description: 'Working directory for the command',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 60000)',
        },
      },
      required: ['command'],
    },
    riskLevel: RiskLevel.SYSTEM,
    async execute(params: ShellExecuteParams, context: ToolContext): Promise<ToolResult> {
      if (isCommandDangerous(params.command)) {
        return {
          success: false,
          error: `Command "${params.command}" is flagged as potentially dangerous and requires explicit approval`,
        };
      }

      if (context.dryRun) {
        return {
          success: true,
          data: {
            message: `Would execute: ${params.command} ${params.args?.join(' ') ?? ''}`,
            dryRun: true,
          },
        };
      }

      try {
        const result = await shellAdapter.execute(params.command, params.args, {
          cwd: params.cwd ?? context.workingDirectory,
          timeout: params.timeout ?? 60000,
        });

        return {
          success: result.exitCode === 0,
          data: {
            command: result.command,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            duration: result.duration,
          },
          error: result.exitCode !== 0 ? `Command exited with code ${result.exitCode}` : undefined,
          metadata: {
            taskId: context.taskId,
            operation: 'shell_execute',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

export function createPowerShellTool(shellAdapter: ShellAdapter = createShellAdapter()): Tool<PowerShellExecuteParams> {
  return {
    name: 'powershell_execute',
    description: 'Execute a PowerShell script on the system. Use with caution.',
    parameters: {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description: 'The PowerShell script to execute',
        },
      },
      required: ['script'],
    },
    riskLevel: RiskLevel.SYSTEM,
    async execute(params: PowerShellExecuteParams, context: ToolContext): Promise<ToolResult> {
      if (context.dryRun) {
        return {
          success: true,
          data: {
            message: `Would execute PowerShell script`,
            script: params.script.substring(0, 200) + (params.script.length > 200 ? '...' : ''),
            dryRun: true,
          },
        };
      }

      try {
        const result = await shellAdapter.executePowerShell(params.script);

        return {
          success: result.exitCode === 0,
          data: {
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            duration: result.duration,
          },
          error: result.exitCode !== 0 ? `PowerShell exited with code ${result.exitCode}` : undefined,
          metadata: {
            taskId: context.taskId,
            operation: 'powershell_execute',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

export function registerShellTools(registry: {
  register: (tool: Tool) => void;
}, shellAdapter?: ShellAdapter): void {
  const adapter = shellAdapter ?? createShellAdapter();
  
  registry.register(createShellTool(adapter));
  registry.register(createPowerShellTool(adapter));
}
