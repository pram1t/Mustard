import { describe, it, expect } from 'vitest';
import { adaptCoreEvent, classifyErrorCode } from '../event-adapter';
import type { AgentEvent as CoreAgentEvent } from '@pram1t/mustard-core';

const SESSION_ID = 'test-session-123';

describe('adaptCoreEvent', () => {
  it('maps text event to TextEvent', () => {
    const core: CoreAgentEvent = { type: 'text', content: 'Hello world' };
    const result = adaptCoreEvent(core, SESSION_ID);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('text');
    expect(result!.data).toEqual({ content: 'Hello world', delta: 'Hello world', role: 'assistant' });
  });

  it('maps tool_call event to ToolCallEvent', () => {
    const core: CoreAgentEvent = {
      type: 'tool_call',
      tool_call: { id: 'tc-1', name: 'Read', arguments: { file_path: '/test.ts' } },
    };
    const result = adaptCoreEvent(core, SESSION_ID);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('tool_call');
    expect(result!.data).toMatchObject({
      id: 'tc-1',
      name: 'Read',
      arguments: { file_path: '/test.ts' },
    });
  });

  it('maps tool_result event to ToolResultEvent', () => {
    const core: CoreAgentEvent = {
      type: 'tool_result',
      tool_call_id: 'tc-1',
      tool_name: 'Read',
      result: { success: true, output: 'file contents', metadata: { executionTime: 42 } },
    };
    const result = adaptCoreEvent(core, SESSION_ID);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('tool_result');
    expect(result!.data).toMatchObject({
      id: 'tc-1',
      name: 'Read',
      result: 'file contents',
      duration: 42,
    });
  });

  it('maps error event to ErrorEvent', () => {
    const core: CoreAgentEvent = {
      type: 'error',
      error: 'Connection timeout',
      recoverable: true,
    };
    const result = adaptCoreEvent(core, SESSION_ID);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('error');
    expect(result!.data).toMatchObject({
      code: 'TIMEOUT',
      message: 'Connection timeout',
      recoverable: true,
    });
  });

  it('maps done event to DoneEvent', () => {
    const core: CoreAgentEvent = {
      type: 'done',
      totalIterations: 5,
      totalToolCalls: 3,
    };
    const result = adaptCoreEvent(core, SESSION_ID);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('done');
    expect(result!.data).toMatchObject({ reason: 'complete' });
  });

  it('maps thinking event to ThinkingEvent', () => {
    const core: CoreAgentEvent = { type: 'thinking', iteration: 2 };
    const result = adaptCoreEvent(core, SESSION_ID);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('thinking');
    expect(result!.data).toMatchObject({ stage: 'executing' });
  });

  it('maps permission_denied to ErrorEvent with PERMISSION_DENIED code', () => {
    const core: CoreAgentEvent = {
      type: 'permission_denied',
      tool: 'Bash',
      reason: 'blocked by rule',
    };
    const result = adaptCoreEvent(core, SESSION_ID);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('error');
    expect(result!.data).toMatchObject({
      code: 'PERMISSION_DENIED',
      recoverable: true,
    });
  });

  it('maps permission_ask to ToolCallEvent with requiresConfirmation', () => {
    const core: CoreAgentEvent = {
      type: 'permission_ask',
      tool: 'Bash',
      reason: 'needs approval',
    };
    const result = adaptCoreEvent(core, SESSION_ID);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('tool_call');
    expect(result!.data).toMatchObject({
      name: 'Bash',
      requiresConfirmation: true,
      riskLevel: 'high',
    });
  });

  it('returns null for compaction event', () => {
    const core: CoreAgentEvent = {
      type: 'compaction',
      messagesRemoved: 10,
      tokensRemoved: 5000,
    };
    expect(adaptCoreEvent(core, SESSION_ID)).toBeNull();
  });

  it('returns null for hook_triggered event', () => {
    const core = { type: 'hook_triggered', event: 'pre_tool_use', hookCount: 1 } as CoreAgentEvent;
    expect(adaptCoreEvent(core, SESSION_ID)).toBeNull();
  });

  it('returns null for hook_blocked event', () => {
    const core = { type: 'hook_blocked', event: 'pre_tool_use', reason: 'test' } as CoreAgentEvent;
    expect(adaptCoreEvent(core, SESSION_ID)).toBeNull();
  });

  it('returns null for hook_output event', () => {
    const core = { type: 'hook_output', event: 'post_tool_use', output: 'done' } as CoreAgentEvent;
    expect(adaptCoreEvent(core, SESSION_ID)).toBeNull();
  });

  it('all mapped events have version, timestamp, and sessionId', () => {
    const cores: CoreAgentEvent[] = [
      { type: 'text', content: 'test' },
      { type: 'done', totalIterations: 1, totalToolCalls: 0 },
      { type: 'thinking', iteration: 1 },
    ];

    for (const core of cores) {
      const result = adaptCoreEvent(core, SESSION_ID);
      expect(result).not.toBeNull();
      expect(result!.version).toBe(1);
      expect(result!.timestamp).toBeGreaterThan(0);
      expect(result!.sessionId).toBe(SESSION_ID);
    }
  });
});

describe('classifyErrorCode', () => {
  it('classifies rate limit errors', () => {
    expect(classifyErrorCode('Rate limit exceeded')).toBe('RATE_LIMIT');
    expect(classifyErrorCode('HTTP 429 Too Many Requests')).toBe('RATE_LIMIT');
  });

  it('classifies API key errors', () => {
    expect(classifyErrorCode('Invalid API key provided')).toBe('INVALID_API_KEY');
  });

  it('classifies timeout errors', () => {
    expect(classifyErrorCode('Request timed out')).toBe('TIMEOUT');
  });

  it('classifies network errors', () => {
    expect(classifyErrorCode('ECONNREFUSED')).toBe('NETWORK_ERROR');
    expect(classifyErrorCode('fetch failed')).toBe('NETWORK_ERROR');
  });

  it('classifies cancellation', () => {
    expect(classifyErrorCode('Operation cancelled by user')).toBe('CANCELLED');
    expect(classifyErrorCode('AbortError')).toBe('CANCELLED');
  });

  it('defaults to INTERNAL_ERROR', () => {
    expect(classifyErrorCode('Something weird happened')).toBe('INTERNAL_ERROR');
  });
});
