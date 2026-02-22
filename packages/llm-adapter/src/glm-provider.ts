import type {
  LLMProvider,
  LLMConfig,
} from './types.js';
import { OpenAICompatibleProvider } from './openai-provider.js';

export const GLM_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';

export const GLM_MODELS = [
  'glm-4.7',
  'glm-4.7-flash',
  'glm-4.6-flash',
  'glm-4.5-flash',
  'glm-4.5-air',
  'glm-4-plus',
  'glm-4-flashx',
  'glm-4-flash',
  'glm-4-long',
] as const;

export type GlmModel = typeof GLM_MODELS[number];

export interface GlmConfig extends LLMConfig {
  model?: string;
}

export class GlmProvider extends OpenAICompatibleProvider {
  constructor(config: GlmConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl ?? GLM_BASE_URL,
      model: config.model ?? 'glm-5',
    });
  }

  getName(): string {
    return 'GLM (智谱 AI)';
  }

  getAvailableModels(): string[] {
    return [...GLM_MODELS];
  }
}

export function createGlmProvider(config: GlmConfig): LLMProvider {
  return new GlmProvider(config);
}
