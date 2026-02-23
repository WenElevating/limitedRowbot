import { describe, it, expect, beforeEach } from 'vitest';
import { createToolValidator } from './tool-validator.js';
import type { Tool } from './types.js';
import { RiskLevel } from '@robot/permission-system';

describe('createToolValidator', () => {
  let validator: ReturnType<typeof createToolValidator>;
  let tools: Map<string, Tool>;

  beforeEach(() => {
    tools = new Map();

    tools.set('test_tool', {
      name: 'test_tool',
      description: 'A test tool',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'A message',
          },
          count: {
            type: 'number',
            description: 'A count',
          },
        },
        required: ['message'],
      },
      riskLevel: RiskLevel.READ,
      execute: async () => ({ success: true }),
    });

    tools.set('tool_with_enum', {
      name: 'tool_with_enum',
      description: 'Tool with enum',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            description: 'Mode',
            enum: ['read', 'write', 'delete'],
          },
        },
        required: ['mode'],
      },
      riskLevel: RiskLevel.READ,
      execute: async () => ({ success: true }),
    });

    tools.set('tool_with_array', {
      name: 'tool_with_array',
      description: 'Tool with array',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'Items',
            items: {
              type: 'string',
              description: 'Item',
            },
          },
        },
        required: [],
      },
      riskLevel: RiskLevel.READ,
      execute: async () => ({ success: true }),
    });

    tools.set('tool_with_nested_object', {
      name: 'tool_with_nested_object',
      description: 'Tool with nested object',
      parameters: {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            description: 'Config',
            properties: {
              name: {
                type: 'string',
                description: 'Name',
              },
              value: {
                type: 'number',
                description: 'Value',
              },
            },
          },
        },
        required: [],
      },
      riskLevel: RiskLevel.READ,
      execute: async () => ({ success: true }),
    });

    validator = createToolValidator(tools);
  });

  describe('validate', () => {
    it('should return valid for correct params', () => {
      const result = validator.validate('test_tool', { message: 'hello' });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for missing required param', () => {
      const result = validator.validate('test_tool', {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: message');
    });

    it('should return invalid for unknown tool', () => {
      const result = validator.validate('unknown_tool', {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Tool not found: unknown_tool');
    });

    it('should validate enum values', () => {
      const result = validator.validate('tool_with_enum', { mode: 'invalid' });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be one of');
    });

    it('should accept valid enum value', () => {
      const result = validator.validate('tool_with_enum', { mode: 'read' });

      expect(result.valid).toBe(true);
    });

    it('should validate array items', () => {
      const result = validator.validate('tool_with_array', { items: ['a', 'b', 'c'] });

      expect(result.valid).toBe(true);
    });

    it('should validate nested objects', () => {
      const result = validator.validate('tool_with_nested_object', {
        config: { name: 'test', value: 123 },
      });

      expect(result.valid).toBe(true);
    });

    it('should validate optional params', () => {
      const result = validator.validate('test_tool', { message: 'hello', count: 42 });

      expect(result.valid).toBe(true);
    });
  });

  describe('validateSchema', () => {
    it('should return invalid for non-object params', () => {
      const result = validator.validateSchema('string', {
        type: 'object',
        properties: {},
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Parameters must be an object');
    });

    it('should return invalid for null params', () => {
      const result = validator.validateSchema(null, {
        type: 'object',
        properties: {},
      });

      expect(result.valid).toBe(false);
    });

    it('should validate type mismatch', () => {
      const result = validator.validateSchema(
        { message: 123 },
        {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Message' },
          },
        }
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('expected string');
    });

    it('should skip validation for undefined optional params', () => {
      const result = validator.validateSchema(
        {},
        {
          type: 'object',
          properties: {
            optional: { type: 'string', description: 'Optional' },
          },
        }
      );

      expect(result.valid).toBe(true);
    });

    it('should validate array type', () => {
      const result = validator.validateSchema(
        { items: [1, 2, 3] },
        {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              description: 'Items',
              items: { type: 'string', description: 'Item' },
            },
          },
        }
      );

      expect(result.valid).toBe(false);
    });

    it('should validate boolean type', () => {
      const result = validator.validateSchema(
        { flag: true },
        {
          type: 'object',
          properties: {
            flag: { type: 'boolean', description: 'Flag' },
          },
        }
      );

      expect(result.valid).toBe(true);
    });

    it('should validate number type', () => {
      const result = validator.validateSchema(
        { count: 42 },
        {
          type: 'object',
          properties: {
            count: { type: 'number', description: 'Count' },
          },
        }
      );

      expect(result.valid).toBe(true);
    });
  });
});
