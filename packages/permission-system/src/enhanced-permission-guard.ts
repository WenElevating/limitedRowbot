import type {
  PermissionGuard,
  PermissionRequest,
  PermissionResult,
  PermissionConfig,
  PermissionCallback,
} from './types.js';
import { RiskLevel } from './types.js';

export interface ApprovalPolicy {
  autoApprove: RiskLevel[];
  requireConfirmation: RiskLevel[];
  denyByDefault: boolean;
}

export interface WhitelistConfig {
  allowedCommands: string[];
  allowedPaths: string[];
  allowedDomains: string[];
  deniedCommands: string[];
  deniedPaths: string[];
  deniedDomains: string[];
}

export interface EnhancedPermissionConfig extends PermissionConfig {
  approvalPolicy?: ApprovalPolicy;
  whitelist?: WhitelistConfig;
  sessionTimeout?: number;
  maxApprovalsPerSession?: number;
}

interface SessionState {
  approvals: Map<string, number>;
  lastActivity: number;
}

const DEFAULT_WHITELIST: WhitelistConfig = {
  allowedCommands: [],
  allowedPaths: [],
  allowedDomains: [],
  deniedCommands: [
    'rm -rf',
    'del /s',
    'format',
    'shutdown',
    'restart',
    'reg delete',
    'bcdedit',
  ],
  deniedPaths: [
    'C:\\Windows\\System32',
    'C:\\Program Files',
    '/etc',
    '/usr/bin',
  ],
  deniedDomains: [],
};

const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
  autoApprove: [RiskLevel.READ],
  requireConfirmation: [RiskLevel.MODIFY, RiskLevel.DELETE, RiskLevel.SYSTEM],
  denyByDefault: false,
};

export function createEnhancedPermissionGuard(
  config: EnhancedPermissionConfig = {}
): PermissionGuard {
  const whitelist: WhitelistConfig = {
    ...DEFAULT_WHITELIST,
    ...config.whitelist,
  };
  
  const approvalPolicy: ApprovalPolicy = {
    ...DEFAULT_APPROVAL_POLICY,
    ...config.approvalPolicy,
  };
  
  const sessionTimeout = config.sessionTimeout ?? 300000;
  const maxApprovalsPerSession = config.maxApprovalsPerSession ?? 100;
  
  let callback: PermissionCallback | null = null;
  const sessionState: SessionState = {
    approvals: new Map(),
    lastActivity: Date.now(),
  };
  
  function isCommandAllowed(command: string): { allowed: boolean; reason?: string } {
    const cmd = command.toLowerCase().trim();
    
    for (const denied of whitelist.deniedCommands) {
      if (cmd.includes(denied.toLowerCase())) {
        return { allowed: false, reason: `Command contains denied pattern: ${denied}` };
      }
    }
    
    if (whitelist.allowedCommands.length > 0) {
      const isAllowed = whitelist.allowedCommands.some(
        allowed => cmd.includes(allowed.toLowerCase())
      );
      if (!isAllowed) {
        return { allowed: false, reason: 'Command not in allowed list' };
      }
    }
    
    return { allowed: true };
  }
  
  function isPathAllowed(targetPath: string): { allowed: boolean; reason?: string } {
    for (const denied of whitelist.deniedPaths) {
      if (targetPath.toLowerCase().startsWith(denied.toLowerCase())) {
        return { allowed: false, reason: `Path is in denied list: ${denied}` };
      }
    }
    
    if (whitelist.allowedPaths.length > 0) {
      const isAllowed = whitelist.allowedPaths.some(
        allowed => targetPath.toLowerCase().startsWith(allowed.toLowerCase())
      );
      if (!isAllowed) {
        return { allowed: false, reason: 'Path not in allowed list' };
      }
    }
    
    return { allowed: true };
  }
  
  function isDomainAllowed(url: string): { allowed: boolean; reason?: string } {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      
      for (const denied of whitelist.deniedDomains) {
        if (domain.includes(denied.toLowerCase())) {
          return { allowed: false, reason: `Domain is in denied list: ${denied}` };
        }
      }
      
      if (whitelist.allowedDomains.length > 0) {
        const isAllowed = whitelist.allowedDomains.some(
          allowed => domain.includes(allowed.toLowerCase())
        );
        if (!isAllowed) {
          return { allowed: false, reason: 'Domain not in allowed list' };
        }
      }
      
      return { allowed: true };
    } catch {
      return { allowed: true };
    }
  }
  
  function checkSessionLimit(toolName: string): boolean {
    const now = Date.now();
    
    if (now - sessionState.lastActivity > sessionTimeout) {
      sessionState.approvals.clear();
    }
    
    sessionState.lastActivity = now;
    
    const currentCount = sessionState.approvals.get(toolName) ?? 0;
    if (currentCount >= maxApprovalsPerSession) {
      return false;
    }
    
    sessionState.approvals.set(toolName, currentCount + 1);
    return true;
  }
  
  return {
    async evaluate(request: PermissionRequest): Promise<PermissionResult> {
      const { riskLevel, target, toolName, action, data } = request;
      
      if (action === 'shell' && target) {
        const cmdCheck = isCommandAllowed(target);
        if (!cmdCheck.allowed) {
          return {
            granted: false,
            reason: cmdCheck.reason,
            requiresBackup: false,
          };
        }
      }
      
      if (target && !target.startsWith('http')) {
        const pathCheck = isPathAllowed(target);
        if (!pathCheck.allowed) {
          return {
            granted: false,
            reason: pathCheck.reason,
            requiresBackup: false,
          };
        }
      }
      
      if (target && target.startsWith('http')) {
        const domainCheck = isDomainAllowed(target);
        if (!domainCheck.allowed) {
          return {
            granted: false,
            reason: domainCheck.reason,
            requiresBackup: false,
          };
        }
      }
      
      if (approvalPolicy.autoApprove.includes(riskLevel)) {
        return {
          granted: true,
          requiresBackup: riskLevel === RiskLevel.MODIFY,
        };
      }
      
      if (!approvalPolicy.requireConfirmation.includes(riskLevel)) {
        return {
          granted: !approvalPolicy.denyByDefault,
          reason: approvalPolicy.denyByDefault ? 'Denied by policy' : undefined,
          requiresBackup: false,
        };
      }
      
      if (!checkSessionLimit(toolName)) {
        return {
          granted: false,
          reason: `Session approval limit reached for ${toolName}`,
          requiresBackup: false,
        };
      }
      
      if (callback) {
        const userApproved = await callback(request);
        return {
          granted: userApproved,
          reason: userApproved ? undefined : 'User denied permission',
          requiresBackup: riskLevel === RiskLevel.MODIFY,
        };
      }
      
      return {
        granted: false,
        reason: 'No permission callback configured for interactive confirmation',
        requiresBackup: false,
      };
    },
    
    setCallback(cb: PermissionCallback): void {
      callback = cb;
    },
  };
}

export function formatPermissionRequest(request: PermissionRequest): string {
  const riskEmoji = {
    [RiskLevel.READ]: '📖',
    [RiskLevel.MODIFY]: '✏️',
    [RiskLevel.DELETE]: '🗑️',
    [RiskLevel.SYSTEM]: '⚡',
  };
  
  const lines = [
    `${riskEmoji[request.riskLevel]} 权限请求`,
    `工具: ${request.toolName}`,
    `风险等级: ${request.riskLevel}`,
  ];
  
  if (request.target) {
    lines.push(`目标: ${request.target}`);
  }
  
  lines.push(`描述: ${request.description}`);
  
  return lines.join('\n');
}
