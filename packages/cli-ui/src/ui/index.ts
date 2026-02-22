import chalk from 'chalk';
import * as readline from 'readline';
import { UIStateManager } from './state.js';
import { LayoutManager } from './layout.js';
import { UIRenderer, getDisplayWidth } from './renderer.js';
import { InputHandler, getCommandSuggestion } from './input.js';

const BANNER_LINES = [
  '    ██████╗ ██████╗ ██████╗ ███████╗',
  '    ██╔══██╗██╔══██╗██╔══██╗██╔════╝',
  '    ██████╔╝██████╔╝██████╔╝█████╗  ',
  '    ██╔══██╗██╔══██╗██╔══██╗██╔══╝  ',
  '    ██████╔╝██████╔╝██████╔╝███████╗',
  '    ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝',
];

export class TerminalUI {
  private stateManager: UIStateManager;
  private layout: LayoutManager;
  private renderer: UIRenderer;
  private inputHandler: InputHandler;
  
  private onInputCallback: ((input: string) => Promise<void>) | null = null;
  private currentLine = '';
  private isStreaming = false;
  private width: number;

  constructor() {
    this.stateManager = new UIStateManager();
    this.layout = new LayoutManager();
    this.renderer = new UIRenderer(this.layout);
    this.inputHandler = new InputHandler();
    this.width = this.layout.getConfig().totalWidth;

    this.setupInputHandler();
  }

  private setupInputHandler(): void {
    this.inputHandler.onCursorUpdate((value: string, cursor: number) => {
      this.stateManager.setInput(value, cursor);
      this.renderInputLine(value, cursor);
    });

    this.inputHandler.onSuggestion((input: string) => {
      return getCommandSuggestion(input);
    });

    this.inputHandler.onExit(() => {
      this.stop();
      process.stdout.write('\n👋 再见！\n\n');
      process.exit(0);
    });

    this.inputHandler.onInput(async (input: string) => {
      this.finalizeUserMessage(input);
      
      if (this.stateManager.getState().phase === 'idle') {
        this.stateManager.setPhase('conversation');
      }

      if (this.onInputCallback) {
        await this.onInputCallback(input);
      }
    });
  }

  private renderInputLine(value: string, cursor: number): void {
    process.stdout.write('\x1b[?25l');
    process.stdout.write('\r\x1b[K');
    process.stdout.write('> ' + value);
    
    const suggestion = this.inputHandler.getSuggestion();
    if (suggestion && suggestion.length > value.length) {
      const remaining = suggestion.slice(value.length);
      process.stdout.write(chalk.gray(remaining));
    }
    
    const textBeforeCursor = value.slice(0, cursor);
    const cursorCol = 3 + getDisplayWidth(textBeforeCursor);
    process.stdout.write(`\x1b[${cursorCol}G`);
    process.stdout.write('\x1b[?25h');
  }

  private finalizeUserMessage(content: string): void {
    process.stdout.write('\x1b[?25l');
    process.stdout.write('\x1b[1B\x1b[2K');
    process.stdout.write('\x1b[2A\x1b[2K');
    process.stdout.write('\x1b[1B\r\x1b[K');
    process.stdout.write(chalk.cyan('> ') + chalk.bgGray(chalk.white(' ' + content + ' ')));
    process.stdout.write('\n\n');
    process.stdout.write('\x1b[?25h');
  }

  onInput(callback: (input: string) => Promise<void>): void {
    this.onInputCallback = callback;
  }

  setDebug(debug: boolean): void {
    this.stateManager.setDebug(debug);
  }

  setConfig(provider: string, model: string): void {
    this.stateManager.setConfig(provider, model);
  }

  start(): void {
    this.printHeader();
    this.printBanner();
    this.printInputBox();
  }

