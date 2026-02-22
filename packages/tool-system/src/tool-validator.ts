import type { Tool, ToolParameters, ToolParameterProperty } from './types.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ToolValidator {
  validate(toolName: string, params: unknown): ValidationResult;
  validateSchema(params: unknown, schema: ToolParameters): ValidationResult;
}

function validateProperty(value: unknown, prop: ToolParameterProperty, path: string): string[] {
  const errors: string[] = [];
  
  if (value === undefined || value === null) {
    return errors;
  }
  
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  
  if (actualType !== prop.type) {
    if (!(actualType === 'number' && prop.type === 'number')) {
      errors.push(`${path}: expected ${prop.type}, got ${actualType}`);
      return errors;
    }
  }
  
  if (prop.enum && !prop.enum.includes(value as string)) {
    errors.push(`${path}: value must be one of [${prop.enum.join(', ')}]`);
  }
  
  if (prop.type === 'array' && prop.items && Array.isArray(value)) {
    value.forEach((item, index) => {
      errors.push(...validateProperty(item, prop.items!, `${path}[${index}]`));
    });
  }
  
  if (prop.type === 'object' && prop.properties && typeof value === 'object' && value !== null) {
    for (const [key, nestedProp] of Object.entries(prop.properties)) {
      const nestedValue = (value as Record<string, unknown>)[key];
      if (nestedValue !== undefined) {
        errors.push(...validateProperty(nestedValue, nestedProp, `${path}.${key}`));
      }
    }
  }
  
  return errors;
}

export function createToolValidator(tools: Map<string, Tool>): ToolValidator {
  return {
    validate(toolName: string, params: unknown): ValidationResult {
      const tool = tools.get(toolName);
      if (!tool) {
        return {
          valid: false,
          errors: [`Tool not found: ${toolName}`],
        };
      }
      
      return this.validateSchema(params, tool.parameters);
    },
    
    validateSchema(params: unknown, schema: ToolParameters): ValidationResult {
      const errors: string[] = [];
      
      if (typeof params !== 'object' || params === null) {
        return {
          valid: false,
          errors: ['Parameters must be an object'],
        };
      }
      
      const paramObj = params as Record<string, unknown>;
      
      if (schema.required) {
        for (const req of schema.required) {
          if (paramObj[req] === undefined) {
            errors.push(`Missing required parameter: ${req}`);
          }
        }
      }
      
      for (const [key, prop] of Object.entries(schema.properties)) {
        const value = paramObj[key];
        if (value !== undefined) {
          errors.push(...validateProperty(value, prop, key));
        }
      }
      
      return {
        valid: errors.length === 0,
        errors,
      };
    },
  };
}
