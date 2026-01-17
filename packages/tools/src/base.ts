/**
 * Base Tool Class
 *
 * Abstract base class for implementing tools with common functionality.
 */

import type {
  Tool,
  ToolParameters,
  ToolResult,
  ExecutionContext,
  JSONSchema,
} from './types';

/**
 * Abstract base class for tools
 * Provides common functionality like parameter validation and error handling
 */
export abstract class BaseTool implements Tool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters: ToolParameters;

  /**
   * Execute the tool - to be implemented by subclasses
   */
  abstract execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult>;

  /**
   * Validate parameters against the schema
   * @returns Array of validation errors, empty if valid
   */
  protected validateParams(params: Record<string, unknown>): string[] {
    const errors: string[] = [];
    const schema = this.parameters;

    // Check required parameters
    if (schema.required) {
      for (const required of schema.required) {
        if (!(required in params) || params[required] === undefined) {
          errors.push(`Missing required parameter: ${required}`);
        }
      }
    }

    // Check parameter types
    for (const [key, value] of Object.entries(params)) {
      const paramSchema = schema.properties[key];
      if (!paramSchema) {
        if (schema.additionalProperties === false) {
          errors.push(`Unknown parameter: ${key}`);
        }
        continue;
      }

      const typeError = this.validateType(key, value, paramSchema);
      if (typeError) {
        errors.push(typeError);
      }
    }

    return errors;
  }

  /**
   * Validate a single parameter value against its schema
   */
  private validateType(
    name: string,
    value: unknown,
    schema: JSONSchema
  ): string | null {
    if (value === undefined || value === null) {
      return null; // Handled by required check
    }

    switch (schema.type) {
      case 'string':
        if (typeof value !== 'string') {
          return `Parameter '${name}' must be a string`;
        }
        if (schema.minLength && value.length < schema.minLength) {
          return `Parameter '${name}' must be at least ${schema.minLength} characters`;
        }
        if (schema.maxLength && value.length > schema.maxLength) {
          return `Parameter '${name}' must be at most ${schema.maxLength} characters`;
        }
        if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
          return `Parameter '${name}' does not match pattern: ${schema.pattern}`;
        }
        if (schema.enum && !schema.enum.includes(value)) {
          return `Parameter '${name}' must be one of: ${schema.enum.join(', ')}`;
        }
        break;

      case 'number':
      case 'integer':
        if (typeof value !== 'number') {
          return `Parameter '${name}' must be a number`;
        }
        if (schema.type === 'integer' && !Number.isInteger(value)) {
          return `Parameter '${name}' must be an integer`;
        }
        if (schema.minimum !== undefined && value < schema.minimum) {
          return `Parameter '${name}' must be >= ${schema.minimum}`;
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
          return `Parameter '${name}' must be <= ${schema.maximum}`;
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return `Parameter '${name}' must be a boolean`;
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          return `Parameter '${name}' must be an array`;
        }
        break;

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          return `Parameter '${name}' must be an object`;
        }
        break;
    }

    return null;
  }

  /**
   * Create a success result
   */
  protected success(output: string | object, metadata?: ToolResult['metadata']): ToolResult {
    return {
      success: true,
      output,
      metadata,
    };
  }

  /**
   * Create a failure result
   */
  protected failure(error: string, output: string | object = ''): ToolResult {
    return {
      success: false,
      output,
      error,
    };
  }

  /**
   * Wrap execution with validation and error handling
   */
  protected async safeExecute(
    params: Record<string, unknown>,
    context: ExecutionContext,
    fn: () => Promise<ToolResult>
  ): Promise<ToolResult> {
    // Validate parameters
    const errors = this.validateParams(params);
    if (errors.length > 0) {
      return this.failure(`Validation failed: ${errors.join('; ')}`);
    }

    // Execute with error handling
    try {
      const startTime = Date.now();
      const result = await fn();

      // Add execution time if not already set
      if (result.metadata) {
        result.metadata.executionTime = result.metadata.executionTime ?? (Date.now() - startTime);
      } else {
        result.metadata = { executionTime: Date.now() - startTime };
      }

      return result;
    } catch (error) {
      return this.failure(`Tool execution failed: ${error}`);
    }
  }

  /**
   * Estimate token count for output
   * Uses rough approximation of 4 characters per token
   */
  protected estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate output if it exceeds the maximum size
   */
  protected truncateOutput(output: string, maxSize: number = 100000): string {
    if (output.length <= maxSize) {
      return output;
    }

    const truncatedLength = maxSize - 100; // Leave room for message
    return (
      output.slice(0, truncatedLength) +
      `\n\n[Output truncated. Showing ${truncatedLength} of ${output.length} characters]`
    );
  }
}

/**
 * Helper function to create a simple tool without extending BaseTool
 */
export function createTool(definition: Tool): Tool {
  return definition;
}
