/**
 * STDIO Transport
 *
 * Implements transport over stdin/stdout for local MCP servers.
 * Spawns a child process and communicates via JSON-RPC over stdio.
 */

import { spawn, ChildProcess } from 'child_process';
import { createInterface, Interface } from 'readline';
import type {
  JSONRPCRequest,
  JSONRPCNotification,
  JSONRPCResponse,
  JSONRPCMessage,
  StdioServerConfig,
} from '../types.js';
import { TransportError, ConnectionError, TimeoutError } from '../types.js';
import type { Transport, TransportState } from './types.js';
import { DEFAULT_TIMEOUT } from './types.js';
import { filterEnvVars } from '@mustard/core';

/**
 * Pending request tracker
 */
interface PendingRequest {
  resolve: (response: JSONRPCResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * STDIO Transport implementation
 */
export class StdioTransport implements Transport {
  private process: ChildProcess | null = null;
  private readline: Interface | null = null;
  private pendingRequests: Map<string | number, PendingRequest> = new Map();
  private _state: TransportState = 'disconnected';
  private buffer = '';

  constructor(private config: StdioServerConfig) {}

  get state(): TransportState {
    return this._state;
  }

  // Event handlers (set by client)
  onNotification?: (notification: JSONRPCNotification) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;

  /**
   * Start the transport by spawning the child process
   */
  async start(): Promise<void> {
    if (this._state !== 'disconnected') {
      throw new TransportError(`Cannot start: transport is ${this._state}`);
    }

    this._state = 'connecting';

    try {
      // Parse the command
      const [command, ...defaultArgs] = this.config.command.split(' ');
      const args = [...defaultArgs, ...(this.config.args || [])];

      // Use filtered environment to prevent credential leakage to MCP servers
      const safeEnv = filterEnvVars();

      // Spawn the process with safe environment
      this.process = spawn(command, args, {
        cwd: this.config.cwd,
        env: { ...safeEnv, ...this.config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Set up stdout reader
      if (this.process.stdout) {
        this.readline = createInterface({
          input: this.process.stdout,
          crlfDelay: Infinity,
        });

        this.readline.on('line', (line) => this.handleLine(line));
      }

      // Set up stderr for debugging
      if (this.process.stderr) {
        this.process.stderr.on('data', (data: Buffer) => {
          // Log stderr but don't treat as error
          const message = data.toString().trim();
          if (message) {
            console.error(`[MCP Server] ${message}`);
          }
        });
      }

      // Handle process events
      this.process.on('error', (error) => {
        this._state = 'error';
        this.rejectAllPending(new ConnectionError(`Process error: ${error.message}`, error));
        this.onError?.(error);
      });

      this.process.on('exit', (code, signal) => {
        this._state = 'disconnected';
        const message = signal
          ? `Process killed by signal ${signal}`
          : `Process exited with code ${code}`;
        this.rejectAllPending(new ConnectionError(message));
        this.onClose?.();
      });

      // Wait a bit for process to start
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (this.process?.killed || this._state === 'error') {
            reject(new ConnectionError('Process failed to start'));
          } else {
            this._state = 'connected';
            resolve();
          }
        }, 100);

        this.process?.on('error', (error) => {
          clearTimeout(timeout);
          reject(new ConnectionError(`Failed to start process: ${error.message}`, error));
        });
      });

    } catch (error) {
      this._state = 'error';
      throw new ConnectionError(
        `Failed to start MCP server: ${error instanceof Error ? error.message : String(error)}`,
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

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new TimeoutError(`Request ${request.id} timed out after ${timeout}ms`));
      }, timeout);

      // Track pending request
      this.pendingRequests.set(request.id, { resolve, reject, timer });

      // Send the request
      this.write(request);
    });
  }

  /**
   * Send a notification (no response expected)
   */
  async notify(notification: JSONRPCNotification): Promise<void> {
    if (this._state !== 'connected') {
      throw new TransportError(`Cannot notify: transport is ${this._state}`);
    }

    this.write(notification);
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    if (this._state === 'disconnected') {
      return;
    }

    // Reject all pending requests
    this.rejectAllPending(new TransportError('Transport closed'));

    // Clean up readline
    if (this.readline) {
      this.readline.close();
      this.readline = null;
    }

    // Kill the process
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');

      // Force kill after timeout
      await new Promise<void>((resolve) => {
        const forceKillTimer = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process?.on('exit', () => {
          clearTimeout(forceKillTimer);
          resolve();
        });
      });
    }

    this.process = null;
    this._state = 'disconnected';
  }

  /**
   * Write a message to the process stdin
   */
  private write(message: JSONRPCMessage): void {
    if (!this.process?.stdin?.writable) {
      throw new TransportError('Process stdin not writable');
    }

    const json = JSON.stringify(message);
    this.process.stdin.write(json + '\n');
  }

  /**
   * Handle a line of output from the process
   */
  private handleLine(line: string): void {
    if (!line.trim()) return;

    try {
      const message = JSON.parse(line) as JSONRPCMessage;

      // Check if it's a response (has id that is not null/undefined)
      if ('id' in message && message.id !== undefined && message.id !== null) {
        const id = message.id as string | number;
        const pending = this.pendingRequests.get(id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(id);
          pending.resolve(message as JSONRPCResponse);
        }
      } else if ('method' in message) {
        // It's a notification from the server
        this.onNotification?.(message as JSONRPCNotification);
      }
    } catch (error) {
      // Log parse errors but don't fail
      console.error(`[MCP Transport] Failed to parse message: ${line}`);
    }
  }

  /**
   * Reject all pending requests
   */
  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}
