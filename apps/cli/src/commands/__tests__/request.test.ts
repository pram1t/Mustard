import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import type { RequestOptions } from '../request.js';

// Mock @mustard/orchestrator
vi.mock('@mustard/orchestrator', () => {
  class MockOrchestrator {
    config: any;
    deps: any;
    constructor(config: any, deps: any) {
      this.config = config;
      this.deps = deps;
    }
    async plan(_prompt: string) {
      return {
        id: 'plan-1',
        request: 'test request',
        steps: [
          { id: 'step-1', title: 'Design API', description: 'Design the API', assignTo: 'architect', priority: 'normal', dependencies: [], prompt: 'Design' },
          { id: 'step-2', title: 'Build API', description: 'Build the API', assignTo: 'backend', priority: 'normal', dependencies: ['step-1'], prompt: 'Build' },
        ],
        createdAt: new Date(),
      };
    }
    async executePlan(_plan: any) {
      this.deps.bus.publish('plan.created', { planId: 'plan-1', steps: 2 });
      this.deps.bus.publish('task.started', { taskId: 'step-1', title: 'Design API', role: 'architect' });
      this.deps.bus.publish('task.completed', { taskId: 'step-1', title: 'Design API', duration: 500 });
      this.deps.bus.publish('task.started', { taskId: 'step-2', title: 'Build API', role: 'backend' });
      this.deps.bus.publish('task.completed', { taskId: 'step-2', title: 'Build API', duration: 1000 });
      return {
        planId: 'plan-1',
        success: true,
        stepResults: [
          { stepId: 'step-1', status: 'completed', duration: 500, output: 'designed' },
          { stepId: 'step-2', status: 'completed', duration: 1000, output: 'built' },
        ],
        totalDuration: 1500,
        summary: 'Successfully completed all 2 steps.',
      };
    }
    async execute(prompt: string) {
      return this.executePlan(null);
    }
  }

  return {
    Orchestrator: MockOrchestrator,
    formatPlanForApproval: vi.fn((plan: any) => {
      return `EXECUTION PLAN\nRequest: ${plan.request}\nSteps: ${plan.steps.length}`;
    }),
  };
});

vi.mock('@mustard/message-bus', async () => {
  const actual = await vi.importActual('@mustard/message-bus');
  return actual;
});

// Mock readline for approval prompt
vi.mock('readline', () => ({
  createInterface: vi.fn(() => ({
    question: vi.fn((_prompt: string, cb: (answer: string) => void) => {
      // Default to 'y' for approval
      cb('y');
    }),
    close: vi.fn(),
  })),
}));

let requestCommand: (action: any, prompt: string, options: RequestOptions) => Promise<void>;

beforeAll(async () => {
  const mod = await import('../request.js');
  requestCommand = mod.requestCommand;
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

describe('requestCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('submit', () => {
    it('should generate a plan and show it', async () => {
      await requestCommand('submit', 'Build a REST API', {
        router: createMockRouter(),
        tools: createMockTools(),
        verbose: false,
        cwd: process.cwd(),
      });

      const output = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join('\n');
      expect(output).toContain('Generating plan');
      expect(output).toContain('EXECUTION PLAN');
    });

    it('should execute the plan after approval', async () => {
      await requestCommand('submit', 'Build a REST API', {
        router: createMockRouter(),
        tools: createMockTools(),
        verbose: false,
        cwd: process.cwd(),
      });

      const output = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join('\n');
      expect(output).toContain('Executing plan');
      expect(output).toContain('completed');
    });
  });

  describe('execute', () => {
    it('should execute directly without approval', async () => {
      await requestCommand('execute', 'Build features', {
        router: createMockRouter(),
        tools: createMockTools(),
        verbose: false,
        cwd: process.cwd(),
      });

      const output = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join('\n');
      // Should NOT show plan approval prompt (no "EXECUTION PLAN" display)
      expect(output).not.toContain('EXECUTION PLAN');
      expect(output).toContain('completed');
    });
  });

  describe('error handling', () => {
    it('should error on empty prompt', async () => {
      await requestCommand('submit', '', {
        router: createMockRouter(),
        tools: createMockTools(),
        verbose: false,
        cwd: process.cwd(),
      });

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
