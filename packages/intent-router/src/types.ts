export type IntentType = 
  | 'system_query'
  | 'file_operation'
  | 'shell_command'
  | 'process_management'
  | 'chat'
  | 'complex_task';

export interface IntentResult {
  type: IntentType;
  confidence: number;
  action?: string;
  params?: Record<string, unknown>;
  needsLLM: boolean;
  fastPath?: () => Promise<unknown>;
}

export interface SystemQueryIntent extends IntentResult {
  type: 'system_query';
  queryType: 'cpu' | 'memory' | 'disk' | 'process' | 'network' | 'time' | 'env' | 'path';
}

export interface FileOperationIntent extends IntentResult {
  type: 'file_operation';
  operation: 'read' | 'write' | 'delete' | 'list' | 'copy' | 'move';
  targetPath?: string;
}

export interface ShellCommandIntent extends IntentResult {
  type: 'shell_command';
  command?: string;
}

export interface ChatIntent extends IntentResult {
  type: 'chat';
}

export interface ComplexTaskIntent extends IntentResult {
  type: 'complex_task';
}

export interface IntentRouter {
  detect(input: string): IntentResult;
  isFastPath(intent: IntentResult): boolean;
}
