export interface FileInfo {
  path: string;
  name: string;
  isDirectory: boolean;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  permissions?: string;
}

export interface FileReadResult {
  path: string;
  content: string;
  encoding: string;
  size: number;
}

export interface FileWriteResult {
  path: string;
  bytesWritten: number;
  created: boolean;
}

export interface FileDeleteResult {
  path: string;
  success: boolean;
  wasDirectory: boolean;
}

export interface DirectoryListResult {
  path: string;
  entries: FileInfo[];
}

export interface ShellExecuteResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  memoryUsage: number;
  cpuUsage: number;
  command?: string;
}

export interface FileAdapter {
  read(path: string, encoding?: BufferEncoding): Promise<FileReadResult>;
  write(path: string, content: string, encoding?: BufferEncoding): Promise<FileWriteResult>;
  delete(path: string): Promise<FileDeleteResult>;
  exists(path: string): Promise<boolean>;
  listDir(path: string): Promise<DirectoryListResult>;
  createDir(path: string, recursive?: boolean): Promise<boolean>;
  copy(src: string, dest: string): Promise<FileWriteResult>;
  move(src: string, dest: string): Promise<boolean>;
  getFileInfo(path: string): Promise<FileInfo>;
}

export interface ShellAdapter {
  execute(command: string, args?: string[], options?: ShellExecuteOptions): Promise<ShellExecuteResult>;
  executePowerShell(script: string): Promise<ShellExecuteResult>;
}

export interface ShellExecuteOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  shell?: boolean;
}

export interface ProcessAdapter {
  list(): Promise<ProcessInfo[]>;
  kill(pid: number): Promise<boolean>;
  findByName(name: string): Promise<ProcessInfo[]>;
  start(command: string, args?: string[]): Promise<ProcessInfo>;
}
