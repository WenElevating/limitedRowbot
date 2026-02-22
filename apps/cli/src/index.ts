#!/usr/bin/env node
import { Command } from 'commander';
import { config } from 'dotenv';
import chalk from 'chalk';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { TerminalUI } from '@robot/cli-ui';
import { createOpenAIProvider, createGlmProvider, GLM_MODELS, type LLMProvider } from '@robot/llm-adapter';
import { createSemanticRouter } from '@robot/intent-router';
import { createShellAdapter } from '@robot/windows-adapter';
import { createToolService, type ToolService } from './tool-service.js';

config();

const CONFIG_DIR = join(homedir(), '.robot');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

interface AppConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

interface AppContext {
  llmProvider: LLMProvider;
  config: AppConfig;
  chatHistory: { role: 'user' | 'assistant' | 'system'; content: string }[];
  toolService?: ToolService;
  setProvider: (provider: LLMProvider, config: AppConfig) => void;
}

function loadConfig(): AppConfig | null {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    const content = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function saveConfig(cfg: AppConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

async function createProvider(cfg: AppConfig): Promise<LLMProvider> {
  if (cfg.provider === 'glm') {
    return createGlmProvider({
      model: cfg.model,
      apiKey: cfg.apiKey || process.env.GLM_API_KEY || '',
      baseUrl: cfg.baseUrl,
    });
  }
  return createOpenAIProvider({
    model: cfg.model,
    apiKey: cfg.apiKey || process.env.OPENAI_API_KEY || '',
    baseUrl: cfg.baseUrl,
  });
}

async function initContext(): Promise<AppContext> {
  let cfg = loadConfig();
  
  if (!cfg) {
    cfg = {
      provider: 'glm',
      model: 'glm-4-flash',
      apiKey: process.env.GLM_API_KEY || '',
      baseUrl: process.env.GLM_BASE_URL,
    };
    saveConfig(cfg);
  }

  const llmProvider = await createProvider(cfg);

  let currentProvider = llmProvider;
  let currentConfig = cfg;

  return {
    get llmProvider() { return currentProvider; },
    get config() { return currentConfig; },
    chatHistory: [],
    setProvider: (provider: LLMProvider, config: AppConfig) => {
      currentProvider = provider;
      currentConfig = config;
    },
  };
}

const SYSTEM_PROMPT = `你是一个高效、准确、极速响应的 CLI 助手。请严格遵循以下规则：

1. **理解意图**：快速识别用户请求类型，包括系统任务、知识问答、天气查询、文档检索等。
2. **响应适中**：回答要简洁但完整，不要过于简短导致信息不足，也不要过于冗长。结构化输出，使用列表和分类让信息清晰。
3. **直接执行/回答**：
   - 系统任务（CPU、内存、磁盘、文件、进程） → 直接生成可执行命令或操作建议。
   - 问答、知识查询 → 使用最新文档 / MCP / 网络资源回答，直接给出结论。
   - 天气、时间等动态信息 → 返回准确的实时结果。
4. **输出结构化**：
   - 必要时区分：
     - 命令: <执行命令>
     - 输出: <结果摘要>
     - 总结: <核心结论>
   - 使用分类和列表组织信息，让内容易读。
5. **中文优先**：默认使用中文，简明扼要。
6. **避免废话**：不要重复用户输入，不输出无关背景信息。
7. **安全与确认**：涉及破坏性操作（删除文件、终止进程等）必须确认用户意图。
8. **快速决策**：
   - 不做冗长分析，直接给出可操作内容或准确答案。
   - 如果信息不完整，可简短提示补充。
9. **引用最新信息**：
   - 如果有可用 MCP（如 Context7 或网页抓取），优先使用最新文档/数据。
   - 输出必须保证信息最新、准确。`;

function getIntentAcknowledgment(input: string): string {
  const lowerInput = input.toLowerCase();
  
  if (lowerInput.includes('规划') || lowerInput.includes('方案') || lowerInput.includes('计划')) {
    return '我来帮你规划一个方案！';
  }
  if (lowerInput.includes('cpu')) {
    return '我来检查 CPU 占用情况...';
  }
  if (lowerInput.includes('内存') || lowerInput.includes('memory')) {
    return '我来检查内存占用情况...';
  }
  if (lowerInput.includes('磁盘') || lowerInput.includes('disk')) {
    return '我来检查磁盘使用情况...';
  }
  if (lowerInput.includes('天气')) {
    return '我来查询天气信息...';
  }
  if (lowerInput.includes('推荐') || lowerInput.includes('好玩') || lowerInput.includes('景点')) {
    return '我来帮你搜索相关信息...';
  }
  
  return '我来处理你的请求...';
}

function detectTaskType(input: string): 'system' | 'search' | 'general' {
  const lowerInput = input.toLowerCase();
  
  if (lowerInput.includes('cpu') || lowerInput.includes('内存') || lowerInput.includes('memory') || 
      lowerInput.includes('磁盘') || lowerInput.includes('disk') || lowerInput.includes('进程')) {
    return 'system';
  }
  
  if (lowerInput.includes('规划') || lowerInput.includes('方案') || lowerInput.includes('推荐') ||
      lowerInput.includes('景点') || lowerInput.includes('好玩') || lowerInput.includes('攻略')) {
    return 'search';
  }
  
  return 'general';
}

function trimHistory(history: { role: 'user' | 'assistant' | 'system'; content: string }[]): { role: 'user' | 'assistant' | 'system'; content: string }[] {
  if (history.length <= 6) return history;
  return history.slice(-6);
}

async function executeSystemTask(input: string, ctx: AppContext, ui: TerminalUI): Promise<void> {
  const shellAdapter = createShellAdapter();
  let command = '';
  let result;
  
  const lowerInput = input.toLowerCase();
  
  if (lowerInput.includes('cpu')) {
    ui.showStep('执行命令', ' - 查询 CPU 占用');
    command = 'Get-Process | Sort-Object CPU -Descending | Select-Object -First 5';
    result = await shellAdapter.executePowerShell(
      'Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name, @{N="CPU(s)";E={$_.CPU.ToString("F2")}}, @{N="Memory(MB)";E={$_.WorkingSet64/1MB.ToString("F2")}} | Format-Table -AutoSize'
    );
  } else if (lowerInput.includes('内存') || lowerInput.includes('memory')) {
    ui.showStep('执行命令', ' - 查询内存占用');
    command = 'Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 5';
    result = await shellAdapter.executePowerShell(
      'Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 5 Name, @{N="Memory(MB)";E={$_.WorkingSet64/1MB.ToString("F2")}}, @{N="CPU(s)";E={$_.CPU.ToString("F2")}} | Format-Table -AutoSize'
    );
  } else if (lowerInput.includes('磁盘') || lowerInput.includes('disk')) {
    ui.showStep('执行命令', ' - 查询磁盘使用');
    command = 'Get-PSDrive -PSProvider FileSystem';
    result = await shellAdapter.executePowerShell(
      'Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N="Used(GB)";E={$_.Used/1GB.ToString("F2")}}, @{N="Free(GB)";E={$_.Free/1GB.ToString("F2")}} | Format-Table -AutoSize'
    );
  } else {
    ui.showStep('执行命令', ' - 查询进程信息');
    command = 'Get-Process | Select-Object -First 10';
    result = await shellAdapter.executePowerShell(
      'Get-Process | Select-Object -First 10 Name, Id, CPU, @{N="Memory(MB)";E={$_.WorkingSet64/1MB.ToString("F2")}} | Format-Table -AutoSize'
    );
  }
  
  const output = result.stdout || result.stderr;
  ui.showStepResult(output.slice(0, 300) + (output.length > 300 ? '...' : ''));
  
  ui.showStreamingStatus('分析结果', ' - 生成总结...');
  
  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: `用户问题: ${input}\n\n执行结果:\n${output}\n\n请用2-3句话简洁总结。` },
  ];
  
  if (ctx.llmProvider.stream) {
    ui.showStreamingStatus('生成中', '...');
    ui.addTokens(0);
    
    let fullContent = '';
    let tokenCount = 0;
    let started = false;
    
    for await (const chunk of ctx.llmProvider.stream(messages)) {
      if (chunk.delta.content) {
        if (!started) {
          started = true;
          ui.hideThinking();
          ui.startStreaming();
        }
        fullContent += chunk.delta.content;
        tokenCount = Math.ceil(fullContent.length / 2);
        ui.addTokens(tokenCount);
        ui.streamChunk(chunk.delta.content);
      }
    }
    
    ui.stopStreaming();
    ctx.chatHistory.push({ role: 'user', content: input });
    ctx.chatHistory.push({ role: 'assistant', content: fullContent });
  } else {
    const response = await ctx.llmProvider.complete(messages);
    ui.hideThinking();
    if (response.usage) {
      ui.addTokens(response.usage.totalTokens);
    }
    ui.addAssistantMessage(response.message.content);
    ctx.chatHistory.push({ role: 'user', content: input });
    ctx.chatHistory.push({ role: 'assistant', content: response.message.content });
  }
}

