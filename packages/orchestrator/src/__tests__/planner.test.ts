import { describe, it, expect, vi } from 'vitest';
import { Planner } from '../planner.js';

/**
 * Create a mock LLMRouter that returns a pre-built JSON response.
 */
function createMockRouter(jsonResponse: any) {
  const responseStr = typeof jsonResponse === 'string' ? jsonResponse : JSON.stringify(jsonResponse);

  return {
    chat: vi.fn(async function* () {
      yield { type: 'text', content: responseStr };
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

describe('Planner', () => {
  it('should create a plan from LLM response', async () => {
    const mockSteps = [
      {
        id: 'step-1',
        title: 'Analyze codebase',
        description: 'Review project structure',
        assignTo: 'architect',
        priority: 'high',
        dependencies: [],
        prompt: 'Analyze the project structure.',
      },
      {
        id: 'step-2',
        title: 'Implement feature',
        description: 'Write the code',
        assignTo: 'backend',
        priority: 'normal',
        dependencies: ['step-1'],
        prompt: 'Implement the user authentication feature.',
      },
    ];

    const router = createMockRouter(mockSteps);
    const planner = new Planner(router);

    const plan = await planner.createPlan('Add user authentication');

    expect(plan.id).toBeDefined();
    expect(plan.request).toBe('Add user authentication');
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].id).toBe('step-1');
    expect(plan.steps[0].assignTo).toBe('architect');
    expect(plan.steps[1].dependencies).toEqual(['step-1']);
    expect(plan.createdAt).toBeInstanceOf(Date);
  });

  it('should handle markdown-wrapped JSON', async () => {
    const wrapped = '```json\n[{"id":"step-1","title":"Test","description":"Test","assignTo":"backend","priority":"normal","dependencies":[],"prompt":"Do something"}]\n```';
    const router = createMockRouter(wrapped);
    const planner = new Planner(router);

    const plan = await planner.createPlan('Test request');
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].title).toBe('Test');
  });

  it('should provide defaults for missing fields', async () => {
    const minimal = [{ title: 'Minimal step' }];
    const router = createMockRouter(minimal);
    const planner = new Planner(router);

    const plan = await planner.createPlan('Test');
    expect(plan.steps[0].id).toBe('step-1');
    expect(plan.steps[0].assignTo).toBe('backend');
    expect(plan.steps[0].priority).toBe('normal');
    expect(plan.steps[0].dependencies).toEqual([]);
  });

  it('should include context in the prompt', async () => {
    const router = createMockRouter([{ id: 'step-1', title: 'Test', description: 'test', assignTo: 'backend', priority: 'normal', dependencies: [], prompt: 'test' }]);
    const planner = new Planner(router);

    await planner.createPlan('Add feature', 'Project uses React and Node.js');

    // Check that chat was called with context in the message
    expect(router.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('React and Node.js'),
          }),
        ]),
      })
    );
  });

  it('should throw on invalid JSON response', async () => {
    const router = createMockRouter('this is not json');
    const planner = new Planner(router);

    await expect(planner.createPlan('Test')).rejects.toThrow('Failed to parse planner response');
  });

  it('should throw when response is not an array', async () => {
    const router = createMockRouter({ notAnArray: true });
    const planner = new Planner(router);

    await expect(planner.createPlan('Test')).rejects.toThrow('Expected a JSON array');
  });

  it('should pass the request as user message', async () => {
    const router = createMockRouter([{ id: 'step-1', title: 'T', description: 't', assignTo: 'backend', priority: 'normal', dependencies: [], prompt: 't' }]);
    const planner = new Planner(router);

    await planner.createPlan('Implement payment processing');

    expect(router.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Implement payment processing'),
          }),
        ]),
      })
    );
  });
});
