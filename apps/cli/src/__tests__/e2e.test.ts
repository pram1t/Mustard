/**
 * CLI End-to-End Tests
 *
 * Integration tests that exercise the full agent loop using the MockLLMProvider.
 * These tests verify the complete flow from prompt input through LLM response
 * and tool execution to final event output.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { MockLLMProvider } from '../../../../packages/llm/src/__tests__/mocks';
import { createRouter, type LLMRouter } from '@mustard/llm';
import {
  AgentLoop,
  PermissionManager,
  SessionManager,
  type AgentEvent,
} from '@mustard/core';
import { ToolRegistry, type Tool, type ToolResult, type ExecutionContext, type ToolParameters } from '@mustard/tools';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Collect all events from an agent run into an array.
 */
async function collectEvents(gen: AsyncGenerator<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

/**
 * Filter events by type from an event array.
 */
function filterEvents<T extends AgentEvent['type']>(
  events: AgentEvent[],
  type: T,
): Extract<AgentEvent, { type: T }>[] {
  return events.filter((e) => e.type === type) as Extract<AgentEvent, { type: T }>[];
}

/**
 * Create a minimal tool registry with no real filesystem tools.
 * Optionally register custom mock tools.
 */
function createMockRegistry(mockTools?: Tool[]): ToolRegistry {
  const registry = new ToolRegistry();
  if (mockTools) {
    registry.registerAll(mockTools);
  }
  return registry;
}

/**
 * Create a simple mock tool for testing tool execution flow.
 */
function createEchoTool(): Tool {
  return {
    name: 'Echo',
    description: 'Echoes back the input message',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message to echo' },
      },
      required: ['message'],
    } as ToolParameters,
    async execute(
      params: Record<string, unknown>,
      _context: ExecutionContext,
    ): Promise<ToolResult> {
      return {
        success: true,
        output: `Echo: ${params.message}`,
      };
    },
  };
}

/**
 * Create a mock tool that always fails.
 */
function createFailingTool(): Tool {
  return {
    name: 'FailTool',
    description: 'A tool that always fails',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    } as ToolParameters,
    async execute(
      _params: Record<string, unknown>,
      _context: ExecutionContext,
    ): Promise<ToolResult> {
      return {
        success: false,
        output: '',
        error: 'Intentional failure for testing',
      };
    },
  };
}

// ============================================================================
// Test Setup
// ============================================================================

let mockProvider: MockLLMProvider;
let router: LLMRouter;

beforeEach(() => {
  mockProvider = new MockLLMProvider();
  router = createRouter(mockProvider);
});

afterEach(() => {
  mockProvider.reset();
});

// ============================================================================
// 1. Basic Agent Conversation
// ============================================================================

describe('Basic agent conversation', () => {
  it('should stream text events from a simple response', async () => {
    mockProvider.queueResponse({
      content: 'Hello, I am OpenAgent!',
      finishReason: 'stop',
    });

    const tools = createMockRegistry();
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'You are a test assistant.',
      cwd: os.tmpdir(),
    });

    const events = await collectEvents(agent.run('Hello'));
    const textEvents = filterEvents(events, 'text');
    const doneEvents = filterEvents(events, 'done');
    const thinkingEvents = filterEvents(events, 'thinking');

    // Text should be streamed word by word from MockLLMProvider
    expect(textEvents.length).toBeGreaterThan(0);

    // Reconstruct the full text
    const fullText = textEvents.map((e) => e.content).join('');
    expect(fullText).toBe('Hello, I am OpenAgent!');

    // Should have exactly one done event
    expect(doneEvents).toHaveLength(1);
    expect(doneEvents[0].totalIterations).toBe(1);
    expect(doneEvents[0].totalToolCalls).toBe(0);

    // Should have at least one thinking event
    expect(thinkingEvents.length).toBeGreaterThanOrEqual(1);
    expect(thinkingEvents[0].iteration).toBe(1);
  });

  it('should send user message to the provider', async () => {
    mockProvider.queueResponse({
      content: 'Response',
      finishReason: 'stop',
    });

    const tools = createMockRegistry();
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'System prompt here.',
      cwd: os.tmpdir(),
    });

    await collectEvents(agent.run('Test prompt'));

    const history = mockProvider.getCallHistory();
    expect(history).toHaveLength(1);

    // Messages should include system + user
    const messages = history[0].params.messages;
    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe('System prompt here.');

    const userMsg = messages.find((m) => m.role === 'user');
    expect(userMsg).toBeDefined();
    expect(userMsg!.content).toBe('Test prompt');
  });

  it('should handle empty content response gracefully', async () => {
    mockProvider.queueResponse({
      content: '',
      finishReason: 'stop',
    });

    const tools = createMockRegistry();
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
    });

    const events = await collectEvents(agent.run('Hello'));
    const doneEvents = filterEvents(events, 'done');

    expect(doneEvents).toHaveLength(1);
    expect(doneEvents[0].totalIterations).toBe(1);
  });
});

