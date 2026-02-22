import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { ProcessAdapter, ProcessInfo } from './types.js';

const execAsync = promisify(exec);

interface WmiProcessInfo {
  ProcessId: number;
  Name: string;
  CommandLine: string | null;
  WorkingSetSize: number;
}

interface TaskListProcessInfo {
  imageName: string;
  pid: number;
  memUsage: string;
}

function parseTaskList(output: string): TaskListProcessInfo[] {
  const lines = output.trim().split('\n');
  const processes: TaskListProcessInfo[] = [];
  
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    
    const match = line.match(/^(.+?)\s+(\d+)\s+\w+\s+\d+\s+([\d,]+)\s[K]/);
    if (match && match[1] && match[2] && match[3]) {
      processes.push({
        imageName: match[1].trim(),
        pid: parseInt(match[2], 10),
        memUsage: match[3].replace(/,/g, ''),
      });
    }
  }
  
  return processes;
}

export function createProcessAdapter(): ProcessAdapter {
  return {
    async list(): Promise<ProcessInfo[]> {
      const { stdout } = await execAsync('tasklist /FO CSV /NH', {
        maxBuffer: 10 * 1024 * 1024,
      });
      
      const lines = stdout.trim().split('\n');
      const processes: ProcessInfo[] = [];
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const parts = line.match(/"([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)"/);
        if (parts && parts[1] && parts[2] && parts[5]) {
          const memStr = parts[5].replace(/[^\d]/g, '');
          processes.push({
            pid: parseInt(parts[2], 10),
            name: parts[1],
            memoryUsage: parseInt(memStr, 10) * 1024,
            cpuUsage: 0,
          });
        }
      }
      
      return processes;
    },

    async kill(pid: number): Promise<boolean> {
      try {
        await execAsync(`taskkill /PID ${pid} /F`);
        return true;
      } catch {
        return false;
      }
    },

    async findByName(name: string): Promise<ProcessInfo[]> {
      const processes = await this.list();
      const lowerName = name.toLowerCase();
      return processes.filter(p => p.name.toLowerCase().includes(lowerName));
    },

    async start(command: string, args: string[] = []): Promise<ProcessInfo> {
      const { spawn } = await import('node:child_process');
      
      return new Promise((resolve, reject) => {
        const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
        const proc = spawn(fullCommand, [], {
          detached: true,
          shell: true,
          windowsHide: true,
        });
        
        proc.on('error', reject);
        
        proc.unref();
        
        setTimeout(() => {
          resolve({
            pid: proc.pid ?? 0,
            name: command,
            memoryUsage: 0,
            cpuUsage: 0,
            command: fullCommand,
          });
        }, 100);
      });
    },
  };
}
