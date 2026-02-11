import { create } from 'zustand';
import type { AgentEvent } from '../../shared/event-types';

export interface Message {
  id: string;
  type: 'user' | 'assistant' | 'tool_call' | 'tool_result' | 'error';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationState {
  sessionId: string | null;
  messages: Message[];
  status: 'idle' | 'busy' | 'error';
  input: string;
}

export interface ConversationActions {
  addUserMessage: (content: string) => void;
  handleEvent: (event: AgentEvent) => void;
  setStatus: (status: ConversationState['status']) => void;
  setInput: (input: string) => void;
  clear: () => void;
}

export const useConversationStore = create<ConversationState & ConversationActions>()(
  (set) => ({
    sessionId: null,
    messages: [],
    status: 'idle',
    input: '',

    addUserMessage: (content) =>
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: crypto.randomUUID(),
            type: 'user',
            content,
            timestamp: Date.now(),
          },
        ],
        input: '',
        status: 'busy',
      })),

    handleEvent: (event) =>
      set((state) => {
        const updates: Partial<ConversationState> = {};

        if (event.sessionId) {
          updates.sessionId = event.sessionId;
        }

        switch (event.type) {
          case 'text': {
            const lastMsg = state.messages[state.messages.length - 1];
            if (lastMsg && lastMsg.type === 'assistant') {
              // Upsert: update existing assistant message
              const updated = [...state.messages];
              updated[updated.length - 1] = {
                ...lastMsg,
                content: event.data.content,
              };
              updates.messages = updated;
            } else {
              // Append new assistant message
              updates.messages = [
                ...state.messages,
                {
                  id: crypto.randomUUID(),
                  type: 'assistant',
                  content: event.data.content,
                  timestamp: event.timestamp,
                },
              ];
            }
            break;
          }

          case 'tool_call':
            updates.messages = [
              ...state.messages,
              {
                id: event.data.id,
                type: 'tool_call',
                content: JSON.stringify(event.data),
                timestamp: event.timestamp,
                metadata: { name: event.data.name, arguments: event.data.arguments },
              },
            ];
            break;

          case 'tool_result':
            updates.messages = [
              ...state.messages,
              {
                id: `result-${event.data.id}`,
                type: 'tool_result',
                content: typeof event.data.result === 'string'
                  ? event.data.result
                  : JSON.stringify(event.data.result),
                timestamp: event.timestamp,
                metadata: { name: event.data.name, duration: event.data.duration, error: event.data.error },
              },
            ];
            break;

          case 'error':
            updates.messages = [
              ...state.messages,
              {
                id: crypto.randomUUID(),
                type: 'error',
                content: event.data.message,
                timestamp: event.timestamp,
                metadata: { code: event.data.code, recoverable: event.data.recoverable },
              },
            ];
            updates.status = 'error';
            break;

          case 'status':
            updates.status = event.data.status === 'busy' ? 'busy' : 'idle';
            break;

          case 'done':
            updates.status = 'idle';
            break;

          case 'thinking':
            // No message appended for thinking events in Phase 6
            break;
        }

        return updates;
      }),

    setStatus: (status) => set({ status }),
    setInput: (input) => set({ input }),
    clear: () => set({ sessionId: null, messages: [], status: 'idle', input: '' }),
  }),
);
