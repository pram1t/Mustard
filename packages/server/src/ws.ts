/**
 * OpenAgent V2 - WebSocket Event Bridge
 *
 * Bridges EventBus events to connected WebSocket clients.
 * Clients receive real-time plan.*, task.*, worker.*, artifact.* events.
 */

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import type { MessageEnvelope } from '@openagent/message-bus';
import type { AppContext } from './server.js';

const EVENT_PATTERNS = ['plan.*', 'task.*', 'worker.*', 'artifact.*'];

export function registerWebSocket(app: FastifyInstance, ctx: AppContext): void {
  const clients = new Set<WebSocket>();

  // Subscribe to all relevant bus events and forward to clients
  for (const pattern of EVENT_PATTERNS) {
    ctx.bus.subscribe(pattern, (msg: MessageEnvelope<any>) => {
      const payload = JSON.stringify({
        type: msg.type,
        payload: msg.payload,
        timestamp: msg.timestamp,
      });

      for (const ws of clients) {
        if (ws.readyState === 1 /* OPEN */) {
          ws.send(payload);
        }
      }
    });
  }

  app.register(async function (fastify) {
    fastify.get('/api/ws', { websocket: true }, (socket) => {
      clients.add(socket);

      socket.on('message', (raw: Buffer) => {
        // Handle client messages (e.g., subscribe/unsubscribe filters)
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'ping') {
            socket.send(JSON.stringify({ type: 'pong' }));
          }
        } catch {
          // Ignore malformed messages
        }
      });

      socket.on('close', () => {
        clients.delete(socket);
      });

      // Send welcome message
      socket.send(JSON.stringify({
        type: 'connected',
        payload: { message: 'Connected to OpenAgent event stream.' },
        timestamp: Date.now(),
      }));
    });
  });
}
