/**
 * AI coordination types for OpenAgent Collab.
 *
 * Types for intent engine, zone claiming, rate limiting, and agent management.
 */

import type { Range } from '@openagent/collab-core';
import type { ActivityState } from '@openagent/collab-presence';

// ============================================================================
// Intent System
// ============================================================================

/**
 * AI Intent — proposed action before execution.
 */
export interface Intent {
  /** Unique intent identifier */
  id: string;

  /** Agent that proposed this intent */
  agentId: string;

  /** Human-readable summary */
  summary: string;

  /** Intent type */
  type: IntentType;

  /** Proposed action details */
  action: IntentAction;

  /** Why the agent wants to do this */
  rationale: string;

  /** Confidence score (0-1) */
  confidence: number;

  /** Risk assessment */
  risk: RiskLevel;

  /** Current status */
  status: IntentStatus;

  /** Creation timestamp */
  createdAt: number;

  /** Resolution timestamp */
  resolvedAt?: number;

  /** Who resolved it */
  resolvedBy?: string;

  /** Resolution reason (for rejections) */
  rejectionReason?: string;
}

/** Intent types */
export type IntentType =
  | 'file_read'
  | 'file_create'
  | 'file_edit'
  | 'file_delete'
  | 'file_rename'
  | 'command_run'
  | 'search'
  | 'analyze'
  | 'other';

/** Intent action union */
export type IntentAction =
  | FileReadAction
  | FileCreateAction
  | FileEditAction
  | FileDeleteAction
  | FileRenameAction
  | CommandRunAction
  | SearchAction
  | AnalyzeAction
  | OtherAction;

export interface FileReadAction {
  type: 'file_read';
  path: string;
}

export interface FileCreateAction {
  type: 'file_create';
  path: string;
  content: string;
}

export interface FileEditAction {
  type: 'file_edit';
  path: string;
  range: Range;
  oldContent: string;
  newContent: string;
  diff: string;
}

export interface FileDeleteAction {
  type: 'file_delete';
  path: string;
}

export interface FileRenameAction {
  type: 'file_rename';
  oldPath: string;
  newPath: string;
}

export interface CommandRunAction {
  type: 'command_run';
  command: string;
  cwd?: string;
}

export interface SearchAction {
  type: 'search';
  query: string;
  scope: 'file' | 'project' | 'workspace';
}

export interface AnalyzeAction {
  type: 'analyze';
  target: string;
  analysisType: string;
}

export interface OtherAction {
  type: 'other';
  description: string;
  data?: unknown;
}

/** Risk levels */
export type RiskLevel = 'safe' | 'moderate' | 'dangerous';

/** Intent statuses */
export type IntentStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'invalidated';

// ============================================================================
// Zone Claiming
// ============================================================================

/**
 * Claimed zone.
 */
export interface ClaimedZone {
  /** File path */
  file: string;

  /** Claimed region */
  region: Range;

  /** Claimer's participant ID */
  claimerId: string;

  /** Claimer type */
  claimerType: 'human' | 'ai';

  /** When claim was made */
  claimedAt: number;

  /** Claim expiry (for AI) */
  expiresAt?: number;
}

/** Zone claim request */
export interface ZoneClaimRequest {
  file: string;
  region: Range;
  participantId: string;
  participantType: 'human' | 'ai';
  duration?: number; // For temporary claims
}

/** Zone claim result */
export interface ZoneClaimResult {
  success: boolean;
  claim?: ClaimedZone;
  conflict?: {
    existingClaim: ClaimedZone;
    resolution: 'denied' | 'yielded' | 'partial';
  };
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Rate limiter configuration.
 */
export interface RateLimiterConfig {
  /** Maximum operations per window */
  maxOperations: number;

  /** Time window in milliseconds */
  windowMs: number;

  /** Cooldown after limit hit */
  cooldownMs: number;
}

/**
 * Rate limit status.
 */
export interface RateLimitStatus {
  /** Operations remaining */
  remaining: number;

  /** When window resets */
  resetAt: number;

  /** Whether currently limited */
  isLimited: boolean;
}

/** Default rate limits for AI agents */
export const DEFAULT_AI_RATE_LIMITS: Record<string, RateLimiterConfig> = {
  file_read: { maxOperations: 50, windowMs: 60_000, cooldownMs: 5_000 },
  file_edit: { maxOperations: 10, windowMs: 60_000, cooldownMs: 10_000 },
  command_run: { maxOperations: 5, windowMs: 60_000, cooldownMs: 30_000 },
  intent_propose: { maxOperations: 20, windowMs: 60_000, cooldownMs: 5_000 },
};

// ============================================================================
// Turn Management
// ============================================================================

/**
 * Turn manager state.
 */
export interface TurnManagerState {
  /** Current turn holder (null = open) */
  currentTurn: string | null;

  /** Turn queue */
  queue: TurnRequest[];