// ============================================================================
// 2. Tool Execution Flow
// ============================================================================

describe('Tool execution flow', () => {
  it('should execute a tool and produce tool_call and tool_result events', async () => {
    const echoTool = createEchoTool();

    // First response: LLM requests the Echo tool
    mockProvider.queueResponse({
      toolCalls: [
        {
          id: 'call_001',
          name: 'Echo',
          arguments: { message: 'test message' },
        },
      ],
      finishReason: 'tool_calls',
    });

    // Second response: LLM provides final text after seeing tool result
    mockProvider.queueResponse({
      content: 'The echo returned your message.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry([echoTool]);
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'You are a test assistant.',
      cwd: os.tmpdir(),
    });

    const events = await collectEvents(agent.run('Echo my message'));
    const toolCallEvents = filterEvents(events, 'tool_call');
    const toolResultEvents = filterEvents(events, 'tool_result');

    // Should have tool call event
    expect(toolCallEvents).toHaveLength(1);
    expect(toolCallEvents[0].tool_call.name).toBe('Echo');
    expect(toolCallEvents[0].tool_call.id).toBe('call_001');

    // Should have tool result event
    expect(toolResultEvents).toHaveLength(1);
    expect(toolResultEvents[0].tool_name).toBe('Echo');
    expect(toolResultEvents[0].tool_call_id).toBe('call_001');
    expect(toolResultEvents[0].result.success).toBe(true);
    expect(toolResultEvents[0].result.output).toBe('Echo: test message');
  });

  it('should handle tool execution failure', async () => {
    const failTool = createFailingTool();

    mockProvider.queueResponse({
      toolCalls: [
        {
          id: 'call_fail',
          name: 'FailTool',
          arguments: {},
        },
      ],
      finishReason: 'tool_calls',
    });

    mockProvider.queueResponse({
      content: 'The tool failed.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry([failTool]);
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
    });

    const events = await collectEvents(agent.run('Run the failing tool'));
    const toolResultEvents = filterEvents(events, 'tool_result');

    expect(toolResultEvents).toHaveLength(1);
    expect(toolResultEvents[0].result.success).toBe(false);
    expect(toolResultEvents[0].result.error).toBe('Intentional failure for testing');
  });

  it('should handle tool not found gracefully', async () => {
    mockProvider.queueResponse({
      toolCalls: [
        {
          id: 'call_missing',
          name: 'NonExistentTool',
          arguments: {},
        },
      ],
      finishReason: 'tool_calls',
    });

    mockProvider.queueResponse({
      content: 'Tool not found.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry();
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
    });

    const events = await collectEvents(agent.run('Use a missing tool'));
    const toolResultEvents = filterEvents(events, 'tool_result');

    expect(toolResultEvents).toHaveLength(1);
    expect(toolResultEvents[0].result.success).toBe(false);
    expect(toolResultEvents[0].result.error).toContain('Tool not found');
  });
});

