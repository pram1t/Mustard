/**
 * Tool Registry Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry, createDefaultRegistry, createTestContext } from '../registry';
import { BaseTool } from '../base';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types';

// Simple test tool
class EchoTool extends BaseTool {
  readonly name = 'Echo';
  readonly description = 'Echoes the input';
  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Message to echo' },
    },
    required: ['message'],
  };

  async execute(
    params: Record<string, unknown>,
    _context: ExecutionContext
  ): Promise<ToolResult> {
    return this.success(`Echo: ${params.message}`);
  }
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register', () => {
    it('should register a tool', () => {
      const tool = new EchoTool();
      registry.register(tool);

      expect(registry.has('Echo')).toBe(true);
    });

    it('should get a registered tool', () => {
      const tool = new EchoTool();
      registry.register(tool);

      expect(registry.get('Echo')).toBe(tool);
    });

    it('should return undefined for unregistered tool', () => {
      expect(registry.get('NotRegistered')).toBeUndefined();
    });
  });

  describe('unregister', () => {
    it('should unregister a tool', () => {
      const tool = new EchoTool();
      registry.register(tool);

      expect(registry.unregister('Echo')).toBe(true);
      expect(registry.has('Echo')).toBe(false);
    });

    it('should return false for non-existent tool', () => {
      expect(registry.unregister('NotRegistered')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return all registered tools', () => {
      registry.register(new EchoTool());
      const tools = registry.getAll();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('Echo');
    });
  });

  describe('getDefinitions', () => {
    it('should return tool definitions', () => {
      registry.register(new EchoTool());
      const defs = registry.getDefinitions();

      expect(defs).toHaveLength(1);
      expect(defs[0].name).toBe('Echo');
      expect(defs[0].description).toBe('Echoes the input');
      expect(defs[0].parameters).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute a registered tool', async () => {
      registry.register(new EchoTool());
      const context = createTestContext();

      const result = await registry.execute(
        'Echo',
        { message: 'Hello' },
        context
      );

      expect(result.success).toBe(true);
      expect(result.output).toBe('Echo: Hello');
    });

    it('should return error for unknown tool', async () => {
      const context = createTestContext();

      const result = await registry.execute(
        'Unknown',
        {},
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });
  });

  describe('count', () => {
    it('should return correct count', () => {
      expect(registry.count).toBe(0);
      registry.register(new EchoTool());
      expect(registry.count).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all tools', () => {
      registry.register(new EchoTool());
      registry.clear();

      expect(registry.count).toBe(0);
    });
  });
});

describe('createDefaultRegistry', () => {
  it('should create registry with built-in tools', () => {
    const registry = createDefaultRegistry();

    expect(registry.has('Read')).toBe(true);
    expect(registry.has('Write')).toBe(true);
    expect(registry.has('Edit')).toBe(true);
    expect(registry.has('Glob')).toBe(true);
    expect(registry.has('Grep')).toBe(true);
    expect(registry.has('Bash')).toBe(true);
  });
});

describe('createTestContext', () => {
  it('should create a valid context', () => {
    const context = createTestContext();

    expect(context.cwd).toBeDefined();
    expect(context.sessionId).toBeDefined();
    expect(context.homeDir).toBeDefined();
    expect(context.config).toBeDefined();
  });

  it('should allow overrides', () => {
    const context = createTestContext({ cwd: '/custom/path' });

    expect(context.cwd).toBe('/custom/path');
  });
});
