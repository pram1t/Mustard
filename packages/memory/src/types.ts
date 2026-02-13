/**
 * OpenAgent V2 - Memory Types
 *
 * Types for persistent memory with SQLite + FTS5 full-text search.
 */

// =============================================================================
// MEMORY TYPES
// =============================================================================

/**
 * Types of memory entries workers can store.
 */
export type MemoryType = 'decision' | 'pattern' | 'convention' | 'failure';

// =============================================================================
// MEMORY ENTRY
// =============================================================================

/**
 * A single memory entry stored in the database.
 */
export interface MemoryEntry {
  /** Unique memory ID (UUID) */
  id: string;

  /** Type of memory */
  type: MemoryType;

  /** Worker ID that created this memory */
  workerId: string;

  /** Project ID this memory belongs to */
  projectId: string;

  /** Short title */
  title: string;

  /** Detailed content / description */
  content: string;

  /** Tags for categorization */
  tags: string[];

  /** When the memory was created */
  createdAt: Date;

  /** How many times this memory has been accessed */
  accessCount: number;

  /** When this memory was last accessed */
  lastAccessed: Date;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// MEMORY INPUT (for creating new entries)
// =============================================================================

/**
 * Input for creating a new memory entry (id, dates, accessCount auto-generated).
 */
export interface MemoryInput {
  type: MemoryType;
  workerId: string;
  projectId: string;
  title: string;
  content: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// =============================================================================
// MEMORY QUERY
// =============================================================================

/**
 * Query options for filtering memories.
 */
export interface MemoryQuery {
  /** Filter by memory type */
  type?: MemoryType;

  /** Filter by worker ID */
  workerId?: string;

  /** Filter by project ID */
  projectId?: string;

  /** Filter by tags (any match) */
  tags?: string[];

  /** Maximum results */
  limit?: number;

  /** Sort order */
  orderBy?: 'createdAt' | 'lastAccessed' | 'accessCount';

  /** Sort direction */
  order?: 'asc' | 'desc';
}

/**
 * Full-text search result with relevance score.
 */
export interface SearchResult {
  entry: MemoryEntry;
  score: number;
}

// =============================================================================
// MEMORY STORE INTERFACE
// =============================================================================

/**
 * Interface for the memory persistence store.
 */
export interface IMemoryStore {
  /**
   * Store a new memory entry.
   */
  store(input: MemoryInput): MemoryEntry;

  /**
   * Get a memory entry by ID. Updates access count.
   */
  get(id: string): MemoryEntry | null;

  /**
   * Query memories with filters.
   */
  query(opts: MemoryQuery): MemoryEntry[];

  /**
   * Full-text search across titles and content.
   */
  search(text: string, limit?: number): SearchResult[];

  /**
   * Update an existing memory entry.
   */
  update(id: string, updates: Partial<MemoryInput>): MemoryEntry | null;

  /**
   * Delete a memory entry.
   */
  delete(id: string): boolean;

  /**
   * Get the total count of memories.
   */
  count(projectId?: string): number;

  /**
   * Close the database connection.
   */
  close(): void;
}

// =============================================================================
// CONTEXT BUILDER OPTIONS
// =============================================================================

/**
 * Options for building context from memories.
 */
export interface ContextBuildOptions {
  /** Project ID to scope memories */
  projectId: string;

  /** Worker ID to prioritize relevant memories */
  workerId?: string;

  /** Memory types to include */
  types?: MemoryType[];

  /** Maximum memories to include */
  maxMemories?: number;

  /** Optional search text to find relevant memories */
  searchText?: string;
}
