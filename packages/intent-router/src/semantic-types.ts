export interface ToolMeta {
  name: string;
  description: string;
  riskLevel: number;
  keywords: string[];
  examples: string[];
  category: 'system' | 'file' | 'shell' | 'process' | 'network';
}

export interface RoutingResult {
  matched: boolean;
  tool?: string;
  params?: Record<string, unknown>;
  confidence: number;
  source: 'command' | 'keyword' | 'llm';
  type: 'system' | 'chat' | 'complex_task';
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

export interface SemanticRouter {
  route(input: string): RoutingResult;
  registerTool(meta: ToolMeta): void;
  clearCache(): void;
}

export const SYSTEM_TOOLS: ToolMeta[] = [
  {
    name: 'get_cpu_usage',
    description: 'Retrieve current CPU utilization percentage from the system',
    riskLevel: 1,
    keywords: ['cpu', 'processor', 'usage', 'load', '占用', '使用率', '负载'],
    examples: ['cpu usage', 'cpu占用', '查看cpu', 'cpu使用率', 'processor load'],
    category: 'system',
  },
  {
    name: 'get_memory_usage',
    description: 'Retrieve current memory/RAM utilization from the system',
    riskLevel: 1,
    keywords: ['memory', 'ram', '内存', '使用率', '占用'],
    examples: ['memory usage', '内存占用', '查看内存', 'ram usage'],
    category: 'system',
  },
  {
    name: 'get_disk_usage',
    description: 'Retrieve disk storage usage and available space',
    riskLevel: 1,
    keywords: ['disk', 'storage', '硬盘', '磁盘', '空间'],
    examples: ['disk usage', '磁盘空间', '硬盘使用', 'storage'],
    category: 'system',
  },
  {
    name: 'get_process_list',
    description: 'List all running processes with their resource usage',
    riskLevel: 1,
    keywords: ['process', '进程', 'running', '运行', 'program'],
    examples: ['process list', '进程列表', 'running processes', '查看进程'],
    category: 'process',
  },
  {
    name: 'get_network_info',
    description: 'Get network interfaces and IP addresses',
    riskLevel: 1,
    keywords: ['network', 'ip', '网络', '网卡', 'interface'],
    examples: ['network info', 'ip地址', '网络信息', '网卡'],
    category: 'network',
  },
  {
    name: 'get_time',
    description: 'Get current system time and date',
    riskLevel: 1,
    keywords: ['time', 'date', '时间', '日期', '几点'],
    examples: ['what time', '当前时间', '几点了', 'date'],
    category: 'system',
  },
  {
    name: 'get_current_directory',
    description: 'Get current working directory path',
    riskLevel: 1,
    keywords: ['pwd', 'directory', '目录', '路径', 'cwd'],
    examples: ['current directory', '当前目录', 'pwd', '工作目录'],
    category: 'system',
  },
  {
    name: 'get_environment',
    description: 'Get environment variables information',
    riskLevel: 1,
    keywords: ['env', 'environment', '环境变量'],
    examples: ['env', '环境变量', 'environment'],
    category: 'system',
  },
];

export const COMMAND_ALIASES: Record<string, { tool: string; params?: Record<string, unknown> }> = {
  '/cpu': { tool: 'get_cpu_usage' },
  '/memory': { tool: 'get_memory_usage' },
  '/mem': { tool: 'get_memory_usage' },
  '/ram': { tool: 'get_memory_usage' },
  '/disk': { tool: 'get_disk_usage' },
  '/storage': { tool: 'get_disk_usage' },
  '/process': { tool: 'get_process_list' },
  '/processes': { tool: 'get_process_list' },
  '/ps': { tool: 'get_process_list' },
  '/network': { tool: 'get_network_info' },
  '/net': { tool: 'get_network_info' },
  '/ip': { tool: 'get_network_info' },
  '/time': { tool: 'get_time' },
  '/date': { tool: 'get_time' },
  '/pwd': { tool: 'get_current_directory' },
  '/cwd': { tool: 'get_current_directory' },
  '/dir': { tool: 'get_current_directory' },
  '/env': { tool: 'get_environment' },
  '/help': { tool: '__help__' },
  '/?': { tool: '__help__' },
  '/clear': { tool: '__clear__' },
  '/model': { tool: '__model__' },
  '/config': { tool: '__config__' },
  '/reconfig': { tool: '__reconfig__' },
  '/exit': { tool: '__exit__' },
  '/quit': { tool: '__exit__' },
  '/q': { tool: '__exit__' },
};