// ============================================================================
// 3. Multi-Turn Conversation
// ============================================================================

describe('Multi-turn conversation', () => {
  it('should handle a tool call followed by text response in one run', async () => {
    const echoTool = createEchoTool();

    // Turn 1: tool call
    mockProvider.queueResponse({
      toolCalls: [
        {
          id: 'call_multi_1',
          name: 'Echo',
          arguments: { message: 'hello' },
        },
      ],
      finishReason: 'tool_calls',
    });

    // Turn 2: text response after seeing tool result
    mockProvider.queueResponse({
      content: 'I echoed your message successfully.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry([echoTool]);
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
    });

    const events = await collectEvents(agent.run('Echo hello'));

    const toolCallEvents = filterEvents(events, 'tool_call');
    const toolResultEvents = filterEvents(events, 'tool_result');
    const textEvents = filterEvents(events, 'text');
    const doneEvents = filterEvents(events, 'done');

    expect(toolCallEvents).toHaveLength(1);
    expect(toolResultEvents).toHaveLength(1);
    expect(textEvents.length).toBeGreaterThan(0);
    expect(doneEvents).toHaveLength(1);
    expect(doneEvents[0].totalIterations).toBe(2);
    expect(doneEvents[0].totalToolCalls).toBe(1);

    // Verify the provider was called twice
    const history = mockProvider.getCallHistory();
    expect(history).toHaveLength(2);

    // Second call should include the tool result in the message history
    const secondCallMessages = history[1].params.messages;
    const toolMsg = secondCallMessages.find((m) => m.role === 'tool');
    expect(toolMsg).toBeDefined();
    expect(toolMsg!.content).toBe('Echo: hello');
  });

  it('should handle multiple sequential tool calls', async () => {
    const echoTool = createEchoTool();

    // Turn 1: first tool call
    mockProvider.queueResponse({
      toolCalls: [
        {
          id: 'call_seq_1',
          name: 'Echo',
          arguments: { message: 'first' },
        },
      ],
      finishReason: 'tool_calls',
    });

    // Turn 2: second tool call
    mockProvider.queueResponse({
      toolCalls: [
        {
          id: 'call_seq_2',
          name: 'Echo',
          arguments: { message: 'second' },
        },
      ],
      finishReason: 'tool_calls',
    });

    // Turn 3: final text
    mockProvider.queueResponse({
      content: 'Both echoed.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry([echoTool]);
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
    });

    const events = await collectEvents(agent.run('Echo first then second'));

    const toolCallEvents = filterEvents(events, 'tool_call');
    const toolResultEvents = filterEvents(events, 'tool_result');
    const doneEvents = filterEvents(events, 'done');

    expect(toolCallEvents).toHaveLength(2);
    expect(toolResultEvents).toHaveLength(2);
    expect(toolResultEvents[0].result.output).toBe('Echo: first');
    expect(toolResultEvents[1].result.output).toBe('Echo: second');
    expect(doneEvents[0].totalIterations).toBe(3);
    expect(doneEvents[0].totalToolCalls).toBe(2);
  });

  it('should handle parallel tool calls in a single response', async () => {
    const echoTool = createEchoTool();

    // Single response with two tool calls
    mockProvider.queueResponse({
      toolCalls: [
        {
          id: 'call_par_1',
          name: 'Echo',
          arguments: { message: 'alpha' },
        },
        {
          id: 'call_par_2',
          name: 'Echo',
          arguments: { message: 'beta' },
        },
      ],
      finishReason: 'tool_calls',
    });

    mockProvider.queueResponse({
      content: 'Both echoed in parallel.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry([echoTool]);
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
    });

    const events = await collectEvents(agent.run('Echo alpha and beta'));

    const toolCallEvents = filterEvents(events, 'tool_call');
    const toolResultEvents = filterEvents(events, 'tool_result');
    const doneEvents = filterEvents(events, 'done');

    expect(toolCallEvents).toHaveLength(2);
    expect(toolResultEvents).toHaveLength(2);
    // Both from one iteration, so totalToolCalls=2 but only 2 iterations total
    expect(doneEvents[0].totalIterations).toBe(2);
    expect(doneEvents[0].totalToolCalls).toBe(2);
  });
});

