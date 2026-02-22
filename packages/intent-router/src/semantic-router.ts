import type { ToolMeta, RoutingResult, SemanticRouter, CacheEntry } from './semantic-types.js';
import { SYSTEM_TOOLS, COMMAND_ALIASES } from './semantic-types.js';

const CONFIDENCE_THRESHOLD = 0.75;

const TTL_DEFAULTS: Record<string, number> = {
  get_cpu_usage: 1000,
  get_memory_usage: 1000,
  get_process_list: 2000,
  get_disk_usage: 5000,
  get_network_info: 5000,
  get_time: 0,
  get_current_directory: 0,
  get_environment: 0,
};

const CHAT_PATTERNS = [
  /^你[是谁]/,
  /^你[能会]做什么/,
  /^hello/i,
  /^hi[!\s]?$/i,
  /^你好/,
  /^谢谢/,
  /^thanks/i,
  /^帮助/i,
  /^help/i,
  /介绍[一下]?你自己/,
  /[怎么]?使用/,
];

const COMPLEX_INDICATORS = [
  /找出/,
  /查找/,
  /搜索/,
  /前[0-9一二三四五]+/,
  /最高/,
  /最低/,
  /最大/,
  /最小/,
  /排序/,
  /过滤/,
  /筛选/,
  /然后/,
  /之后/,
  /如果/,
  /否则/,
  /循环/,
  /多次/,
  /批量/,
  /自动/,
  /监控/,
  /定时/,
  /整理/,
  /删除/,
  /创建/,
  /修改/,
  /分析/,
  /比较/,
  /统计/,
  /and then/i,
  /after that/i,
  /if/i,
  /otherwise/i,
  /loop/i,
  /batch/i,
  /automate/i,
  /monitor/i,
  /top\s+\d/i,
  /find/i,
  /search/i,
];

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);
}

function isComplexQuery(input: string): boolean {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  
  for (const indicator of COMPLEX_INDICATORS) {
    if (indicator.test(trimmed) || indicator.test(lower)) {
      return true;
    }
  }
  
  return false;
}

function calculateKeywordScore(input: string, tool: ToolMeta): number {
  const tokens = tokenize(input);
  const inputLower = input.toLowerCase();
  
  let score = 0;
  let matchedKeywords = 0;
  
  for (const keyword of tool.keywords) {
    const keywordLower = keyword.toLowerCase();
    if (inputLower.includes(keywordLower)) {
      matchedKeywords++;
      score += 0.3;
    }
  }
  
  for (const example of tool.examples) {
    const exampleLower = example.toLowerCase();
    if (inputLower.includes(exampleLower) || exampleLower.includes(inputLower)) {
      score += 0.5;
    }
  }
  
  for (const token of tokens) {
    for (const keyword of tool.keywords) {
      if (keyword.toLowerCase().includes(token) || token.includes(keyword.toLowerCase())) {
        matchedKeywords++;
        score += 0.1;
      }
    }
  }
  
  const keywordRatio = matchedKeywords / tool.keywords.length;
  score += keywordRatio * 0.3;
  
  return Math.min(score, 1);
}

function detectInputType(input: string): 'chat' | 'complex_task' {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  
  for (const pattern of CHAT_PATTERNS) {
    if (pattern.test(trimmed) || pattern.test(lower)) {
      return 'chat';
    }
  }
  
  if (trimmed.length < 15) {
    return 'chat';
  }
  
  return 'complex_task';
}

export function createSemanticRouter(): SemanticRouter {
  const tools = new Map<string, ToolMeta>();
  const cache = new Map<string, CacheEntry<unknown>>();
  
  for (const tool of SYSTEM_TOOLS) {
    tools.set(tool.name, tool);
  }
  
  return {
    route(input: string): RoutingResult {
      const trimmed = input.trim();
      
      // Step 1: Command prefix check (fastest path)
      if (trimmed.startsWith('/')) {
        const parts = trimmed.split(/\s+/);
        const command = parts[0]?.toLowerCase();
        const args = parts.slice(1);
        
        if (command && COMMAND_ALIASES[command]) {
          const alias = COMMAND_ALIASES[command];
          return {
            matched: true,
            tool: alias.tool,
            params: alias.params ?? { args },
            confidence: 1.0,
            source: 'command',
            type: 'system',
          };
        }
        
        return {
          matched: false,
          confidence: 0,
          source: 'command',
          type: 'chat',
        };
      }
      
      // Step 2: Check if complex query - should go to LLM
      if (isComplexQuery(trimmed)) {
        return {
          matched: false,
          confidence: 0,
          source: 'llm',
          type: 'complex_task',
        };
      }
      
      // Step 3: Keyword-based semantic routing
      let bestTool: ToolMeta | null = null;
      let bestScore = 0;
      
      for (const tool of tools.values()) {
        const score = calculateKeywordScore(trimmed, tool);
        if (score > bestScore) {
          bestScore = score;
          bestTool = tool;
        }
      }
      
      // Step 4: Confidence threshold
      if (bestTool && bestScore >= CONFIDENCE_THRESHOLD) {
        return {
          matched: true,
          tool: bestTool.name,
          confidence: bestScore,
          source: 'keyword',
          type: 'system',
        };
      }
      
      // Fallback to LLM
      const inputType = detectInputType(trimmed);
      
      return {
        matched: false,
        confidence: bestScore,
        source: 'llm',
        type: inputType,
      };
    },
    
    registerTool(meta: ToolMeta): void {
      tools.set(meta.name, meta);
    },
    
    clearCache(): void {
      cache.clear();
    },
  };
}

export function createTTLCache() {
  const cache = new Map<string, CacheEntry<unknown>>();
  
  return {
    get<T>(key: string): T | null {
      const entry = cache.get(key);
      if (!entry) return null;
      
      if (Date.now() - entry.timestamp > entry.ttl) {
        cache.delete(key);
        return null;
      }
      
      return entry.value as T;
    },
    
    set<T>(key: string, value: T, ttl: number): void {
      cache.set(key, {
        value,
        timestamp: Date.now(),
        ttl,
      });
    },
    
    has(key: string): boolean {
      const entry = cache.get(key);
      if (!entry) return false;
      
      if (Date.now() - entry.timestamp > entry.ttl) {
        cache.delete(key);
        return false;
      }
      
      return true;
    },
    
    clear(): void {
      cache.clear();
    },
    
    getTTL(toolName: string): number {
      return TTL_DEFAULTS[toolName] ?? 5000;
    },
  };
}

export { SYSTEM_TOOLS, COMMAND_ALIASES };
