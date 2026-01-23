/**
 * Agent Module
 *
 * Exports agent loop and execution functionality.
 */

export type {
  AgentConfig,
  AgentEvent,
  AgentState,
  RunOptions,
  TextEvent,
  ToolCallEvent,
  ToolResultEvent,
  ErrorEvent,
  DoneEvent,
  ThinkingEvent,
  CompactionEvent,
} from './types.js';

export { DEFAULT_AGENT_CONFIG } from './types.js';
export { AgentLoop, createAgent } from './loop.js';
export { executeTools, executeSingleTool, validateToolCalls } from './execution.js';
