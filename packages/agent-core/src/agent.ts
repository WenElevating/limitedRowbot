import type { LLMProvider, ChatMessage, ToolDefinition } from '@robot/llm-adapter';
import type { ToolRegistry } from '@robot/tool-system';
import type { ExecutionPlan, ExecutionStep, AgentConfig, AgentSession, ExecutionResult, PlanCallback, StepCallback } from './types.js';
import type { Logger } from '@robot/logger';
import type { PermissionGuard, PermissionRequest } from '@robot/permission-system';
import { RiskLevel } from '@robot/permission-system';

const SYSTEM_PROMPT = `You are a Windows desktop automation agent. You help users accomplish tasks by using the available tools.

When given a task:
1. Analyze what needs to be done
2. Plan the steps using the available tools
3. Execute each step carefully
4. Report the results

Available tools will be provided to you. Use them responsibly.

Important rules:
- Always use absolute paths for file operations
- Be careful with delete operations
- Ask for clarification if the task is ambiguous
- Report errors clearly and suggest solutions`;

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

function extractRiskLevel(toolName: string, toolRegistry: ToolRegistry): RiskLevel {
  const tool = toolRegistry.get(toolName);
  return tool?.riskLevel ?? RiskLevel.MODIFY;
}

export class Agent {
  private llmProvider: LLMProvider;
  private toolRegistry: ToolRegistry;
  private permissionGuard: PermissionGuard;
  private logger: Logger;
  private maxIterations: number;
  private workingDirectory: string;
  private systemPrompt: string;
  private onPlanCreated?: PlanCallback;
  private onStepExecuted?: StepCallback;

  constructor(config: AgentConfig) {
    this.llmProvider = config.llmProvider;
    this.toolRegistry = config.toolRegistry;
    this.permissionGuard = config.permissionGuard;
    this.logger = config.logger;
    this.maxIterations = config.maxIterations ?? 10;
    this.workingDirectory = config.workingDirectory ?? process.cwd();
    this.systemPrompt = config.systemPrompt ?? SYSTEM_PROMPT;
  }

  setPlanCallback(callback: PlanCallback): void {
    this.onPlanCreated = callback;
  }

  setStepCallback(callback: StepCallback): void {
    this.onStepExecuted = callback;
  }