// ============================================================================
// 4. Permission System
// ============================================================================

describe('Permission system', () => {
  it('should allow all tools in permissive mode', async () => {
    const echoTool = createEchoTool();

    mockProvider.queueResponse({
      toolCalls: [
        {
          id: 'call_perm_allow',
          name: 'Echo',
          arguments: { message: 'permissive test' },
        },
      ],
      finishReason: 'tool_calls',
    });

    mockProvider.queueResponse({
      content: 'Done.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry([echoTool]);
    const permissions = new PermissionManager({ mode: 'permissive' });

    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
      permissions,
    });

    const events = await collectEvents(agent.run('Test permissive'));

    const toolResultEvents = filterEvents(events, 'tool_result');
    const deniedEvents = filterEvents(events, 'permission_denied');

    expect(toolResultEvents).toHaveLength(1);
    expect(toolResultEvents[0].result.success).toBe(true);
    expect(deniedEvents).toHaveLength(0);
  });

  it('should ask for approval in strict mode and deny when no callback', async () => {
    const echoTool = createEchoTool();

    mockProvider.queueResponse({
      toolCalls: [
        {
          id: 'call_perm_strict',
          name: 'Echo',
          arguments: { message: 'strict test' },
        },
      ],
      finishReason: 'tool_calls',
    });

    // After the denied tool, the LLM responds with text
    mockProvider.queueResponse({
      content: 'Permission was denied.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry([echoTool]);
    const permissions = new PermissionManager({ mode: 'strict' });
    // No approval callback is set, so 'ask' decisions result in no approval

    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
      permissions,
    });

    const events = await collectEvents(agent.run('Test strict'));

    const askEvents = filterEvents(events, 'permission_ask');
    const toolResultEvents = filterEvents(events, 'tool_result');

    // Should have a permission ask event
    expect(askEvents).toHaveLength(1);
    expect(askEvents[0].tool).toBe('Echo');

    // Tool result should be failure due to denied permission
    expect(toolResultEvents).toHaveLength(1);
    expect(toolResultEvents[0].result.success).toBe(false);
    expect(toolResultEvents[0].result.error).toContain('Requires approval');
  });

  it('should deny tools via custom deny rules', async () => {
    const echoTool = createEchoTool();

    mockProvider.queueResponse({
      toolCalls: [
        {
          id: 'call_deny',
          name: 'Echo',
          arguments: { message: 'should be denied' },
        },
      ],
      finishReason: 'tool_calls',
    });

    mockProvider.queueResponse({
      content: 'Denied.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry([echoTool]);
    const permissions = new PermissionManager({ mode: 'permissive' });
    permissions.addDenyRule({ tool: 'Echo', reason: 'Echo is blocked for testing' });

    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
      permissions,
    });

    const events = await collectEvents(agent.run('Try echo'));

    const deniedEvents = filterEvents(events, 'permission_denied');
    const toolResultEvents = filterEvents(events, 'tool_result');

    expect(deniedEvents).toHaveLength(1);
    expect(deniedEvents[0].tool).toBe('Echo');
    expect(deniedEvents[0].reason).toContain('Echo is blocked for testing');

    expect(toolResultEvents).toHaveLength(1);
    expect(toolResultEvents[0].result.success).toBe(false);
    expect(toolResultEvents[0].result.error).toContain('Permission denied');
  });

  it('should allow tools via custom allow rules in default mode', async () => {
    const echoTool = createEchoTool();

    mockProvider.queueResponse({
      toolCalls: [
        {
          id: 'call_allow_rule',
          name: 'Echo',
          arguments: { message: 'allowed' },
        },
      ],
      finishReason: 'tool_calls',
    });

    mockProvider.queueResponse({
      content: 'Allowed.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry([echoTool]);
    const permissions = new PermissionManager({ mode: 'default' });
    // Echo is NOT in the default safe list, but we add an allow rule
    permissions.addAllowRule({ tool: 'Echo', reason: 'Explicitly allowed for test' });

    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
      permissions,
    });

    const events = await collectEvents(agent.run('Echo something'));

    const toolResultEvents = filterEvents(events, 'tool_result');
    const deniedEvents = filterEvents(events, 'permission_denied');

    expect(deniedEvents).toHaveLength(0);
    expect(toolResultEvents).toHaveLength(1);
    expect(toolResultEvents[0].result.success).toBe(true);
  });

  it('should approve tools when approval callback returns true', async () => {
    const echoTool = createEchoTool();

    mockProvider.queueResponse({
      toolCalls: [
        {
          id: 'call_approve',
          name: 'Echo',
          arguments: { message: 'approved' },
        },
      ],
      finishReason: 'tool_calls',
    });

    mockProvider.queueResponse({
      content: 'Approved and done.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry([echoTool]);
    const permissions = new PermissionManager({ mode: 'strict' });
    permissions.setApprovalCallback(async () => true);

    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
      permissions,
    });

    const events = await collectEvents(agent.run('Echo with approval'));

    const toolResultEvents = filterEvents(events, 'tool_result');
    expect(toolResultEvents).toHaveLength(1);
    expect(toolResultEvents[0].result.success).toBe(true);
    expect(toolResultEvents[0].result.output).toBe('Echo: approved');
  });
});

