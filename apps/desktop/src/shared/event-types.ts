/**
 * Event Type Definitions
 *
 * Unified event protocol for CLI and Desktop.
 * These types are defined in @mustard/core and consumed by both interfaces.
 *
 * Design Principles:
 * - Single source of truth: Same events for CLI and Desktop
 * - Serializable: All events can be JSON.stringify/parse
 * - Versioned: Protocol version for forward compatibility
 * - No UI concerns: Events describe what happened, not how to display it
 */

// =============================================================================
// PROTOCOL VERSION
// =============================================================================

export const EVENT_PROTOCOL_VERSION = 1;

// =============================================================================
// BASE EVENT STRUCTURE
// =============================================================================

export interface AgentEventBase {
  version: number;
  type: EventType;
  timestamp: number;
  sessionId: string;
}

export type EventType =
  | 'text'
  | 'tool_call'
  | 'tool_result'
  | 'error'
  | 'done'
  | 'thinking'
  | 'status';

// =============================================================================
// EVENT TYPE DEFINITIONS
// =============================================================================

export interface TextEvent extends AgentEventBase {
  type: 'text';
  data: {
    content: string;
    delta?: string;
    role: 'assistant';
  };
}

export interface ToolCallEvent extends AgentEventBase {
  type: 'tool_call';
  data: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    requiresConfirmation?: boolean;
    riskLevel?: 'low' | 'medium' | 'high';
  };
}

export interface ToolResultEvent extends AgentEventBase {
  type: 'tool_result';
  data: {
    id: string;
    name: string;
    result: unknown;
    error?: string;
    duration: number;
    truncated?: boolean;
  };
}

export interface ErrorEvent extends AgentEventBase {
  type: 'error';
  data: {
    code: ErrorCode;
    message: string;
    recoverable: boolean;
    details?: Record<string, unknown>;
  };
}

export type ErrorCode =
  | 'RATE_LIMIT'
  | 'INVALID_API_KEY'
  | 'CONTEXT_OVERFLOW'
  | 'TOOL_ERROR'
  | 'NETWORK_ERROR'
  | 'PERMISSION_DENIED'
  | 'INTERNAL_ERROR'
  | 'TIMEOUT'
  | 'CANCELLED';

export interface DoneEvent extends AgentEventBase {
  type: 'done';
  data: {
    reason: DoneReason;
    usage?: TokenUsage;
    duration: number;
  };
}

export type DoneReason =
  | 'complete'
  | 'stopped'
  | 'error'
  | 'limit';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface ThinkingEvent extends AgentEventBase {
  type: 'thinking';
  data: {
    stage: ThinkingStage;
    progress?: number;
  };
}

export type ThinkingStage =
  | 'planning'
  | 'executing'
  | 'reviewing'
  | 'generating';

export interface StatusEvent extends AgentEventBase {
  type: 'status';
  data: {
    status: AgentStatus;
    message?: string;
  };
}

export type AgentStatus =
  | 'connecting'
  | 'ready'
  | 'busy'
  | 'idle'
  | 'error';

// =============================================================================
// UNION TYPE
// =============================================================================

export type AgentEvent =
  | TextEvent
  | ToolCallEvent
  | ToolResultEvent
  | ErrorEvent
  | DoneEvent
  | ThinkingEvent
  | StatusEvent;

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isTextEvent(event: AgentEvent): event is TextEvent {
  return event.type === 'text';
}

export function isToolCallEvent(event: AgentEvent): event is ToolCallEvent {
  return event.type === 'tool_call';
}

export function isToolResultEvent(event: AgentEvent): event is ToolResultEvent {
  return event.type === 'tool_result';
}

export function isErrorEvent(event: AgentEvent): event is ErrorEvent {
  return event.type === 'error';
}

export function isDoneEvent(event: AgentEvent): event is DoneEvent {
  return event.type === 'done';
}

export function isThinkingEvent(event: AgentEvent): event is ThinkingEvent {
  return event.type === 'thinking';
}

export function isStatusEvent(event: AgentEvent): event is StatusEvent {
  return event.type === 'status';
}

// =============================================================================
// EVENT VALIDATION
// =============================================================================

export function isValidEvent(obj: unknown): obj is AgentEvent {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const event = obj as Record<string, unknown>;

  if (typeof event.version !== 'number') return false;
  if (typeof event.type !== 'string') return false;
  if (typeof event.timestamp !== 'number') return false;
  if (typeof event.sessionId !== 'string') return false;

  const validTypes: EventType[] = [
    'text', 'tool_call', 'tool_result', 'error', 'done', 'thinking', 'status'
  ];
  if (!validTypes.includes(event.type as EventType)) return false;

  if (typeof event.data !== 'object' || event.data === null) return false;

  return true;
}

// =============================================================================
// EVENT FACTORY FUNCTIONS
// =============================================================================

function createBaseEvent(type: EventType, sessionId: string): AgentEventBase {
  return {
    version: EVENT_PROTOCOL_VERSION,
    type,
    timestamp: Date.now(),
    sessionId,
  };
}

export function createTextEvent(
  sessionId: string,
  content: string,
  delta?: string
): TextEvent {
  return {
    ...createBaseEvent('text', sessionId),
    type: 'text',
    data: { content, delta, role: 'assistant' },
  };
}

export function createToolCallEvent(
  sessionId: string,
  id: string,
  name: string,
  args: Record<string, unknown>
): ToolCallEvent {
  return {
    ...createBaseEvent('tool_call', sessionId),
    type: 'tool_call',
    data: { id, name, arguments: args },
  };
}

export function createToolResultEvent(
  sessionId: string,
  id: string,
  name: string,
  result: unknown,
  duration: number,
  error?: string
): ToolResultEvent {
  return {
    ...createBaseEvent('tool_result', sessionId),
    type: 'tool_result',
    data: { id, name, result, error, duration },
  };
}

export function createErrorEvent(
  sessionId: string,
  code: ErrorCode,
  message: string,
  recoverable: boolean
): ErrorEvent {
  return {
    ...createBaseEvent('error', sessionId),
    type: 'error',
    data: { code, message, recoverable },
  };
}

export function createDoneEvent(
  sessionId: string,
  reason: DoneReason,
  duration: number,
  usage?: TokenUsage
): DoneEvent {
  return {
    ...createBaseEvent('done', sessionId),
    type: 'done',
    data: { reason, duration, usage },
  };
}

export function createThinkingEvent(
  sessionId: string,
  stage: ThinkingStage,
  progress?: number
): ThinkingEvent {
  return {
    ...createBaseEvent('thinking', sessionId),
    type: 'thinking',
    data: { stage, progress },
  };
}

export function createStatusEvent(
  sessionId: string,
  status: AgentStatus,
  message?: string
): StatusEvent {
  return {
    ...createBaseEvent('status', sessionId),
    type: 'status',
    data: { status, message },
  };
}

// =============================================================================
// SERIALIZATION
// =============================================================================

export function serializeEvent(event: AgentEvent): string {
  return JSON.stringify(event);
}

export function deserializeEvent(data: string): AgentEvent {
  const parsed = JSON.parse(data);

  if (!isValidEvent(parsed)) {
    throw new Error('Invalid event structure');
  }

  return parsed;
}
