import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock core dependencies
vi.mock('@mustard/core', () => ({
  createAgent: vi.fn(() => ({
    getState: vi.fn(() => ({ iteration: 0, toolCallCount: 0, isRunning: false })),
    run: vi.fn(async function* () {
      yield { type: 'text', content: 'Hello' };
      yield { type: 'done', totalIterations: 1, totalToolCalls: 0 };
    }),
  })),
  AgentLoop: vi.fn(),
}));

vi.mock('../../ipc/event-emitter', () => ({
  emitEvent: vi.fn(),
  emitStatus: vi.fn(),
}));

vi.mock('../event-adapter', () => ({
  adaptCoreEvent: vi.fn((event: { type: string }) => {
    if (event.type === 'text') {
      return { version: 1, type: 'text', timestamp: Date.now(), sessionId: 'test', data: { content: 'Hello' } };
    }
    if (event.type === 'done') {
      return { version: 1, type: 'done', timestamp: Date.now(), sessionId: 'test', data: { reason: 'complete', duration: 0 } };
    }
    return null;
  }),
}));

vi.mock('../../security/tool-security', () => ({
  assessToolRisk: vi.fn(() => ({ riskLevel: 'low', requiresConfirmation: false })),
}));

vi.mock('../../../shared/event-types', () => ({
  createErrorEvent: vi.fn((_sid: string, code: string, msg: string, recoverable: boolean) => ({
    version: 1, type: 'error', timestamp: Date.now(), sessionId: 'test',
    data: { code, message: msg, recoverable },
  })),
}));

import { AgentService } from '../agent';
import type { LLMRouter } from '@mustard/llm';
import type { IToolRegistry } from '@mustard/tools';

describe('AgentService', () => {
  let service: AgentService;

  const mockRouter = {} as LLMRouter;
  const mockTools = {} as IToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AgentService(mockRouter, mockTools);
  });

  it('returns idle status before any chat', () => {
    const status = service.getStatus();
    expect(status.state).toBe('idle');
  });

  it('chat returns success true', async () => {
    const result = await service.chat('Hello');
    expect(result).toEqual({ success: true });
  });

  it('stop returns false when no run is active', async () => {
    const result = await service.stop();
    expect(result).toEqual({ success: false });
  });

  it('dispose cleans up agent', () => {
    service.dispose();
    const status = service.getStatus();
    expect(status.state).toBe('idle');
  });
});
