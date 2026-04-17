/**
 * Presence & awareness types for OpenAgent Collab.
 *
 * Types for real-time presence, cursors, and activity tracking.
 */

import type { SelectionRange } from '@openagent/collab-core';

// ============================================================================
// Awareness State
// ============================================================================

/**
 * Complete awareness state for a participant.
 */
export interface AwarenessState {
  /** User identity */
  user: UserInfo;

  /** Current cursor position */
  cursor: CursorState | null;

  /** Current activity */
  activity: ActivityState;

  /** AI intent (for AI participants only) */
  intent?: IntentState;

  /** Editing region claim */
  editingRegion?: EditingRegion;

  /** Last activity timestamp */
  lastActivity: number;

  /** Yjs client ID */
  clientId: number;
}

/**
 * User identity information.
 */
export interface UserInfo {
  /** Unique user ID */
  id: string;

  /** Display name */
  name: string;

  /** Assigned color (hex) */
  color: string;

  /** Avatar URL (optional) */
  avatar?: string;

  /** User type */
  type: 'human' | 'ai';
}

// ============================================================================
// Cursor State
// ============================================================================

/**
 * Cursor position and selection.
 */
export interface CursorState {
  /** Current file path */
  file: string | null;

  /** Line number (1-indexed) */
  line: number;

  /** Column number (1-indexed) */
  column: number;

  /** Selection range (optional) */
  selection?: SelectionRange;
}

// ============================================================================
// Activity State
// ============================================================================

/** Activity states */
export type ActivityState =
  | 'active'    // Actively editing
  | 'typing'    // Currently typing
  | 'idle'      // Not doing anything
  | 'viewing'   // Just looking
  | 'away'      // Tab not focused
  | 'thinking'  // AI: processing
  | 'executing'; // AI: running action

/**
 * Activity tracking configuration.
 */
export interface ActivityConfig {
  /** Time before considered idle (ms) */
  idleTimeout: number;

  /** Time before considered away (ms) */
  awayTimeout: number;

  /** Heartbeat interval (ms) */
  heartbeatInterval: number;
}

/** Default activity configuration */
export const DEFAULT_ACTIVITY_CONFIG: ActivityConfig = {
  idleTimeout: 60_000,      // 1 minute
  awayTimeout: 300_000,     // 5 minutes
  heartbeatInterval: 5_000, // 5 seconds
};

// ============================================================================
// AI Intent State (lightweight, for awareness)
// ============================================================================

/**
 * AI intent state for awareness broadcast.
 */
export interface IntentState {
  /** Intent summary */
  summary: string;

  /** Intent type */
  type: IntentType;

  /** Target file (optional) */
  targetFile?: string;

  /** Target region (optional) */
  targetRegion?: SelectionRange;

  /** Confidence score (0-1) */
  confidence: number;

  /** Current status */
  status: IntentStatus;
}

/** Intent types */
export type IntentType =
  | 'file_read'
  | 'file_create'
  | 'file_edit'
  | 'file_delete'
  | 'command_run'
  | 'search'
  | 'analyze'
  | 'other';

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
// Editing Region
// ============================================================================

/**
 * Claimed editing region.
 */
export interface EditingRegion {
  /** File being edited */
  file: string;

  /** Start line of region */
  startLine: number;

  /** End line of region */
  endLine: number;
}

// ============================================================================
// Presence Events
// ============================================================================

/** Awareness change event */
export interface AwarenessChangeEvent {
  /** Client IDs that were added */
  added: number[];

  /** Client IDs that were updated */
  updated: number[];

  /** Client IDs that were removed */
  removed: number[];
}

/** Presence event union */
export type PresenceEvent =
  | CursorMoveEvent
  | ActivityChangeEvent
  | IntentDeclaredEvent
  | FileFocusEvent
  | HeartbeatEvent;

export interface CursorMoveEvent {
  type: 'cursor_move';
  participantId: string;
  cursor: CursorState;
  timestamp: number;
}

export interface ActivityChangeEvent {
  type: 'activity_change';
  participantId: string;
  activity: ActivityState;
  timestamp: number;
}

export interface IntentDeclaredEvent {
  type: 'intent_declared';
  participantId: string;
  intent: IntentState;
  timestamp: number;
}

export interface FileFocusEvent {
  type: 'file_focus';
  participantId: string;
  file: string | null;
  timestamp: number;
}

export interface HeartbeatEvent {
  type: 'heartbeat';
  participantId: string;
  timestamp: number;
}

// ============================================================================
// Follow Mode
// ============================================================================

/**
 * Follow mode state.
 */
export interface FollowModeState {
  /** Whether following is enabled */
  enabled: boolean;

  /** User ID being followed */
  targetUserId: string | null;

  /** Auto-switch files */
  autoSwitchFiles: boolean;

  /** Auto-scroll to cursor */
  autoScroll: boolean;
}

// ============================================================================
// Cursor Rendering
// ============================================================================

/**
 * Remote cursor for rendering.
 */
export interface RemoteCursor {
  /** User info */
  user: UserInfo;

  /** Position */
  line: number;
  column: number;

  /** Selection (optional) */
  selection?: SelectionRange;

  /** Current activity */
  activity: ActivityState;

  /** Whether cursor is stale */
  isStale: boolean;
}

/**
 * Cursor decoration options.
 */
export interface CursorDecoration {
  /** CSS class for cursor line */
  cursorClassName: string;

  /** CSS class for selection */
  selectionClassName: string;

  /** CSS class for name label */
  labelClassName: string;

  /** Whether to show name label */
  showLabel: boolean;

  /** Whether to animate cursor */
  animate: boolean;
}

// ============================================================================
// Participant Presence
// ============================================================================

/**
 * Participant presence summary.
 */
export interface ParticipantPresence {
  /** Participant info */
  participant: {
    id: string;
    name: string;
    type: 'human' | 'ai';
    color: string;
  };

  /** Current location */
  location: {
    file: string | null;
    line?: number;
  };

  /** Current activity */
  activity: ActivityState;

  /** Current intent (for AI) */
  intent?: IntentState;

  /** Is participant online */
  isOnline: boolean;

  /** Last seen timestamp */
  lastSeen: number;
}

// ============================================================================
// Presence Metrics
// ============================================================================

/**
 * Presence metrics.
 */
export interface PresenceMetrics {
  /** Total participants */
  totalParticipants: number;

  /** Online participants */
  onlineParticipants: number;

  /** Active participants (not idle) */
  activeParticipants: number;

  /** AI agents */
  aiAgents: number;

  /** Participants per file */
  participantsPerFile: Map<string, number>;

  /** Activity distribution */
  activityDistribution: Record<ActivityState, number>;
}
