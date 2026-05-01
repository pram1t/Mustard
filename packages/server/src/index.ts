/**
 * @mustard/server
 *
 * Fastify HTTP/WebSocket API server for OpenAgent V2.
 */

export { createServer, startServer } from './server.js';
export type { AppContext } from './server.js';
export type { ServerConfig, ServerDeps, ApiError, ApiResponse } from './types.js';
export { DEFAULT_SERVER_CONFIG } from './types.js';
export type { ServerMetrics } from './routes/metrics.js';
