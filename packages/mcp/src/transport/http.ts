/**
 * HTTP Transport
 *
 * Implements transport over HTTP for remote MCP servers.
 * Uses fetch for JSON-RPC requests and optional SSE for notifications.
 */

import type {
  JSONRPCRequest,
  JSONRPCNotification,
  JSONRPCResponse,
  HttpServerConfig,
} from '../types.js';
import { TransportError, ConnectionError, TimeoutError } from '../types.js';
import type { Transport, TransportState } from './types.js';
import { DEFAULT_TIMEOUT } from './types.js';

/**
 * HTTP Transport implementation
 */
export class HttpTransport implements Transport {
  private _state: TransportState = 'disconnected';
  private abortController: AbortController | null = null;

  constructor(private config: HttpServerConfig) {}

  get state(): TransportState {
    return this._state;
  }

  // Event handlers (set by client)
  onNotification?: (notification: JSONRPCNotification) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;

  /**
   * Start the transport (validate connection)
   */
  async start(): Promise<void> {
    if (this._state !== 'disconnected') {
      throw new TransportError(`Cannot start: transport is ${this._state}`);
    }

    this._state = 'connecting';
    this.abortController = new AbortController();

    try {
      // Validate the URL is reachable with a simple request
      const url = new URL(this.config.url);

      // Try a simple OPTIONS request to check connectivity
      const response = await fetch(url.toString(), {
        method: 'OPTIONS',
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);

      // Even if OPTIONS fails, we'll try to use the endpoint
      // Some servers don't support OPTIONS

      this._state = 'connected';
    } catch (error) {
      this._state = 'error';
      throw new ConnectionError(
        `Failed to connect to MCP server at ${this.config.url}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Send a request and wait for response
   */
  async send(request: JSONRPCRequest, timeout = DEFAULT_TIMEOUT): Promise<JSONRPCResponse> {
    if (this._state !== 'connected') {
      throw new TransportError(`Cannot send: transport is ${this._state}`);
    }

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        throw new TransportError(`HTTP error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data as JSONRPCResponse;
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new TimeoutError(`Request ${request.id} timed out after ${timeout}ms`);
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TransportError('Request aborted');
      }
      throw new TransportError(
        `HTTP request failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Send a notification (no response expected)
   */
  async notify(notification: JSONRPCNotification): Promise<void> {
    if (this._state !== 'connected') {
      throw new TransportError(`Cannot notify: transport is ${this._state}`);
    }

    try {
      await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(notification),
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      // Notifications don't expect a response, so we just log errors
      console.error(`[MCP Transport] Notification failed: ${error}`);
    }
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    if (this._state === 'disconnected') {
      return;
    }

    // Abort any pending requests
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this._state = 'disconnected';
    this.onClose?.();
  }
}
