import * as readline from 'readline';

interface Key {
  sequence: string;
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

type InputCallback = (input: string) => void;
type CursorUpdateCallback = (value: string, cursor: number) => void;
type SuggestionCallback = (input: string) => string | null;
type ExitCallback = () => void;
type ListSelectCallback = (index: number) => void;
type ListChangeCallback = (selectedIndex: number) => void;

export const COMMANDS = [
  '/help',
  '/clear',
  '/exit',
  '/config',
  '/model',
  '/mcp',
  '/weather',
  '/search',
];

export class InputHandler {
  private buffer = '';
  private cursor = 0;
  private inputCallback: InputCallback | null = null;
  private cursorUpdateCallback: CursorUpdateCallback | null = null;
  private suggestionCallback: SuggestionCallback | null = null;
  private exitCallback: ExitCallback | null = null;
  private currentSuggestion: string | null = null;
  private listMode = false;
  private listItems: string[] = [];
  private listSelectedIndex = 0;
  private listSelectCallback: ListSelectCallback | null = null;
  private listCancelCallback: (() => void) | null = null;
  private listChangeCallback: ListChangeCallback | null = null;

  constructor() {
    if (process.stdin.isTTY) {
      readline.emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
      process.stdin.on('keypress', (char: string, key: Key) => {
        this.handleKeypress(char, key);
      });
    }
  }

  onInput(callback: InputCallback): void {
    this.inputCallback = callback;
  }

  onCursorUpdate(callback: CursorUpdateCallback): void {
    this.cursorUpdateCallback = callback;
  }

  onSuggestion(callback: SuggestionCallback): void {
    this.suggestionCallback = callback;
  }

  onExit(callback: ExitCallback): void {
    this.exitCallback = callback;
  }

  startListMode(items: string[], onSelect: (index: number) => void, onCancel?: () => void, onChange?: (selectedIndex: number) => void): void {
    this.listMode = true;
    this.listItems = items;
    this.listSelectedIndex = 0;
    this.listSelectCallback = onSelect;
    this.listCancelCallback = onCancel ?? null;
    this.listChangeCallback = onChange ?? null;
  }

  stopListMode(): void {
    this.listMode = false;
    this.listItems = [];
    this.listSelectedIndex = 0;
    this.listSelectCallback = null;
    this.listCancelCallback = null;
    this.listChangeCallback = null;
  }

  isInListMode(): boolean {
    return this.listMode;
  }

  getListState(): { items: string[]; selectedIndex: number } | null {
    if (!this.listMode) return null;
    return {
      items: this.listItems,
      selectedIndex: this.listSelectedIndex,
    };
  }

  private notifyCursorUpdate(): void {
    if (this.cursorUpdateCallback) {
      this.cursorUpdateCallback(this.buffer, this.cursor);
    }
    this.updateSuggestion();
  }

  private updateSuggestion(): void {
    if (this.suggestionCallback) {
      this.currentSuggestion = this.suggestionCallback(this.buffer);
    }
  }

  getSuggestion(): string | null {
    return this.currentSuggestion;
  }

  applySuggestion(): boolean {
    if (this.currentSuggestion && this.currentSuggestion.length > this.buffer.length) {
      this.buffer = this.currentSuggestion;
      this.cursor = this.buffer.length;
      this.currentSuggestion = null;
      this.notifyCursorUpdate();
      return true;
    }
    return false;
  }

  private handleKeypress(char: string, key: Key): void {
    if (!key) return;

    if (key.ctrl && key.name === 'c') {
      if (this.listMode && this.listCancelCallback) {
        this.listCancelCallback();
        this.stopListMode();
        return;
      }
      if (this.exitCallback) {
        this.exitCallback();
      } else {
        process.exit(0);
      }
      return;
    }

    if (this.listMode) {
      switch (key.name) {
        case 'up':
        case 'k':
          if (this.listSelectedIndex > 0) {
            this.listSelectedIndex--;
            if (this.listChangeCallback) {
              this.listChangeCallback(this.listSelectedIndex);
            }
          }
          break;
        case 'down':
        case 'j':
          if (this.listSelectedIndex < this.listItems.length - 1) {
            this.listSelectedIndex++;
            if (this.listChangeCallback) {
              this.listChangeCallback(this.listSelectedIndex);
            }
          }
          break;
        case 'return':
        case 'enter': {
          const callback = this.listSelectCallback;
          const selectedIndex = this.listSelectedIndex;
          this.stopListMode();
          if (callback) {
            callback(selectedIndex);
          }
          break;
        }
        case 'escape':
        case 'q': {
          const callback = this.listCancelCallback;
          this.stopListMode();
          if (callback) {
            callback();
          }
          break;
        }
      }
      return;
    }

    switch (key.name) {
      case 'return':
      case 'enter':
        if (this.buffer.trim() && this.inputCallback) {
          const input = this.buffer.trim();
          this.buffer = '';
          this.cursor = 0;
          this.currentSuggestion = null;
          this.notifyCursorUpdate();
          this.inputCallback(input);
        }
        break;

      case 'tab':
        this.applySuggestion();
        break;

      case 'backspace':
        if (this.cursor > 0) {
          this.buffer = this.buffer.slice(0, this.cursor - 1) + this.buffer.slice(this.cursor);
          this.cursor--;
          this.notifyCursorUpdate();
        }
        break;

      case 'delete':
        if (this.cursor < this.buffer.length) {
          this.buffer = this.buffer.slice(0, this.cursor) + this.buffer.slice(this.cursor + 1);
          this.notifyCursorUpdate();
        }
        break;

      case 'left':
        if (this.cursor > 0) {
          this.cursor--;
          this.notifyCursorUpdate();
        }
        break;

      case 'right':
        if (this.cursor < this.buffer.length) {
          this.cursor++;
          this.notifyCursorUpdate();
        }
        break;

      case 'home':
        this.cursor = 0;
        this.notifyCursorUpdate();
        break;

      case 'end':
        this.cursor = this.buffer.length;
        this.notifyCursorUpdate();
        break;

      default:
        if (char && !key.ctrl && !key.meta) {
          this.buffer = this.buffer.slice(0, this.cursor) + char + this.buffer.slice(this.cursor);
          this.cursor++;
          this.notifyCursorUpdate();
        }
    }
  }

  getBuffer(): string {
    return this.buffer;
  }

  getCursor(): number {
    return this.cursor;
  }

  clearBuffer(): void {
    this.buffer = '';
    this.cursor = 0;
    this.currentSuggestion = null;
    this.notifyCursorUpdate();
  }
}

export function getCommandSuggestion(input: string): string | null {
  const lower = input.toLowerCase();
  if (!lower.startsWith('/')) return null;
  
  const matches = COMMANDS.filter(cmd => cmd.startsWith(lower));
  return matches.length === 1 ? matches[0] : null;
}

export function getCommandCompletions(input: string): string[] {
  const lower = input.toLowerCase();
  if (!lower.startsWith('/')) return [];
  
  return COMMANDS.filter(cmd => cmd.startsWith(lower));
}
