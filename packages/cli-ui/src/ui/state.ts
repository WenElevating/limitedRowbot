export interface UIState {
  header: string[];
  outputBuffer: string[];
  inputValue: string;
  cursorPosition: number;
  statusLine: string;
  isStreaming: boolean;
  tokenCount: number;
  startTime: number | null;
  phase: 'idle' | 'conversation';
  debug: boolean;
  config: {
    provider: string;
    model: string;
  } | null;
}

export type StateSubscriber = (state: UIState) => void;

export class UIStateManager {
  private state: UIState;
  private subscribers: StateSubscriber[] = [];

  constructor() {
    this.state = {
      header: [],
      outputBuffer: [],
      inputValue: '',
      cursorPosition: 0,
      statusLine: '',
      isStreaming: false,
      tokenCount: 0,
      startTime: null,
      phase: 'idle',
      debug: false,
      config: null,
    };
  }

  getState(): UIState {
    return this.state;
  }

  subscribe(fn: StateSubscriber): () => void {
    this.subscribers.push(fn);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== fn);
    };
  }

  private emit(): void {
    for (const fn of this.subscribers) {
      fn(this.state);
    }
  }

  setDebug(debug: boolean): void {
    this.state = { ...this.state, debug };
    this.emit();
  }

  setConfig(provider: string, model: string): void {
    this.state = { ...this.state, config: { provider, model } };
    this.emit();
  }

  setPhase(phase: 'idle' | 'conversation'): void {
    this.state = { ...this.state, phase };
    this.emit();
  }

  setInputValue(value: string): void {
    this.state = { ...this.state, inputValue: value };
  }

  setCursorPosition(position: number): void {
    this.state = { ...this.state, cursorPosition: position };
  }

  setInput(value: string, cursor: number): void {
    this.state = { ...this.state, inputValue: value, cursorPosition: cursor };
  }

  appendInputValue(char: string): void {
    this.state = { ...this.state, inputValue: this.state.inputValue + char };
  }

  backspace(): void {
    this.state = { ...this.state, inputValue: this.state.inputValue.slice(0, -1) };
  }

  clearInput(): string {
    const value = this.state.inputValue;
    this.state = { ...this.state, inputValue: '' };
    return value;
  }

  startStreaming(): void {
    this.state = {
      ...this.state,
      isStreaming: true,
      startTime: Date.now(),
      tokenCount: 0,
    };
    this.emit();
  }

  stopStreaming(): void {
    this.state = { ...this.state, isStreaming: false };
    this.emit();
  }

  addToken(count: number = 1): void {
    this.state = { ...this.state, tokenCount: this.state.tokenCount + count };
    this.emit();
  }

  appendOutput(text: string): void {
    const lines = text.split('\n');
    this.state = {
      ...this.state,
      outputBuffer: [...this.state.outputBuffer, ...lines],
    };
    this.emit();
  }

  appendToLastLine(text: string): void {
    const buffer = [...this.state.outputBuffer];
    if (buffer.length > 0) {
      buffer[buffer.length - 1] += text;
    } else {
      buffer.push(text);
    }
    this.state = { ...this.state, outputBuffer: buffer };
    this.emit();
  }

  newLine(): void {
    this.state = {
      ...this.state,
      outputBuffer: [...this.state.outputBuffer, ''],
    };
    this.emit();
  }

  setStatusLine(status: string): void {
    this.state = { ...this.state, statusLine: status };
    this.emit();
  }

  clearOutput(): void {
    this.state = { ...this.state, outputBuffer: [] };
    this.emit();
  }

  getElapsedTime(): number {
    if (!this.state.startTime) return 0;
    return (Date.now() - this.state.startTime) / 1000;
  }
}
