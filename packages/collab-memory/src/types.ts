/**
 * Shared memory types for OpenAgent Collab.
 *
 * Types for the 4-layer memory system: ephemeral, session, project, team.
 */

// ============================================================================
// Memory Layers
// ============================================================================

/** Memory layer identifiers */
export type MemoryLayer = 'ephemeral' | 'session' | 'project' | 'team';

/**
 * Layer 1: Ephemeral memory snapshot — the data shape produced by
 * EphemeralMemory.snapshot(). The class itself is also called
 * `EphemeralMemory`, hence the suffix on the interface.
 */
export interface EphemeralMemorySnapshot {
  /** Current cursor positions */
  cursors: Map<string, CursorSnapshot>;

  /** Active intents */
  intents: Map<string, IntentSnapshot>;

  /** Conversation thread */
  thread: ThreadMessage[];
}

/** Cursor snapshot for ephemeral memory */
export interface CursorSnapshot {
  participantId: string;
  file: string | null;
  line: number;
  column: number;
  timestamp: number;
}

/** Intent snapshot for ephemeral memory */
export interface IntentSnapshot {
  intentId: string;
  agentId: string;
  summary: string;
  status: string;
  timestamp: number;
}

/** Thread message for ephemeral memory */
export interface ThreadMessage {
  id: string;
  participantId: string;
  participantName: string;
  content: string;
  timestamp: number;
}

// ============================================================================
// Layer 2: Session Memory — SQLite, this work session
// ============================================================================

/**
 * Session memory entry.
 */
export interface SessionEntry {
  /** Entry ID */
  id: string;

  /** Room ID */
  roomId: string;

  /** Session ID */
  sessionId: string;

  /** Entry type */
  type: SessionEntryType;

  /** Content */
  content: string;

  /** Metadata */
  metadata: Record<string, unknown>;

  /** Participant who created this */
  participantId: string;

  /** Timestamp */
  createdAt: Date;
}

/** Session entry types */
export type SessionEntryType =
  | 'message'    // Chat message
  | 'decision'   // Key decision made
  | 'action'     // Action taken (file edit, command run, etc.)
  | 'intent'     // AI intent lifecycle
  | 'note';      // Manual note

/**
 * Session summary — created when session ends.
 */
export interface SessionSummary {
  /** Session ID */
  sessionId: string;

  /** Room ID */
  roomId: string;

  /** Summary text (LLM-generated) */
  summary: string;

  /** Key decisions made */
  decisions: string[];

  /** Files modified */
  filesModified: string[];

  /** Participants involved */
  participants: string[];

  /** Session start */
  startedAt: Date;

  /** Session end */
  endedAt: Date;

  /** Duration in seconds */
  durationSeconds: number;
}

// ============================================================================
// Layer 3: Project Memory — SQLite + FTS5, persistent
// ============================================================================

/**
 * Project memory entry.
 */
export interface ProjectEntry {
  /** Entry ID */
  id: string;

  /** Room ID (or project ID) */
  roomId: string;

  /** Entry category */
  category: ProjectCategory;

  /** Title/key */
  title: string;

  /** Content */
  content: string;

  /** Tags for search */
  tags: string[];

  /** Who created this */
  createdBy: string;

  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

/** Project memory categories */
export type ProjectCategory =
  | 'architecture'  // Architecture decisions
  | 'convention'    // Coding conventions
  | 'decision'      // Key decisions
  | 'pattern'       // Recurring patterns
  | 'knowledge'     // Domain knowledge
  | 'todo'          // Pending items
  | 'other';

// ============================================================================
// Layer 4: Team Memory — stub for V1
// ============================================================================

/**
 * Team memory entry (stub for V1).
 */
export interface TeamEntry {
  /** Entry ID */
  id: string;

  /** Team identifier */
  teamId: string;

  /** Category */
  category: string;

  /** Content */
  content: string;

  /** Who created this */
  createdBy: string;

  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Context Assembly
// ============================================================================

/**
 * Context assembly configuration.
 */
export interface ContextAssemblyConfig {
  /** Max token budget for assembled context */
  maxTokens: number;

  /** Token allocation per layer */
  layerBudgets: Record<MemoryLayer, number>;

  /** Whether to include ephemeral data */
  includeEphemeral: boolean;

  /** Number of recent sessions to include */
  recentSessionCount: number;
}

/** Default context assembly config */
export const DEFAULT_CONTEXT_CONFIG: ContextAssemblyConfig = {
  maxTokens: 4000,
  layerBudgets: {
    ephemeral: 500,
    session: 1500,
    project: 1500,
    team: 500,
  },
  includeEphemeral: true,
  recentSessionCount: 3,
};

/**
 * Assembled context for AI injection.
 */
export interface AssembledContext {
  /** Layer contributions */
  layers: {
    ephemeral?: string;
    session?: string;
    project?: string;
    team?: string;
  };

  /** Total token count */
  tokenCount: number;

  /** Assembly timestamp */
  assembledAt: Date;
}

// ============================================================================
// Search
// ============================================================================

/**
 * Memory search query.
 */
export interface MemorySearchQuery {
  /** Search text */
  query: string;

  /** Layers to search */
  layers?: MemoryLayer[];

  /** Room ID filter */
  roomId?: string;

  /** Category filter (for project layer) */
  category?: ProjectCategory;

  /** Max results */
  limit?: number;
}

/**
 * Memory search result.
 */
export interface MemorySearchResult {
  /** Source layer */
  layer: MemoryLayer;

  /** Entry ID */
  id: string;

  /** Content snippet */
  snippet: string;

  /** Relevance score */
  score: number;

  /** Entry category */
  category?: string;

  /** Timestamp */
  timestamp: Date;
}
