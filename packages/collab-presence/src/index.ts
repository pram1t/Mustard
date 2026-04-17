/**
 * @openagent/collab-presence
 *
 * Real-time presence, cursors, and activity tracking for OpenAgent Collab.
 */

// ── Types ───────────────────────────────────────────────────────────────────
export type {
  // Awareness
  AwarenessState,
  UserInfo,

  // Cursor
  CursorState,

  // Activity
  ActivityState,
  ActivityConfig,

  // Intent (lightweight awareness version)
  IntentState,
  IntentType,
  IntentStatus,

  // Editing region
  EditingRegion,

  // Presence events
  AwarenessChangeEvent,
  PresenceEvent,
  CursorMoveEvent,
  ActivityChangeEvent,
  IntentDeclaredEvent,
  FileFocusEvent,
  HeartbeatEvent,

  // Follow mode
  FollowModeState,

  // Cursor rendering
  RemoteCursor,
  CursorDecoration,

  // Participant presence
  ParticipantPresence,

  // Metrics
  PresenceMetrics,
} from './types.js';

export { DEFAULT_ACTIVITY_CONFIG } from './types.js';

// ── Awareness Manager ───────────────────────────────────────────────────────
export { AwarenessManager } from './awareness-manager.js';

// ── Activity Tracker ────────────────────────────────────────────────────────
export { ActivityTracker } from './activity-tracker.js';

// ── Cursor Tracker ──────────────────────────────────────────────────────────
export { CursorTracker } from './cursor-tracker.js';

// ── Follow Manager ──────────────────────────────────────────────────────────
export { FollowManager } from './follow-manager.js';
