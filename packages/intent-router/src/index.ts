export type {
  IntentType,
  IntentResult,
  SystemQueryIntent,
  FileOperationIntent,
  ShellCommandIntent,
  ChatIntent,
  ComplexTaskIntent,
  IntentRouter,
} from './types.js';

export { createIntentRouter, isSystemQueryIntent, isFileOperationIntent } from './router.js';

export type {
  ToolMeta,
  RoutingResult,
  CacheEntry,
  SemanticRouter,
} from './semantic-types.js';

export { 
  createSemanticRouter, 
  createTTLCache,
  SYSTEM_TOOLS, 
  COMMAND_ALIASES 
} from './semantic-router.js';
