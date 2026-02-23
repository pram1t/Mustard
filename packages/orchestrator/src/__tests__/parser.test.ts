import { describe, it, expect, vi } from 'vitest';
import { RequestParser } from '../parser.js';

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

describe('RequestParser', () => {
  it('should parse a valid classification response', async () => {
    const router = createMockRouter({
      intent: 'new_feature',
      scope: 'medium',
      complexity: 'moderate',
      suggestedPriority: 'normal',
      suggestedWorkers: ['architect', 'backend', 'qa'],
      summary: 'Add user authentication with JWT tokens.',
    });
    const parser = new RequestParser(router);

    const result = await parser.parse('Add user authentication');

    expect(result.originalRequest).toBe('Add user authentication');
    expect(result.intent).toBe('new_feature');
    expect(result.scope).toBe('medium');
    expect(result.complexity).toBe('moderate');
    expect(result.suggestedPriority).toBe('normal');
    expect(result.suggestedWorkers).toEqual(['architect', 'backend', 'qa']);
    expect(result.summary).toBe('Add user authentication with JWT tokens.');
  });

  it('should handle markdown-wrapped JSON', async () => {
    const wrapped = '```json\n{"intent":"bug_fix","scope":"small","complexity":"simple","suggestedPriority":"high","suggestedWorkers":["backend"],"summary":"Fix login bug"}\n```';
    const router = createMockRouter(wrapped);
    const parser = new RequestParser(router);

    const result = await parser.parse('Fix login issue');
    expect(result.intent).toBe('bug_fix');
    expect(result.scope).toBe('small');
  });

  it('should fall back to defaults on invalid JSON', async () => {
    const router = createMockRouter('this is not json at all');
    const parser = new RequestParser(router);

    const result = await parser.parse('Some request');
    expect(result.intent).toBe('other');
    expect(result.scope).toBe('medium');
    expect(result.complexity).toBe('moderate');
    expect(result.suggestedPriority).toBe('normal');
    expect(result.suggestedWorkers).toEqual(['backend']);
  });

  it('should validate enum values and fall back on invalid', async () => {
    const router = createMockRouter({
      intent: 'invalid_intent',
      scope: 'huge',
      complexity: 'extreme',
      suggestedPriority: 'urgent',
      suggestedWorkers: ['backend'],
      summary: 'Test',
    });
    const parser = new RequestParser(router);

    const result = await parser.parse('Test');
    expect(result.intent).toBe('other');
    expect(result.scope).toBe('medium');
    expect(result.complexity).toBe('moderate');
    expect(result.suggestedPriority).toBe('normal');
  });

  it('should include context in LLM call', async () => {
    const router = createMockRouter({
      intent: 'refactor',
      scope: 'large',
      complexity: 'complex',
      suggestedPriority: 'normal',
      suggestedWorkers: ['architect', 'backend'],
      summary: 'Refactor the auth module',
    });
    const parser = new RequestParser(router);

    await parser.parse('Refactor auth', 'Project uses Express.js');

    expect(router.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Express.js'),
          }),
        ]),
      })
    );
  });

  it('should preserve context in result', async () => {
    const router = createMockRouter({
      intent: 'testing',
      scope: 'small',
      complexity: 'simple',
      suggestedPriority: 'low',
      suggestedWorkers: ['qa'],
      summary: 'Write tests',
    });
    const parser = new RequestParser(router);

    const result = await parser.parse('Write unit tests', 'Using Vitest');
    expect(result.context).toBe('Using Vitest');
  });

  it('should handle all valid intents', async () => {
    const intents = [
      'new_feature', 'bug_fix', 'refactor', 'testing', 'documentation',
      'security_audit', 'performance', 'devops', 'design', 'research', 'other',
    ];

    for (const intent of intents) {
      const router = createMockRouter({
        intent,
        scope: 'small',
        complexity: 'simple',
        suggestedPriority: 'normal',
        suggestedWorkers: ['backend'],
        summary: 'Test',
      });
      const parser = new RequestParser(router);
      const result = await parser.parse('Test');
      expect(result.intent).toBe(intent);
    }
  });
});
