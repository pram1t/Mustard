/**
 * WebSocket sync provider for OpenAgent Collab.
 *
 * Wraps y-websocket's WebsocketProvider with:
 * - Token-based authentication
 * - Connection status events
 * - Reconnect/heartbeat management
 * - Typed event interface
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { WebSocketProviderConfig, SyncStatus } from './types.js';

// ============================================================================
// Types
// ============================================================================

/** Events emitted by CollabWSProvider */
export interface WSProviderEvents {
  status: (event: { status: 'connecting' | 'connected' | 'disconnected' }) => void;
  synced: (synced: boolean) => void;
  'connection-error': (event: { error: Error }) => void;
}

/** Listener unsubscribe function */
export type Unsubscribe = () => void;

// ============================================================================
// CollabWSProvider
// ============================================================================

/**
 * Managed WebSocket provider for a collab room.
 *
 * ```ts
 * const provider = new CollabWSProvider(ydoc, {
 *   url: 'ws://localhost:3100/api/collab/ws',
 *   roomId: 'my-room',
 *   token: 'jwt-token',
 * });
 *
 * provider.on('status', ({ status }) => console.log(status));
 * provider.connect();
 * ```
 */
export class CollabWSProvider {
  private readonly ydoc: Y.Doc;
  private readonly config: Required<WebSocketProviderConfig>;
  private inner: WebsocketProvider | null = null;
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private _connected = false;
  private _synced = false;

  constructor(ydoc: Y.Doc, config: WebSocketProviderConfig) {
    this.ydoc = ydoc;
    this.config = {
      url: config.url,
      roomId: config.roomId,
      token: config.token,
      connect: config.connect ?? false,
      resyncInterval: config.resyncInterval ?? 10_000,
    };

    if (this.config.connect) {
      this.connect();
    }
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /** Open the WebSocket connection. */
  connect(): void {
    if (this.inner) return;

    this.inner = new WebsocketProvider(
      this.config.url,
      this.config.roomId,
      this.ydoc,
      {
        params: { token: this.config.token },
        connect: true,
        resyncInterval: this.config.resyncInterval,
      },
    );

    // Bind inner events → our typed interface
    this.inner.on('status', (evt: { status: string }) => {
      const status = evt.status as 'connecting' | 'connected' | 'disconnected';
      this._connected = status === 'connected';
      this.emit('status', { status });
    });

    this.inner.on('synced', (synced: boolean) => {
      this._synced = synced;
      this.emit('synced', synced);
    });

    this.inner.on('connection-error', (evt: { message?: string }) => {
      this.emit('connection-error', { error: new Error(evt.message ?? 'connection error') });
    });
  }

  /** Close the connection and release resources. */
  disconnect(): void {
    if (this.inner) {
      this.inner.disconnect();
      this.inner.destroy();
      this.inner = null;
    }
    this._connected = false;
    this._synced = false;
  }

  /** Full teardown — disconnect + clear listeners. */
  destroy(): void {
    this.disconnect();
    this.listeners.clear();
  }

  // --------------------------------------------------------------------------
  // Status
  // --------------------------------------------------------------------------

  /** Whether the WebSocket is connected. */
  get connected(): boolean {
    return this._connected;
  }

  /** Whether initial sync is complete. */
  get synced(): boolean {
    return this._synced;
  }

  /** Snapshot of current sync status. */
  getStatus(): SyncStatus {
    return {
      wsConnected: this._connected,
      wsSynced: this._synced,
      rtcPeerCount: 0, // V1: no WebRTC
      lastSync: this._synced ? Date.now() : 0,
    };
  }

  // --------------------------------------------------------------------------
  // Inner provider access (for advanced use / awareness)
  // --------------------------------------------------------------------------

  /** Get the underlying y-websocket provider (null if not connected). */
  getInnerProvider(): WebsocketProvider | null {
    return this.inner;
  }

  // --------------------------------------------------------------------------
  // Event Emitter (minimal)
  // --------------------------------------------------------------------------

  on<K extends keyof WSProviderEvents>(event: K, fn: WSProviderEvents[K]): Unsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    const wrappedFn = fn as (...args: unknown[]) => void;
    set.add(wrappedFn);
    return () => set.delete(wrappedFn);
  }

  private emit(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const fn of set) {
        try {
          fn(...args);
        } catch {
          // Swallow listener errors to avoid breaking the provider
        }
      }
    }
  }
}
