import { describe, it, expect, beforeEach } from 'vitest';
import { createIntentRouter, isSystemQueryIntent, isFileOperationIntent } from './router.js';

describe('createIntentRouter', () => {
  const router = createIntentRouter();

  describe('detect', () => {
    describe('chat patterns', () => {
      it('should detect greeting "hello"', () => {
        const result = router.detect('hello');
        expect(result.type).toBe('chat');
        expect(result.needsLLM).toBe(true);
      });

      it('should detect greeting "hi"', () => {
        const result = router.detect('hi');
        expect(result.type).toBe('chat');
      });

      it('should detect greeting "你好"', () => {
        const result = router.detect('你好');
        expect(result.type).toBe('chat');
      });

      it('should detect "你是谁"', () => {
        const result = router.detect('你是谁');
        expect(result.type).toBe('chat');
      });

      it('should detect "谢谢"', () => {
        const result = router.detect('谢谢');
        expect(result.type).toBe('chat');
      });

      it('should detect "help"', () => {
        const result = router.detect('help');
        expect(result.type).toBe('chat');
      });
    });

    describe('system query - cpu', () => {
      it('should detect "cpu占用"', () => {
        const result = router.detect('cpu占用');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('cpu');
        }
      });

      it('should detect "查看cpu"', () => {
        const result = router.detect('查看cpu');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('cpu');
        }
      });

      it('should detect "cpu usage"', () => {
        const result = router.detect('cpu usage');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('cpu');
        }
      });

      it('should detect "cpu负载"', () => {
        const result = router.detect('cpu负载');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('cpu');
        }
      });
    });

    describe('system query - memory', () => {
      it('should detect "内存占用"', () => {
        const result = router.detect('内存占用');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('memory');
        }
      });

      it('should detect "查看内存"', () => {
        const result = router.detect('查看内存');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('memory');
        }
      });

      it('should detect "memory"', () => {
        const result = router.detect('memory');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('memory');
        }
      });
    });

    describe('system query - disk', () => {
      it('should detect "磁盘占用"', () => {
        const result = router.detect('磁盘占用');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('disk');
        }
      });

      it('should detect "查看磁盘"', () => {
        const result = router.detect('查看磁盘');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('disk');
        }
      });

      it('should detect "disk"', () => {
        const result = router.detect('disk');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('disk');
        }
      });

      it('should detect "硬盘"', () => {
        const result = router.detect('硬盘');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('disk');
        }
      });
    });

    describe('system query - process', () => {
      it('should detect "查看进程"', () => {
        const result = router.detect('查看进程');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('process');
        }
      });

      it('should detect "processes"', () => {
        const result = router.detect('processes');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('process');
        }
      });

      it('should detect "运行的程序"', () => {
        const result = router.detect('运行的程序');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('process');
        }
      });
    });

    describe('system query - time', () => {
      it('should detect "时间"', () => {
        const result = router.detect('时间');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('time');
        }
      });

      it('should detect "几点"', () => {
        const result = router.detect('几点');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('time');
        }
      });

      it('should detect "今天"', () => {
        const result = router.detect('今天');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('time');
        }
      });
    });

    describe('system query - path', () => {
      it('should detect "当前目录"', () => {
        const result = router.detect('当前目录');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('path');
        }
      });

      it('should detect "pwd"', () => {
        const result = router.detect('pwd');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('path');
        }
      });

      it('should detect "工作目录"', () => {
        const result = router.detect('工作目录');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('path');
        }
      });
    });

    describe('system query - env', () => {
      it('should detect "环境变量"', () => {
        const result = router.detect('环境变量');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('env');
        }
      });

      it('should detect "env"', () => {
        const result = router.detect('env');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('env');
        }
      });
    });

    describe('system query - network', () => {
      it('should detect "网络"', () => {
        const result = router.detect('网络');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('network');
        }
      });

      it('should detect "ip"', () => {
        const result = router.detect('ip');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('network');
        }
      });
    });

    describe('file operations', () => {
      it('should detect "读取文件"', () => {
        const result = router.detect('读取文件');
        expect(result.type).toBe('file_operation');
        if (isFileOperationIntent(result)) {
          expect(result.params.operation).toBe('read');
        }
      });

      it('should detect "写入文件"', () => {
        const result = router.detect('写入文件');
        expect(result.type).toBe('file_operation');
        if (isFileOperationIntent(result)) {
          expect(result.params.operation).toBe('write');
        }
      });

      it('should detect "删除文件"', () => {
        const result = router.detect('删除文件');
        expect(result.type).toBe('file_operation');
        if (isFileOperationIntent(result)) {
          expect(result.params.operation).toBe('delete');
        }
      });

      it('should detect "列出目录"', () => {
        const result = router.detect('列出目录');
        expect(result.type).toBe('system_query');
        if (isSystemQueryIntent(result)) {
          expect(result.queryType).toBe('path');
        }
      });
    });

    describe('shell commands', () => {
      it('should detect "run" prefix with longer input', () => {
        const result = router.detect('run npm install and build the project');
        expect(result.type).toBe('shell_command');
      });

      it('should detect "执行" prefix with longer input', () => {
        const result = router.detect('执行命令并查看结果');
        expect(result.type).toBe('shell_command');
      });

      it('should detect command with flag in longer input', () => {
        const result = router.detect('npm install -g for global packages');
        expect(result.type).toBe('complex_task');
      });
    });

    describe('complex tasks', () => {
      it('should detect "如果" indicator', () => {
        const result = router.detect('如果文件存在则读取');
        expect(result.type).toBe('complex_task');
      });

      it('should detect "批量" indicator', () => {
        const result = router.detect('批量处理文件');
        expect(result.type).toBe('complex_task');
      });

      it('should detect "自动" indicator', () => {
        const result = router.detect('自动监控进程');
        expect(result.type).toBe('complex_task');
      });
    });

    describe('default behavior', () => {
      it('should return chat for short input', () => {
        const result = router.detect('test');
        expect(result.type).toBe('chat');
      });

      it('should return complex_task for long input', () => {
        const result = router.detect('这是一个比较长的输入内容，需要更多的处理');
        expect(result.type).toBe('complex_task');
      });
    });
  });

  describe('isFastPath', () => {
    it('should return true for system_query without LLM', () => {
      const result = router.detect('cpu占用');
      expect(router.isFastPath(result)).toBe(true);
    });

    it('should return false for chat intent', () => {
      const result = router.detect('hello');
      expect(router.isFastPath(result)).toBe(false);
    });

    it('should return false for file_operation intent', () => {
      const result = router.detect('读取文件');
      expect(router.isFastPath(result)).toBe(false);
    });
  });
});

describe('isSystemQueryIntent', () => {
  it('should return true for system_query intent', () => {
    const router = createIntentRouter();
    const intent = router.detect('cpu占用');
    expect(isSystemQueryIntent(intent)).toBe(true);
  });

  it('should return false for other intent types', () => {
    const router = createIntentRouter();
    const intent = router.detect('hello');
    expect(isSystemQueryIntent(intent)).toBe(false);
  });
});

describe('isFileOperationIntent', () => {
  it('should return true for file_operation intent', () => {
    const router = createIntentRouter();
    const intent = router.detect('读取文件');
    expect(isFileOperationIntent(intent)).toBe(true);
  });

  it('should return false for other intent types', () => {
    const router = createIntentRouter();
    const intent = router.detect('cpu占用');
    expect(isFileOperationIntent(intent)).toBe(false);
  });
});
