import { describe, it, expect } from 'vitest';
import { EventBus, type MessageEnvelope } from '@mustard/message-bus';
import { IntentEngine } from '../intent-engine.js';
import type { Intent } from '../types.js';
import {
  attachIntentEngineToBus,
  INTENT_TOPICS,
  INTENT_TOPIC_WILDCARD,
} from '../bus-adapter.js';

function proposeArgs() {
  return {
    agentId: 'agent-1',
    summary: 'read file',
    type: 'file_read' as const,
    action: { type: 'file_read' as const, path: '/tmp/x' },
    rationale: 'test',
    confidence: 0.9,
    risk: 'safe' as const,
  };
}

describe('attachIntentEngineToBus', () => {
  it('forwards proposed events to collab.ai.intent.proposed', () => {
    const engine = new IntentEngine();
    const bus = new EventBus();
    const received: Array<MessageEnvelope<Intent>> = [];

    attachIntentEngineToBus(engine, bus);
    bus.subscribe<Intent>(INTENT_TOPICS.proposed, env => {
      received.push(env);
    });

    const intent = engine.propose(proposeArgs());

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe(INTENT_TOPICS.proposed);
    expect(received[0].payload.id).toBe(intent.id);
  });

  it('forwards all seven transition events in order', () => {
    const engine = new IntentEngine();
    const bus = new EventBus();
    const types: string[] = [];

    attachIntentEngineToBus(engine, bus);
    bus.subscribe(INTENT_TOPIC_WILDCARD, env => types.push(env.type));

    const a = engine.propose(proposeArgs());
    engine.approve(a.id, 'h1');
    engine.startExecution(a.id);
    engine.complete(a.id);

    const b = engine.propose(proposeArgs());
    engine.reject(b.id, 'h1', 'nope');

    const c = engine.propose(proposeArgs());
    engine.approve(c.id, 'h1');
    engine.startExecution(c.id);
    engine.fail(c.id, 'err');

    const d = engine.propose(proposeArgs());
    engine.invalidate(d.id, 'superseded');

    expect(types).toEqual([
      INTENT_TOPICS.proposed,
      INTENT_TOPICS.approved,
      INTENT_TOPICS.executing,
      INTENT_TOPICS.completed,
      INTENT_TOPICS.proposed,
      INTENT_TOPICS.rejected,
      INTENT_TOPICS.proposed,
      INTENT_TOPICS.approved,
      INTENT_TOPICS.executing,
      INTENT_TOPICS.failed,
      INTENT_TOPICS.proposed,
      INTENT_TOPICS.invalidated,
    ]);
  });

  it('attaches source metadata when provided', () => {
    const engine = new IntentEngine();
    const bus = new EventBus();
    const received: Array<MessageEnvelope<Intent>> = [];

    attachIntentEngineToBus(engine, bus, { source: 'room-42' });
    bus.subscribe<Intent>(INTENT_TOPIC_WILDCARD, env => received.push(env));

    engine.propose(proposeArgs());

    expect(received[0].source).toBe('room-42');
  });

  it('disposer detaches every forwarded listener', () => {
    const engine = new IntentEngine();
    const bus = new EventBus();
    const received: unknown[] = [];

    const dispose = attachIntentEngineToBus(engine, bus);
    bus.subscribe(INTENT_TOPIC_WILDCARD, env => received.push(env));

    engine.propose(proposeArgs());
    expect(received).toHaveLength(1);

    dispose();

    const { id } = engine.propose(proposeArgs());
    engine.approve(id, 'h');

    // After dispose, no further publishes — still just the first one
    expect(received).toHaveLength(1);
  });

  it('publishes the exact Intent object from the engine', () => {
    const engine = new IntentEngine();
    const bus = new EventBus();
    const received: Array<MessageEnvelope<Intent>> = [];

    attachIntentEngineToBus(engine, bus);
    bus.subscribe<Intent>(INTENT_TOPICS.approved, env => received.push(env));

    const intent = engine.propose(proposeArgs());
    const approved = engine.approve(intent.id, 'human-1');

    expect(received[0].payload.id).toBe(approved.id);
    expect(received[0].payload.status).toBe('approved');
    expect(received[0].payload.resolvedBy).toBe('human-1');
  });

  it('an auto-approved intent emits proposed then approved on the bus', () => {
    const engine = new IntentEngine({
      autoApproval: {
        enabled: true,
        allowedRisks: ['safe'],
        allowedTypes: ['file_read'],
        approverIdentity: 'auto-approval',
      },
    });
    const bus = new EventBus();
    const types: string[] = [];

    attachIntentEngineToBus(engine, bus);
    bus.subscribe(INTENT_TOPIC_WILDCARD, env => types.push(env.type));

    engine.propose(proposeArgs());

    expect(types).toEqual([INTENT_TOPICS.proposed, INTENT_TOPICS.approved]);
  });
});
