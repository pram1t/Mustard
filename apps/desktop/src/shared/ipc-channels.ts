/**
 * IPC Channel Definitions
 *
 * Strict allowlist of IPC channels for Desktop -v1.
 * All channels must be explicitly defined here - no dynamic channel creation.
 *
 * Design Principles:
 * - Transport only: Channels forward messages, don't transform them
 * - Minimal surface: < 20 channels total
 * - Grouped by concern: Agent, Config, MCP, Window, App
 */

// =============================================================================
// CHANNEL DEFINITIONS
// =============================================================================

/**
 * All permitted IPC channels.
 * Adding a new channel requires explicit addition here.
 */
export const IPC_CHANNELS = {
  // ─────────────────────────────────────────────────────────────────────────────
  // Agent Operations (Core functionality)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Send a chat message to the agent */
  AGENT_CHAT: 'agent:chat',

  /** Stop the current agent operation */
  AGENT_STOP: 'agent:stop',

  /** Event stream from agent to renderer */
  AGENT_EVENT: 'agent:event',

  /** Get current agent status */
  AGENT_STATUS: 'agent:status',

  // ─────────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────────

  /** Get current configuration */
  CONFIG_GET: 'config:get',

  /** Update configuration */
  CONFIG_SET: 'config:set',

  /** Get available LLM providers */
  CONFIG_GET_PROVIDERS: 'config:getProviders',

  /** Get available models for a provider */
  CONFIG_GET_MODELS: 'config:getModels',

  /** Set API key for a provider (encrypted storage) */
  CONFIG_SET_API_KEY: 'config:setApiKey',

  /** Remove API key for a provider */
  CONFIG_REMOVE_API_KEY: 'config:removeApiKey',

  // ─────────────────────────────────────────────────────────────────────────────
  // MCP (Model Context Protocol)
  // ─────────────────────────────────────────────────────────────────────────────

  /** List configured MCP servers */
  MCP_LIST: 'mcp:list',

  /** Add a new MCP server */
  MCP_ADD: 'mcp:add',

  /** Remove an MCP server */
  MCP_REMOVE: 'mcp:remove',

  /** Get MCP server status */
  MCP_STATUS: 'mcp:status',

  /** Restart an MCP server */
  MCP_RESTART: 'mcp:restart',

  // ─────────────────────────────────────────────────────────────────────────────
  // Window Management
  // ─────────────────────────────────────────────────────────────────────────────

  /** Minimize the window */
  WINDOW_MINIMIZE: 'window:minimize',

  /** Maximize/restore the window */
  WINDOW_MAXIMIZE: 'window:maximize',

  /** Close the window */
  WINDOW_CLOSE: 'window:close',

  /** Check if window is maximized */
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',

  // ─────────────────────────────────────────────────────────────────────────────
  // Application
  // ─────────────────────────────────────────────────────────────────────────────

  /** Get application version */
  APP_VERSION: 'app:version',

  /** Check for updates */
  APP_CHECK_UPDATE: 'app:checkUpdate',

  /** Quit the application */
  APP_QUIT: 'app:quit',

} as const;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Union type of all valid channel names.
 * Used for type-safe channel references.
 */
export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

/**
 * Channels that use invoke/handle pattern (request/response).
 */
export type InvokeChannel =
  | typeof IPC_CHANNELS.AGENT_CHAT
  | typeof IPC_CHANNELS.AGENT_STOP
  | typeof IPC_CHANNELS.AGENT_STATUS
  | typeof IPC_CHANNELS.CONFIG_GET
  | typeof IPC_CHANNELS.CONFIG_SET
  | typeof IPC_CHANNELS.CONFIG_GET_PROVIDERS
  | typeof IPC_CHANNELS.CONFIG_GET_MODELS
  | typeof IPC_CHANNELS.CONFIG_SET_API_KEY
  | typeof IPC_CHANNELS.CONFIG_REMOVE_API_KEY
  | typeof IPC_CHANNELS.MCP_LIST
  | typeof IPC_CHANNELS.MCP_ADD
  | typeof IPC_CHANNELS.MCP_REMOVE
  | typeof IPC_CHANNELS.MCP_STATUS
  | typeof IPC_CHANNELS.MCP_RESTART
  | typeof IPC_CHANNELS.WINDOW_MINIMIZE
  | typeof IPC_CHANNELS.WINDOW_MAXIMIZE
  | typeof IPC_CHANNELS.WINDOW_CLOSE
  | typeof IPC_CHANNELS.WINDOW_IS_MAXIMIZED
  | typeof IPC_CHANNELS.APP_VERSION
  | typeof IPC_CHANNELS.APP_CHECK_UPDATE
  | typeof IPC_CHANNELS.APP_QUIT;

/**
 * Channels that use send/on pattern (one-way events).
 */
export type EventChannel =
  | typeof IPC_CHANNELS.AGENT_EVENT;

// =============================================================================
// CHANNEL VALIDATION
// =============================================================================

/**
 * Set of all valid channels for O(1) lookup.
 */
export const VALID_CHANNELS = new Set<string>(Object.values(IPC_CHANNELS));

