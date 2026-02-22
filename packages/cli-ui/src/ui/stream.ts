import { UIStateManager } from './state.js';
import { UIRenderer } from './renderer.js';

export class StreamHandler {
  private stateManager: UIStateManager;
  private renderer: UIRenderer;
  private renderInterval: NodeJS.Timeout | null = null;

  constructor(stateManager: UIStateManager, renderer: UIRenderer) {
    this.stateManager = stateManager;
    this.renderer = renderer;
  }

  start(): void {
    this.stateManager.startStreaming();
    this.renderer.startSpinner();
    
    this.renderInterval = setInterval(() => {
      this.renderer.renderStatusOnly(this.stateManager.getState());
    }, 100);
  }

  stop(): void {
    if (this.renderInterval) {
      clearInterval(this.renderInterval);
      this.renderInterval = null;
    }
    this.renderer.stopSpinner();
    this.stateManager.stopStreaming();
  }

  onChunk(chunk: string): void {
    this.stateManager.appendToLastLine(chunk);
    this.stateManager.addToken(1);
    this.renderer.renderStreamingUpdate(this.stateManager.getState());
  }

  newLine(): void {
    this.stateManager.newLine();
    this.renderer.renderStreamingUpdate(this.stateManager.getState());
  }

  appendFullResponse(response: string): void {
    this.stateManager.appendOutput(response);
    this.renderer.renderStreamingUpdate(this.stateManager.getState());
  }
}