async function executeSearchTask(input: string, ctx: AppContext, ui: TerminalUI): Promise<void> {
  ui.showStep('Search', `(${input.slice(0, 30)}${input.length > 30 ? '...' : ''})`);
  
  ui.showStreamingStatus('搜索中', '...');
  
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...trimHistory(ctx.chatHistory),
    { role: 'user', content: input },
  ];
  
  if (ctx.llmProvider.stream) {
    ui.showStreamingStatus('生成中', '...');
    ui.addTokens(0);
    
    let fullContent = '';
    let tokenCount = 0;
    let started = false;
    
    for await (const chunk of ctx.llmProvider.stream(messages)) {
      if (chunk.delta.content) {
        if (!started) {
          started = true;
          ui.hideThinking();
          ui.showStepResult(`Found results for "${input.slice(0, 30)}..."`);
          ui.startStreaming();
        }
        fullContent += chunk.delta.content;
        tokenCount = Math.ceil(fullContent.length / 2);
        ui.addTokens(tokenCount);
        ui.streamChunk(chunk.delta.content);
      }
    }
    
    ui.stopStreaming();
    ctx.chatHistory.push({ role: 'user', content: input });
    ctx.chatHistory.push({ role: 'assistant', content: fullContent });
  } else {
    const response = await ctx.llmProvider.complete(messages);
    ui.hideThinking();
    ui.showStepResult(`Found results for "${input.slice(0, 30)}..."`);
    if (response.usage) {
      ui.addTokens(response.usage.totalTokens);
    }
    ui.addAssistantMessage(response.message.content);
    ctx.chatHistory.push({ role: 'user', content: input });
    ctx.chatHistory.push({ role: 'assistant', content: response.message.content });
  }
}

