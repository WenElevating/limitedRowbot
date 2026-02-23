import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createEnhancedPermissionGuard,
  formatPermissionRequest,
} from './enhanced-permission-guard.js';
import { RiskLevel, type PermissionRequest, type PermissionCallback } from './types.js';

describe('createEnhancedPermissionGuard', () => {
  describe('default configuration', () => {
    it('should auto-approve READ operations', async () => {
      const guard = createEnhancedPermissionGuard();
      const request: PermissionRequest = {
        toolName: 'file_reader',
        action: 'read',
        target: '/path/to/file.txt',
        riskLevel: RiskLevel.READ,
        description: 'Read file content',
      };

      const result = await guard.evaluate(request);

      expect(result.granted).toBe(true);
      expect(result.requiresBackup).toBe(false);
    });

    it('should require confirmation for MODIFY operations', async () => {
      const guard = createEnhancedPermissionGuard();
      const callback: PermissionCallback = vi.fn().mockResolvedValue(true);
      guard.setCallback(callback);

      const request: PermissionRequest = {
        toolName: 'file_writer',
        action: 'write',
        target: '/path/to/file.txt',
        riskLevel: RiskLevel.MODIFY,
        description: 'Write to file',
      };

      const result = await guard.evaluate(request);

      expect(callback).toHaveBeenCalledWith(request);
      expect(result.granted).toBe(true);
      expect(result.requiresBackup).toBe(true);
    });

    it('should require confirmation for DELETE operations', async () => {
      const guard = createEnhancedPermissionGuard();
      const callback: PermissionCallback = vi.fn().mockResolvedValue(true);
      guard.setCallback(callback);

      const request: PermissionRequest = {
        toolName: 'file_deleter',
        action: 'delete',
        target: '/path/to/file.txt',
        riskLevel: RiskLevel.DELETE,
        description: 'Delete file',
      };

      const result = await guard.evaluate(request);

      expect(callback).toHaveBeenCalled();
      expect(result.granted).toBe(true);
    });

    it('should require confirmation for SYSTEM operations', async () => {
      const guard = createEnhancedPermissionGuard();
      const callback: PermissionCallback = vi.fn().mockResolvedValue(true);
      guard.setCallback(callback);

      const request: PermissionRequest = {
        toolName: 'shell_executor',
        action: 'shell',
        target: 'Get-Process',
        riskLevel: RiskLevel.SYSTEM,
        description: 'Execute shell command',
      };

      const result = await guard.evaluate(request);

      expect(callback).toHaveBeenCalled();
      expect(result.granted).toBe(true);
    });
  });

  describe('command whitelist/blacklist', () => {
    it('should deny commands in denied list', async () => {
      const guard = createEnhancedPermissionGuard();
      const request: PermissionRequest = {
        toolName: 'shell',
        action: 'shell',
        target: 'rm -rf /important/data',
        riskLevel: RiskLevel.SYSTEM,
        description: 'Dangerous command',
      };

      const result = await guard.evaluate(request);

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('denied pattern');
    });

    it('should deny format command', async () => {
      const guard = createEnhancedPermissionGuard();
      const request: PermissionRequest = {
        toolName: 'shell',
        action: 'shell',
        target: 'format C:',
        riskLevel: RiskLevel.SYSTEM,
        description: 'Format disk',
      };

      const result = await guard.evaluate(request);

      expect(result.granted).toBe(false);
    });

    it('should deny shutdown command', async () => {
      const guard = createEnhancedPermissionGuard();
      const request: PermissionRequest = {
        toolName: 'shell',
        action: 'shell',
        target: 'shutdown /s /t 0',
        riskLevel: RiskLevel.SYSTEM,
        description: 'Shutdown system',
      };

      const result = await guard.evaluate(request);

      expect(result.granted).toBe(false);
    });

    it('should allow commands not in denied list', async () => {
      const guard = createEnhancedPermissionGuard({
        whitelist: {
          allowedCommands: ['Get-Process', 'Get-ChildItem'],
          deniedCommands: [],
          allowedPaths: [],
          deniedPaths: [],
          allowedDomains: [],
          deniedDomains: [],
        },
      });
      const callback: PermissionCallback = vi.fn().mockResolvedValue(true);
      guard.setCallback(callback);

      const request: PermissionRequest = {
        toolName: 'shell',
        action: 'shell',
        target: 'Get-Process',
        riskLevel: RiskLevel.SYSTEM,
        description: 'List processes',
      };

      const result = await guard.evaluate(request);

      expect(result.granted).toBe(true);
    });
  });

  describe('path whitelist/blacklist', () => {
    it('should deny paths in denied list', async () => {
      const guard = createEnhancedPermissionGuard();
      const request: PermissionRequest = {
        toolName: 'file',
        action: 'read',
        target: 'C:\\Windows\\System32\\config\\SAM',
        riskLevel: RiskLevel.READ,
        description: 'Read system file',
      };

      const result = await guard.evaluate(request);

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('denied list');
    });

    it('should deny access to /etc on Unix', async () => {
      const guard = createEnhancedPermissionGuard();
      const request: PermissionRequest = {
        toolName: 'file',
        action: 'read',
        target: '/etc/passwd',
        riskLevel: RiskLevel.READ,
        description: 'Read password file',
      };

      const result = await guard.evaluate(request);

      expect(result.granted).toBe(false);
    });

    it('should allow paths not in denied list', async () => {
      const guard = createEnhancedPermissionGuard();
      const request: PermissionRequest = {
        toolName: 'file',
        action: 'read',
        target: '/home/user/document.txt',
        riskLevel: RiskLevel.READ,
        description: 'Read user file',
      };

      const result = await guard.evaluate(request);

      expect(result.granted).toBe(true);
    });
  });

  describe('domain whitelist/blacklist', () => {
    it('should deny domains in denied list', async () => {
      const guard = createEnhancedPermissionGuard({
        whitelist: {
          allowedCommands: [],
          deniedCommands: [],
          allowedPaths: [],
          deniedPaths: [],
          allowedDomains: [],
          deniedDomains: ['malicious.com'],
        },
      });

      const request: PermissionRequest = {
        toolName: 'http',
        action: 'fetch',
        target: 'https://malicious.com/api',
        riskLevel: RiskLevel.READ,
        description: 'Fetch from malicious domain',
      };

      const result = await guard.evaluate(request);

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('denied list');
    });

    it('should allow domains not in denied list', async () => {
      const guard = createEnhancedPermissionGuard();
      const request: PermissionRequest = {
        toolName: 'http',
        action: 'fetch',
        target: 'https://api.example.com/data',
        riskLevel: RiskLevel.READ,
        description: 'Fetch data',
      };

      const result = await guard.evaluate(request);

      expect(result.granted).toBe(true);
    });

    it('should handle invalid URLs gracefully', async () => {
      const guard = createEnhancedPermissionGuard();
      const request: PermissionRequest = {
        toolName: 'http',
        action: 'fetch',
        target: 'not-a-valid-url',
        riskLevel: RiskLevel.READ,
        description: 'Invalid URL',
      };

      const result = await guard.evaluate(request);

      expect(result.granted).toBe(true);
    });
  });

  describe('session limits', () => {
    it('should enforce session approval limits', async () => {
      const guard = createEnhancedPermissionGuard({
        maxApprovalsPerSession: 2,
        sessionTimeout: 60000,
      });
      const callback: PermissionCallback = vi.fn().mockResolvedValue(true);
      guard.setCallback(callback);

      const request: PermissionRequest = {
        toolName: 'test_tool',
        action: 'modify',
        target: '/path/to/file',
        riskLevel: RiskLevel.MODIFY,
        description: 'Test operation',
      };

      const result1 = await guard.evaluate(request);
      const result2 = await guard.evaluate(request);
      const result3 = await guard.evaluate(request);

      expect(result1.granted).toBe(true);
      expect(result2.granted).toBe(true);
      expect(result3.granted).toBe(false);
      expect(result3.reason).toContain('Session approval limit');
    });
  });

  describe('callback handling', () => {
    it('should return false when no callback is set', async () => {
      const guard = createEnhancedPermissionGuard();

      const request: PermissionRequest = {
        toolName: 'test',
        action: 'modify',
        riskLevel: RiskLevel.MODIFY,
        description: 'Test',
      };

      const result = await guard.evaluate(request);

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('No permission callback');
    });

    it('should respect user denial', async () => {
      const guard = createEnhancedPermissionGuard();
      const callback: PermissionCallback = vi.fn().mockResolvedValue(false);
      guard.setCallback(callback);

      const request: PermissionRequest = {
        toolName: 'test',
        action: 'modify',
        riskLevel: RiskLevel.MODIFY,
        description: 'Test',
      };

      const result = await guard.evaluate(request);

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('User denied');
    });
  });

  describe('denyByDefault policy', () => {
    it('should deny unknown risk levels when denyByDefault is true', async () => {
      const guard = createEnhancedPermissionGuard({
        approvalPolicy: {
          autoApprove: [RiskLevel.READ],
          requireConfirmation: [],
          denyByDefault: true,
        },
      });

      const request: PermissionRequest = {
        toolName: 'test',
        action: 'unknown',
        riskLevel: RiskLevel.MODIFY,
        description: 'Unknown operation',
      };

      const result = await guard.evaluate(request);

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('Denied by policy');
    });
  });
});

