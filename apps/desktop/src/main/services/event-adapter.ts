/**
 * Event Adapter
 *
 * Maps @mustard/core events (12 flat types) to desktop events (7 versioned types).
 * Stateless pure function — no side effects except console logging for dropped events.
 */

import type { AgentEvent as CoreAgentEvent } from '@mustard/core';
import type { AgentEvent as DesktopAgentEvent, ErrorCode } from '../../shared/event-types';
import {
  createTextEvent,
  createToolCallEvent,
  createToolResultEvent,
  createErrorEvent,
  createDoneEvent,
  createThinkingEvent,
} from '../../shared/event-types';

/**
 * Classifies an error message string into a desktop ErrorCode.
 */
function classifyErrorCode(message: string): ErrorCode {
  const lower = message.toLowerCase();

  if (lower.includes('rate limit') || lower.includes('429')) return 'RATE_LIMIT';
  if (lower.includes('api key') || lower.includes('invalid key') || lower.includes('authentication')) return 'INVALID_API_KEY';
  if (lower.includes('context') || lower.includes('token limit') || lower.includes('too long')) return 'CONTEXT_OVERFLOW';
  if (lower.includes('tool') && lower.includes('error')) return 'TOOL_ERROR';
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('econnrefused') || lower.includes('enotfound')) return 'NETWORK_ERROR';
  if (lower.includes('permission') || lower.includes('denied')) return 'PERMISSION_DENIED';
  if (lower.includes('timeout') || lower.includes('timed out')) return 'TIMEOUT';
  if (lower.includes('abort') || lower.includes('cancel')) return 'CANCELLED';

  return 'INTERNAL_ERROR';
}

/**
 * Adapts a core AgentEvent to a desktop AgentEvent.
 * Returns null for events that have no desktop equivalent (logged and dropped).
 */
export function adaptCoreEvent(
  coreEvent: CoreAgentEvent,
  sessionId: string,
): DesktopAgentEvent | null {
  switch (coreEvent.type) {
    case 'text':
      return createTextEvent(sessionId, coreEvent.content, coreEvent.content);

    case 'tool_call':
      return createToolCallEvent(
        sessionId,
        coreEvent.tool_call.id,
        coreEvent.tool_call.name,
        coreEvent.tool_call.arguments,
      );

    case 'tool_result':
      return createToolResultEvent(
        sessionId,
        coreEvent.tool_call_id,
        coreEvent.tool_name,
        coreEvent.result.output,
        coreEvent.result.metadata?.executionTime ?? 0,
        coreEvent.result.error,
      );

    case 'error':
      return createErrorEvent(
        sessionId,
        classifyErrorCode(coreEvent.error),
        coreEvent.error,
        coreEvent.recoverable,
      );

    case 'done':
      return createDoneEvent(sessionId, 'complete', 0);

    case 'thinking':
      return createThinkingEvent(sessionId, 'executing');

    case 'permission_denied':
      return createErrorEvent(
        sessionId,
        'PERMISSION_DENIED',
        `Tool '${coreEvent.tool}' denied: ${coreEvent.reason}`,
        true,
      );

    case 'permission_ask': {
      // Build a ToolCallEvent with requiresConfirmation flag
      const base = createToolCallEvent(
        sessionId,
        `permission-${Date.now()}`,
        coreEvent.tool,
        {},
      );
      base.data.requiresConfirmation = true;
      base.data.riskLevel = 'high';
      return base;
    }

    // Events with no desktop equivalent — log and drop
    case 'compaction':
      console.log(`[event-adapter] Compaction: removed ${coreEvent.messagesRemoved} messages, ${coreEvent.tokensRemoved} tokens`);
      return null;

    case 'hook_triggered':
      console.log(`[event-adapter] Hook triggered: ${coreEvent.event} (${coreEvent.hookCount} hooks)`);
      return null;

    case 'hook_blocked':
      console.log(`[event-adapter] Hook blocked: ${coreEvent.event}${coreEvent.reason ? ` — ${coreEvent.reason}` : ''}`);
      return null;

    case 'hook_output':
      console.log(`[event-adapter] Hook output: ${coreEvent.event}`);
      return null;

    default:
      console.warn(`[event-adapter] Unknown core event type: ${(coreEvent as { type: string }).type}`);
      return null;
  }
}

export { classifyErrorCode };