// ============================================================================
// 5. Session Save/Restore
// ============================================================================

describe('Session save/restore', () => {
  let sessionDir: string;
  let sessionManager: SessionManager;

  beforeEach(() => {
    // Use a unique temp directory for session tests
    sessionDir = path.join(os.tmpdir(), `openagent-test-sessions-${Date.now()}`);
    sessionManager = new SessionManager(sessionDir);
  });

  afterEach(() => {
    // Clean up temp directory
    try {
      if (fs.existsSync(sessionDir)) {
        const files = fs.readdirSync(sessionDir);
        for (const file of files) {
          fs.unlinkSync(path.join(sessionDir, file));
        }
        fs.rmdirSync(sessionDir);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should generate unique session IDs', () => {
    const id1 = sessionManager.generateId();
    const id2 = sessionManager.generateId();

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^session_\d+_[a-f0-9]+$/);
    expect(id2).toMatch(/^session_\d+_[a-f0-9]+$/);
  });

  it('should save and load a session', async () => {
    mockProvider.queueResponse({
      content: 'Hello from saved session.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry();
    const sessionId = sessionManager.generateId();

    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Session test system prompt.',
      cwd: os.tmpdir(),
      sessionId,
    });

    await collectEvents(agent.run('Save this conversation'));

    // Get context state after the run
    const contextState = agent.getContext().getState();

    // Save session
    const sessionData = sessionManager.createSession({
      id: sessionId,
      cwd: os.tmpdir(),
      context: contextState,
      provider: 'mock',
      model: 'mock-model',
    });
    sessionManager.save(sessionData);

    // Verify saved session exists
    expect(sessionManager.exists(sessionId)).toBe(true);

    // Load the session
    const loaded = sessionManager.load(sessionId);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(sessionId);
    expect(loaded!.metadata.provider).toBe('mock');
    expect(loaded!.metadata.model).toBe('mock-model');
    expect(loaded!.metadata.cwd).toBe(os.tmpdir());
    expect(loaded!.metadata.messageCount).toBeGreaterThan(0);
    expect(loaded!.context.messages.length).toBeGreaterThan(0);

    // Verify the messages include system + user + assistant
    const roles = loaded!.context.messages.map((m) => m.role);
    expect(roles).toContain('system');
    expect(roles).toContain('user');
    expect(roles).toContain('assistant');
  });

  it('should restore a session and continue the conversation', async () => {
    // First run: create a conversation
    mockProvider.queueResponse({
      content: 'Initial response.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry();
    const sessionId = sessionManager.generateId();

    const agent1 = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test prompt.',
      cwd: os.tmpdir(),
      sessionId,
    });

    await collectEvents(agent1.run('First message'));

    // Save
    const state = agent1.getContext().getState();
    const sessionData = sessionManager.createSession({
      id: sessionId,
      cwd: os.tmpdir(),
      context: state,
    });
    sessionManager.save(sessionData);

    // Second run: restore and continue
    mockProvider.queueResponse({
      content: 'Continuation response.',
      finishReason: 'stop',
    });

    const agent2 = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test prompt.',
      cwd: os.tmpdir(),
      sessionId,
    });

    // Restore context from saved session
    const loaded = sessionManager.load(sessionId);
    expect(loaded).not.toBeNull();
    await agent2.getContext().restore(loaded!.context);

    const events = await collectEvents(agent2.run('Second message'));
    const textEvents = filterEvents(events, 'text');
    const fullText = textEvents.map((e) => e.content).join('');
    expect(fullText).toBe('Continuation response.');

    // Verify the provider received the full conversation history
    const history = mockProvider.getCallHistory();
    // The second call should have messages from the restored session
    const lastCall = history[history.length - 1];
    const userMessages = lastCall.params.messages.filter((m) => m.role === 'user');
    expect(userMessages.length).toBeGreaterThanOrEqual(2);
  });

  it('should list sessions', async () => {
    const id1 = sessionManager.generateId();
    const id2 = sessionManager.generateId();

    sessionManager.save(
      sessionManager.createSession({
        id: id1,
        cwd: '/tmp/test1',
        context: { messages: [], tokenCount: 0, systemTokens: 0, wasCompacted: false, messagesRemoved: 0 },
      }),
    );

    sessionManager.save(
      sessionManager.createSession({
        id: id2,
        cwd: '/tmp/test2',
        context: { messages: [], tokenCount: 0, systemTokens: 0, wasCompacted: false, messagesRemoved: 0 },
      }),
    );

    const sessions = sessionManager.list();
    expect(sessions.length).toBe(2);

    const sessionIds = sessions.map((s) => s.id);
    expect(sessionIds).toContain(id1);
    expect(sessionIds).toContain(id2);
  });

  it('should delete a session', () => {
    const id = sessionManager.generateId();

    sessionManager.save(
      sessionManager.createSession({
        id,
        cwd: '/tmp/test',
        context: { messages: [], tokenCount: 0, systemTokens: 0, wasCompacted: false, messagesRemoved: 0 },
      }),
    );

    expect(sessionManager.exists(id)).toBe(true);
    const deleted = sessionManager.delete(id);
    expect(deleted).toBe(true);
    expect(sessionManager.exists(id)).toBe(false);
  });

  it('should return null for non-existent session', () => {
    const loaded = sessionManager.load('non-existent-session');
    expect(loaded).toBeNull();
  });

  it('should return false when deleting non-existent session', () => {
    const deleted = sessionManager.delete('non-existent-session');
    expect(deleted).toBe(false);
  });
});