async function executeGeneralTask(input: string, ctx: AppContext, ui: TerminalUI): Promise<void> {
  if (ctx.chatHistory.length === 0) {
    ctx.chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
  }
  
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    ...trimHistory(ctx.chatHistory),
    { role: 'user', content: input },
  ];
  
  if (ctx.llmProvider.stream) {
    ui.showStreamingStatus('思考中', '...');
    ui.addTokens(0);
    
    let fullContent = '';
    let tokenCount = 0;
    let started = false;
    
    for await (const chunk of ctx.llmProvider.stream(messages)) {
      if (chunk.delta.content) {
        if (!started) {
          started = true;
          ui.hideThinking();
          ui.startStreaming();
        }
        fullContent += chunk.delta.content;
        tokenCount = Math.ceil(fullContent.length / 2);
        ui.addTokens(tokenCount);
        ui.streamChunk(chunk.delta.content);
      }
    }
    
    ui.stopStreaming();
    ctx.chatHistory.push({ role: 'user', content: input });
    ctx.chatHistory.push({ role: 'assistant', content: fullContent });
    ctx.chatHistory = trimHistory(ctx.chatHistory);
  } else {
    ui.showStreamingStatus('思考中', '...');
    const response = await ctx.llmProvider.complete(messages);
    ui.hideThinking();
    if (response.usage) {
      ui.addTokens(response.usage.totalTokens);
    }
    ui.addAssistantMessage(response.message.content);
    ctx.chatHistory.push({ role: 'user', content: input });
    ctx.chatHistory.push({ role: 'assistant', content: response.message.content });
  }
}

