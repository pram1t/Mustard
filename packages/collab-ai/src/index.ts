/**
 * @mustard/collab-ai
 *
 * AI intent engine, zone claiming, and agent coordination for OpenAgent Collab.
 */

// ============================================================================
// Classes
// ============================================================================

export { IntentEngine } from './intent-engine.js';
export type { IntentEngineOptions } from './intent-engine.js';

export { ZoneManager } from './zone-manager.js';
export { RateLimiter } from './rate-limiter.js';

export { AgentRegistry } from './agent-registry.js';
export type { AgentRegistryConfig, AgentRegisterInput } from './agent-registry.js';

// ============================================================================
// Message-bus integration
// ============================================================================

export {
  attachIntentEngineToBus,
  INTENT_TOPICS,
  INTENT_TOPIC_WILDCARD,
} from './bus-adapter.js';
export type {
  AttachIntentEngineOptions,
  IntentEventName,
} from './bus-adapter.js';

// ============================================================================
// Context bridge
// ============================================================================

export { ContextBridge } from './context-bridge.js';
export type {
  RoomProvider,
  ParticipantProvider,
  KnowledgeProvider,
  TaskProvider,
  ContextBridgeConfig,
  ContextBridgeOptions,
} from './context-bridge.js';

// ============================================================================
// Auto-approval
// ============================================================================

export {
  shouldAutoApprove,
  defaultAutoApprovalPolicy,
} from './auto-approval.js';
export type { AutoApprovalPolicy } from './auto-approval.js';

// ============================================================================
// Types
// ============================================================================

export type {
  // Intent system
  Intent,
  IntentType,
  IntentAction,
  FileReadAction,
  FileCreateAction,
  FileEditAction,
  FileDeleteAction,
  FileRenameAction,
  CommandRunAction,
  SearchAction,
  AnalyzeAction,
  OtherAction,
  RiskLevel,
  IntentStatus,

  // Zone claiming
  ClaimedZone,
  ZoneClaimRequest,
  ZoneClaimResult,

  // Rate limiting
  RateLimiterConfig,
  RateLimitStatus,

  // Turn management
  TurnManagerState,
  TurnRequest,
  TurnPriority,

  // Agent registry
  RegisteredAgent,
  AgentStatus,

  // Context bridge
  AIContext,
  RoomContext,
  ParticipantContext,
  ActionContext,
  ProjectKnowledge,
  TaskContext,

  // Conflict detection
  ConflictDetection,
  ConflictDetail,
  ConflictType,
  ConflictResolution,

  // AI events
  AICoordinationEvent,
  IntentProposedEvent,
  IntentApprovedEvent,
  IntentRejectedEvent,
  IntentExecutingEvent,
  IntentCompletedEvent,
  IntentFailedEvent,
  IntentInvalidatedEvent,
  ZoneClaimedEvent,
  ZoneReleasedEvent,
  AgentStatusChangedEvent,
} from './types.js';

export { DEFAULT_AI_RATE_LIMITS } from './types.js';
