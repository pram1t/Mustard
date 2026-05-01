import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseWorker } from '../base-worker.js';
import { backendDefinition, architectDefinition } from '../definitions.js';
import { buildWorkerPrompt } from '../prompt-builder.js';
import type { WorkerConfig } from '../types.js';

// =============================================================================
// MOCK DEPENDENCIES
// =============================================================================

// Track what gets registered in the internal ToolRegistry
const registeredTools: any[] = [];

vi.mock('@pram1t/mustard-tools', () => {
  return {
    ToolRegistry: class MockToolRegistry {
      private tools: any[] = [];
      register(tool: any) {
        this.tools.push(tool);
        registeredTools.push(tool);
      }
      registerAll() {}
      unregister() { return false; }
      get(name: string) { return this.tools.find((t: any) => t.name === name); }
      getAll() { return this.tools; }
      getNames() { return this.tools.map((t: any) => t.name); }
      has(name: string) { return this.tools.some((t: any) => t.name === name); }
      getDefinitions() { return []; }
      execute() { return {}; }
      get count() { return this.tools.length; }
      clear() { this.tools = []; }
    },
  };
});

// Mock AgentLoop so it doesn't actually need a real LLM
vi.mock('@pram1t/mustard-core', () => {
  return {
    AgentLoop: class MockAgentLoop {
      constructor() {}
      async initialize() {}
      async *run() {}
    },
  };
});

// Mock Tool
function createMockTool(name: string) {
  return {
    name,
    description: `Mock ${name} tool`,
    parameters: {},
    execute: vi.fn(),
  };
}

// Mock ToolRegistry for parent (passed to BaseWorker constructor)
function createMockParentRegistry(toolNames: string[]) {
  const tools = toolNames.map(createMockTool);
  return {
    register: vi.fn(),
    registerAll: vi.fn(),
    unregister: vi.fn(),
    get: vi.fn((name: string) => tools.find((t) => t.name === name)),
    getAll: vi.fn(() => tools),
    getNames: vi.fn(() => tools.map((t) => t.name)),
    has: vi.fn((name: string) => tools.some((t) => t.name === name)),
    getDefinitions: vi.fn(() => []),
    execute: vi.fn(),
    count: tools.length,
    clear: vi.fn(),
  };
}

// Mock LLMRouter (we don't actually call chat in these unit tests)
function createMockRouter() {
  return {
    registerProvider: vi.fn(),
    unregisterProvider: vi.fn(),
    getProvider: vi.fn(),
    getPrimaryProvider: vi.fn(),
    listProviders: vi.fn(() => []),
    hasProvider: vi.fn(() => false),
    setPrimary: vi.fn(),
    chat: vi.fn(),
    countTokens: vi.fn(),
    validateAll: vi.fn(),
    validateProvider: vi.fn(),
  } as any;
}

describe('BaseWorker', () => {
  beforeEach(() => {
    registeredTools.length = 0;
  });

  describe('construction', () => {
    it('should create a worker with the correct role and name', () => {
      const router = createMockRouter();
      const tools = createMockParentRegistry(['Read', 'Write', 'Glob', 'Grep', 'Bash', 'Edit']);
      const config: WorkerConfig = { role: 'backend' };

      const worker = new BaseWorker(backendDefinition, router, tools as any, config);

      expect(worker.role).toBe('backend');
      expect(worker.name).toBe('Backend Developer');
      expect(worker.id).toBeDefined();
      expect(worker.status).toBe('idle');
    });

    it('should generate unique IDs', () => {
      const router = createMockRouter();
      const tools = createMockParentRegistry([]);
      const config: WorkerConfig = { role: 'backend' };

      const w1 = new BaseWorker(backendDefinition, router, tools as any, config);
      const w2 = new BaseWorker(backendDefinition, router, tools as any, config);

      expect(w1.id).not.toBe(w2.id);
    });
  });

  describe('tool filtering', () => {
    it('should allow all tools when allowed list is empty (backend)', () => {
      const router = createMockRouter();
      const allToolNames = ['Read', 'Write', 'Glob', 'Grep', 'Bash', 'Edit'];
      const tools = createMockParentRegistry(allToolNames);
      const config: WorkerConfig = { role: 'backend' };

      registeredTools.length = 0;
      new BaseWorker(backendDefinition, router, tools as any, config);

      // Backend has allowed: [], denied: [] → should get all 6 tools
      expect(tools.getAll).toHaveBeenCalled();
      const names = registeredTools.map((t: any) => t.name);
      expect(names).toContain('Read');
      expect(names).toContain('Write');
      expect(names).toContain('Bash');
      expect(names).toHaveLength(6);
    });

    it('should restrict architect to allowed tools only', () => {
      const router = createMockRouter();
      const allToolNames = ['Read', 'Write', 'Glob', 'Grep', 'Bash', 'Edit', 'WebFetch', 'WebSearch', 'NotebookEdit'];
      const tools = createMockParentRegistry(allToolNames);
      const config: WorkerConfig = { role: 'architect' };

      registeredTools.length = 0;
      new BaseWorker(architectDefinition, router, tools as any, config);

      const names = registeredTools.map((t: any) => t.name);

      // Architect allowed: ['Read', 'Glob', 'Grep', 'Bash', 'WebFetch', 'WebSearch']
      // Architect denied: ['Write', 'Edit', 'NotebookEdit']
      expect(names).toContain('Read');
      expect(names).toContain('Glob');
      expect(names).toContain('Grep');
      expect(names).toContain('Bash');
      expect(names).toContain('WebFetch');
      expect(names).toContain('WebSearch');
      expect(names).not.toContain('Write');
      expect(names).not.toContain('Edit');
      expect(names).not.toContain('NotebookEdit');
    });
  });

  describe('status', () => {
    it('should start idle', () => {
      const router = createMockRouter();
      const tools = createMockParentRegistry([]);
      const config: WorkerConfig = { role: 'backend' };

      const worker = new BaseWorker(backendDefinition, router, tools as any, config);
      expect(worker.getStatus()).toBe('idle');
    });
  });

  describe('prompt building', () => {
    it('should build prompt from definition', () => {
      const prompt = buildWorkerPrompt(backendDefinition);
      expect(prompt).toContain('Backend Developer');
      expect(prompt).toContain('senior backend developer');
      expect(prompt).toContain('Node.js');
    });

    it('should include override text', () => {
      const prompt = buildWorkerPrompt(backendDefinition, 'Focus on the payments module.');
      expect(prompt).toContain('Focus on the payments module.');
      expect(prompt).toContain('Additional Instructions');
    });

    it('should include expertise section', () => {
      const prompt = buildWorkerPrompt(architectDefinition);
      expect(prompt).toContain('Expertise');
      expect(prompt).toContain('System design');
    });

    it('should include constraints section', () => {
      const prompt = buildWorkerPrompt(architectDefinition);
      expect(prompt).toContain('Constraints');
      expect(prompt).toContain('Do not write production implementation code');
    });

    it('should include artifacts section', () => {
      const prompt = buildWorkerPrompt(architectDefinition);
      expect(prompt).toContain('Artifacts');
      expect(prompt).toContain('architecture');
    });
  });
});