const BUILTIN_COMMANDS: Record<string, string> = {
  '/help': `可用命令：
  /help     - 显示帮助信息
  /clear    - 清空对话历史
  /exit     - 退出程序
  /config   - 显示/修改配置
  /model    - 显示可用模型列表
  /model <name> - 切换到指定模型
  /mcp      - MCP 工具（开发中）
  /weather  - 天气查询（开发中）
  /search   - 搜索功能（开发中）
  
直接输入问题即可与我对话！`,
  '/clear': '对话历史已清空。',
  '/exit': '再见！',
  '/config': '',
  '/model': '',
  '/mcp': 'MCP 工具功能开发中...',
  '/weather': '天气查询功能开发中...',
  '/search': '搜索功能开发中...',
};

function isBuiltinCommand(input: string): string | null {
  const parts = input.trim().toLowerCase().split(/\s+/);
  const cmd = parts[0];
  if (cmd && cmd in BUILTIN_COMMANDS) {
    return cmd;
  }
  return null;
}

async function processInput(input: string, ctx: AppContext, ui: TerminalUI): Promise<void> {
  const builtinCmd = isBuiltinCommand(input);
  
  if (builtinCmd) {
    const args = input.trim().split(/\s+/).slice(1);
    
    switch (builtinCmd) {
      case '/help':
        ui.showStep('显示帮助');
        ui.showStepResult(BUILTIN_COMMANDS['/help']!);
        ui.showStepDone();
        break;
      case '/clear':
        ctx.chatHistory.length = 0;
        ui.showStep('清空历史');
        ui.showStepResult(BUILTIN_COMMANDS['/clear']!);
        ui.showStepDone();
        break;
      case '/exit':
        ui.showStep('退出');
        ui.showStepResult(BUILTIN_COMMANDS['/exit']!);
        setTimeout(() => process.exit(0), 500);
        break;
      case '/config':
        const configItems = [
          `Provider: ${ctx.config.provider}`,
          `Model: ${ctx.config.model}`,
          `API Key: ${ctx.config.apiKey ? '********' : '(未设置)'}`,
          `Base URL: ${ctx.config.baseUrl || '(默认)'}`,
        ];
        
        ui.showListSelect(
          '选择要修改的配置项',
          configItems,
          async (index) => {
            const keys = ['provider', 'model', 'apiKey', 'baseUrl'] as const;
            const key = keys[index];
            const keyNames = ['Provider', 'Model', 'API Key', 'Base URL'];
            
            if (key === 'model' && ctx.config.provider === 'glm') {
              ui.showListSelect(
                '选择模型',
                [...GLM_MODELS],
                async (modelIndex) => {
                  const modelName = GLM_MODELS[modelIndex] ?? 'glm-4-flash';
                  const newConfig: AppConfig = { ...ctx.config, model: modelName };
                  saveConfig(newConfig);
                  const newProvider = await createProvider(newConfig);
                  ctx.setProvider(newProvider, newConfig);
                  ui.setConfig(newConfig.provider, newConfig.model);
                  ui.showStep('配置已更新');
                  ui.showStepResult(`Model 已切换为: ${modelName}`);
                  ui.showStepDone();
                },
                () => {
                  ui.showStep('已取消');
                  ui.showStepDone();
                }
              );
            } else {
              ui.showInputPrompt(
                `修改 ${keyNames[index]}`,
                async (value) => {
                  if (value.trim()) {
                    let newConfig: AppConfig;
                    if (key === 'provider') {
                      newConfig = { ...ctx.config, provider: value.trim() };
                    } else if (key === 'model') {
                      newConfig = { ...ctx.config, model: value.trim() };
                    } else if (key === 'apiKey') {
                      newConfig = { ...ctx.config, apiKey: value.trim() };
                    } else {
                      newConfig = { ...ctx.config, baseUrl: value.trim() };
                    }
                    saveConfig(newConfig);
                    const newProvider = await createProvider(newConfig);
                    ctx.setProvider(newProvider, newConfig);
                    ui.setConfig(newConfig.provider, newConfig.model);
                    ui.showStep('配置已更新');
                    ui.showStepResult(`${keyNames[index]} 已更新`);
                    ui.showStepDone();
                  } else {
                    ui.showStep('已取消');
                    ui.showStepResult('配置未修改');
                    ui.showStepDone();
                  }
                },
                () => {
                  ui.showStep('已取消');
                  ui.showStepDone();
                }
              );
            }
          },
          () => {
            ui.showStep('已取消');
            ui.showStepDone();
          }
        );
        break;
      case '/model':
        if (ctx.config.provider === 'glm') {
          ui.showListSelect(
            '选择模型',
            [...GLM_MODELS],
            async (modelIndex) => {
              const modelName = GLM_MODELS[modelIndex] ?? 'glm-4-flash';
              const newConfig: AppConfig = { ...ctx.config, model: modelName };
              saveConfig(newConfig);
              const newProvider = await createProvider(newConfig);
              ctx.setProvider(newProvider, newConfig);
              ui.setConfig(newConfig.provider, newConfig.model);
              ui.showStep('模型已切换');
              ui.showStepResult(`当前模型: ${modelName}`);
              ui.showStepDone();
            },
            () => {
              ui.showStep('已取消');
              ui.showStepDone();
            }
          );
        } else {
          ui.showStep('可用模型');
          ui.showStepResult(`当前 Provider: ${ctx.config.provider}\n当前模型: ${ctx.config.model}`);
          ui.showStepDone();
        }
        break;
      case '/mcp':
      case '/weather':
      case '/search':
        ui.showStep(builtinCmd.slice(1).toUpperCase());
        ui.showStepResult(BUILTIN_COMMANDS[builtinCmd]!);
        ui.showStepDone();
        break;
    }
    return;
  }
  
  const acknowledgment = getIntentAcknowledgment(input);
  ui.showStep(acknowledgment);
  
  try {
    const taskType = detectTaskType(input);
    
    switch (taskType) {
      case 'system':
        await executeSystemTask(input, ctx, ui);
        break;
      case 'search':
        await executeSearchTask(input, ctx, ui);
        break;
      default:
        await executeGeneralTask(input, ctx, ui);
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.name === 'TimeoutError') {
        ui.showError('请求超时，请稍后重试');
      } else {
        ui.showError(`发生错误: ${error.message}`);
      }
    } else {
      ui.showError('发生未知错误');
    }
  }
}

async function main() {
  const program = new Command();
  
  program
    .name('rowbot')
    .description('Windows Desktop AI Agent')
    .version('0.1.0')
    .option('--debug', 'Enable debug mode')
    .option('--tools', 'Enable tool system')
    .parse();

  const options = program.opts();
  const debugMode = options.debug || false;
  const toolsEnabled = options.tools || false;

  const ctx = await initContext();
  
  const ui = new TerminalUI();
  ui.setDebug(debugMode);
  ui.setConfig(ctx.config.provider, ctx.config.model);

  if (toolsEnabled) {
    const toolService = createToolService(ui, {
      workingDirectory: process.cwd(),
    });
    await toolService.initialize();
    ctx.toolService = toolService;
  }

  process.on('exit', () => {
    ui.stop();
  });

  process.on('SIGINT', () => {
    ui.stop();
    process.stdout.write('\n👋 再见！\n\n');
    process.exit(0);
  });

  ui.onInput(async (text) => {
    await processInput(text, ctx, ui);
  });

  ui.start();
}

main().catch(console.error);
