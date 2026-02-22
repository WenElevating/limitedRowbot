import { spawn } from 'node:child_process';
import type { ShellAdapter, ShellExecuteResult, ShellExecuteOptions } from './types.js';

function executeCommand(
  command: string,
  args: string[] = [],
  options: ShellExecuteOptions = {}
): Promise<ShellExecuteResult> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const { cwd, env, timeout = 60000, shell = true } = options;
    
    const proc = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      shell,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timeoutId: NodeJS.Timeout | null = null;

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        proc.kill();
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);
    }

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (error) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(error);
    });

    proc.on('close', (code) => {
      if (timeoutId) clearTimeout(timeoutId);
      
      resolve({
        command: `${command} ${args.join(' ')}`.trim(),
        exitCode: code ?? 1,
        stdout,
        stderr,
        duration: Date.now() - startTime,
      });
    });
  });
}

export function createShellAdapter(): ShellAdapter {
  return {
    async execute(
      command: string,
      args: string[] = [],
      options: ShellExecuteOptions = {}
    ): Promise<ShellExecuteResult> {
      return executeCommand(command, args, options);
    },

    async executePowerShell(script: string): Promise<ShellExecuteResult> {
      return executeCommand('powershell', ['-NoProfile', '-Command', script], {
        shell: false,
      });
    },
  };
}
