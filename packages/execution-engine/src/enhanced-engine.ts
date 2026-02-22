import type {
  ExecutionGenerator,
  ExecutionEvent,
  PlanStep,
  ExecutionResult,
  StepResult,
} from './types.js';

export interface SandboxConfig {
  timeout: number;
  maxMemoryMB: number;
  allowedCommands: string[];
  allowedPaths: string[];
  env: Record<string, string>;
}

export interface ParallelConfig {
  maxConcurrent: number;
  failFast: boolean;
}

interface PendingConfirm {
  type: 'plan' | 'permission';
  resolve: (value: boolean) => void;
}

interface StepEventEmitter {
  emit: (event: ExecutionEvent) => void;
}

const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  timeout: 30000,
  maxMemoryMB: 512,
  allowedCommands: [],
  allowedPaths: [],
  env: {},
};

const DEFAULT_PARALLEL_CONFIG: ParallelConfig = {
  maxConcurrent: 3,
  failFast: false,
};

export class EnhancedExecutionEngine {
  private pendingConfirm: PendingConfirm | null = null;
  private cancelled = false;
  private sandboxConfig: SandboxConfig;
  private parallelConfig: ParallelConfig;
  private eventQueue: ExecutionEvent[] = [];
  private eventResolver: ((value: ExecutionEvent | null) => void) | null = null;

  constructor(
    private readonly planner: (goal: string) => Promise<PlanStep[]>,
    private readonly executor: (step: PlanStep, sandbox?: SandboxConfig) => Promise<unknown>,
    private readonly formatter?: (goal: string, results: StepResult[]) => Promise<string>,
    sandboxConfig?: Partial<SandboxConfig>,
    parallelConfig?: Partial<ParallelConfig>
  ) {
    this.sandboxConfig = { ...DEFAULT_SANDBOX_CONFIG, ...sandboxConfig };
    this.parallelConfig = { ...DEFAULT_PARALLEL_CONFIG, ...parallelConfig };
  }

  private emit(event: ExecutionEvent): void {
    if (this.eventResolver) {
      this.eventResolver(event);
      this.eventResolver = null;
    } else {
      this.eventQueue.push(event);
    }
  }

  private async *eventGenerator(): AsyncGenerator<ExecutionEvent> {
    while (true) {
      if (this.eventQueue.length > 0) {
        yield this.eventQueue.shift()!;
      } else {
        const event = await new Promise<ExecutionEvent | null>(resolve => {
          this.eventResolver = resolve;
        });
        if (event === null) break;
        yield event;
      }
    }
  }

  async *run(goal: string): ExecutionGenerator {
    this.cancelled = false;
    this.eventQueue = [];

    const executionPromise = this.execute(goal);

    for await (const event of this.eventGenerator()) {
      yield event;
    }

    return await executionPromise;
  }

  private async execute(goal: string): Promise<ExecutionResult> {
    this.emit({ type: 'status', payload: { message: '正在规划...', phase: 'planning' } });

    let steps: PlanStep[];
    try {
      steps = await this.withTimeout(
        this.planner(goal),
        this.sandboxConfig.timeout,
        '规划超时'
      );
    } catch (error) {
      this.emit({ 
        type: 'error', 
        payload: { message: error instanceof Error ? error.message : String(error) } 
      });
      this.emit({ type: 'result', payload: { success: false, error: '规划失败' } });
      return { success: false, error: '规划失败', steps: [] };
    }

    if (this.cancelled) {
      this.emit({ type: 'result', payload: { success: false, error: '已取消' } });
      return { success: false, error: '已取消', steps: [] };
    }

    if (steps.length === 0) {
      this.emit({ type: 'status', payload: { message: '无需执行', phase: 'executing' } });
      this.emit({ type: 'result', payload: { success: true } });
      return { success: true, steps: [] };
    }

    const highRiskSteps = steps.filter(s => s.riskLevel === 'SYSTEM' || s.riskLevel === 'DELETE');
    
    this.emit({
      type: 'confirm_plan',
      payload: {
        taskId: `task_${Date.now()}`,
        goal,
        steps,
        highRiskSteps,
      }
    });

    const planApproved = await this.waitForConfirm('plan');
    if (!planApproved) {
      this.emit({ type: 'result', payload: { success: false, error: '用户取消' } });
      return { success: false, error: '用户取消', steps: [] };
    }

    if (this.cancelled) {
      this.emit({ type: 'result', payload: { success: false, error: '已取消' } });
      return { success: false, error: '已取消', steps: [] };
    }

    this.emit({ type: 'status', payload: { message: '正在执行...', phase: 'executing' } });

    const stepResults = await this.executeSteps(steps);

    const allSuccess = stepResults.every(r => r.success);
    
    if (this.formatter && stepResults.some(r => r.success)) {
      this.emit({ type: 'status', payload: { message: '整理结果...', phase: 'formatting' } });
      
      try {
        const formatted = await this.formatter(goal, stepResults);
        this.emit({
          type: 'result',
          payload: {
            success: allSuccess,
            data: formatted,
          }
        });
      } catch {
        this.emit({
          type: 'result',
          payload: {
            success: allSuccess,
            data: stepResults,
          }
        });
      }
    } else {
      this.emit({
        type: 'result',
        payload: {
          success: allSuccess,
          data: stepResults,
        }
      });
    }

    return {
      success: allSuccess,
      steps: stepResults,
    };
  }

