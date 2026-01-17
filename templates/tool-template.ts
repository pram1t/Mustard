/**
 * Tool Template
 *
 * Use this template to create a new tool for OpenAgent.
 * Copy this file and implement the execute method.
 */

import type {
  Tool,
  ToolResult,
  ExecutionContext,
  ToolParameters,
} from '../specs/tool-interface';

// =============================================================================
// PARAMETER TYPES (Define your tool's parameters)
// =============================================================================

/**
 * Parameters for your tool
 * Define all the inputs your tool accepts
 */
interface MyToolParams {
  // Required parameters
  requiredParam: string;

  // Optional parameters with defaults
  optionalParam?: number;

  // Array parameters
  listParam?: string[];

  // Add all your parameters here
}

// =============================================================================
// TOOL DEFINITION
// =============================================================================

/**
 * Your Tool Implementation
 *
 * Replace "MyTool" with your tool name (e.g., "GitCommit", "DockerRun", etc.)
 */
export const MyTool: Tool = {
  /**
   * Unique tool name
   * Convention: PascalCase for built-in, snake_case for MCP
   */
  name: 'MyTool',

  /**
   * Description for the LLM
   *
   * Be clear and concise. Include:
   * - What the tool does
   * - When to use it
   * - Any important constraints or behaviors
   */
  description: `Describe what your tool does here.
- Include bullet points for key features
- Mention any important constraints
- Explain when the LLM should use this tool`,

  /**
   * JSON Schema for parameters
   * The LLM uses this to understand what arguments to pass
   */
  parameters: {
    type: 'object',
    properties: {
      requiredParam: {
        type: 'string',
        description: 'Description of this required parameter',
      },
      optionalParam: {
        type: 'number',
        description: 'Description of this optional parameter',
        default: 42,
      },
      listParam: {
        type: 'array',
        description: 'A list of items',
        items: { type: 'string' },
      },
    },
    required: ['requiredParam'], // List required parameters
  },

  /**
   * Execute the tool
   *
   * @param params - Validated parameters from LLM (matches MyToolParams)
   * @param context - Execution context with cwd, session info, etc.
   * @returns ToolResult with success status and output
   */
  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    // 1. Cast params to your type for type safety
    const {
      requiredParam,
      optionalParam = 42,
      listParam = [],
    } = params as MyToolParams;

    // 2. Validate parameters (optional, as LLM should send valid params)
    if (!requiredParam) {
      return {
        success: false,
        output: '',
        error: 'requiredParam is required',
      };
    }

    // 3. Use context for paths, permissions, etc.
    const workingDir = context.cwd;
    const sessionId = context.sessionId;

    // 4. Check permissions if needed (for sensitive operations)
    // const permission = await context.permissions.check('MyTool', params);
    // if (permission === 'deny') {
    //   return { success: false, output: '', error: 'Permission denied' };
    // }

    try {
      // 5. Implement your tool logic here
      // Example: Process the parameters and do something useful

      const result = await doSomethingUseful(requiredParam, optionalParam, listParam);

      // 6. Return success result
      return {
        success: true,
        output: result,
        metadata: {
          // Optional: Include metadata about the execution
          executionTime: Date.now(),
          // modifiedFiles: ['path/to/file'], // If files were changed
          // tokensUsed: 100, // If this consumed tokens
        },
      };
    } catch (error) {
      // 7. Return error result
      return {
        success: false,
        output: '', // Can include partial output if useful
        error: `Tool execution failed: ${error}`,
      };
    }
  },
};

// =============================================================================
// HELPER FUNCTIONS (Implement your tool's logic)
// =============================================================================

/**
 * Main logic for your tool
 * Extract this into separate functions for clarity
 */
async function doSomethingUseful(
  param1: string,
  param2: number,
  param3: string[]
): Promise<string> {
  // Implement your tool's main logic here

  // Example: Return a formatted result
  return `Processed: ${param1} with value ${param2} and ${param3.length} items`;
}

// =============================================================================
// ALTERNATIVE: Helper Functions for Common Patterns
// =============================================================================

/**
 * Helper to create success result
 */
function success(output: string | Record<string, unknown>, metadata?: Record<string, unknown>): ToolResult {
  return {
    success: true,
    output,
    metadata,
  };
}

/**
 * Helper to create error result
 */
function error(message: string, partialOutput: string = ''): ToolResult {
  return {
    success: false,
    output: partialOutput,
    error: message,
  };
}

/**
 * Helper to resolve paths (handles absolute and relative)
 */
function resolvePath(path: string, context: ExecutionContext): string {
  const nodePath = require('path');
  return nodePath.isAbsolute(path) ? path : nodePath.resolve(context.cwd, path);
}

// =============================================================================
// USAGE EXAMPLE
// =============================================================================

/*
// Register your tool with the registry
import { ToolRegistry } from '@openagent/tools';
import { MyTool } from './my-tool';

const registry = new ToolRegistry();
registry.register(MyTool);

// Execute the tool
const result = await registry.execute('MyTool', {
  requiredParam: 'test',
  optionalParam: 100,
  listParam: ['a', 'b', 'c'],
}, context);

console.log(result);
*/

// =============================================================================
// BEST PRACTICES
// =============================================================================

/*
1. CLEAR DESCRIPTIONS
   - Be specific about what the tool does
   - Include when to use and when NOT to use
   - Document any side effects

2. ROBUST PARAMETER HANDLING
   - Provide sensible defaults
   - Validate inputs even if LLM should send valid params
   - Handle edge cases gracefully

3. PROPER ERROR HANDLING
   - Return descriptive error messages
   - Include context about what went wrong
   - Don't throw exceptions; return error results

4. PATH HANDLING
   - Always support both absolute and relative paths
   - Use context.cwd for relative path resolution
   - Validate paths exist before operating

5. PERMISSION AWARENESS
   - Consider if the tool needs permission checks
   - Use context.permissions for sensitive operations
   - Respect permission denials

6. METADATA
   - Include modifiedFiles if the tool changes files
   - Track execution time for debugging
   - Add any tool-specific metadata
*/