  private printHeader(): void {
    const state = this.stateManager.getState();
    const debugTag = state.debug ? ' [debug]' : '';
    const configInfo = state.config 
      ? ` ${state.config.provider} / ${state.config.model}`
      : '';
    
    const left = chalk.cyan.bold('🤖 rowbot') + chalk.yellow(debugTag);
    const right = chalk.gray(configInfo);
    const leftLen = left.replace(/\x1b\[[0-9;]*m/g, '').length;
    const rightLen = right.replace(/\x1b\[[0-9;]*m/g, '').length;
    const padding = Math.max(0, this.width - leftLen - rightLen);

    process.stdout.write(left + ' '.repeat(padding) + right + '\n');
    process.stdout.write(chalk.gray('─'.repeat(this.width)) + '\n');
  }

  private printBanner(): void {
    const centerCol = Math.floor((this.width - 40) / 2);
    const padding = ' '.repeat(Math.max(0, centerCol));

    process.stdout.write('\n');
    for (const line of BANNER_LINES) {
      process.stdout.write(padding + chalk.cyan(line) + '\n');
    }
    process.stdout.write('\n');

    const tip = '输入任务让我帮你完成';
    const tipPadding = ' '.repeat(Math.max(0, Math.floor((this.width - 20) / 2)));
    process.stdout.write(tipPadding + chalk.gray('💡 ') + chalk.white(tip) + '\n');
    process.stdout.write('\n');

    const helpText = '输入 /help 查看可用命令';
    const helpPadding = ' '.repeat(Math.max(0, Math.floor((this.width - helpText.length) / 2)));
    process.stdout.write(helpPadding + chalk.gray(helpText) + '\n');
    process.stdout.write('\n');
  }

  private printSeparator(): void {
    process.stdout.write(chalk.gray('─'.repeat(this.width)) + '\n');
  }

  private printInputBox(): void {
    this.printSeparator();
    process.stdout.write('> \n');
    this.printSeparator();
    process.stdout.write('\x1b[2A\x1b[3G');
  }

  stop(): void {
    process.stdout.write('\x1b[2A\x1b[J');
    this.renderer.exitAlternateBuffer();
  }

  addUserMessage(content: string): void {
    this.printSeparator();
    process.stdout.write(chalk.cyan('> ') + chalk.bgGray(chalk.white(' ' + content + ' ')) + '\n');
    this.printSeparator();
  }

  addAssistantMessage(content: string): void {
    const lines = content.split('\n');
    process.stdout.write(chalk.white('● ') + lines[0] + '\n');
    
    for (const line of lines.slice(1)) {
      process.stdout.write(chalk.white('  ') + line + '\n');
    }
    process.stdout.write('\n');
    this.printInputBox();
  }

  startStreaming(): void {
    this.renderer.stopSpinner();
    process.stdout.write('\r\x1b[2K');
    this.isStreaming = true;
    this.currentLine = '';
    process.stdout.write(chalk.white('● '));
  }

  streamChunk(chunk: string): void {
    if (!this.isStreaming) return;
    this.currentLine += chunk;
    for (const char of chunk) {
      if (char === '\n') {
        process.stdout.write('\n  ');
      } else {
        process.stdout.write(char);
      }
    }
  }

  stopStreaming(): void {
    this.isStreaming = false;
    const tokenCount = this.renderer.getTokenCount();
    if (tokenCount > 0) {
      process.stdout.write(chalk.gray(`\n  ↑ ${tokenCount} tokens\n`));
    }
    process.stdout.write('\n');
    this.printInputBox();
    this.renderer.resetTokenCount();
  }

  setStatus(status: string): void {
    this.stateManager.setStatusLine(status);
  }

  showThinking(): void {
    this.stateManager.setStatusLine('thinking');
    this.renderer.statusLine = 'thinking';
    process.stdout.write('\r\x1b[2K');
    this.renderer.setStatus('思考中...');
  }

  hideThinking(): void {
    this.renderer.stopSpinner();
    this.stateManager.setStatusLine('');
    this.renderer.statusLine = '';
    process.stdout.write('\r\x1b[2K');
  }

  showStep(action: string, detail?: string): void {
    if (detail) {
      process.stdout.write(chalk.white('● ') + chalk.cyan(action) + chalk.gray(detail) + '\n');
    } else {
      process.stdout.write(chalk.white('● ') + chalk.cyan(action) + '\n');
    }
  }

  showStepResult(result: string): void {
    process.stdout.write(chalk.gray('  ⎿ ') + chalk.white(result) + '\n');
  }

  showStepDone(): void {
    this.printInputBox();
  }

  showStreamingStatus(action: string, detail?: string): void {
    this.renderer.setStatus(action, detail);
  }

  addTokens(count: number): void {
    this.renderer.addTokens(count);
  }

  showError(error: string): void {
    process.stdout.write(chalk.red(`❌ ${error}`) + '\n');
    this.printInputBox();
  }

  showSuccess(message: string): void {
    process.stdout.write(chalk.green(`✅ ${message}`) + '\n');
    this.printInputBox();
  }

  showListSelect(
    title: string,
    items: string[],
    onSelect: (index: number) => void,
    onCancel?: () => void
  ): void {
    let selectedIndex = 0;
    const lineCount = items.length + 2;
    let startRow = 0;

    const render = () => {
      process.stdout.write('\x1b[?25l');
      
      readline.cursorTo(process.stdout, 0, startRow);
      readline.clearScreenDown(process.stdout);
      
      process.stdout.write(chalk.white('● ') + chalk.cyan(title) + '\n');
      
      for (let i = 0; i < items.length; i++) {
        const prefix = i === selectedIndex ? chalk.green('❯ ') : '  ';
        const item = i === selectedIndex ? chalk.white(items[i]) : chalk.gray(items[i]);
        process.stdout.write(prefix + item + '\n');
      }
      
      process.stdout.write(chalk.gray('  ↑↓ 选择  Enter 确认  Esc 取消'));
      
      readline.cursorTo(process.stdout, 0, startRow + lineCount - 1);
      process.stdout.write('\x1b[?25h');
    };

    process.stdout.write('\n'.repeat(lineCount));
    startRow = (process.stdout.rows ?? 24) - lineCount - 1;
    if (startRow < 0) startRow = 0;

    render();

    this.inputHandler.startListMode(
      items,
      (index) => {
        readline.cursorTo(process.stdout, 0, startRow + lineCount);
        readline.clearScreenDown(process.stdout);
        onSelect(index);
      },
      () => {
        readline.cursorTo(process.stdout, 0, startRow + lineCount);
        readline.clearScreenDown(process.stdout);
        onCancel?.();
      },
      (newIndex) => {
        selectedIndex = newIndex;
        render();
      }
    );
  }

  showInputPrompt(prompt: string, onInput: (value: string) => void, onCancel?: () => void): void {
    process.stdout.write('\r\x1b[2K');
    process.stdout.write(chalk.white('● ') + chalk.cyan(prompt) + '\n');
    process.stdout.write(chalk.gray('  输入新值，按 Enter 确认\n'));
    process.stdout.write('> ');
    
    const savedCallback = this.onInputCallback;
    
    this.inputHandler.onInput(async (input: string) => {
      this.onInputCallback = savedCallback;
      process.stdout.write('\x1b[3A\x1b[J');
      onInput(input);
    });
  }
}
