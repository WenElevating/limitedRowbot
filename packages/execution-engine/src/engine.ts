import type {
  ExecutionGenerator,
  ExecutionEvent,
  PlanStep,
  ExecutionResult,
  StepResult,
} from './types.js';

interface PendingConfirm {
  type: 'plan' | 'permission';
  resolve: (value: boolean) => void;
}

export class ExecutionEngine {
  private pendingConfirm: PendingConfirm | null = null;
  private cancelled = false;

  constructor(
    private readonly planner: (goal: string) => Promise<PlanStep[]>,
    private readonly executor: (step: PlanStep) => Promise<unknown>,
    private readonly formatter?: (goal: string, results: StepResult[]) => Promise<string>
  ) {}

  async *run(goal: string): ExecutionGenerator {
    this.cancelled = false;

    // Phase 1: Planning
    yield { type: 'status', payload: { message: '正在规划...', phase: 'planning' } };

    let steps: PlanStep[];
    try {
      steps = await this.planner(goal);
    } catch (error) {
      yield { 
        type: 'error', 
        payload: { message: error instanceof Error ? error.message : String(error) } 
      };
      return { success: false, error: '规划失败', steps: [] };
    }

    if (this.cancelled) {
      return { success: false, error: '已取消', steps: [] };
    }

    // Phase 2: Confirm Plan
    const highRiskSteps = steps.filter(s => s.riskLevel === 'SYSTEM' || s.riskLevel === 'DELETE');
    
    yield {
      type: 'confirm_plan',
      payload: {
        taskId: `task_${Date.now()}`,
        goal,
        steps,
        highRiskSteps,
      }
    };

    const planApproved = await this.waitForConfirm('plan');
    if (!planApproved) {
      return { success: false, error: '用户取消', steps: [] };
    }

    if (this.cancelled) {
      return { success: false, error: '已取消', steps: [] };
    }

    // Phase 3: Execute Steps
    yield { type: 'status', payload: { message: '正在执行...', phase: 'executing' } };

    const stepResults: StepResult[] = [];
    
    for (let i = 0; i < steps.length; i++) {
      if (this.cancelled) {
        return { success: false, error: '已取消', steps: stepResults };
      }

      const step = steps[i];
      if (!step) continue;
      
      yield {
        type: 'step_start',
        payload: {
          stepIndex: i,
          totalSteps: steps.length,
          toolName: step.toolName,
          description: step.description,
        }
      };

      // Check permission for high-risk operations
      if (step.riskLevel === 'SYSTEM' || step.riskLevel === 'DELETE') {
        yield {
          type: 'confirm_permission',
          payload: {
            toolName: step.toolName,
            action: step.description ?? `执行 ${step.toolName}`,
            riskLevel: step.riskLevel,
            description: step.description ?? '',
          }
        };

        const permissionApproved = await this.waitForConfirm('permission');
        if (!permissionApproved) {
          yield {
            type: 'step_complete',
            payload: {
              stepIndex: i,
              success: false,
              error: '用户拒绝',
            }
          };
          stepResults.push({ stepId: step.id, success: false, error: '用户拒绝' });
          continue;
        }
      }

      try {
        const result = await this.executor(step);
        
        yield {
          type: 'step_complete',
          payload: {
            stepIndex: i,
            success: true,
            result,
          }
        };
        
        stepResults.push({ stepId: step.id, success: true, result });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        yield {
          type: 'step_complete',
          payload: {
            stepIndex: i,
            success: false,
            error: errorMessage,
          }
        };
        
        stepResults.push({ stepId: step.id, success: false, error: errorMessage });
      }
    }

    // Phase 4: Format Result
    if (this.formatter && stepResults.some(r => r.success)) {
      yield { type: 'status', payload: { message: '整理结果...', phase: 'formatting' } };
      
      try {
        const formatted = await this.formatter(goal, stepResults);
        yield {
          type: 'result',
          payload: {
            success: true,
            data: formatted,
          }
        };
      } catch {
        yield {
          type: 'result',
          payload: {
            success: true,
            data: stepResults,
          }
        };
      }
    } else {
      yield {
        type: 'result',
        payload: {
          success: stepResults.every(r => r.success),
          data: stepResults,
        }
      };
    }

    return {
      success: stepResults.every(r => r.success),
      steps: stepResults,
    };
  }

  private async waitForConfirm(type: 'plan' | 'permission'): Promise<boolean> {
    return new Promise((resolve) => {
      this.pendingConfirm = { type, resolve };
    });
  }

  confirmPlan(approved: boolean): void {
    if (this.pendingConfirm?.type === 'plan') {
      this.pendingConfirm.resolve(approved);
      this.pendingConfirm = null;
    }
  }

  confirmPermission(approved: boolean): void {
    if (this.pendingConfirm?.type === 'permission') {
      this.pendingConfirm.resolve(approved);
      this.pendingConfirm = null;
    }
  }

  cancel(): void {
    this.cancelled = true;
    if (this.pendingConfirm) {
      this.pendingConfirm.resolve(false);
      this.pendingConfirm = null;
    }
  }
}

export function createExecutionEngine(
  planner: (goal: string) => Promise<PlanStep[]>,
  executor: (step: PlanStep) => Promise<unknown>,
  formatter?: (goal: string, results: StepResult[]) => Promise<string>
): ExecutionEngine {
  return new ExecutionEngine(planner, executor, formatter);
}
