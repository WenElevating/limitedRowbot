export interface LogEntry {
  id?: number;
  taskId: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: Record<string, unknown>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 
  | 'agent'
  | 'tool'
  | 'permission'
  | 'llm'
  | 'system'
  | 'user';

export interface LoggerConfig {
  logDir?: string;
  dbName?: string;
  consoleOutput?: boolean;
  minLevel?: LogLevel;
}

export interface Logger {
  debug(category: LogCategory, taskId: string, message: string, data?: Record<string, unknown>): void;
  info(category: LogCategory, taskId: string, message: string, data?: Record<string, unknown>): void;
  warn(category: LogCategory, taskId: string, message: string, data?: Record<string, unknown>): void;
  error(category: LogCategory, taskId: string, message: string, data?: Record<string, unknown>): void;
  getLogsByTask(taskId: string): Promise<LogEntry[]>;
  getLogsByCategory(category: LogCategory, limit?: number): Promise<LogEntry[]>;
  close(): void;
}
