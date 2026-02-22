import type { IntentRouter, IntentResult, IntentType, SystemQueryIntent } from './types.js';

interface PatternRule {
  patterns: RegExp[];
  type: IntentType;
  queryType?: string;
  extractor?: (match: RegExpMatchArray) => Record<string, unknown>;
}

const SYSTEM_QUERY_RULES: PatternRule[] = [
  {
    patterns: [
      /cpu[占用使用率情况]/i,
      /[查看检查看一下]cpu/i,
      /cpu\s*usage/i,
      /processor/i,
      /cpu\s*负载/i,
      /cpu\s*load/i,
    ],
    type: 'system_query',
    queryType: 'cpu',
  },
  {
    patterns: [
      /内存[占用使用率情况]/i,
      /[查看检查看一下]内存/i,
      /memory/i,
      /ram\s*usage/i,
      /内存\s*情况/i,
    ],
    type: 'system_query',
    queryType: 'memory',
  },
  {
    patterns: [
      /磁盘[占用使用空间情况]/i,
      /[查看检查看一下]磁盘/i,
      /disk/i,
      /硬盘/i,
      /storage/i,
      /磁盘\s*情况/i,
    ],
    type: 'system_query',
    queryType: 'disk',
  },
  {
    patterns: [
      /[查看列出看一下]进程/i,
      /process(es)?/i,
      /运行[的]?程序/i,
      /[当前正在]运行/i,
      /进程\s*情况/i,
      /进程\s*列表/i,
    ],
    type: 'system_query',
    queryType: 'process',
  },
  {
    patterns: [
      /[当前现在]?时间/i,
      /what\s*time/i,
      /几点/i,
      /date/i,
      /今天/i,
    ],
    type: 'system_query',
    queryType: 'time',
  },
  {
    patterns: [
      /[当前]?目录/i,
      /current\s*dir/i,
      /pwd/i,
      /[在哪]?路径/i,
      /工作目录/i,
      /working\s*dir/i,
    ],
    type: 'system_query',
    queryType: 'path',
  },
  {
    patterns: [
      /环境变量/i,
      /env/i,
      /environment/i,
    ],
    type: 'system_query',
    queryType: 'env',
  },
  {
    patterns: [
      /网络/i,
      /network/i,
      /ip/i,
      /连接/i,
      /网卡/i,
    ],
    type: 'system_query',
    queryType: 'network',
  },
];

const FILE_OPERATION_RULES: PatternRule[] = [
  {
    patterns: [
      /[读取查看看一下]文件/i,
      /read\s*file/i,
      /cat\s+/i,
    ],
    type: 'file_operation',
    extractor: (match) => {
      const input = match.input ?? '';
      const pathMatch = input.match(/["']([^"']+)["']|([^\s]+\.[a-zA-Z]+)/);
      return { operation: 'read', targetPath: pathMatch?.[1] ?? pathMatch?.[2] };
    },
  },
  {
    patterns: [
      /[写入创建]文件/i,
      /write\s*file/i,
      /create\s*file/i,
    ],
    type: 'file_operation',
    extractor: (match) => {
      const input = match.input ?? '';
      const pathMatch = input.match(/["']([^"']+)["']|([^\s]+\.[a-zA-Z]+)/);
      return { operation: 'write', targetPath: pathMatch?.[1] ?? pathMatch?.[2] };
    },
  },
  {
    patterns: [
      /[删除]文件/i,
      /delete\s*file/i,
      /remove\s*file/i,
    ],
    type: 'file_operation',
    extractor: (match) => {
      const input = match.input ?? '';
      const pathMatch = input.match(/["']([^"']+)["']|([^\s]+\.[a-zA-Z]+)/);
      return { operation: 'delete', targetPath: pathMatch?.[1] ?? pathMatch?.[2] };
    },
  },
  {
    patterns: [
      /[列出查看看一下]目录/i,
      /list\s*dir/i,
      /ls\s+/i,
    ],
    type: 'file_operation',
    extractor: () => ({ operation: 'list' }),
  },
];

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

export function createIntentRouter(): IntentRouter {
  return {
    detect(input: string): IntentResult {
      const trimmedInput = input.trim();
      const lowerInput = trimmedInput.toLowerCase();
      
      // Check for chat patterns first
      for (const pattern of CHAT_PATTERNS) {
        if (pattern.test(trimmedInput) || pattern.test(lowerInput)) {
          return {
            type: 'chat',
            confidence: 0.9,
            needsLLM: true,
          };
        }
      }
      
      // Check system query rules - use original input for better matching
      for (const rule of SYSTEM_QUERY_RULES) {
        for (const pattern of rule.patterns) {
          if (pattern.test(trimmedInput) || pattern.test(lowerInput)) {
            const result: SystemQueryIntent = {
              type: 'system_query',
              confidence: 0.95,
              queryType: rule.queryType as SystemQueryIntent['queryType'],
              needsLLM: false,
            };
            return result;
          }
        }
      }
      
      // Check file operation rules
      for (const rule of FILE_OPERATION_RULES) {
        for (const pattern of rule.patterns) {
          const match = trimmedInput.match(pattern) || lowerInput.match(pattern);
          if (match) {
            const params = rule.extractor?.(match) ?? {};
            return {
              type: 'file_operation',
              confidence: 0.85,
              needsLLM: false,
              params,
            };
          }
        }
      }
      
      // Check for shell command indicators
      if (/^(run|exec|执行|运行)/i.test(trimmedInput) || /^[a-z]+\s+-/.test(trimmedInput)) {
        return {
          type: 'shell_command',
          confidence: 0.8,
          needsLLM: true,
        };
      }
      
      // Check for complex task indicators
      const complexIndicators = [
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
        /and then/i,
        /after that/i,
        /if/i,
        /otherwise/i,
        /loop/i,
        /multiple/i,
        /batch/i,
        /automate/i,
        /monitor/i,
        /schedule/i,
      ];
      
      for (const indicator of complexIndicators) {
        if (indicator.test(trimmedInput) || indicator.test(lowerInput)) {
          return {
            type: 'complex_task',
            confidence: 0.9,
            needsLLM: true,
          };
        }
      }
      
      // Default based on input length
      if (trimmedInput.length < 20) {
        return {
          type: 'chat',
          confidence: 0.6,
          needsLLM: true,
        };
      }
      
      return {
        type: 'complex_task',
        confidence: 0.7,
        needsLLM: true,
      };
    },
    
    isFastPath(intent: IntentResult): boolean {
      return !intent.needsLLM && intent.type === 'system_query';
    },
  };
}

export function isSystemQueryIntent(intent: IntentResult): intent is SystemQueryIntent {
  return intent.type === 'system_query';
}

export function isFileOperationIntent(intent: IntentResult): intent is import('./types.js').FileOperationIntent {
  return intent.type === 'file_operation';
}
