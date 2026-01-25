/**
 * Transport Interface
 *
 * Abstract interface for MCP transport implementations.
 * Transports handle the low-level communication with MCP servers.
 */

import type {
  JSONRPCRequest,
  JSONRPCNotification,
  JSONRPCResponse,
} from '../types.js';

/**
 * Transport state
 */
export type TransportState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Transport interface
 *
 * Implementations must provide:
 * - start(): Begin the connection
 * - send(): Send a request and wait for response
 * - notify(): Send a notification (no response)
 * - close(): Terminate the connection
 */
export interface Transport {
  /**
   * Current transport state
   */
  readonly state: TransportState;

  /**
   * Start the transport connection
   */
  start(): Promise<void>;

  /**
   * Send a JSON-RPC request and wait for response
   *
   * @param request - The request to send
   * @param timeout - Optional timeout in milliseconds
   * @returns The response from the server
   */
  send(request: JSONRPCRequest, timeout?: number): Promise<JSONRPCResponse>;

  /**
   * Send a JSON-RPC notification (no response expected)
   *
   * @param notification - The notification to send
   */
  notify(notification: JSONRPCNotification): Promise<void>;

  /**
   * Close the transport connection
   */
  close(): Promise<void>;

  /**
   * Event handler for server-initiated notifications
   */
  onNotification?: (notification: JSONRPCNotification) => void;

  /**
   * Event handler for transport errors
   */
  onError?: (error: Error) => void;

  /**
   * Event handler for connection close
   */
  onClose?: () => void;
}

/**
 * Default timeout for requests (30 seconds)
 */
export const DEFAULT_TIMEOUT = 30000;
