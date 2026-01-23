/**
 * Tool Execution
 *
 * Handles parallel execution of tool calls with proper error handling.
 */

import type { ToolCall } from '@openagent/llm';
import type { ToolResult, IToolRegistry, ExecutionContext } from '@openagent/tools';
import { getLogger } from '@openagent/logger';

/**
 * Execute multiple tool calls in parallel.
 *
 * @param toolCalls - Array of tool calls to execute
 * @param registry - Tool registry containing available tools
 * @param context - Execution context for tools
 * @returns Map of tool_call_id to ToolResult
 */
export async function executeTools(
  toolCalls: ToolCall[],
  registry: IToolRegistry,
  context: ExecutionContext
): Promise<Map<string, ToolResult>> {
  const logger = getLogger();
  const results = new Map<string, ToolResult>();

  if (toolCalls.length === 0) {
    return results;
  }

  logger.debug('Executing tools', {
    count: toolCalls.length,
    tools: toolCalls.map(tc => tc.name),
    sessionId: context.sessionId,
  });

  // Execute all tools in parallel
  const executions = toolCalls.map(async (toolCall): Promise<[string, ToolResult]> => {
    const startTime = Date.now();

    try {
      // Check if tool exists
      if (!registry.has(toolCall.name)) {
        logger.warn('Tool not found', { tool: toolCall.name, toolCallId: toolCall.id });
        return [
          toolCall.id,
          {
            success: false,
            output: '',
            error: `Tool '${toolCall.name}' not found`,
          },
        ];
      }

      // Execute the tool
      const result = await registry.execute(
        toolCall.name,
        toolCall.arguments,
        context
      );

      const duration = Date.now() - startTime;
      logger.debug('Tool executed', {
        tool: toolCall.name,
        toolCallId: toolCall.id,
        success: result.success,
        duration,
      });

      return [toolCall.id, result];

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      logger.error('Tool execution failed', {
        tool: toolCall.name,
        toolCallId: toolCall.id,
        error: errorMsg,
        duration,
      });

      return [
        toolCall.id,
        {
          success: false,
          output: '',
          error: errorMsg,
        },
      ];
    }
  });

  // Wait for all executions to complete
  const completedResults = await Promise.all(executions);

  // Build results map
  for (const [id, result] of completedResults) {
    results.set(id, result);
  }

  logger.debug('All tools executed', {
    count: results.size,
    successful: Array.from(results.values()).filter(r => r.success).length,
    sessionId: context.sessionId,
  });

  return results;
}

/**
 * Execute a single tool call.
 *
 * @param toolCall - The tool call to execute
 * @param registry - Tool registry
 * @param context - Execution context
 * @returns ToolResult
 */
export async function executeSingleTool(
  toolCall: ToolCall,
  registry: IToolRegistry,
  context: ExecutionContext
): Promise<ToolResult> {
  const results = await executeTools([toolCall], registry, context);
  return results.get(toolCall.id) || {
    success: false,
    output: '',
    error: 'Execution failed',
  };
}

/**
 * Validate tool calls before execution.
 * Checks that all referenced tools exist in the registry.
 *
 * @param toolCalls - Tool calls to validate
 * @param registry - Tool registry
 * @returns Array of validation errors (empty if all valid)
 */
export function validateToolCalls(
  toolCalls: ToolCall[],
  registry: IToolRegistry
): string[] {
  const errors: string[] = [];

  for (const toolCall of toolCalls) {
    if (!registry.has(toolCall.name)) {
      errors.push(`Tool '${toolCall.name}' not found (call ID: ${toolCall.id})`);
    }
  }

  return errors;
}
