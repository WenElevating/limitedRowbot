import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as os from 'node:os';

const execAsync = promisify(exec);

export interface SystemInfo {
  cpu: CpuInfo;
  memory: MemoryInfo;
  disk: DiskInfo[];
  processes: ProcessInfo[];
  network: NetworkInfo;
  time: TimeInfo;
  env: EnvInfo;
  path: PathInfo;
}

export interface CpuInfo {
  usage: number;
  cores: number;
  model: string;
  loadAverage: number[];
}

export interface MemoryInfo {
  total: number;
  free: number;
  used: number;
  usagePercent: number;
}

export interface DiskInfo {
  drive: string;
  total: number;
  free: number;
  used: number;
  usagePercent: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
}

export interface NetworkInfo {
  hostname: string;
  interfaces: NetworkInterface[];
}

export interface NetworkInterface {
  name: string;
  addresses: string[];
}

export interface TimeInfo {
  now: string;
  timezone: string;
  uptime: number;
}

export interface EnvInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  homedir: string;
  tmpdir: string;
}

export interface PathInfo {
  cwd: string;
  homedir: string;
  tmpdir: string;
}

export interface FastPathResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
  cached: boolean;
}

export interface FastPathExecutor {
  execute(queryType: string): Promise<FastPathResult>;
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

export async function getCpuInfo(): Promise<CpuInfo> {
  const cpus = os.cpus();
  const loadAvg = os.loadavg();
  
  // Windows: use wmic for CPU usage
  let cpuUsage = 0;
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(
        'wmic cpu get loadpercentage /value',
        { timeout: 5000 }
      );
      const match = stdout.match(/LoadPercentage=(\d+)/);
      if (match && match[1]) {
        cpuUsage = parseInt(match[1], 10);
      }
    } else {
      // Unix-like: calculate from load average
      cpuUsage = Math.min((loadAvg[0] ?? 0) / cpus.length * 100, 100);
    }
  } catch {
    cpuUsage = 0;
  }
  
  return {
    usage: cpuUsage,
    cores: cpus.length,
    model: cpus[0]?.model ?? 'Unknown',
    loadAverage: loadAvg,
  };
}

export async function getMemoryInfo(): Promise<MemoryInfo> {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  
  return {
    total,
    free,
    used,
    usagePercent: (used / total) * 100,
  };
}

export async function getDiskInfo(): Promise<DiskInfo[]> {
  const disks: DiskInfo[] = [];
  
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(
        'wmic logicaldisk get size,freespace,caption /value',
        { timeout: 5000 }
      );
      
      const drives = stdout.split('\n\n').filter(s => s.trim());
      for (const drive of drives) {
        const caption = drive.match(/Caption=(\w:)/)?.[1];
        const freeSpace = drive.match(/FreeSpace=(\d+)/)?.[1];
        const size = drive.match(/Size=(\d+)/)?.[1];
        
        if (caption && freeSpace && size) {
          const free = parseInt(freeSpace, 10);
          const total = parseInt(size, 10);
          disks.push({
            drive: caption,
            total,
            free,
            used: total - free,
            usagePercent: ((total - free) / total) * 100,
          });
        }
      }
    }
  } catch {
    // Fallback: return empty
  }
  
  return disks;
}

export async function getProcessInfo(limit = 10): Promise<ProcessInfo[]> {
  const processes: ProcessInfo[] = [];
  
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(
        'powershell "Get-Process | Sort-Object CPU -Descending | Select-Object -First ' + limit + ' | ConvertTo-Json"',
        { timeout: 10000 }
      );
      
      const data = JSON.parse(stdout);
      const procs = Array.isArray(data) ? data : [data];
      
      for (const p of procs) {
        if (p.Id && p.ProcessName) {
          processes.push({
            pid: p.Id,
            name: p.ProcessName,
            cpu: p.CPU ?? 0,
            memory: p.WorkingSet64 ?? p.WorkingSet ?? 0,
          });
        }
      }
    }
  } catch {
    // Fallback: return empty
  }
  
  return processes;
}

export async function getNetworkInfo(): Promise<NetworkInfo> {
  const interfaces = os.networkInterfaces();
  const ifaces: NetworkInterface[] = [];
  
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (addrs) {
      ifaces.push({
        name,
        addresses: addrs.map(a => a.address),
      });
    }
  }
  
  return {
    hostname: os.hostname(),
    interfaces: ifaces,
  };
}

export async function getTimeInfo(): Promise<TimeInfo> {
  return {
    now: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    uptime: os.uptime(),
  };
}

