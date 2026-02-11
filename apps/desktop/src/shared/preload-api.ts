/**
 * Preload API Definitions
 *
 * Defines the minimal API exposed to the renderer via contextBridge.
 * This is the ONLY interface between untrusted renderer and trusted main process.
 *
 * Design Principles:
 * - Minimal surface: < 15 methods total
 * - No Node.js access: Renderer cannot access fs, child_process, etc.
 * - Type-safe: Full TypeScript types for all methods
 * - Async-only: All methods return Promises (IPC is async)
 */

import type { AgentEvent } from './event-types';

// =============================================================================
// PRELOAD API INTERFACE
// =============================================================================

/**
 * The API exposed to window.api in the renderer.
 * This is the complete interface - nothing else is exposed.
 */
export interface PreloadAPI {
  // ─────────────────────────────────────────────────────────────────────────────
  // Agent Operations (4 methods)
  // ─────────────────────────────────────────────────────────────────────────────

  chat(message: string): Promise<void>;
  stop(): Promise<void>;
  onEvent(callback: (event: AgentEvent) => void): () => void;
  getStatus(): Promise<AgentStatusInfo>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Configuration (4 methods)
  // ─────────────────────────────────────────────────────────────────────────────

  getConfig(): Promise<SafeConfig>;
  setConfig(config: Partial<SafeConfig>): Promise<void>;
  getProviders(): Promise<ProviderInfo[]>;
  getModels(providerId: string): Promise<ModelInfo[]>;

  // ─────────────────────────────────────────────────────────────────────────────
  // MCP Management (3 methods)
  // ─────────────────────────────────────────────────────────────────────────────

  getMCPServers(): Promise<MCPServerInfo[]>;
  setMCPServer(server: MCPServerInput): Promise<string>;
  removeMCPServer(serverId: string): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Window Controls (3 methods)
  // ─────────────────────────────────────────────────────────────────────────────

  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Application (1 method)
  // ─────────────────────────────────────────────────────────────────────────────

  getAppInfo(): Promise<AppInfo>;
}

// =============================================================================
// SUPPORTING TYPES
// =============================================================================

export interface AgentStatusInfo {
  state: 'idle' | 'busy' | 'error';
  currentOperation?: string;
  error?: string;
}

export interface SafeConfig {
  provider: string;
  model: string;
  hasApiKey: boolean;
  theme: 'light' | 'dark' | 'system';
  shortcuts: ShortcutConfig;
  ui: UIConfig;
}

export interface ShortcutConfig {
  focusChat: string;
  sendMessage: string;
  stopAgent: string;
  openSettings: string;
}

export interface UIConfig {
  fontSize: 'small' | 'medium' | 'large';
  expandToolCalls: boolean;
  soundEnabled: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  requiresApiKey: boolean;
  hasApiKey: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  maxOutput: number;
  capabilities: ModelCapabilities;
}

export interface ModelCapabilities {
  tools: boolean;
  vision: boolean;
  thinking: boolean;
}

export interface MCPServerInfo {
  id: string;
  name: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  tools: MCPToolInfo[];
  error?: string;
}

export interface MCPToolInfo {
  name: string;
  description: string;
}

export interface MCPServerInput {
  id?: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface AppInfo {
  version: string;
  platform: NodeJS.Platform;
  arch: string;
  isDev: boolean;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isEventCallback(
  fn: unknown
): fn is (event: AgentEvent) => void {
  return typeof fn === 'function';
}

export function isSafeConfig(obj: unknown): obj is Partial<SafeConfig> {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const config = obj as Record<string, unknown>;

  if ('provider' in config && typeof config.provider !== 'string') {
    return false;
  }
  if ('model' in config && typeof config.model !== 'string') {
    return false;
  }
  if ('theme' in config) {
    const validThemes = ['light', 'dark', 'system'];
    if (!validThemes.includes(config.theme as string)) {
      return false;
    }
  }

  return true;
}

export function isMCPServerInput(obj: unknown): obj is MCPServerInput {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const server = obj as Record<string, unknown>;

  if (typeof server.name !== 'string' || server.name.length === 0) {
    return false;
  }
  if (typeof server.command !== 'string' || server.command.length === 0) {
    return false;
  }
  if ('args' in server && !Array.isArray(server.args)) {
    return false;
  }

  return true;
}

// =============================================================================
// METHOD COUNT VALIDATION
// =============================================================================

/**
 * Total preload methods: 15
 * Design constraint: Must be < 15 to minimize attack surface.
 * Count: chat, stop, onEvent, getStatus, getConfig, setConfig, getProviders,
 *        getModels, getMCPServers, setMCPServer, removeMCPServer,
 *        minimize, toggleMaximize, close, getAppInfo = 15 methods
 */
export const PRELOAD_METHOD_COUNT = 15;

// =============================================================================
// WINDOW TYPE AUGMENTATION
// =============================================================================

declare global {
  interface Window {
    api: PreloadAPI;
  }
}

export {};
