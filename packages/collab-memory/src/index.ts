/**
 * @mustard/collab-memory
 *
 * 4-layer shared memory system for OpenAgent Collab.
 */

// ============================================================================
// Classes
// ============================================================================

export { EphemeralMemory } from './ephemeral.js';
export type { EphemeralMemoryOptions } from './ephemeral.js';

export { SessionMemory } from './session.js';
export type {
  SessionMemoryOptions,
  CreateSessionInput,
  EndSessionInput,
  AppendEntryInput,
} from './session.js';

export { ProjectMemory } from './project.js';
export type {
  ProjectMemoryOptions,
  AddProjectEntryInput,
  UpdateProjectEntryInput,
  ProjectSearchOptions,
  ProjectSearchHit,
} from './project.js';

export { TeamMemory } from './team.js';
export type {
  TeamMemoryOptions,
  AddTeamEntryInput,
  UpdateTeamEntryInput,
  ListTeamEntriesFilter,
} from './team.js';

export { ContextAssembler, approxTokens } from './context-assembler.js';
export type { ContextAssemblerOptions } from './context-assembler.js';

export { Summarizer } from './summarizer.js';
export type {
  SummarizerOptions,
  SummarizeInput,
  CompleteFn,
} from './summarizer.js';

// ============================================================================
// Types
// ============================================================================

export type {
  // Memory layers
  MemoryLayer,

  // Layer 1: Ephemeral
  EphemeralMemorySnapshot,
  CursorSnapshot,
  IntentSnapshot,
  ThreadMessage,

  // Layer 2: Session
  SessionEntry,
  SessionEntryType,
  SessionSummary,

  // Layer 3: Project
  ProjectEntry,
  ProjectCategory,

  // Layer 4: Team (stub)
  TeamEntry,

  // Context assembly
  ContextAssemblyConfig,
  AssembledContext,

  // Search
  MemorySearchQuery,
  MemorySearchResult,
} from './types.js';

export { DEFAULT_CONTEXT_CONFIG } from './types.js';
