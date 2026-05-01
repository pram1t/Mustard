/**
 * OpenAgent V2 - Server Types
 *
 * Types for the Fastify HTTP/WebSocket API server.
 */

import type { LLMRouter } from '@pram1t/mustard-llm';
import type { IToolRegistry } from '@pram1t/mustard-tools';
import type { IMessageBus } from '@pram1t/mustard-message-bus';
import type { IMemoryStore } from '@pram1t/mustard-memory';
import type { IArtifactStore } from '@pram1t/mustard-artifact';

/**
 * Server configuration.
 */
export interface ServerConfig {
  /** Port to listen on (default: 3100) */
  port: number;

  /** Host to bind to (default: '127.0.0.1') */
  host: string;

  /** Enable CORS (default: true for dev) */
  cors: boolean;

  /** API key for authentication (optional) */
  apiKey?: string;

  /** Max parallel workers (default: 3) */
  maxParallelWorkers: number;
}

/**
 * Dependencies injected into the server.
 */
export interface ServerDeps {
  router: LLMRouter;
  tools: IToolRegistry;
  bus: IMessageBus;
  memoryStore?: IMemoryStore;
  artifactStore?: IArtifactStore;
}

/**
 * Default server configuration.
 */
export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  port: 3100,
  host: '127.0.0.1',
  cors: true,
  maxParallelWorkers: 3,
};

/**
 * API error response body.
 */
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

/**
 * API success response wrapper.
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}
