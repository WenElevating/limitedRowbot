import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  BrowserConfig,
  BrowserAdapter,
  BrowserActionResult,
  NavigateOptions,
  ScreenshotOptions,
  ClickOptions,
  TypeOptions,
  ScrollOptions,
  WaitOptions,
} from './types.js';
import type { Tool, ToolParameters } from '@robot/tool-system';
import { RiskLevel } from '@robot/permission-system';

const execAsync = promisify(exec);

const DEFAULT_CONFIG: BrowserConfig = {
  headless: false,
  timeout: 30000,
  defaultViewport: {
    width: 1280,
    height: 720,
  },
  allowedDomains: [],
  blockedDomains: [],
};

function parseUrl(url: string): { hostname: string } | null {
  try {
    const parsed = new URL(url);
    return { hostname: parsed.hostname };
  } catch {
    return null;
  }
}

export function createBrowserAdapter(config: Partial<BrowserConfig> = {}): BrowserAdapter {
  const finalConfig: BrowserConfig = { ...DEFAULT_CONFIG, ...config };
  let currentUrl: string | null = null;
  let pageTitle: string | null = null;

  function isDomainAllowed(url: string): boolean {
    const parsed = parseUrl(url);
    if (!parsed) return false;

    const domain = parsed.hostname.toLowerCase();

    for (const blocked of finalConfig.blockedDomains) {
      if (domain.includes(blocked.toLowerCase())) {
        return false;
      }
    }

    if (finalConfig.allowedDomains.length > 0) {
      return finalConfig.allowedDomains.some(
        allowed => domain.includes(allowed.toLowerCase())
      );
    }

    return true;
  }

  async function openDefaultBrowser(url: string): Promise<BrowserActionResult> {
    if (!isDomainAllowed(url)) {
      return {
        success: false,
        error: `Domain not allowed: ${url}`,
      };
    }

    try {
      const platform = process.platform;
      let command: string;
      
      if (platform === 'win32') {
        command = `start "" "${url}"`;
      } else if (platform === 'darwin') {
        command = `open "${url}"`;
      } else {
        command = `xdg-open "${url}"`;
      }

      await execAsync(command);
      currentUrl = url;
      pageTitle = url;

      return {
        success: true,
        data: { url, message: 'Opened in default browser' },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    async open(url: string): Promise<BrowserActionResult> {
      return openDefaultBrowser(url);
    },

    async close(): Promise<BrowserActionResult> {
      currentUrl = null;
      pageTitle = null;
      return {
        success: true,
        data: { message: 'Browser session cleared' },
      };
    },

    async navigate(options: NavigateOptions): Promise<BrowserActionResult> {
      if (!isDomainAllowed(options.url)) {
        return {
          success: false,
          error: `Domain not allowed: ${options.url}`,
        };
      }

      return openDefaultBrowser(options.url);
    },

    async screenshot(_options?: ScreenshotOptions): Promise<BrowserActionResult> {
      return {
        success: false,
        error: 'Screenshot requires headless browser (Playwright/Puppeteer). Use open() to open in default browser.',
      };
    },

    async click(_options: ClickOptions): Promise<BrowserActionResult> {
      return {
        success: false,
        error: 'Click requires headless browser (Playwright/Puppeteer). Use open() to open in default browser.',
      };
    },

    async type(_options: TypeOptions): Promise<BrowserActionResult> {
      return {
        success: false,
        error: 'Type requires headless browser (Playwright/Puppeteer). Use open() to open in default browser.',
      };
    },

    async scroll(_options: ScrollOptions): Promise<BrowserActionResult> {
      return {
        success: false,
        error: 'Scroll requires headless browser (Playwright/Puppeteer). Use open() to open in default browser.',
      };
    },

    async wait(_options: WaitOptions): Promise<BrowserActionResult> {
      return {
        success: false,
        error: 'Wait requires headless browser (Playwright/Puppeteer). Use open() to open in default browser.',
      };
    },

    async evaluate(_script: string): Promise<BrowserActionResult> {
      return {
        success: false,
        error: 'Evaluate requires headless browser (Playwright/Puppeteer). Use open() to open in default browser.',
      };
    },

    async getTitle(): Promise<string> {
      return pageTitle ?? '';
    },

    async getUrl(): Promise<string> {
      return currentUrl ?? '';
    },

    isDomainAllowed,
  };
}

export function createBrowserTools(): Tool[] {
  const openParams: ToolParameters = {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to open',
      },
    },
    required: ['url'],
  };

  const navigateParams: ToolParameters = {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to navigate to',
      },
      waitUntil: {
        type: 'string',
        description: 'When to consider navigation complete',
        enum: ['load', 'domcontentloaded', 'networkidle'],
      },
    },
    required: ['url'],
  };

  return [
    {
      name: 'browser_open',
      description: 'Open a URL in the default browser',
      parameters: openParams,
      riskLevel: RiskLevel.READ,
      execute: async () => ({ success: true }),
    },
    {
      name: 'browser_navigate',
      description: 'Navigate to a URL in the browser',
      parameters: navigateParams,
      riskLevel: RiskLevel.READ,
      execute: async () => ({ success: true }),
    },
  ];
}
