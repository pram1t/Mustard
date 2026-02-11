import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useConversationStore } from '../conversation';
import {
  createTextEvent,
  createToolCallEvent,
  createToolResultEvent,
  createErrorEvent,
  createDoneEvent,
  createThinkingEvent,
} from '../../../shared/event-types';
import type { StatusEvent } from '../../../shared/event-types';

let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

const SESSION = 'test-session';

function createStatusEvent(sessionId: string, status: 'busy' | 'idle'): StatusEvent {
  return {
    version: 1,
    type: 'status',
    timestamp: Date.now(),
    sessionId,
    data: { status },
  };
}

describe('useConversationStore', () => {
  beforeEach(() => {
    uuidCounter = 0;
    useConversationStore.setState({
      sessionId: null,
      messages: [],
      status: 'idle',
      input: '',
    });
  });

  describe('addUserMessage', () => {
    it('appends a user message and clears input', () => {
      useConversationStore.setState({ input: 'Hello' });
      useConversationStore.getState().addUserMessage('Hello');

      const state = useConversationStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].type).toBe('user');
      expect(state.messages[0].content).toBe('Hello');
      expect(state.messages[0].id).toBe('test-uuid-1');
      expect(state.input).toBe('');
      expect(state.status).toBe('busy');
    });
  });

  describe('handleEvent', () => {
    it('handles text event — creates new assistant message', () => {
      const event = createTextEvent(SESSION, 'Hello world', 'Hello world');
      useConversationStore.getState().handleEvent(event);

      const state = useConversationStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].type).toBe('assistant');
      expect(state.messages[0].content).toBe('Hello world');
      expect(state.sessionId).toBe(SESSION);
    });

    it('handles text event — upserts existing assistant message', () => {
      const event1 = createTextEvent(SESSION, 'Hello', 'Hello');
      useConversationStore.getState().handleEvent(event1);

      const event2 = createTextEvent(SESSION, 'Hello world', ' world');
      useConversationStore.getState().handleEvent(event2);

      const state = useConversationStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].content).toBe('Hello world');
    });

    it('handles text event — does not upsert after non-assistant message', () => {
      useConversationStore.getState().addUserMessage('Hi');
      const event = createTextEvent(SESSION, 'Hello', 'Hello');
      useConversationStore.getState().handleEvent(event);

      const state = useConversationStore.getState();
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].type).toBe('user');
      expect(state.messages[1].type).toBe('assistant');
    });

    it('handles tool_call event', () => {
      const event = createToolCallEvent(SESSION, 'call-1', 'Read', { path: '/tmp/file.txt' });
      useConversationStore.getState().handleEvent(event);

      const state = useConversationStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].type).toBe('tool_call');
      expect(state.messages[0].id).toBe('call-1');
      expect(state.messages[0].metadata?.name).toBe('Read');
    });

    it('handles tool_result event', () => {
      const event = createToolResultEvent(SESSION, 'call-1', 'Read', 'file contents', 150);
      useConversationStore.getState().handleEvent(event);

      const state = useConversationStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].type).toBe('tool_result');
      expect(state.messages[0].id).toBe('result-call-1');
      expect(state.messages[0].content).toBe('file contents');
    });

    it('handles error event', () => {
      const event = createErrorEvent(SESSION, 'RATE_LIMIT', 'Too many requests', true);
      useConversationStore.getState().handleEvent(event);

      const state = useConversationStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].type).toBe('error');
      expect(state.messages[0].content).toBe('Too many requests');
      expect(state.messages[0].metadata?.code).toBe('RATE_LIMIT');
      expect(state.status).toBe('error');
    });

    it('handles status event — busy', () => {
      const event = createStatusEvent(SESSION, 'busy');
      useConversationStore.getState().handleEvent(event);

      expect(useConversationStore.getState().status).toBe('busy');
    });

    it('handles status event — idle', () => {
      useConversationStore.setState({ status: 'busy' });
      const event = createStatusEvent(SESSION, 'idle');
      useConversationStore.getState().handleEvent(event);

      expect(useConversationStore.getState().status).toBe('idle');
    });

    it('handles done event — sets status to idle', () => {
      useConversationStore.setState({ status: 'busy' });
      const event = createDoneEvent(SESSION, 'complete', 0);
      useConversationStore.getState().handleEvent(event);

      expect(useConversationStore.getState().status).toBe('idle');
    });

    it('handles thinking event — no message appended', () => {
      const event = createThinkingEvent(SESSION, 'executing');
      useConversationStore.getState().handleEvent(event);

      expect(useConversationStore.getState().messages).toHaveLength(0);
    });

    it('sets sessionId from event', () => {
      const event = createTextEvent('new-session', 'Hello', 'Hello');
      useConversationStore.getState().handleEvent(event);

      expect(useConversationStore.getState().sessionId).toBe('new-session');
    });
  });

  describe('setInput', () => {
    it('updates input', () => {
      useConversationStore.getState().setInput('test input');
      expect(useConversationStore.getState().input).toBe('test input');
    });
  });

  describe('setStatus', () => {
    it('updates status', () => {
      useConversationStore.getState().setStatus('busy');
      expect(useConversationStore.getState().status).toBe('busy');
    });
  });

  describe('clear', () => {
    it('resets conversation state', () => {
      useConversationStore.setState({
        sessionId: 'some-session',
        messages: [{ id: '1', type: 'user', content: 'hi', timestamp: 0 }],
        status: 'busy',
        input: 'draft',
      });

      useConversationStore.getState().clear();

      const state = useConversationStore.getState();
      expect(state.sessionId).toBeNull();
      expect(state.messages).toHaveLength(0);
      expect(state.status).toBe('idle');
      expect(state.input).toBe('');
    });
  });
});
