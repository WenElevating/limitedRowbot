export interface LayoutConfig {
  totalHeight: number;
  totalWidth: number;
  headerHeight: number;
  statusHeight: number;
  inputHeight: number;
  outputHeight: number;
}

export class LayoutManager {
  private config: LayoutConfig;

  constructor() {
    const totalHeight = process.stdout.rows || 24;
    const totalWidth = process.stdout.columns || 80;
    
    const HEADER_HEIGHT = 2;
    const STATUS_HEIGHT = 1;
    const INPUT_HEIGHT = 1;
    const SEPARATOR_HEIGHT = 1;
    
    const OUTPUT_HEIGHT = totalHeight - HEADER_HEIGHT - STATUS_HEIGHT - INPUT_HEIGHT - SEPARATOR_HEIGHT;

    this.config = {
      totalHeight,
      totalWidth,
      headerHeight: HEADER_HEIGHT,
      statusHeight: STATUS_HEIGHT,
      inputHeight: INPUT_HEIGHT,
      outputHeight: Math.max(1, OUTPUT_HEIGHT),
    };
  }

  update(): void {
    const totalHeight = process.stdout.rows || 24;
    const totalWidth = process.stdout.columns || 80;
    
    const HEADER_HEIGHT = 2;
    const STATUS_HEIGHT = 1;
    const INPUT_HEIGHT = 1;
    const SEPARATOR_HEIGHT = 1;
    
    const OUTPUT_HEIGHT = totalHeight - HEADER_HEIGHT - STATUS_HEIGHT - INPUT_HEIGHT - SEPARATOR_HEIGHT;

    this.config = {
      totalHeight,
      totalWidth,
      headerHeight: HEADER_HEIGHT,
      statusHeight: STATUS_HEIGHT,
      inputHeight: INPUT_HEIGHT,
      outputHeight: Math.max(1, OUTPUT_HEIGHT),
    };
  }

  getConfig(): LayoutConfig {
    return this.config;
  }

  getHeaderStartRow(): number {
    return 1;
  }

  getHeaderEndRow(): number {
    return this.config.headerHeight;
  }

  getOutputStartRow(): number {
    return this.config.headerHeight + 1;
  }

  getOutputEndRow(): number {
    return this.config.headerHeight + this.config.outputHeight;
  }

  getStatusRow(): number {
    return this.config.headerHeight + this.config.outputHeight + 1;
  }

  getInputRow(): number {
    return this.config.totalHeight;
  }

  getSeparatorRow(): number {
    return this.config.totalHeight - 1;
  }
}