// ============================================================================
// 6. Error Handling
// ============================================================================

describe('Error handling', () => {
  it('should emit error event when provider throws', async () => {
    mockProvider.queueError(new Error('Provider connection failed'));

    const tools = createMockRegistry();
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
    });

    const events = await collectEvents(agent.run('Trigger error'));

    const errorEvents = filterEvents(events, 'error');
    const doneEvents = filterEvents(events, 'done');

    expect(errorEvents.length).toBeGreaterThanOrEqual(1);
    expect(errorEvents[0].error).toContain('Provider connection failed');
    expect(errorEvents[0].recoverable).toBe(false);

    // Should still emit done event
    expect(doneEvents).toHaveLength(1);
  });

  it('should handle error on second iteration gracefully', async () => {
    const echoTool = createEchoTool();

    // First response: tool call succeeds
    mockProvider.queueResponse({
      toolCalls: [
        {
          id: 'call_err_1',
          name: 'Echo',
          arguments: { message: 'before error' },
        },
      ],
      finishReason: 'tool_calls',
    });

    // Second response: provider throws
    mockProvider.queueError(new Error('Unexpected LLM failure'));

    const tools = createMockRegistry([echoTool]);
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
    });

    const events = await collectEvents(agent.run('Cause error after tool'));

    const toolResultEvents = filterEvents(events, 'tool_result');
    const errorEvents = filterEvents(events, 'error');

    // The first tool call should have succeeded
    expect(toolResultEvents).toHaveLength(1);
    expect(toolResultEvents[0].result.success).toBe(true);

    // Then an error should have occurred
    expect(errorEvents.length).toBeGreaterThanOrEqual(1);
    expect(errorEvents[0].error).toContain('Unexpected LLM failure');
  });

  it('should handle abort signal', async () => {
    // Queue a response so the agent starts processing
    mockProvider.queueResponse({
      content: 'This should be interrupted.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry();
    const controller = new AbortController();

    // Abort immediately before running
    controller.abort();

    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
    });

    const events = await collectEvents(agent.run('Aborted run', { signal: controller.signal }));

    const errorEvents = filterEvents(events, 'error');

    // Should have an abort error
    expect(errorEvents.length).toBeGreaterThanOrEqual(1);
    expect(errorEvents.some((e) => e.error.toLowerCase().includes('abort'))).toBe(true);
  });
});

