import type { Tool, ToolResult, ToolContext, ToolParameters } from './types.js';
import { RiskLevel } from '@robot/permission-system';
import { createFileAdapter, type FileAdapter } from '@robot/windows-adapter';

interface FileReadParams {
  path: string;
  encoding?: BufferEncoding;
}

interface FileWriteParams {
  path: string;
  content: string;
  encoding?: BufferEncoding;
}

interface FileDeleteParams {
  path: string;
}

interface FileListParams {
  path: string;
}

interface FileCopyParams {
  source: string;
  destination: string;
}

interface FileMoveParams {
  source: string;
  destination: string;
}

interface FileExistsParams {
  path: string;
}

interface FileCreateDirParams {
  path: string;
  recursive?: boolean;
}

export function createFileReadTool(fileAdapter: FileAdapter = createFileAdapter()): Tool<FileReadParams> {
  return {
    name: 'file_read',
    description: 'Read the contents of a file from the filesystem',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute path to the file to read',
        },
        encoding: {
          type: 'string',
          description: 'The encoding to use when reading the file',
          enum: ['utf-8', 'utf8', 'ascii', 'base64', 'hex'],
          default: 'utf-8',
        },
      },
      required: ['path'],
    },
    riskLevel: RiskLevel.READ,
    async execute(params: FileReadParams, context: ToolContext): Promise<ToolResult> {
      try {
        const result = await fileAdapter.read(params.path, params.encoding ?? 'utf-8');
        return {
          success: true,
          data: {
            content: result.content,
            path: result.path,
            size: result.size,
            encoding: result.encoding,
          },
          metadata: {
            taskId: context.taskId,
            operation: 'file_read',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

export function createFileWriteTool(fileAdapter: FileAdapter = createFileAdapter()): Tool<FileWriteParams> {
  return {
    name: 'file_write',
    description: 'Write content to a file, creating it if it does not exist',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute path to the file to write',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file',
        },
        encoding: {
          type: 'string',
          description: 'The encoding to use when writing the file',
          enum: ['utf-8', 'utf8', 'ascii', 'base64', 'hex'],
          default: 'utf-8',
        },
      },
      required: ['path', 'content'],
    },
    riskLevel: RiskLevel.MODIFY,
    async execute(params: FileWriteParams, context: ToolContext): Promise<ToolResult> {
      if (context.dryRun) {
        return {
          success: true,
          data: {
            message: `Would write ${params.content.length} bytes to ${params.path}`,
            dryRun: true,
          },
        };
      }

      try {
        const result = await fileAdapter.write(params.path, params.content, params.encoding ?? 'utf-8');
        return {
          success: true,
          data: {
            path: result.path,
            bytesWritten: result.bytesWritten,
            created: result.created,
          },
          metadata: {
            taskId: context.taskId,
            operation: 'file_write',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

export function createFileDeleteTool(fileAdapter: FileAdapter = createFileAdapter()): Tool<FileDeleteParams> {
  return {
    name: 'file_delete',
    description: 'Delete a file or directory from the filesystem',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute path to the file or directory to delete',
        },
      },
      required: ['path'],
    },
    riskLevel: RiskLevel.DELETE,
    async execute(params: FileDeleteParams, context: ToolContext): Promise<ToolResult> {
      if (context.dryRun) {
        return {
          success: true,
          data: {
            message: `Would delete ${params.path}`,
            dryRun: true,
          },
        };
      }

      try {
        const result = await fileAdapter.delete(params.path);
        return {
          success: true,
          data: {
            path: result.path,
            wasDirectory: result.wasDirectory,
          },
          metadata: {
            taskId: context.taskId,
            operation: 'file_delete',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

export function createFileListTool(fileAdapter: FileAdapter = createFileAdapter()): Tool<FileListParams> {
  return {
    name: 'file_list',
    description: 'List the contents of a directory',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute path to the directory to list',
        },
      },
      required: ['path'],
    },
    riskLevel: RiskLevel.READ,
    async execute(params: FileListParams, context: ToolContext): Promise<ToolResult> {
      try {
        const result = await fileAdapter.listDir(params.path);
        return {
          success: true,
          data: {
            path: result.path,
            entries: result.entries.map(e => ({
              name: e.name,
              path: e.path,
              isDirectory: e.isDirectory,
              size: e.size,
              modifiedAt: e.modifiedAt.toISOString(),
            })),
          },
          metadata: {
            taskId: context.taskId,
            operation: 'file_list',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

export function createFileExistsTool(fileAdapter: FileAdapter = createFileAdapter()): Tool<FileExistsParams> {
  return {
    name: 'file_exists',
    description: 'Check if a file or directory exists',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute path to check',
        },
      },
      required: ['path'],
    },
    riskLevel: RiskLevel.READ,
    async execute(params: FileExistsParams, context: ToolContext): Promise<ToolResult> {
      try {
        const exists = await fileAdapter.exists(params.path);
        return {
          success: true,
          data: {
            path: params.path,
            exists,
          },
          metadata: {
            taskId: context.taskId,
            operation: 'file_exists',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

export function createFileCopyTool(fileAdapter: FileAdapter = createFileAdapter()): Tool<FileCopyParams> {
  return {
    name: 'file_copy',
    description: 'Copy a file from one location to another',
    parameters: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'The absolute path to the source file',
        },
        destination: {
          type: 'string',
          description: 'The absolute path to the destination',
        },
      },
      required: ['source', 'destination'],
    },
    riskLevel: RiskLevel.MODIFY,
    async execute(params: FileCopyParams, context: ToolContext): Promise<ToolResult> {
      if (context.dryRun) {
        return {
          success: true,
          data: {
            message: `Would copy ${params.source} to ${params.destination}`,
            dryRun: true,
          },
        };
      }

      try {
        const result = await fileAdapter.copy(params.source, params.destination);
        return {
          success: true,
          data: {
            source: params.source,
            destination: result.path,
            bytesWritten: result.bytesWritten,
          },
          metadata: {
            taskId: context.taskId,
            operation: 'file_copy',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

export function createFileMoveTool(fileAdapter: FileAdapter = createFileAdapter()): Tool<FileMoveParams> {
  return {
    name: 'file_move',
    description: 'Move a file from one location to another',
    parameters: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'The absolute path to the source file',
        },
        destination: {
          type: 'string',
          description: 'The absolute path to the destination',
        },
      },
      required: ['source', 'destination'],
    },
    riskLevel: RiskLevel.MODIFY,
    async execute(params: FileMoveParams, context: ToolContext): Promise<ToolResult> {
      if (context.dryRun) {
        return {
          success: true,
          data: {
            message: `Would move ${params.source} to ${params.destination}`,
            dryRun: true,
          },
        };
      }

      try {
        await fileAdapter.move(params.source, params.destination);
        return {
          success: true,
          data: {
            source: params.source,
            destination: params.destination,
          },
          metadata: {
            taskId: context.taskId,
            operation: 'file_move',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

export function createFileCreateDirTool(fileAdapter: FileAdapter = createFileAdapter()): Tool<FileCreateDirParams> {
  return {
    name: 'file_create_dir',
    description: 'Create a directory, including parent directories if needed',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute path to the directory to create',
        },
        recursive: {
          type: 'boolean',
          description: 'Whether to create parent directories if they do not exist',
          default: true,
        },
      },
      required: ['path'],
    },
    riskLevel: RiskLevel.MODIFY,
    async execute(params: FileCreateDirParams, context: ToolContext): Promise<ToolResult> {
      if (context.dryRun) {
        return {
          success: true,
          data: {
            message: `Would create directory ${params.path}`,
            dryRun: true,
          },
        };
      }

      try {
        await fileAdapter.createDir(params.path, params.recursive ?? true);
        return {
          success: true,
          data: {
            path: params.path,
            created: true,
          },
          metadata: {
            taskId: context.taskId,
            operation: 'file_create_dir',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

export function registerFileTools(registry: {
  register: (tool: Tool) => void;
}, fileAdapter?: FileAdapter): void {
  const adapter = fileAdapter ?? createFileAdapter();
  
  registry.register(createFileReadTool(adapter));
  registry.register(createFileWriteTool(adapter));
  registry.register(createFileDeleteTool(adapter));
  registry.register(createFileListTool(adapter));
  registry.register(createFileExistsTool(adapter));
  registry.register(createFileCopyTool(adapter));
  registry.register(createFileMoveTool(adapter));
  registry.register(createFileCreateDirTool(adapter));
}
