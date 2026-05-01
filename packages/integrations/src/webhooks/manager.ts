/**
 * Webhook manager — bridges EventBus events to registered webhook endpoints.
 */

import { randomUUID } from 'node:crypto';
import type { IMessageBus } from '@mustard/message-bus';
import { WebhookSender } from './sender.js';
import type { WebhookConfig, WebhookPayload, WebhookRegistration, WebhookResult } from './types.js';

export class WebhookManager {
  private registrations = new Map<string, WebhookRegistration>();
  private senders = new Map<string, WebhookSender>();
  private subscriptionUnsubs: Array<() => void> = [];

  constructor(private bus?: IMessageBus) {}

  /**
   * Register a new webhook endpoint.
   */
  register(config: WebhookConfig, eventPatterns: string[]): WebhookRegistration {
    const id = randomUUID();
    const reg: WebhookRegistration = { id, config, eventPatterns, enabled: true };
    this.registrations.set(id, reg);
    this.senders.set(id, new WebhookSender(config));

    if (this.bus) {
      this.subscribeToEvents(id, reg);
    }

    return reg;
  }

  /**
   * Remove a webhook registration.
   */
  unregister(id: string): boolean {
    this.registrations.delete(id);
    this.senders.delete(id);
    return true;
  }

  /**
   * Enable or disable a webhook.
   */
  setEnabled(id: string, enabled: boolean): void {
    const reg = this.registrations.get(id);
    if (reg) reg.enabled = enabled;
  }

  /**
   * List all registered webhooks.
   */
  list(): WebhookRegistration[] {
    return Array.from(this.registrations.values());
  }

  /**
   * Send an event to all matching webhooks (useful without EventBus).
   */
  async dispatch(event: string, data: unknown): Promise<Map<string, WebhookResult>> {
    const results = new Map<string, WebhookResult>();
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    for (const [id, reg] of this.registrations) {
      if (!reg.enabled) continue;
      if (!this.matchesPatterns(event, reg.eventPatterns)) continue;

      const sender = this.senders.get(id);
      if (sender) {
        results.set(id, await sender.send(payload));
      }
    }

    return results;
  }

  /**
   * Disconnect all event subscriptions.
   */
  destroy(): void {
    for (const unsub of this.subscriptionUnsubs) {
      unsub();
    }
    this.subscriptionUnsubs = [];
    this.registrations.clear();
    this.senders.clear();
  }

  private subscribeToEvents(id: string, reg: WebhookRegistration): void {
    if (!this.bus) return;

    for (const pattern of reg.eventPatterns) {
      const sub = this.bus.subscribe(pattern, async (msg) => {
        const currentReg = this.registrations.get(id);
        if (!currentReg?.enabled) return;

        const sender = this.senders.get(id);
        if (!sender) return;

        const payload: WebhookPayload = {
          event: msg.type,
          timestamp: new Date().toISOString(),
          data: msg.payload,
        };

        await sender.send(payload);
      });

      this.subscriptionUnsubs.push(sub);
    }
  }

  private matchesPatterns(event: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      if (pattern === '*') return true;
      if (pattern.endsWith('.*')) {
        return event.startsWith(pattern.slice(0, -1));
      }
      return event === pattern;
    });
  }
}
