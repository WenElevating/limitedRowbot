import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type {
  FileAdapter,
  FileInfo,
  FileReadResult,
  FileWriteResult,
  FileDeleteResult,
  DirectoryListResult,
} from './types.js';

const statAsync = promisify(fs.stat);
const readdirAsync = promisify(fs.readdir);
const mkdirAsync = promisify(fs.mkdir);
const unlinkAsync = promisify(fs.unlink);
const rmdirAsync = promisify(fs.rmdir);
const copyFileAsync = promisify(fs.copyFile);
const renameAsync = promisify(fs.rename);
const accessAsync = promisify(fs.access);

function formatPermissions(mode: number): string {
  const permissions = ['r', 'w', 'x'];
  let result = '';
  
  for (let i = 0; i < 3; i++) {
    const shift = 8 - i * 3;
    for (const perm of permissions) {
      result += (mode & (1 << shift - permissions.indexOf(perm))) ? perm : '-';
    }
  }
  
  return result;
}

export function createFileAdapter(): FileAdapter {
  return {
    async read(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<FileReadResult> {
      const normalizedPath = path.resolve(filePath);
      const stats = await statAsync(normalizedPath);
      
      if (stats.isDirectory()) {
        throw new Error(`Cannot read directory: ${normalizedPath}`);
      }
      
      const content = await fs.promises.readFile(normalizedPath, encoding);
      
      return {
        path: normalizedPath,
        content,
        encoding,
        size: stats.size,
      };
    },

    async write(filePath: string, content: string, encoding: BufferEncoding = 'utf-8'): Promise<FileWriteResult> {
      const normalizedPath = path.resolve(filePath);
      const dir = path.dirname(normalizedPath);
      
      let created = false;
      try {
        await accessAsync(normalizedPath, fs.constants.F_OK);
      } catch {
        created = true;
        await mkdirAsync(dir, { recursive: true });
      }
      
      await fs.promises.writeFile(normalizedPath, content, encoding);
      const stats = await statAsync(normalizedPath);
      
      return {
        path: normalizedPath,
        bytesWritten: stats.size,
        created,
      };
    },

    async delete(filePath: string): Promise<FileDeleteResult> {
      const normalizedPath = path.resolve(filePath);
      const stats = await statAsync(normalizedPath);
      
      if (stats.isDirectory()) {
        await rmdirAsync(normalizedPath, { recursive: true });
      } else {
        await unlinkAsync(normalizedPath);
      }
      
      return {
        path: normalizedPath,
        success: true,
        wasDirectory: stats.isDirectory(),
      };
    },

    async exists(filePath: string): Promise<boolean> {
      try {
        await accessAsync(filePath, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    },

    async listDir(dirPath: string): Promise<DirectoryListResult> {
      const normalizedPath = path.resolve(dirPath);
      const entries = await readdirAsync(normalizedPath, { withFileTypes: true });
      
      const fileInfos: FileInfo[] = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(normalizedPath, entry.name);
          const stats = await statAsync(fullPath);
          
          return {
            path: fullPath,
            name: entry.name,
            isDirectory: entry.isDirectory(),
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            permissions: formatPermissions(stats.mode),
          };
        })
      );
      
      return {
        path: normalizedPath,
        entries: fileInfos,
      };
    },

    async createDir(dirPath: string, recursive = true): Promise<boolean> {
      await mkdirAsync(dirPath, { recursive });
      return true;
    },

    async copy(src: string, dest: string): Promise<FileWriteResult> {
      const normalizedSrc = path.resolve(src);
      const normalizedDest = path.resolve(dest);
      const destDir = path.dirname(normalizedDest);
      
      await mkdirAsync(destDir, { recursive: true });
      await copyFileAsync(normalizedSrc, normalizedDest);
      
      const stats = await statAsync(normalizedDest);
      
      return {
        path: normalizedDest,
        bytesWritten: stats.size,
        created: true,
      };
    },

    async move(src: string, dest: string): Promise<boolean> {
      const normalizedSrc = path.resolve(src);
      const normalizedDest = path.resolve(dest);
      const destDir = path.dirname(normalizedDest);
      
      await mkdirAsync(destDir, { recursive: true });
      await renameAsync(normalizedSrc, normalizedDest);
      
      return true;
    },

    async getFileInfo(filePath: string): Promise<FileInfo> {
      const normalizedPath = path.resolve(filePath);
      const stats = await statAsync(normalizedPath);
      
      return {
        path: normalizedPath,
        name: path.basename(normalizedPath),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        permissions: formatPermissions(stats.mode),
      };
    },
  };
}
