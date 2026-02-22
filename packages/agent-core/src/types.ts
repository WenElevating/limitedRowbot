import type { Tool, ToolResult, ToolContext, ToolRegistry } from '@robot/tool-system';
import type { LLMProvider, ChatMessage, ToolDefinition } from '@robot/llm-adapter';
import type { PermissionGuard, PermissionRequest } from '@robot/permission-system';
import type { RiskLevel } from '@robot/permission-system';
import type { Logger } from '@robot/logger';

export interface ExecutionStep {
  id: string;
  toolName: string;
  params: Record<string, unknown>;
  description: string;
  riskLevel: RiskLevel;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: ToolResult;
  error?: string;
}

export interface ExecutionPlan {
  id: string;
  taskId: string;
  goal: string;
  steps: ExecutionStep[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface AgentConfig {
  llmProvider: LLMProvider;
  toolRegistry: ToolRegistry;
  permissionGuard: PermissionGuard;
  logger: Logger;
  maxIterations?: number;
  workingDirectory?: string;
  systemPrompt?: string;
}

export interface AgentSession {
  taskId: string;
  messages: ChatMessage[];
  plan?: ExecutionPlan;
  currentStep?: number;
}

export interface ExecutionResult {
  success: boolean;
  plan: ExecutionPlan;
  finalMessage?: string;
  error?: string;
}

export type PlanCallback = (plan: ExecutionPlan) => Promise<boolean>;
export type StepCallback = (step: ExecutionStep, index: number, total: number) => Promise<void>;
