import type { Tool, ToolRegistry, ToolDefinition } from './types.js';

export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, Tool>();

  return {
    register(tool: Tool): void {
      if (tools.has(tool.name)) {
        throw new Error(`Tool already registered: ${tool.name}`);
      }
      tools.set(tool.name, tool);
    },

    get(name: string): Tool | undefined {
      return tools.get(name);
    },

    getAll(): Tool[] {
      return Array.from(tools.values());
    },

    getDefinitions(): ToolDefinition[] {
      return Array.from(tools.values()).map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
    },

    has(name: string): boolean {
      return tools.has(name);
    },
  };
}