  /** Turn timeout */
  timeoutMs: number;
}

/** Turn request */
export interface TurnRequest {
  participantId: string;
  participantType: 'human' | 'ai';
  requestedAt: number;
  priority: TurnPriority;
}

/** Turn priority */
export type TurnPriority = 'high' | 'normal' | 'low';

// ============================================================================
// Agent Registry
// ============================================================================

/**
 * Registered agent.
 */
export interface RegisteredAgent {
  /** Agent identifier */
  id: string;

  /** Display name */
  name: string;

  /** Model being used */
  model: string;

  /** Provider */
  provider: string;

  /** Agent status */
  status: AgentStatus;

  /** Allowed actions */
  allowedActions: string[];

  /** Rate limits */
  rateLimits: Record<string, RateLimiterConfig>;

  /** When agent was registered */
  registeredAt: number;

  /** Last activity */
  lastActivity: number;
}

/** Agent status */
export type AgentStatus =
  | 'initializing'
  | 'idle'
  | 'thinking'
  | 'executing'
  | 'paused'
  | 'error'
  | 'disconnected';

// ============================================================================
// Context Bridge
// ============================================================================

/**
 * Context for AI LLM calls.
 */
export interface AIContext {
  /** Current room state */
  room: RoomContext;

  /** Current participants */
  participants: ParticipantContext[];

  /** Recent actions */
  recentActions: ActionContext[];

  /** Project knowledge */
  projectKnowledge: ProjectKnowledge;

  /** Current task/conversation */
  currentTask: TaskContext;
}

/** Room context for AI */
export interface RoomContext {
  id: string;
  name: string;
  projectPath?: string;
  currentMode: string;
  fileCount: number;
  activeFiles: string[];
}

/** Participant context for AI */
export interface ParticipantContext {
  id: string;
  name: string;
  type: 'human' | 'ai';
  currentFile?: string;
  activity: ActivityState;
  intent?: string;
}

/** Recent action context */
export interface ActionContext {
  participantId: string;
  participantName: string;
  action: string;
  target?: string;
  timestamp: number;
}

/** Project knowledge summary */
export interface ProjectKnowledge {
  /** Project summary */
  summary: string;

  /** Key files */
  keyFiles: string[];

  /** Architecture overview */
  architecture?: string;

  /** Conventions */
  conventions: string[];

  /** Recent decisions */
  recentDecisions: string[];
}

/** Current task context */
export interface TaskContext {
  /** Task description */
  description: string;

  /** Conversation history (summarized) */
  conversationSummary: string;

  /** Files involved */
  relevantFiles: string[];
}

// ============================================================================
// Conflict Detection
// ============================================================================

/** Conflict detection result */
export interface ConflictDetection {
  /** Whether conflict exists */
  hasConflict: boolean;

  /** Conflict details */
  conflicts: ConflictDetail[];
}

/** Conflict detail */
export interface ConflictDetail {
  type: ConflictType;
  file: string;
  region?: Range;
  participants: string[];
  severity: 'low' | 'medium' | 'high';
  resolution?: ConflictResolution;
}

/** Conflict types */
export type ConflictType =
  | 'same_region'      // Multiple editors in same region
  | 'claimed_zone'     // Trying to edit claimed zone
  | 'intent_collision' // Multiple intents for same target
  | 'dependency';      // Change breaks dependency

/** Conflict resolution */
export interface ConflictResolution {
  strategy: 'human_wins' | 'first_wins' | 'merge' | 'ask';
  winner?: string;
  reason: string;
}

// ============================================================================
// AI Events
// ============================================================================

/** AI coordination event union */
export type AICoordinationEvent =
  | IntentProposedEvent
  | IntentApprovedEvent
  | IntentRejectedEvent
  | IntentExecutingEvent
  | IntentCompletedEvent
  | IntentFailedEvent
  | IntentInvalidatedEvent
  | ZoneClaimedEvent
  | ZoneReleasedEvent
  | AgentStatusChangedEvent;

export interface IntentProposedEvent {
  type: 'intent_proposed';
  intent: Intent;
}

export interface IntentApprovedEvent {
  type: 'intent_approved';
  intentId: string;
  approvedBy: string;
}

export interface IntentRejectedEvent {
  type: 'intent_rejected';
  intentId: string;
  rejectedBy: string;
  reason: string;
}

export interface IntentExecutingEvent {
  type: 'intent_executing';
  intentId: string;
}

export interface IntentCompletedEvent {
  type: 'intent_completed';
  intentId: string;
  result: unknown;
}

export interface IntentFailedEvent {
  type: 'intent_failed';
  intentId: string;
  error: string;
}

export interface IntentInvalidatedEvent {
  type: 'intent_invalidated';
  intentId: string;
  reason: string;
}

export interface ZoneClaimedEvent {
  type: 'zone_claimed';
  claim: ClaimedZone;
}

export interface ZoneReleasedEvent {
  type: 'zone_released';
  file: string;
  region: Range;
  participantId: string;
}

export interface AgentStatusChangedEvent {
  type: 'agent_status_changed';
  agentId: string;
  status: AgentStatus;
  previousStatus: AgentStatus;
}
