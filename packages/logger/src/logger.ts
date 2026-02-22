import type { LogEntry, LogLevel, LogCategory, LoggerConfig, Logger } from './types.js';
import initSqlJs from 'sql.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

export function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `task_${timestamp}_${random}`;
}

interface SqlDatabase {
  run(sql: string, params?: unknown[]): void;
  exec(sql: string, params?: unknown[]): { columns: string[]; values: unknown[][] }[];
  export(): Uint8Array;
  close(): void;
}

export async function createLoggerAsync(config: LoggerConfig = {}): Promise<Logger> {
  const {
    logDir = './logs',
    dbName = 'robot_logs.db',
    consoleOutput = true,
    minLevel = 'debug',
  } = config;

  const dbPath = path.join(logDir, dbName);
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const SQL = await initSqlJs();
  
  let db: SqlDatabase;
  
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer) as SqlDatabase;
  } else {
    db = new SQL.Database() as SqlDatabase;
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taskId TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_task_id ON logs(taskId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_category ON logs(category)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON logs(timestamp)`);

  function saveDatabase(): void {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }

  function log(
    level: LogLevel,
    category: LogCategory,
    taskId: string,
    message: string,
    data?: Record<string, unknown>
  ): void {
    if (!shouldLog(level, minLevel)) {
      return;
    }

    const entry: LogEntry = {
      taskId,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };

    db.run(
      `INSERT INTO logs (taskId, timestamp, level, category, message, data) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        entry.taskId,
        entry.timestamp,
        entry.level,
        entry.category,
        entry.message,
        data ? JSON.stringify(data) : null,
      ]
    );

    saveDatabase();

    if (consoleOutput) {
      const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${category}] [${taskId}]`;
      const dataStr = data ? ` ${JSON.stringify(data)}` : '';
      
      switch (level) {
        case 'error':
          console.error(`${prefix} ${message}${dataStr}`);
          break;
        case 'warn':
          console.warn(`${prefix} ${message}${dataStr}`);
          break;
        case 'debug':
          console.debug(`${prefix} ${message}${dataStr}`);
          break;
        default:
          console.log(`${prefix} ${message}${dataStr}`);
      }
    }
  }

  return {
    debug: (category, taskId, message, data) => log('debug', category, taskId, message, data),
    info: (category, taskId, message, data) => log('info', category, taskId, message, data),
    warn: (category, taskId, message, data) => log('warn', category, taskId, message, data),
    error: (category, taskId, message, data) => log('error', category, taskId, message, data),

    async getLogsByTask(taskId: string): Promise<LogEntry[]> {
      const rows = db.exec(`
        SELECT id, taskId, timestamp, level, category, message, data
        FROM logs
        WHERE taskId = ?
        ORDER BY timestamp ASC
      `, [taskId]);

      if (rows.length === 0) {
        return [];
      }

      return rows[0]!.values.map((row: unknown[]) => ({
        id: row[0] as number,
        taskId: row[1] as string,
        timestamp: row[2] as string,
        level: row[3] as LogLevel,
        category: row[4] as LogCategory,
        message: row[5] as string,
        data: row[6] ? JSON.parse(row[6] as string) : undefined,
      }));
    },

    async getLogsByCategory(category: LogCategory, limit = 100): Promise<LogEntry[]> {
      const rows = db.exec(`
        SELECT id, taskId, timestamp, level, category, message, data
        FROM logs
        WHERE category = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `, [category, limit]);

      if (rows.length === 0) {
        return [];
      }

      return rows[0]!.values.map((row: unknown[]) => ({
        id: row[0] as number,
        taskId: row[1] as string,
        timestamp: row[2] as string,
        level: row[3] as LogLevel,
        category: row[4] as LogCategory,
        message: row[5] as string,
        data: row[6] ? JSON.parse(row[6] as string) : undefined,
      }));
    },

    close(): void {
      saveDatabase();
      db.close();
    },
  };
}

let defaultLogger: Logger | null = null;

export async function createLogger(config: LoggerConfig = {}): Promise<Logger> {
  if (!defaultLogger) {
    defaultLogger = await createLoggerAsync(config);
  }
  return defaultLogger;
}
