/**
 * Shared types for @pram1t/mustard-collab-server.
 */

export interface CollabServerConfig {
  /** Bind host. Default '127.0.0.1'. */
  host: string;
  /** Bind port. Default 3200. */
  port: number;
  /** Enable CORS (recommended for local dev). Default true. */
  cors: boolean;
  /** HMAC secret for JWT signing + verification. Required. */
  jwtSecret: string;
  /** Token lifetime in seconds. Default 3600. */
  tokenLifetimeSec: number;
}

export const DEFAULT_COLLAB_SERVER_CONFIG: CollabServerConfig = {
  host: '127.0.0.1',
  port: 3200,
  cors: true,
  jwtSecret: '',
  tokenLifetimeSec: 3600,
};

/**
 * A participant identity sent by the API consumer on login.
 */
export interface LoginRequest {
  participantId: string;
  participantName: string;
  type: 'human' | 'ai';
  roomId?: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: number;
  participantId: string;
  roomId?: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