// ============================================================================
// 7. Max Iterations
// ============================================================================

describe('Max iterations', () => {
  it('should stop after maxIterations is reached', async () => {
    const echoTool = createEchoTool();

    // Queue enough tool call responses to exceed maxIterations
    // Each tool call consumes one iteration
    for (let i = 0; i < 5; i++) {
      mockProvider.queueResponse({
        toolCalls: [
          {
            id: `call_iter_${i}`,
            name: 'Echo',
            arguments: { message: `iteration ${i}` },
          },
        ],
        finishReason: 'tool_calls',
      });
    }

    const tools = createMockRegistry([echoTool]);
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
      maxIterations: 3,
    });

    const events = await collectEvents(agent.run('Keep calling tools'));

    const errorEvents = filterEvents(events, 'error');
    const doneEvents = filterEvents(events, 'done');
    const toolCallEvents = filterEvents(events, 'tool_call');

    // Should have max iterations error
    expect(errorEvents.length).toBeGreaterThanOrEqual(1);
    expect(errorEvents.some((e) => e.error.includes('Maximum iterations (3) reached'))).toBe(true);
    expect(errorEvents.find((e) => e.error.includes('Maximum iterations'))!.recoverable).toBe(true);

    // Should have at most 3 tool calls (one per iteration)
    expect(toolCallEvents.length).toBeLessThanOrEqual(3);

    // Should still emit done
    expect(doneEvents).toHaveLength(1);
    expect(doneEvents[0].totalIterations).toBe(3);
  });

  it('should allow overriding maxIterations via run options', async () => {
    const echoTool = createEchoTool();

    for (let i = 0; i < 5; i++) {
      mockProvider.queueResponse({
        toolCalls: [
          {
            id: `call_override_${i}`,
            name: 'Echo',
            arguments: { message: `iteration ${i}` },
          },
        ],
        finishReason: 'tool_calls',
      });
    }

    const tools = createMockRegistry([echoTool]);
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
      maxIterations: 50, // high default
    });

    // Override with low value via run options
    const events = await collectEvents(agent.run('Keep calling', { maxIterations: 2 }));

    const errorEvents = filterEvents(events, 'error');
    const doneEvents = filterEvents(events, 'done');

    expect(errorEvents.some((e) => e.error.includes('Maximum iterations (2) reached'))).toBe(true);
    expect(doneEvents).toHaveLength(1);
    expect(doneEvents[0].totalIterations).toBe(2);
  });

  it('should complete normally if iterations stay within limit', async () => {
    mockProvider.queueResponse({
      content: 'Simple response within limits.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry();
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
      maxIterations: 5,
    });

    const events = await collectEvents(agent.run('Just respond'));

    const errorEvents = filterEvents(events, 'error');
    const doneEvents = filterEvents(events, 'done');

    // No max iterations error
    expect(errorEvents).toHaveLength(0);
    expect(doneEvents).toHaveLength(1);
    expect(doneEvents[0].totalIterations).toBe(1);
  });
});

