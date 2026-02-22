import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  PermissionGuard,
  PermissionRequest,
  PermissionResult,
  PermissionConfig,
  PermissionCallback,
  BackupInfo,
} from './types.js';
import { RiskLevel, RISK_LEVEL_PRIORITY } from './types.js';

const DEFAULT_CONFIG: PermissionConfig = {
  autoApproveRead: true,
  autoApproveModify: false,
  requireConfirmationForDelete: true,
  requireConfirmationForSystem: true,
  backupBeforeModify: true,
  backupDir: './.robot-backups',
  allowedPaths: [],
  deniedPaths: [],
  allowedCommands: [],
  deniedCommands: [],
};

export function createPermissionGuard(config: PermissionConfig = {}): PermissionGuard {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let callback: PermissionCallback | null = null;

  function isPathAllowed(targetPath: string): boolean {
    const normalizedPath = path.resolve(targetPath);
    
    if (finalConfig.deniedPaths && finalConfig.deniedPaths.length > 0) {
      for (const denied of finalConfig.deniedPaths) {
        if (normalizedPath.startsWith(path.resolve(denied))) {
          return false;
        }
      }
    }
    
    if (finalConfig.allowedPaths && finalConfig.allowedPaths.length > 0) {
      for (const allowed of finalConfig.allowedPaths) {
        if (normalizedPath.startsWith(path.resolve(allowed))) {
          return true;
        }
      }
      return false;
    }
    
    return true;
  }

  function isCommandAllowed(command: string): boolean {
    const cmd = command.toLowerCase().trim();
    
    if (finalConfig.deniedCommands && finalConfig.deniedCommands.length > 0) {
      for (const denied of finalConfig.deniedCommands) {
        if (cmd.includes(denied.toLowerCase())) {
          return false;
        }
      }
    }
    
    if (finalConfig.allowedCommands && finalConfig.allowedCommands.length > 0) {
      for (const allowed of finalConfig.allowedCommands) {
        if (cmd.includes(allowed.toLowerCase())) {
          return true;
        }
      }
      return false;
    }
    
    return true;
  }

  async function createBackup(filePath: string): Promise<string> {
    const normalizedPath = path.resolve(filePath);
    
    if (!fs.existsSync(normalizedPath)) {
      throw new Error(`Cannot backup: file does not exist: ${normalizedPath}`);
    }
    
    const backupDir = path.resolve(finalConfig.backupDir ?? './.robot-backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${path.basename(normalizedPath)}.${timestamp}.bak`;
    const backupPath = path.join(backupDir, backupName);
    
    fs.copyFileSync(normalizedPath, backupPath);
    
    return backupPath;
  }

  return {
    async evaluate(request: PermissionRequest): Promise<PermissionResult> {
      const { riskLevel, target, toolName, action } = request;
      
      if (target && !isPathAllowed(target)) {
        return {
          granted: false,
          reason: `Path not allowed: ${target}`,
          requiresBackup: false,
        };
      }
      
      if (action === 'shell' && target && !isCommandAllowed(target)) {
        return {
          granted: false,
          reason: `Command not allowed: ${target}`,
          requiresBackup: false,
        };
      }
      
      let requiresConfirmation = false;
      let requiresBackup = false;
      
      switch (riskLevel) {
        case RiskLevel.READ:
          requiresConfirmation = !finalConfig.autoApproveRead;
          break;
        case RiskLevel.MODIFY:
          requiresConfirmation = !finalConfig.autoApproveModify;
          requiresBackup = finalConfig.backupBeforeModify ?? false;
          break;
        case RiskLevel.DELETE:
          requiresConfirmation = finalConfig.requireConfirmationForDelete ?? true;
          break;
        case RiskLevel.SYSTEM:
          requiresConfirmation = finalConfig.requireConfirmationForSystem ?? true;
          break;
      }
      
      if (!requiresConfirmation) {
        return {
          granted: true,
          requiresBackup,
        };
      }
      
      if (callback) {
        const userApproved = await callback(request);
        return {
          granted: userApproved,
          reason: userApproved ? undefined : 'User denied permission',
          requiresBackup,
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

    async createBackup(filePath: string): Promise<string> {
      return createBackup(filePath);
    },
  };
}

export function getBackupInfo(backupPath: string): BackupInfo {
  const stats = fs.statSync(backupPath);
  const parts = path.basename(backupPath).split('.');
  const originalName = parts.slice(0, -2).join('.');
  
  return {
    originalPath: path.resolve(originalName),
    backupPath: path.resolve(backupPath),
    timestamp: stats.birthtime,
    size: stats.size,
  };
}

export function listBackups(backupDir: string): BackupInfo[] {
  const dir = path.resolve(backupDir);
  
  if (!fs.existsSync(dir)) {
    return [];
  }
  
  const files = fs.readdirSync(dir);
  const backups: BackupInfo[] = [];
  
  for (const file of files) {
    if (file.endsWith('.bak')) {
      const backupPath = path.join(dir, file);
      backups.push(getBackupInfo(backupPath));
    }
  }
  
  return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
