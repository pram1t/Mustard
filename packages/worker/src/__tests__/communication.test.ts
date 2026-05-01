import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '@pram1t/mustard-message-bus';
import { WorkerChannel, type WorkerMessage } from '../communication.js';

describe('WorkerChannel', () => {
  let bus: EventBus;
  let channelA: WorkerChannel;
  let channelB: WorkerChannel;

  beforeEach(() => {
    bus = new EventBus();
    channelA = new WorkerChannel(bus, 'worker-a', 'architect');
    channelB = new WorkerChannel(bus, 'worker-b', 'backend');
  });

  afterEach(() => {
    channelA.dispose();
    channelB.dispose();
  });

  describe('send', () => {
    it('should deliver message to target worker by ID', () => {
      channelA.send({ workerId: 'worker-b' }, 'Hello backend');

      expect(channelB.getInboxSize()).toBe(1);
      const messages = channelB.drainInbox();
      expect(messages[0].content).toBe('Hello backend');
      expect(messages[0].fromRole).toBe('architect');
    });

    it('should deliver message to target worker by role', () => {
      channelA.send({ role: 'backend' }, 'Hello all backends');

      expect(channelB.getInboxSize()).toBe(1);
      const messages = channelB.drainInbox();
      expect(messages[0].content).toBe('Hello all backends');
    });

    it('should not deliver message to unrelated workers', () => {
      const channelC = new WorkerChannel(bus, 'worker-c', 'frontend');
      channelA.send({ workerId: 'worker-b' }, 'Only for B');

      expect(channelC.getInboxSize()).toBe(0);
      channelC.dispose();
    });

    it('should include metadata', () => {
      channelA.send({ workerId: 'worker-b' }, 'with meta', { key: 'value' });

      const messages = channelB.drainInbox();
      expect(messages[0].metadata).toEqual({ key: 'value' });
    });
  });

  describe('broadcast', () => {
    it('should deliver to all other workers', () => {
      const channelC = new WorkerChannel(bus, 'worker-c', 'frontend');
      channelA.broadcast('Announcement to all');

      expect(channelB.getInboxSize()).toBe(1);
      expect(channelC.getInboxSize()).toBe(1);
      expect(channelB.drainInbox()[0].content).toBe('Announcement to all');
      channelC.dispose();
    });

    it('should not deliver to sender', () => {
      channelA.broadcast('My announcement');

      expect(channelA.getInboxSize()).toBe(0);
    });
  });

  describe('share', () => {
    it('should share intermediate result with all other workers', () => {
      channelA.share('Intermediate finding', { type: 'analysis' });

      expect(channelB.getInboxSize()).toBe(1);
      const messages = channelB.drainInbox();
      expect(messages[0].content).toBe('Intermediate finding');
      expect(messages[0].metadata).toEqual({ type: 'analysis' });
    });

    it('should not deliver share to sender', () => {
      channelA.share('My result');

      expect(channelA.getInboxSize()).toBe(0);
    });
  });

  describe('ask/answer', () => {
    it('should resolve when answer arrives', async () => {
      // Set up answerer
      bus.subscribe('worker.question', (msg) => {
        const payload = msg.payload as WorkerMessage;
        if (payload.toRole === 'backend' && payload.correlationId) {
          // Simulate backend answering
          channelB.answer(payload.correlationId, 'The answer is 42');
        }
      });

      const answer = await channelA.ask('backend', 'What is the answer?');

      expect(answer.content).toBe('The answer is 42');
      expect(answer.fromRole).toBe('backend');
    });

    it('should timeout when no answer arrives', async () => {
      await expect(
        channelA.ask('backend', 'No one will answer', 50)
      ).rejects.toThrow('timed out');
    });
  });

  describe('drainInbox', () => {
    it('should return and clear all messages', () => {
      channelA.send({ workerId: 'worker-b' }, 'msg1');
      channelA.send({ workerId: 'worker-b' }, 'msg2');

      expect(channelB.getInboxSize()).toBe(2);
      const messages = channelB.drainInbox();
      expect(messages).toHaveLength(2);
      expect(channelB.getInboxSize()).toBe(0);
    });

    it('should return empty array when inbox is empty', () => {
      const messages = channelA.drainInbox();
      expect(messages).toHaveLength(0);
    });
  });

  describe('formatInboxAsContext', () => {
    it('should format messages as markdown context', () => {
      channelA.send({ workerId: 'worker-b' }, 'Consider using the Repository pattern');

      const context = channelB.formatInboxAsContext();
      expect(context).toContain('## Messages from other workers:');
      expect(context).toContain('[architect]: Consider using the Repository pattern');
    });

    it('should return empty string when no messages', () => {
      const context = channelA.formatInboxAsContext();
      expect(context).toBe('');
    });

    it('should drain inbox after formatting', () => {
      channelA.send({ workerId: 'worker-b' }, 'Hello');
      channelB.formatInboxAsContext();
      expect(channelB.getInboxSize()).toBe(0);
    });
  });

  describe('dispose', () => {
    it('should clean up subscriptions and inbox', () => {
      channelA.send({ workerId: 'worker-b' }, 'before dispose');
      expect(channelB.getInboxSize()).toBe(1);

      channelB.dispose();

      // New messages should not be received
      channelA.send({ workerId: 'worker-b' }, 'after dispose');
      expect(channelB.getInboxSize()).toBe(0);
    });
  });
});