// ============================================================================
// 8. Agent State Management
// ============================================================================

describe('Agent state management', () => {
  it('should track state correctly during and after a run', async () => {
    const echoTool = createEchoTool();

    mockProvider.queueResponse({
      toolCalls: [
        {
          id: 'call_state_1',
          name: 'Echo',
          arguments: { message: 'state test' },
        },
      ],
      finishReason: 'tool_calls',
    });

    mockProvider.queueResponse({
      content: 'Done tracking state.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry([echoTool]);
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
    });

    // Before running
    const stateBefore = agent.getState();
    expect(stateBefore.isRunning).toBe(false);
    expect(stateBefore.iteration).toBe(0);
    expect(stateBefore.toolCallCount).toBe(0);

    await collectEvents(agent.run('Track my state'));

    // After running
    const stateAfter = agent.getState();
    expect(stateAfter.isRunning).toBe(false);
    expect(stateAfter.iteration).toBe(2); // tool call + final text
    expect(stateAfter.toolCallCount).toBe(1);
  });

  it('should reset state between runs', async () => {
    mockProvider.queueResponse({
      content: 'First run.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry();
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test',
      cwd: os.tmpdir(),
    });

    await collectEvents(agent.run('First run'));

    const stateAfterFirst = agent.getState();
    expect(stateAfterFirst.iteration).toBe(1);

    // Second run
    mockProvider.queueResponse({
      content: 'Second run.',
      finishReason: 'stop',
    });

    await collectEvents(agent.run('Second run'));

    // State should reflect only the second run
    const stateAfterSecond = agent.getState();
    expect(stateAfterSecond.iteration).toBe(1);
    expect(stateAfterSecond.toolCallCount).toBe(0);
  });

  it('should maintain context across multiple runs', async () => {
    mockProvider.queueResponse({
      content: 'First response.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry();
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Remember things.',
      cwd: os.tmpdir(),
    });

    await collectEvents(agent.run('Remember the number 42'));

    // Second run should have accumulated context
    mockProvider.queueResponse({
      content: 'The number was 42.',
      finishReason: 'stop',
    });

    await collectEvents(agent.run('What number did I mention?'));

    const history = mockProvider.getCallHistory();
    expect(history).toHaveLength(2);

    // Second call should include messages from first run
    const secondCallMessages = history[1].params.messages;
    const userMessages = secondCallMessages.filter((m) => m.role === 'user');
    expect(userMessages.length).toBe(2);
    expect(userMessages[0].content).toBe('Remember the number 42');
    expect(userMessages[1].content).toBe('What number did I mention?');
  });

  it('should allow full reset of the agent', async () => {
    mockProvider.queueResponse({
      content: 'Before reset.',
      finishReason: 'stop',
    });

    const tools = createMockRegistry();
    const agent = new AgentLoop(router, {
      tools,
      systemPrompt: 'Test system prompt.',
      cwd: os.tmpdir(),
    });

    await collectEvents(agent.run('Something'));
    await agent.reset();

    // After reset, context should be cleared
    const context = agent.getContext().getState();
    // Only the system message should remain after reset + re-initialize
    expect(context.messages.length).toBe(1);
    expect(context.messages[0].role).toBe('system');
  });
});
