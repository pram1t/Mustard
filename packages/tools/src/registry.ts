/**
 * Tool Registry
 *
 * Manages registration and execution of tools.
 */

import type {
  Tool,
  ToolDefinition,
  ToolResult,
  ExecutionContext,
  ExecuteOptions,
  IToolRegistry,
} from './types.js';
import { getLogger } from '@openagent/logger';
import { auditLog } from './security.js';

// Import built-in tools
import { ReadTool } from './builtin/read.js';
import { WriteTool } from './builtin/write.js';
import { EditTool } from './builtin/edit.js';
import { GlobTool } from './builtin/glob.js';
import { GrepTool } from './builtin/grep.js';
import { BashTool } from './builtin/bash.js';

/**
 * Tool Registry
 * Manages a collection of tools and provides execution capabilities
 */
export class ToolRegistry implements IToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private logger = getLogger();

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool '${tool.name}' is already registered. Overwriting.`, { toolName: tool.name });
    }
    this.tools.set(tool.name, tool);
    this.logger.debug(`Registered tool: ${tool.name}`, { toolName: tool.name });
  }

  /**
   * Register multiple tools at once
   */
  registerAll(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tool definitions for LLM
   * Returns simplified format suitable for sending to LLM
   */
  getDefinitions(): ToolDefinition[] {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Execute a tool by name
   */
  async execute(
    name: string,
    params: Record<string, unknown>,
    context: ExecutionContext,
    options?: ExecuteOptions
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Unknown tool: ${name}. Available tools: ${this.getNames().join(', ')}`,
      };
    }

    // Handle timeout if specified
    if (options?.timeout) {
      return this.executeWithTimeout(tool, params, context, options.timeout, options.signal);
    }

    // Execute directly
    try {
      const startTime = Date.now();
      this.logger.debug(`Executing tool: ${name}`, { toolName: name, params });

      // Audit log the execution (if enabled)
      auditLog(name, params, context);

      const result = await tool.execute(params, context);
      const duration = Date.now() - startTime;
      this.logger.debug(`Tool execution completed: ${name}`, {
        toolName: name,
        success: result.success,
        durationMs: duration
      });
      return result;
    } catch (error) {
      this.logger.error(`Tool '${name}' threw an error`, { toolName: name, error: String(error) });
      return {
        success: false,
        output: '',
        error: `Tool '${name}' threw an error: ${error}`,
      };
    }
  }

  /**
   * Execute tool with timeout
   */
  private async executeWithTimeout(
    tool: Tool,
    params: Record<string, unknown>,
    context: ExecutionContext,
    timeout: number,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          output: '',
          error: `Tool '${tool.name}' timed out after ${timeout}ms`,
        });
      }, timeout);

      // Handle abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          resolve({
            success: false,
            output: '',
            error: `Tool '${tool.name}' was aborted`,
          });
        });
      }

      // Execute the tool
      tool
        .execute(params, context)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          resolve({
            success: false,
            output: '',
            error: `Tool '${tool.name}' threw an error: ${error}`,
          });
        });
    });
  }

  /**
   * Get count of registered tools
   */
  get count(): number {
    return this.tools.size;
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
  }
}

/**
 * Create a default registry with all built-in tools
 */
export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // File operations
  registry.register(new ReadTool());
  registry.register(new WriteTool());
  registry.register(new EditTool());

  // Search operations
  registry.register(new GlobTool());
  registry.register(new GrepTool());

  // Shell operations
  registry.register(new BashTool());

  // Note: These tools are planned but not yet implemented
  // registry.register(new WebFetchTool());
  // registry.register(new AskUserTool());
  // registry.register(new TaskTool());

  return registry;
}

/**
 * Create a minimal execution context for testing
 */
export function createTestContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    cwd: process.cwd(),
    sessionId: 'test-session',
    homeDir: process.env.HOME || process.env.USERPROFILE || '',
    config: {},
    ...overrides,
  };
}
