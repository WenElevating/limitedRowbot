import chalk from 'chalk';
import { UIState } from './state.js';
import { LayoutManager } from './layout.js';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function getDisplayWidth(str: string): number {
  let width = 0;
  for (const char of str) {
    const code = char.codePointAt(0) || 0;
    if (code === 0) continue;
    if (code < 32 || (code >= 0x7F && code < 0xA0)) {
      continue;
    }
    if (
      (code >= 0x1100 && (
        code <= 0x115F ||
        code === 0x2329 ||
        code === 0x232A ||
        (code >= 0x2E80 && code <= 0x3247 && code !== 0x303F) ||
        (code >= 0x3250 && code <= 0x4DBF) ||
        (code >= 0x4E00 && code <= 0xA4C6) ||
        (code >= 0xA960 && code <= 0xA97C) ||
        (code >= 0xAC00 && code <= 0xD7A3) ||
        (code >= 0xF900 && code <= 0xFAFF) ||
        (code >= 0xFE10 && code <= 0xFE1F) ||
        (code >= 0xFE30 && code <= 0xFE6B) ||
        (code >= 0xFF01 && code <= 0xFF60) ||
        (code >= 0xFFE0 && code <= 0xFFE6) ||
        (code >= 0x1B000 && code <= 0x1B001) ||
        (code >= 0x1F200 && code <= 0x1F251) ||
        (code >= 0x1F300 && code <= 0x1F9FF) ||
        (code >= 0x20000 && code <= 0x3FFFD)
      ))
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

export class UIRenderer {
  private layout: LayoutManager;
  private spinnerFrame = 0;
  private spinnerInterval: NodeJS.Timeout | null = null;
  private initialized = false;
  private lastRenderedLine = '';
  statusLine = '';
  private inputLine = '';
  private startTime = 0;
  private tokenCount = 0;
  private statusAction = '';
  private statusDetail = '';

  constructor(layout: LayoutManager) {
    this.layout = layout;
  }

  private hideCursor(): void {
    process.stdout.write('\x1b[?25l');
  }

  private showCursor(): void {
    process.stdout.write('\x1b[?25h');
  }

  private clearLine(): void {
    process.stdout.write('\x1b[2K');
  }

  private clearCurrentLine(): void {
    process.stdout.write('\x1b[2K\r');
  }

  private write(text: string): void {
    process.stdout.write(text);
  }

  private saveCursor(): void {
    process.stdout.write('\x1b[s');
  }

  private restoreCursor(): void {
    process.stdout.write('\x1b[u');
  }

  enterAlternateBuffer(): void {
    process.stdout.write('\x1b[?25l');
    process.stdout.write('\x1b[5 q');
  }

  exitAlternateBuffer(): void {
    this.stopSpinner();
    process.stdout.write('\r\x1b[2K');
    process.stdout.write('\x1b[?25h');
    process.stdout.write('\x1b[0 q');
  }

  render(state: UIState): void {
    if (!this.initialized) {
      this.enterAlternateBuffer();
      this.initialized = true;
    }

    this.renderHeader(state);
    this.renderInputPrompt(state);
  }

  private renderHeader(state: UIState): void {
    const debugTag = state.debug ? ' [debug]' : '';
    const configInfo = state.config 
      ? ` ${state.config.provider} / ${state.config.model}`
      : '';
    
    const left = chalk.cyan.bold('🤖 rowbot') + chalk.yellow(debugTag);
    const right = chalk.gray(configInfo);
    const width = this.layout.getConfig().totalWidth;
    const leftLen = left.replace(/\x1b\[[0-9;]*m/g, '').length;
    const rightLen = right.replace(/\x1b\[[0-9;]*m/g, '').length;
    const padding = Math.max(0, width - leftLen - rightLen);

    this.clearCurrentLine();
    this.write(left + ' '.repeat(padding) + right + '\n');
    this.write(chalk.gray('─'.repeat(width)) + '\n');
  }

  private renderInputPrompt(state: UIState): void {
    this.inputLine = '> ' + state.inputValue;
    this.write(this.inputLine);
    
    const textBeforeCursor = state.inputValue.slice(0, state.cursorPosition);
    const cursorCol = 3 + getDisplayWidth(textBeforeCursor);
    process.stdout.write(`\x1b[${cursorCol}G`);
  }

  startSpinner(): void {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
    }
    this.spinnerFrame = 0;
    this.startTime = Date.now();
    this.spinnerInterval = setInterval(() => {
      this.spinnerFrame = (this.spinnerFrame + 1) % SPINNER_FRAMES.length;
      this.updateStatusSpinner();
    }, 100);
    this.updateStatusSpinner();
  }

  setStatus(action: string, detail?: string): void {
    this.statusAction = action;
    this.statusDetail = detail || '';
    if (!this.spinnerInterval) {
      this.startSpinner();
    }
  }

  addTokens(count: number): void {
    this.tokenCount = count;
    if (this.spinnerInterval) {
      this.updateStatusSpinner();
    }
  }

  getTokenCount(): number {
    return this.tokenCount;
  }

  resetTokenCount(): void {
    this.tokenCount = 0;
  }

  private updateStatusSpinner(): void {
    const frame = SPINNER_FRAMES[this.spinnerFrame];
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);
    
    let status = chalk.cyan(frame) + ' ';
    if (this.statusAction) {
      status += this.statusAction;
    }
    if (this.statusDetail) {
      status += chalk.gray(this.statusDetail);
    }
    status += chalk.gray(` (${elapsed}s · ↑ ${this.tokenCount} tokens)`);
    
    process.stdout.write(`\r\x1b[2K${status}`);
  }

  stopSpinner(): void {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
    process.stdout.write('\r\x1b[2K');
    this.statusAction = '';
    this.statusDetail = '';
  }

  finishStreaming(): void {
    this.stopSpinner();
    process.stdout.write('\n');
  }

  renderOutputOnly(state: UIState): void {
  }

  renderStreamingUpdate(state: UIState): void {
  }

  renderStatusOnly(state: UIState): void {
    if (state.statusLine === 'thinking') {
      this.statusLine = 'thinking';
    } else {
      this.statusLine = state.statusLine || '';
      if (this.statusLine) {
        this.hideCursor();
        this.clearCurrentLine();
        this.write(this.statusLine);
        this.showCursor();
      }
    }
  }

  renderInputOnly(state: UIState): void {
    this.hideCursor();
    this.clearCurrentLine();
    this.write('> ' + state.inputValue);
    
    const textBeforeCursor = state.inputValue.slice(0, state.cursorPosition);
    const cursorCol = 3 + getDisplayWidth(textBeforeCursor);
    process.stdout.write(`\x1b[${cursorCol}G`);
    this.showCursor();
  }

  printLine(text: string): void {
    this.hideCursor();
    this.clearCurrentLine();
    this.write(text + '\n');
    this.showCursor();
  }

  printStreamingChunk(chunk: string): void {
    this.hideCursor();
    this.clearCurrentLine();
    this.write(chunk);
    this.lastRenderedLine = chunk;
    this.showCursor();
  }

  newLine(): void {
    this.hideCursor();
    this.write('\n');
    this.lastRenderedLine = '';
    this.showCursor();
  }
}
