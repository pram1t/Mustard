import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { EventBus } from '@mustard/message-bus';
import type { OrchestrateOptions } from '../orchestrate.js';

// Mock @mustard/orchestrator so we don't create real LLM connections
vi.mock('@mustard/orchestrator', () => {
  class MockOrchestrator {
    config: any;
    deps: any;
    constructor(config: any, deps: any) {
      this.config = config;
      this.deps = deps;
    }
    async execute(prompt: string) {
      // Simulate bus events
      this.deps.bus.publish('plan.created', { planId: 'test-plan', steps: 2 });
      this.deps.bus.publish('task.started', { taskId: 'step-1', title: 'Analyze', role: 'architect' });
      this.deps.bus.publish('task.completed', { taskId: 'step-1', title: 'Analyze', duration: 1000 });
      this.deps.bus.publish('task.started', { taskId: 'step-2', title: 'Build', role: 'backend' });
      this.deps.bus.publish('task.completed', { taskId: 'step-2', title: 'Build', duration: 2000 });
      return {
        planId: 'test-plan',
        success: true,
        stepResults: [
          { stepId: 'step-1', status: 'completed', duration: 1000, output: 'analyzed' },
          { stepId: 'step-2', status: 'completed', duration: 2000, output: 'built' },
        ],
        totalDuration: 3000,
        summary: 'Successfully completed all 2 steps.',
      };
    }
  }

  return {
    Orchestrator: MockOrchestrator,
    EventBus: vi.fn(),
  };
});

vi.mock('@mustard/message-bus', async () => {
  const actual = await vi.importActual('@mustard/message-bus');
  return actual;
});

// Use dynamic import inside beforeAll to avoid top-level await in CJS
let orchestrateCommand: (prompt: string, options: OrchestrateOptions) => Promise<void>;

beforeAll(async () => {
  const mod = await import('../orchestrate.js');
  orchestrateCommand = mod.orchestrateCommand;
});

function createMockRouter() {
  return {
    chat: vi.fn(async function* () {
      yield { type: 'text', content: '[]' };
    }),
    registerProvider: vi.fn(),
    unregisterProvider: vi.fn(),
    getProvider: vi.fn(),
    getPrimaryProvider: vi.fn(),
    listProviders: vi.fn(() => []),
    hasProvider: vi.fn(() => false),
    setPrimary: vi.fn(),
    countTokens: vi.fn(),
    validateAll: vi.fn(),
    validateProvider: vi.fn(),
  } as any;
}

function createMockTools() {
  return {
    register: vi.fn(),
    registerAll: vi.fn(),
    unregister: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(() => []),
    getNames: vi.fn(() => []),
    has: vi.fn(() => false),
    getDefinitions: vi.fn(() => []),
    execute: vi.fn(),
    count: 0,
    clear: vi.fn(),
  } as any;
}

describe('orchestrateCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should execute orchestration and log progress events', async () => {
    await orchestrateCommand('build a REST API', {
      router: createMockRouter(),
      tools: createMockTools(),
      verbose: false,
      cwd: process.cwd(),
    });

    const output = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(output).toContain('Plan');
    expect(output).toContain('✓');
  });

  it('should pass maxParallelWorkers to orchestrator', async () => {
    await orchestrateCommand('test prompt', {
      router: createMockRouter(),
      tools: createMockTools(),
      verbose: false,
      maxParallelWorkers: 5,
      cwd: process.cwd(),
    });

    // No error means it ran successfully
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('should show verbose info when verbose is true', async () => {
    await orchestrateCommand('test prompt', {
      router: createMockRouter(),
      tools: createMockTools(),
      verbose: true,
      cwd: process.cwd(),
    });

    const output = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(output).toContain('[Orchestrator]');
    expect(output).toContain('Max parallel workers');
  });

  it('should display the final summary', async () => {
    await orchestrateCommand('test prompt', {
      router: createMockRouter(),
      tools: createMockTools(),
      verbose: false,
      cwd: process.cwd(),
    });

    const output = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(output).toContain('completed');
  });

  it('should use default maxWorkers of 3', async () => {
    await orchestrateCommand('test prompt', {
      router: createMockRouter(),
      tools: createMockTools(),
      verbose: true,
      cwd: process.cwd(),
    });

    const output = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(output).toContain('3');
  });
});
