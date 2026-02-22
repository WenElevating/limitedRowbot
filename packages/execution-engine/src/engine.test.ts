import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionEngine, createExecutionEngine } from './engine.js';
import type { PlanStep } from './types.js';

function createMockPlanner(steps: PlanStep[]) {
  return vi.fn().mockResolvedValue(steps);
}

function createMockExecutor(result: unknown = { success: true }) {
  return vi.fn().mockResolvedValue(result);
}

function createMockFormatter(output: string = 'formatted result') {
  return vi.fn().mockResolvedValue(output);
}

function createTestStep(overrides: Partial<PlanStep> = {}): PlanStep {
  return {
    id: 'step_0',
    toolName: 'test_tool',
    params: {},
    riskLevel: 'LOW',
    description: 'Test step',
    ...overrides,
  };
}

interface RunResult {
  events: any[];
  result: any;
}

async function runEngineWithAutoConfirm(
  engine: ExecutionEngine,
  goal: string,
  options: {
    confirmPlan?: boolean;
    confirmPermissions?: boolean[];
  } = {}
): Promise<RunResult> {
  const { confirmPlan = true, confirmPermissions = [] } = options;
  const events: any[] = [];
  let permissionIndex = 0;

  const generator = engine.run(goal);
  const iterator = generator[Symbol.asyncIterator]();

  let iterResult = await iterator.next();

  while (!iterResult.done) {
    events.push(iterResult.value);

    const eventType = iterResult.value.type;

    const nextPromise = iterator.next();

    if (eventType === 'confirm_plan') {
      engine.confirmPlan(confirmPlan);
      if (!confirmPlan) {
        iterResult = await nextPromise;
        if (iterResult.done) {
          return { events, result: iterResult.value };
        }
        events.push(iterResult.value);
        continue;
      }
    }

    if (eventType === 'confirm_permission') {
      const shouldConfirm = confirmPermissions[permissionIndex] ?? true;
      engine.confirmPermission(shouldConfirm);
      permissionIndex++;
    }

    iterResult = await nextPromise;
  }

  return { events, result: iterResult.value };
}