  async createSession(userGoal: string): Promise<AgentSession> {
    const { generateTaskId } = await import('@robot/logger');
    const taskId = generateTaskId();
    
    this.logger.info('agent', taskId, 'Creating new session', { goal: userGoal });

    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: userGoal },
    ];

    return {
      taskId,
      messages,
    };
  }

  async plan(session: AgentSession): Promise<ExecutionPlan> {
    const { taskId, messages } = session;
    
    this.logger.info('agent', taskId, 'Creating execution plan');

    const toolDefinitions = this.toolRegistry.getDefinitions();
    
    const response = await this.llmProvider.complete(messages, {
      tools: toolDefinitions,
      toolChoice: 'auto',
    });

    const plan: ExecutionPlan = {
      id: generateId(),
      taskId,
      goal: messages[messages.length - 1]?.content ?? '',
      steps: [],
      status: 'pending',
      createdAt: new Date(),
    };

    if (response.message.toolCalls && response.message.toolCalls.length > 0) {
      for (const toolCall of response.message.toolCalls) {
        const params = JSON.parse(toolCall.function.arguments);
        const riskLevel = extractRiskLevel(toolCall.function.name, this.toolRegistry);
        
        plan.steps.push({
          id: generateId(),
          toolName: toolCall.function.name,
          params,
          description: `Execute ${toolCall.function.name}`,
          riskLevel,
          status: 'pending',
        });
      }
    }

    session.messages.push(response.message);
    session.plan = plan;

    this.logger.info('agent', taskId, 'Plan created', { 
      stepCount: plan.steps.length,
      tools: plan.steps.map(s => s.toolName),
    });

    if (this.onPlanCreated) {
      const approved = await this.onPlanCreated(plan);
      if (!approved) {
        plan.status = 'cancelled';
        this.logger.warn('agent', taskId, 'Plan cancelled by user');
      }
    }

    return plan;
  }

  async execute(session: AgentSession, dryRun = false): Promise<ExecutionResult> {
    const { taskId, plan } = session;
    
    if (!plan) {
      return {
        success: false,
        plan: {
          id: generateId(),
          taskId,
          goal: '',
          steps: [],
          status: 'failed',
          createdAt: new Date(),
          error: 'No plan to execute',
        },
        error: 'No plan to execute',
      };
    }

    if (plan.status === 'cancelled') {
      return {
        success: false,
        plan,
        error: 'Plan was cancelled',
      };
    }

    plan.status = 'running';
    plan.startedAt = new Date();
    
    this.logger.info('agent', taskId, 'Starting execution', { dryRun });

    const totalSteps = plan.steps.length;
    let iteration = 0;
    let allStepsCompleted = true;

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      if (!step) continue;
      
      iteration++;
      
      if (iteration > this.maxIterations) {
        this.logger.warn('agent', taskId, 'Max iterations reached');
        plan.status = 'failed';
        plan.error = 'Maximum iterations reached';
        break;
      }

      step.status = 'running';
      
      this.logger.info('agent', taskId, `Executing step ${i + 1}/${totalSteps}`, {
        tool: step.toolName,
        params: step.params,
      });

      const tool = this.toolRegistry.get(step.toolName);
      
      if (!tool) {
        step.status = 'failed';
        step.error = `Tool not found: ${step.toolName}`;
        allStepsCompleted = false;
        
        this.logger.error('agent', taskId, `Tool not found: ${step.toolName}`);
        
        if (this.onStepExecuted) {
          await this.onStepExecuted(step, i, totalSteps);
        }
        continue;
      }

      const permissionRequest: PermissionRequest = {
        toolName: step.toolName,
        action: 'execute',
        target: typeof step.params.path === 'string' ? step.params.path : undefined,
        riskLevel: step.riskLevel,
        description: step.description,
        data: step.params,
      };

      const permission = await this.permissionGuard.evaluate(permissionRequest);
      
      if (!permission.granted) {
        step.status = 'skipped';
        step.error = permission.reason ?? 'Permission denied';
        
        this.logger.warn('agent', taskId, 'Permission denied', { 
          tool: step.toolName, 
          reason: permission.reason 
        });
        
        if (this.onStepExecuted) {
          await this.onStepExecuted(step, i, totalSteps);
        }
        continue;
      }

      if (permission.requiresBackup && typeof step.params.path === 'string') {
        try {
          const backupPath = await this.permissionGuard.createBackup?.(step.params.path);
          this.logger.info('agent', taskId, 'Backup created', { backupPath });
        } catch (error) {
          this.logger.warn('agent', taskId, 'Failed to create backup', { 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      try {
        const context = {
          taskId,
          workingDirectory: this.workingDirectory,
          dryRun,
        };

        const result = await tool.execute(step.params, context);
        step.result = result;
        step.status = result.success ? 'completed' : 'failed';
        
        if (!result.success) {
          step.error = result.error;
          allStepsCompleted = false;
        }

        this.logger.info('agent', taskId, 'Step completed', {
          tool: step.toolName,
          success: result.success,
        });
      } catch (error) {
        step.status = 'failed';
        step.error = error instanceof Error ? error.message : String(error);
        allStepsCompleted = false;
        
        this.logger.error('agent', taskId, 'Step failed', {
          tool: step.toolName,
          error: step.error,
        });
      }

      if (this.onStepExecuted) {
        await this.onStepExecuted(step, i, totalSteps);
      }
    }

    plan.status = allStepsCompleted ? 'completed' : 'failed';
    plan.completedAt = new Date();

    this.logger.info('agent', taskId, 'Execution finished', {
      status: plan.status,
      stepsCompleted: plan.steps.filter(s => s.status === 'completed').length,
      stepsFailed: plan.steps.filter(s => s.status === 'failed').length,
    });

    return {
      success: allStepsCompleted,
      plan,
      error: allStepsCompleted ? undefined : 'Some steps failed',
    };
  }

  async run(userGoal: string, dryRun = false): Promise<ExecutionResult> {
    const session = await this.createSession(userGoal);
    await this.plan(session);
    return this.execute(session, dryRun);
  }
}

export function createAgent(config: AgentConfig): Agent {
  return new Agent(config);
}
