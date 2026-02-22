export enum RiskLevel {
  READ = 'READ',
  MODIFY = 'MODIFY',
  DELETE = 'DELETE',
  SYSTEM = 'SYSTEM',
}

export const RISK_LEVEL_PRIORITY: Record<RiskLevel, number> = {
  [RiskLevel.READ]: 1,
  [RiskLevel.MODIFY]: 2,
  [RiskLevel.DELETE]: 3,
  [RiskLevel.SYSTEM]: 4,
};

export interface PermissionRequest {
  toolName: string;
  action: string;
  target?: string;
  riskLevel: RiskLevel;
  description: string;
  data?: Record<string, unknown>;
}

export interface PermissionResult {
  granted: boolean;
  reason?: string;
  requiresBackup: boolean;
}

export interface PermissionConfig {
  autoApproveRead?: boolean;
  autoApproveModify?: boolean;
  requireConfirmationForDelete?: boolean;
  requireConfirmationForSystem?: boolean;
  backupBeforeModify?: boolean;
  backupDir?: string;
  allowedPaths?: string[];
  deniedPaths?: string[];
  allowedCommands?: string[];
  deniedCommands?: string[];
}

export type PermissionCallback = (request: PermissionRequest) => Promise<boolean>;

export interface PermissionGuard {
  evaluate(request: PermissionRequest): Promise<PermissionResult>;
  setCallback(callback: PermissionCallback): void;
  createBackup?(filePath: string): Promise<string>;
}

export interface BackupInfo {
  originalPath: string;
  backupPath: string;
  timestamp: Date;
  size: number;
}
