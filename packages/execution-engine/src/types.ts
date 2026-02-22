export type ExecutionEventType = 
  | 'status'
  | 'plan'
  | 'confirm_plan'
  | 'confirm_permission'
  | 'step_start'
  | 'step_progress'
  | 'step_complete'
  | 'result'
  | 'error';

export interface ExecutionEvent {
  type: ExecutionEventType;
  payload: unknown;
}

export interface StatusEvent extends ExecutionEvent {
  type: 'status';
  payload: {
    message: string;
    phase: 'planning' | 'executing' | 'formatting';
  };
}

export interface PlanEvent extends ExecutionEvent {
  type: 'plan';
  payload: {
    taskId: string;
    goal: string;
    steps: PlanStep[];
  };
}

export interface ConfirmPlanEvent extends ExecutionEvent {
  type: 'confirm_plan';
  payload: {
    taskId: string;
    goal: string;
    steps: PlanStep[];
    highRiskSteps: PlanStep[];
  };
}

export interface ConfirmPermissionEvent extends ExecutionEvent {
  type: 'confirm_permission';
  payload: {
    toolName: string;
    action: string;
    target?: string;
    riskLevel: string;
    description: string;
  };
}

export interface StepStartEvent extends ExecutionEvent {
  type: 'step_start';
  payload: {
    stepIndex: number;
    totalSteps: number;
    toolName: string;
    description?: string;
  };
}

export interface StepProgressEvent extends ExecutionEvent {
  type: 'step_progress';
  payload: {
    stepIndex: number;
    progress: number;
    message?: string;
  };
}

export interface StepCompleteEvent extends ExecutionEvent {
  type: 'step_complete';
  payload: {
    stepIndex: number;
    success: boolean;
    result?: unknown;
    error?: string;
  };
}

export interface ResultEvent extends ExecutionEvent {
  type: 'result';
  payload: {
    success: boolean;
    data?: unknown;
    error?: string;
  };
}

export interface ErrorEvent extends ExecutionEvent {
  type: 'error';
  payload: {
    message: string;
    code?: string;
  };
}

export interface PlanStep {
  id: string;
  toolName: string;
  params: Record<string, unknown>;
  riskLevel: string;
  description?: string;
}

export interface ExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  steps: StepResult[];
}

export interface StepResult {
  stepId: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface ExecutionController {
  confirmPlan(approved: boolean): void;
  confirmPermission(approved: boolean): void;
  cancel(): void;
}

export type ExecutionGenerator = AsyncGenerator<ExecutionEvent, ExecutionResult, unknown>;
