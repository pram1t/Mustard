/**
 * OpenAgent V2 - Worker Communication Protocol
 *
 * Enables inter-worker messaging via the message bus.
 * Workers can send direct messages, ask questions, broadcast, and share results.
 */

import { randomUUID } from 'node:crypto';
import type { IMessageBus, MessageEnvelope } from '@mustard/message-bus';
import type { WorkerRole } from './types.js';

/**
 * Message types for inter-worker communication.
 */
export type WorkerMessageType =
  | 'worker.message'
  | 'worker.question'
  | 'worker.answer'
  | 'worker.broadcast'
  | 'worker.share';

/**
 * A message between workers.
 */
export interface WorkerMessage {
  fromWorkerId: string;
  fromRole: WorkerRole;
  toWorkerId?: string;
  toRole?: WorkerRole;
  content: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Communication channel for a worker instance.
 * Wraps the message bus to provide worker-specific pub/sub.
 */
export class WorkerChannel {
  private readonly bus: IMessageBus;
  private readonly workerId: string;
  private readonly role: WorkerRole;
  private readonly inbox: WorkerMessage[] = [];
  private readonly unsubscribes: (() => void)[] = [];

  constructor(bus: IMessageBus, workerId: string, role: WorkerRole) {
    this.bus = bus;
    this.workerId = workerId;
    this.role = role;

    // Subscribe to direct messages (by worker ID)
    const unsub1 = this.bus.subscribe('worker.message', (msg: MessageEnvelope<WorkerMessage>) => {
      const payload = msg.payload;
      if (payload.toWorkerId === this.workerId || payload.toRole === this.role) {
        this.inbox.push(payload);
      }
    });
    this.unsubscribes.push(unsub1);

    // Subscribe to questions directed at this role
    const unsub2 = this.bus.subscribe('worker.question', (msg: MessageEnvelope<WorkerMessage>) => {
      const payload = msg.payload;
      if (payload.toRole === this.role || payload.toWorkerId === this.workerId) {
        this.inbox.push(payload);
      }
    });
    this.unsubscribes.push(unsub2);

    // Subscribe to broadcasts
    const unsub3 = this.bus.subscribe('worker.broadcast', (msg: MessageEnvelope<WorkerMessage>) => {
      const payload = msg.payload;
      // Don't receive own broadcasts
      if (payload.fromWorkerId !== this.workerId) {
        this.inbox.push(payload);
      }
    });
    this.unsubscribes.push(unsub3);

    // Subscribe to shared results
    const unsub4 = this.bus.subscribe('worker.share', (msg: MessageEnvelope<WorkerMessage>) => {
      const payload = msg.payload;
      if (payload.fromWorkerId !== this.workerId) {
        this.inbox.push(payload);
      }
    });
    this.unsubscribes.push(unsub4);
  }

  /**
   * Send a direct message to a specific worker or role.
   */
  send(to: { workerId?: string; role?: WorkerRole }, content: string, metadata?: Record<string, unknown>): void {
    const message: WorkerMessage = {
      fromWorkerId: this.workerId,
      fromRole: this.role,
      toWorkerId: to.workerId,
      toRole: to.role,
      content,
      metadata,
    };
    this.bus.publish('worker.message', message);
  }

  /**
   * Ask a question and wait for an answer.
   */
  async ask(toRole: WorkerRole, question: string, timeoutMs: number = 30000): Promise<WorkerMessage> {
    const correlationId = randomUUID();

    const message: WorkerMessage = {
      fromWorkerId: this.workerId,
      fromRole: this.role,
      toRole: toRole,
      content: question,
      correlationId,
    };

    // Subscribe to answer BEFORE publishing question to avoid race condition
    // (publish is synchronous — the answer may arrive before subscribe if we publish first)
    return new Promise<WorkerMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsub();
        reject(new Error(`Question to ${toRole} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const unsub = this.bus.subscribe('worker.answer', (msg: MessageEnvelope<WorkerMessage>) => {
        if (msg.payload.correlationId === correlationId) {
          clearTimeout(timeout);
          unsub();
          resolve(msg.payload);
        }
      });

      // Now publish the question (after we're listening for answers)
      this.bus.publish('worker.question', message);
    });
  }

  /**
   * Answer a question (reply with matching correlationId).
   */
  answer(correlationId: string, content: string): void {
    const message: WorkerMessage = {
      fromWorkerId: this.workerId,
      fromRole: this.role,
      content,
      correlationId,
    };
    this.bus.publish('worker.answer', message);
  }

  /**
   * Broadcast a message to all workers.
   */
  broadcast(content: string, metadata?: Record<string, unknown>): void {
    const message: WorkerMessage = {
      fromWorkerId: this.workerId,
      fromRole: this.role,
      content,
      metadata,
    };
    this.bus.publish('worker.broadcast', message);
  }

  /**
   * Share an intermediate result with all workers.
   */
  share(content: string, metadata?: Record<string, unknown>): void {
    const message: WorkerMessage = {
      fromWorkerId: this.workerId,
      fromRole: this.role,
      content,
      metadata,
    };
    this.bus.publish('worker.share', message);
  }

  /**
   * Get all unread messages from the inbox and clear it.
   */
  drainInbox(): WorkerMessage[] {
    const messages = [...this.inbox];
    this.inbox.length = 0;
    return messages;
  }

  /**
   * Get inbox size without draining.
   */
  getInboxSize(): number {
    return this.inbox.length;
  }

  /**
   * Format inbox messages as context for the worker's prompt.
   */
  formatInboxAsContext(): string {
    if (this.inbox.length === 0) return '';

    const messages = this.drainInbox();
    const lines = ['## Messages from other workers:'];

    for (const msg of messages) {
      const from = `[${msg.fromRole}]`;
      lines.push(`${from}: ${msg.content}`);
    }

    return lines.join('\n');
  }

  /**
   * Clean up subscriptions.
   */
  dispose(): void {
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes.length = 0;
    this.inbox.length = 0;
  }
}