/**
 * Validates that a channel name is in the allowlist.
 */
export function isValidChannel(channel: string): channel is IPCChannel {
  return VALID_CHANNELS.has(channel);
}

/**
 * Asserts that a channel is valid, throwing if not.
 */
export function assertValidChannel(channel: string): asserts channel is IPCChannel {
  if (!isValidChannel(channel)) {
    throw new Error(
      `Invalid IPC channel: "${channel}". ` +
      `Only channels defined in IPC_CHANNELS are permitted.`
    );
  }
}

// =============================================================================
// REQUEST/RESPONSE TYPE MAPPING
// =============================================================================

/**
 * Maps channels to their request payload types.
 */
export interface IPCRequestMap {
  [IPC_CHANNELS.AGENT_CHAT]: { message: string };
  [IPC_CHANNELS.AGENT_STOP]: void;
  [IPC_CHANNELS.AGENT_STATUS]: void;
  [IPC_CHANNELS.CONFIG_GET]: void;
  [IPC_CHANNELS.CONFIG_SET]: { config: Record<string, unknown> };
  [IPC_CHANNELS.CONFIG_GET_PROVIDERS]: void;
  [IPC_CHANNELS.CONFIG_GET_MODELS]: { provider: string };
  [IPC_CHANNELS.CONFIG_SET_API_KEY]: { provider: string; apiKey: string };
  [IPC_CHANNELS.CONFIG_REMOVE_API_KEY]: { provider: string };
  [IPC_CHANNELS.MCP_LIST]: void;
  [IPC_CHANNELS.MCP_ADD]: { server: MCPServerConfig };
  [IPC_CHANNELS.MCP_REMOVE]: { serverId: string };
  [IPC_CHANNELS.MCP_STATUS]: { serverId: string };
  [IPC_CHANNELS.MCP_RESTART]: { serverId: string };
  [IPC_CHANNELS.WINDOW_MINIMIZE]: void;
  [IPC_CHANNELS.WINDOW_MAXIMIZE]: void;
  [IPC_CHANNELS.WINDOW_CLOSE]: void;
  [IPC_CHANNELS.WINDOW_IS_MAXIMIZED]: void;
  [IPC_CHANNELS.APP_VERSION]: void;
  [IPC_CHANNELS.APP_CHECK_UPDATE]: void;
  [IPC_CHANNELS.APP_QUIT]: void;
}

/**
 * Maps channels to their response types.
 */
export interface IPCResponseMap {
  [IPC_CHANNELS.AGENT_CHAT]: { success: boolean };
  [IPC_CHANNELS.AGENT_STOP]: { success: boolean };
  [IPC_CHANNELS.AGENT_STATUS]: AgentStatus;
  [IPC_CHANNELS.CONFIG_GET]: AppConfig;
  [IPC_CHANNELS.CONFIG_SET]: { success: boolean };
  [IPC_CHANNELS.CONFIG_GET_PROVIDERS]: ProviderInfo[];
  [IPC_CHANNELS.CONFIG_GET_MODELS]: ModelInfo[];
  [IPC_CHANNELS.CONFIG_SET_API_KEY]: { success: boolean };
  [IPC_CHANNELS.CONFIG_REMOVE_API_KEY]: { success: boolean };
  [IPC_CHANNELS.MCP_LIST]: MCPServerInfo[];
  [IPC_CHANNELS.MCP_ADD]: { success: boolean; serverId: string };
  [IPC_CHANNELS.MCP_REMOVE]: { success: boolean };
  [IPC_CHANNELS.MCP_STATUS]: MCPServerStatus;
  [IPC_CHANNELS.MCP_RESTART]: { success: boolean };
  [IPC_CHANNELS.WINDOW_MINIMIZE]: void;
  [IPC_CHANNELS.WINDOW_MAXIMIZE]: void;
  [IPC_CHANNELS.WINDOW_CLOSE]: void;
  [IPC_CHANNELS.WINDOW_IS_MAXIMIZED]: boolean;
  [IPC_CHANNELS.APP_VERSION]: string;
  [IPC_CHANNELS.APP_CHECK_UPDATE]: UpdateInfo | null;
  [IPC_CHANNELS.APP_QUIT]: void;
}

// =============================================================================
// SUPPORTING TYPES
// =============================================================================

interface AgentStatus {
  state: 'idle' | 'busy' | 'error';
  currentTask?: string;
}

interface AppConfig {
  provider: string;
  model: string;
  apiKey?: string;
  theme: 'light' | 'dark' | 'system';
}

interface ProviderInfo {
  id: string;
  name: string;
  requiresApiKey: boolean;
}

interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
}

interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface MCPServerInfo {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  tools: string[];
}

interface MCPServerStatus {
  id: string;
  status: 'connected' | 'disconnected' | 'error';
  lastError?: string;
  uptime?: number;
}

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
}

// =============================================================================
// CHANNEL COUNT VALIDATION
// =============================================================================

/**
 * Total number of IPC channels.
 * Design constraint: Must be < 25 to minimize attack surface.
 */
export const CHANNEL_COUNT = Object.keys(IPC_CHANNELS).length;