export async function getEnvInfo(): Promise<EnvInfo> {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: os.arch(),
    homedir: os.homedir(),
    tmpdir: os.tmpdir(),
  };
}

export async function getPathInfo(): Promise<PathInfo> {
  return {
    cwd: process.cwd(),
    homedir: os.homedir(),
    tmpdir: os.tmpdir(),
  };
}

export function formatSystemInfo(type: string, data: unknown): string {
  switch (type) {
    case 'cpu': {
      const cpu = data as CpuInfo;
      return `📊 CPU 信息
────────────────────────────────
核心数: ${cpu.cores}
型号: ${cpu.model}
使用率: ${cpu.usage.toFixed(1)}%
负载均衡: ${cpu.loadAverage.map(l => l.toFixed(2)).join(', ')}
────────────────────────────────`;
    }
    
    case 'memory': {
      const mem = data as MemoryInfo;
      return `💾 内存信息
────────────────────────────────
总计: ${formatBytes(mem.total)}
已用: ${formatBytes(mem.used)}
可用: ${formatBytes(mem.free)}
使用率: ${mem.usagePercent.toFixed(1)}%
────────────────────────────────`;
    }
    
    case 'disk': {
      const disks = data as DiskInfo[];
      let output = '💿 磁盘信息\n────────────────────────────────\n';
      for (const disk of disks) {
        output += `${disk.drive} 总计: ${formatBytes(disk.total)} | 已用: ${formatBytes(disk.used)} | 可用: ${formatBytes(disk.free)} | 使用率: ${disk.usagePercent.toFixed(1)}%\n`;
      }
      output += '────────────────────────────────';
      return output;
    }
    
    case 'process': {
      const procs = data as ProcessInfo[];
      let output = '📋 进程列表 (Top 10 by CPU)\n────────────────────────────────\n';
      output += 'PID\t\t名称\t\t\tCPU\t\t内存\n';
      for (const p of procs) {
        output += `${p.pid}\t\t${p.name.substring(0, 15).padEnd(15)}\t${p.cpu.toFixed(1)}%\t\t${formatBytes(p.memory)}\n`;
      }
      output += '────────────────────────────────';
      return output;
    }
    
    case 'time': {
      const time = data as TimeInfo;
      return `🕐 时间信息
────────────────────────────────
当前时间: ${time.now}
时区: ${time.timezone}
系统运行时间: ${Math.floor(time.uptime / 3600)}小时${Math.floor((time.uptime % 3600) / 60)}分钟
────────────────────────────────`;
    }
    
    case 'env': {
      const env = data as EnvInfo;
      return `🔧 环境信息
────────────────────────────────
Node.js: ${env.nodeVersion}
平台: ${env.platform}
架构: ${env.arch}
用户目录: ${env.homedir}
临时目录: ${env.tmpdir}
────────────────────────────────`;
    }
    
    case 'path': {
      const path = data as PathInfo;
      return `📁 路径信息
────────────────────────────────
当前目录: ${path.cwd}
用户目录: ${path.homedir}
临时目录: ${path.tmpdir}
────────────────────────────────`;
    }
    
    case 'network': {
      const net = data as NetworkInfo;
      let output = `🌐 网络信息\n────────────────────────────────\n`;
      output += `主机名: ${net.hostname}\n\n`;
      for (const iface of net.interfaces) {
        output += `${iface.name}: ${iface.addresses.join(', ')}\n`;
      }
      output += '────────────────────────────────';
      return output;
    }
    
    default:
      return JSON.stringify(data, null, 2);
  }
}

export function createFastPathExecutor(): FastPathExecutor {
  return {
    async execute(queryType: string): Promise<FastPathResult> {
      const startTime = Date.now();
      
      try {
        let data: unknown;
        
        switch (queryType) {
          case 'cpu':
            data = await getCpuInfo();
            break;
          case 'memory':
            data = await getMemoryInfo();
            break;
          case 'disk':
            data = await getDiskInfo();
            break;
          case 'process':
            data = await getProcessInfo();
            break;
          case 'network':
            data = await getNetworkInfo();
            break;
          case 'time':
            data = await getTimeInfo();
            break;
          case 'env':
            data = await getEnvInfo();
            break;
          case 'path':
            data = await getPathInfo();
            break;
          default:
            return {
              success: false,
              error: `Unknown query type: ${queryType}`,
              duration: Date.now() - startTime,
              cached: false,
            };
        }
        
        return {
          success: true,
          data,
          duration: Date.now() - startTime,
          cached: false,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
          cached: false,
        };
      }
    },
  };
}