describe('ExecutionEngine', () => {
  let engine: ExecutionEngine;
  let mockPlanner: ReturnType<typeof createMockPlanner>;
  let mockExecutor: ReturnType<typeof createMockExecutor>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic execution flow', () => {
    it('should emit status events during execution', async () => {
      const steps = [createTestStep()];
      mockPlanner = createMockPlanner(steps);
      mockExecutor = createMockExecutor();
      engine = new ExecutionEngine(mockPlanner, mockExecutor);

      const generator = engine.run('test goal');
      const events: any[] = [];

      const iterator = generator[Symbol.asyncIterator]();
      const first = await iterator.next();
      events.push(first.value);
      
      const second = await iterator.next();
      events.push(second.value);

      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({
        type: 'status',
        payload: { message: '正在规划...', phase: 'planning' },
      });
      expect(events[1].type).toBe('confirm_plan');
      expect(mockPlanner).toHaveBeenCalledWith('test goal');
    });

    it('should complete execution after plan confirmation', async () => {
      const steps = [createTestStep()];
      mockPlanner = createMockPlanner(steps);
      mockExecutor = createMockExecutor({ data: 'test result' });
      engine = new ExecutionEngine(mockPlanner, mockExecutor);

      const { result } = await runEngineWithAutoConfirm(engine, 'test goal');

      expect(mockExecutor).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(1);
    }, 10000);

    it('should execute multiple steps in order', async () => {
      const steps = [
        createTestStep({ id: 'step_0', toolName: 'tool_a' }),
        createTestStep({ id: 'step_1', toolName: 'tool_b' }),
        createTestStep({ id: 'step_2', toolName: 'tool_c' }),
      ];
      mockPlanner = createMockPlanner(steps);
      mockExecutor = createMockExecutor();
      engine = new ExecutionEngine(mockPlanner, mockExecutor);

      await runEngineWithAutoConfirm(engine, 'test goal');

      expect(mockExecutor).toHaveBeenCalledTimes(3);
      expect(mockExecutor).toHaveBeenNthCalledWith(1, steps[0]);
      expect(mockExecutor).toHaveBeenNthCalledWith(2, steps[1]);
      expect(mockExecutor).toHaveBeenNthCalledWith(3, steps[2]);
    }, 10000);
  });

  describe('plan confirmation', () => {
    it('should return cancelled when user rejects plan', async () => {
      const steps = [createTestStep()];
      mockPlanner = createMockPlanner(steps);
      mockExecutor = createMockExecutor();
      engine = new ExecutionEngine(mockPlanner, mockExecutor);

      const { result } = await runEngineWithAutoConfirm(engine, 'test goal', { confirmPlan: false });

      expect(result.success).toBe(false);
      expect(result.error).toBe('用户取消');
      expect(mockExecutor).not.toHaveBeenCalled();
    }, 10000);

    it('should include high risk steps in confirm_plan event', async () => {
      const steps = [
        createTestStep({ id: 'step_0', riskLevel: 'LOW' }),
        createTestStep({ id: 'step_1', riskLevel: 'SYSTEM' }),
        createTestStep({ id: 'step_2', riskLevel: 'DELETE' }),
      ];
      mockPlanner = createMockPlanner(steps);
      mockExecutor = createMockExecutor();
      engine = new ExecutionEngine(mockPlanner, mockExecutor);

      const generator = engine.run('test goal');
      const iterator = generator[Symbol.asyncIterator]();
      
      await iterator.next();
      const confirmEvent = await iterator.next();

      expect(confirmEvent.done).toBe(false);
      expect((confirmEvent.value as any).type).toBe('confirm_plan');
      expect((confirmEvent.value as any).payload.highRiskSteps).toHaveLength(2);
      expect((confirmEvent.value as any).payload.highRiskSteps[0].riskLevel).toBe('SYSTEM');
      expect((confirmEvent.value as any).payload.highRiskSteps[1].riskLevel).toBe('DELETE');
    });
  });

  describe('permission confirmation', () => {
    it('should request permission for SYSTEM risk level', async () => {
      const steps = [createTestStep({ riskLevel: 'SYSTEM' })];
      mockPlanner = createMockPlanner(steps);
      mockExecutor = createMockExecutor();
      engine = new ExecutionEngine(mockPlanner, mockExecutor);

      const { events } = await runEngineWithAutoConfirm(engine, 'test goal', { confirmPermissions: [true] });

      const permissionEvent = events.find(e => e.type === 'confirm_permission');
      expect(permissionEvent).toBeDefined();
      expect(permissionEvent.payload.toolName).toBe('test_tool');
      expect(permissionEvent.payload.riskLevel).toBe('SYSTEM');
    }, 10000);

    it('should request permission for DELETE risk level', async () => {
      const steps = [createTestStep({ riskLevel: 'DELETE' })];
      mockPlanner = createMockPlanner(steps);
      mockExecutor = createMockExecutor();
      engine = new ExecutionEngine(mockPlanner, mockExecutor);

      const { events } = await runEngineWithAutoConfirm(engine, 'test goal', { confirmPermissions: [true] });

      const permissionEvent = events.find(e => e.type === 'confirm_permission');
      expect(permissionEvent).toBeDefined();
      expect(permissionEvent.payload.riskLevel).toBe('DELETE');
    }, 10000);

    it('should skip step when permission denied', async () => {
      const steps = [createTestStep({ riskLevel: 'SYSTEM' })];
      mockPlanner = createMockPlanner(steps);
      mockExecutor = createMockExecutor();
      engine = new ExecutionEngine(mockPlanner, mockExecutor);

      const { result } = await runEngineWithAutoConfirm(engine, 'test goal', { confirmPermissions: [false] });

      expect(mockExecutor).not.toHaveBeenCalled();
      expect(result.steps[0].success).toBe(false);
      expect(result.steps[0].error).toBe('用户拒绝');
    }, 10000);

    it('should not request permission for LOW risk level', async () => {
      const steps = [createTestStep({ riskLevel: 'LOW' })];
      mockPlanner = createMockPlanner(steps);
      mockExecutor = createMockExecutor();
      engine = new ExecutionEngine(mockPlanner, mockExecutor);

      const { events } = await runEngineWithAutoConfirm(engine, 'test goal');

      const permissionEvent = events.find(e => e.type === 'confirm_permission');
      expect(permissionEvent).toBeUndefined();
      expect(mockExecutor).toHaveBeenCalled();
    }, 10000);
  });

  describe('error handling', () => {
    it('should handle planner errors', async () => {
      const mockPlannerError = vi.fn().mockRejectedValue(new Error('Planner failed'));
      engine = new ExecutionEngine(mockPlannerError, createMockExecutor());

      const { events, result } = await runEngineWithAutoConfirm(engine, 'test goal');

      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.payload.message).toBe('Planner failed');
      expect(result.success).toBe(false);
    });

    it('should handle executor errors and continue', async () => {
      const steps = [
        createTestStep({ id: 'step_0' }),
        createTestStep({ id: 'step_1' }),
        createTestStep({ id: 'step_2' }),
      ];
      mockPlanner = createMockPlanner(steps);
      const mockExecutorError = vi.fn()
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Step 1 failed'))
        .mockResolvedValueOnce({ success: true });
      
      engine = new ExecutionEngine(mockPlanner, mockExecutorError);

      const { result } = await runEngineWithAutoConfirm(engine, 'test goal');

      expect(mockExecutorError).toHaveBeenCalledTimes(3);
      expect(result.steps[0].success).toBe(true);
      expect(result.steps[1].success).toBe(false);
      expect(result.steps[1].error).toBe('Step 1 failed');
      expect(result.steps[2].success).toBe(true);
    }, 10000);
  });

  describe('cancel functionality', () => {
    it('should cancel pending confirmation', async () => {
      const steps = [createTestStep()];
      mockPlanner = createMockPlanner(steps);
      engine = new ExecutionEngine(mockPlanner, createMockExecutor());

      const generator = engine.run('test goal');
      const iterator = generator[Symbol.asyncIterator]();
      
      await iterator.next();
      await iterator.next();
      
      const nextPromise = iterator.next();
      engine.cancel();
      
      const final = await nextPromise;

      expect(final.done).toBe(true);
      expect((final.value as any).success).toBe(false);
      expect((final.value as any).error).toBe('用户取消');
    }, 10000);
  });

  describe('formatter', () => {
    it('should format results when formatter provided', async () => {
      const steps = [createTestStep()];
      mockPlanner = createMockPlanner(steps);
      mockExecutor = createMockExecutor({ data: 'raw result' });
      const mockFormatter = createMockFormatter('formatted output');
      engine = new ExecutionEngine(mockPlanner, mockExecutor, mockFormatter);

      const { events } = await runEngineWithAutoConfirm(engine, 'test goal');

      const resultEvent = events.find(e => e.type === 'result');
      expect(mockFormatter).toHaveBeenCalledWith('test goal', expect.any(Array));
      expect(resultEvent.payload.data).toBe('formatted output');
    }, 10000);

    it('should skip formatter when no successful results', async () => {
      const steps = [createTestStep({ riskLevel: 'SYSTEM' })];
      mockPlanner = createMockPlanner(steps);
      mockExecutor = createMockExecutor();
      const mockFormatter = createMockFormatter();
      engine = new ExecutionEngine(mockPlanner, mockExecutor, mockFormatter);

      await runEngineWithAutoConfirm(engine, 'test goal', { confirmPermissions: [false] });

      expect(mockFormatter).not.toHaveBeenCalled();
    }, 10000);
  });

  describe('createExecutionEngine factory', () => {
    it('should create engine with all parameters', () => {
      const planner = createMockPlanner([]);
      const executor = createMockExecutor();
      const formatter = createMockFormatter();

      const engine = createExecutionEngine(planner, executor, formatter);

      expect(engine).toBeInstanceOf(ExecutionEngine);
    });

    it('should create engine without formatter', () => {
      const planner = createMockPlanner([]);
      const executor = createMockExecutor();

      const engine = createExecutionEngine(planner, executor);

      expect(engine).toBeInstanceOf(ExecutionEngine);
    });
  });

  describe('step events', () => {
    it('should emit step_start and step_complete events', async () => {
      const steps = [createTestStep({ toolName: 'test_tool' })];
      mockPlanner = createMockPlanner(steps);
      mockExecutor = createMockExecutor({ result: 'ok' });
      engine = new ExecutionEngine(mockPlanner, mockExecutor);

      const { events } = await runEngineWithAutoConfirm(engine, 'test goal');

      const startEvent = events.find(e => e.type === 'step_start');
      expect(startEvent).toBeDefined();
      expect(startEvent.payload.stepIndex).toBe(0);
      expect(startEvent.payload.totalSteps).toBe(1);
      expect(startEvent.payload.toolName).toBe('test_tool');

      const completeEvent = events.find(e => e.type === 'step_complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent.payload.stepIndex).toBe(0);
      expect(completeEvent.payload.success).toBe(true);
      expect(completeEvent.payload.result).toEqual({ result: 'ok' });
    }, 10000);
  });
});
