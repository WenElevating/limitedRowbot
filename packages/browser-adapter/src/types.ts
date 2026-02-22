export interface BrowserConfig {
  headless: boolean;
  timeout: number;
  defaultViewport: {
    width: number;
    height: number;
  };
  allowedDomains: string[];
  blockedDomains: string[];
  downloadPath?: string;
}

export interface NavigateOptions {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
  selector?: string;
  type?: 'png' | 'jpeg';
}

export interface ClickOptions {
  selector: string;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
}

export interface TypeOptions {
  selector: string;
  text: string;
  delay?: number;
  clear?: boolean;
}

export interface ScrollOptions {
  direction: 'up' | 'down' | 'left' | 'right';
  distance?: number;
}

export interface WaitOptions {
  selector?: string;
  timeout?: number;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
}

export interface BrowserActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  screenshot?: string;
}

export interface BrowserAdapter {
  open(url: string): Promise<BrowserActionResult>;
  close(): Promise<BrowserActionResult>;
  navigate(options: NavigateOptions): Promise<BrowserActionResult>;
  screenshot(options?: ScreenshotOptions): Promise<BrowserActionResult>;
  click(options: ClickOptions): Promise<BrowserActionResult>;
  type(options: TypeOptions): Promise<BrowserActionResult>;
  scroll(options: ScrollOptions): Promise<BrowserActionResult>;
  wait(options: WaitOptions): Promise<BrowserActionResult>;
  evaluate(script: string): Promise<BrowserActionResult>;
  getTitle(): Promise<string>;
  getUrl(): Promise<string>;
  isDomainAllowed(url: string): boolean;
}