  private async executeSteps(steps: PlanStep[]): Promise<StepResult[]> {
    const results: StepResult[] = new Array(steps.length);
    const independentSteps: { index: number; step: PlanStep }[] = [];
    const dependentSteps: { index: number; step: PlanStep }[] = [];

    steps.forEach((step, index) => {
      if (this.isIndependentStep(step)) {
        independentSteps.push({ index, step });
      } else {
        dependentSteps.push({ index, step });
      }
    });

    if (independentSteps.length > 1) {
      const parallelResults = await this.executeParallel(independentSteps, steps.length);
      parallelResults.forEach(({ index, result }) => {
        results[index] = result;
      });
    } else {
      for (const { index, step } of independentSteps) {
        results[index] = await this.executeSingleStep(step, index, steps.length);
      }
    }

    for (const { index, step } of dependentSteps) {
      results[index] = await this.executeSingleStep(step, index, steps.length);
    }

    return results;
  }

  private isIndependentStep(step: PlanStep): boolean {
    const dependentTools = ['file_write', 'file_delete', 'file_move', 'shell_execute'];
    return !dependentTools.includes(step.toolName);
  }

  private async executeParallel(
    steps: { index: number; step: PlanStep }[],
    totalSteps: number
  ): Promise<{ index: number; result: StepResult }[]> {
    const batches: { index: number; step: PlanStep }[][] = [];
    
    for (let i = 0; i < steps.length; i += this.parallelConfig.maxConcurrent) {
      batches.push(steps.slice(i, i + this.parallelConfig.maxConcurrent));
    }

    const results: { index: number; result: StepResult }[] = [];

    for (const batch of batches) {
      if (this.cancelled) break;

      const batchResults = await Promise.all(
        batch.map(async ({ index, step }) => {
          const result = await this.executeSingleStep(step, index, totalSteps);
          return { index, result };
        })
      );

      results.push(...batchResults);

      if (this.parallelConfig.failFast && batchResults.some(r => !r.result.success)) {
        break;
      }
    }

    return results;
  }

  private async executeSingleStep(
    step: PlanStep,
    stepIndex: number,
    totalSteps: number
  ): Promise<StepResult> {
    if (this.cancelled) {
      return { stepId: step.id, success: false, error: '已取消' };
    }

    this.emit({ 
      type: 'step_start', 
      payload: {
        stepIndex,
        totalSteps,
        toolName: step.toolName,
        description: step.description,
      }
    });

    if (step.riskLevel === 'SYSTEM' || step.riskLevel === 'DELETE') {
      this.emit({
        type: 'confirm_permission',
        payload: {
          toolName: step.toolName,
          action: step.description ?? `执行 ${step.toolName}`,
          riskLevel: step.riskLevel,
          description: step.description ?? '',
        }
      });

      const permissionApproved = await this.waitForConfirm('permission');
      if (!permissionApproved) {
        this.emit({
          type: 'step_complete',
          payload: {
            stepIndex,
            success: false,
            error: '用户拒绝',
          }
        });
        return { stepId: step.id, success: false, error: '用户拒绝' };
      }
    }

    try {
      const result = await this.withTimeout(
        this.executor(step, this.sandboxConfig),
        this.sandboxConfig.timeout,
        `执行 ${step.toolName} 超时`
      );
      
      this.emit({
        type: 'step_complete',
        payload: {
          stepIndex,
          success: true,
          result,
        }
      });
      
      return { stepId: step.id, success: true, result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.emit({
        type: 'step_complete',
        payload: {
          stepIndex,
          success: false,
          error: errorMessage,
        }
      });
      
      return { stepId: step.id, success: false, error: errorMessage };
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      ),
    ]);
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
    if (this.eventResolver) {
      this.eventResolver(null);
      this.eventResolver = null;
    }
  }

  updateSandboxConfig(config: Partial<SandboxConfig>): void {
    this.sandboxConfig = { ...this.sandboxConfig, ...config };
  }

  updateParallelConfig(config: Partial<ParallelConfig>): void {
    this.parallelConfig = { ...this.parallelConfig, ...config };
  }
}

export function createEnhancedExecutionEngine(
  planner: (goal: string) => Promise<PlanStep[]>,
  executor: (step: PlanStep, sandbox?: SandboxConfig) => Promise<unknown>,
  formatter?: (goal: string, results: StepResult[]) => Promise<string>,
  sandboxConfig?: Partial<SandboxConfig>,
  parallelConfig?: Partial<ParallelConfig>
): EnhancedExecutionEngine {
  return new EnhancedExecutionEngine(
    planner,
    executor,
    formatter,
    sandboxConfig,
    parallelConfig
  );
}