describe('formatPermissionRequest', () => {
  it('should format READ request correctly', () => {
    const request: PermissionRequest = {
      toolName: 'file_reader',
      action: 'read',
      target: '/path/to/file.txt',
      riskLevel: RiskLevel.READ,
      description: 'Read file content',
    };

    const formatted = formatPermissionRequest(request);

    expect(formatted).toContain('📖');
    expect(formatted).toContain('file_reader');
    expect(formatted).toContain('READ');
    expect(formatted).toContain('/path/to/file.txt');
    expect(formatted).toContain('Read file content');
  });

  it('should format MODIFY request correctly', () => {
    const request: PermissionRequest = {
      toolName: 'file_writer',
      action: 'write',
      riskLevel: RiskLevel.MODIFY,
      description: 'Write to file',
    };

    const formatted = formatPermissionRequest(request);

    expect(formatted).toContain('✏️');
    expect(formatted).toContain('MODIFY');
  });

  it('should format DELETE request correctly', () => {
    const request: PermissionRequest = {
      toolName: 'file_deleter',
      action: 'delete',
      riskLevel: RiskLevel.DELETE,
      description: 'Delete file',
    };

    const formatted = formatPermissionRequest(request);

    expect(formatted).toContain('🗑️');
    expect(formatted).toContain('DELETE');
  });

  it('should format SYSTEM request correctly', () => {
    const request: PermissionRequest = {
      toolName: 'shell',
      action: 'shell',
      riskLevel: RiskLevel.SYSTEM,
      description: 'Execute command',
    };

    const formatted = formatPermissionRequest(request);

    expect(formatted).toContain('⚡');
    expect(formatted).toContain('SYSTEM');
  });
});
