/**
 * @openagent/collab-server
 *
 * Fastify HTTP + WebSocket server for OpenAgent Collab.
 */

export { createApp } from './app.js';
export type { CreateAppOptions, CreateAppResult } from './app.js';

export { registerWebSocket } from './ws.js';
export type {
  RegisterWebSocketOptions,
  WebSocketBridge,
} from './ws.js';

export {
  DEFAULT_COLLAB_SERVER_CONFIG,
} from './types.js';
export type {
  CollabServerConfig,
  LoginRequest,
  LoginResponse,
  ApiError,
} from './types.js';

export { RoomRegistry } from './room-registry.js';
export type {
  RoomContext,
  RoomRegistryOptions,
  CreateRoomInput,
} from './room-registry.js';

export { sign, verify } from './jwt.js';
export type {
  JwtHeader,
  JwtPayload,
  SignOptions,
  VerifyOptions,
} from './jwt.js';
