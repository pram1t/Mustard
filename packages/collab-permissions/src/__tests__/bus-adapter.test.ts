import { describe, it, expect } from 'vitest';
import { EventBus, type MessageEnvelope } from '@openagent/message-bus';
import { ModeManager } from '../mode-manager.js';
import {
  attachModeManagerToBus,
  MODE_TOPICS,
  MODE_TOPIC_WILDCARD,
} from '../bus-adapter.js';
import type { ModeChangeEvent } from '../types.js';

describe('attachModeManagerToBus', () => {
  it('forwards mode changes to collab.permissions.mode.changed', () => {
    const m = new ModeManager({ roomId: 'r-1' });
    const bus = new EventBus();
    const received: Array<MessageEnvelope<ModeChangeEvent>> = [];

    attachModeManagerToBus(m, bus);
    bus.subscribe<ModeChangeEvent>(MODE_TOPICS.changed, env => {
      received.push(env);
    });

    m.setMode('code', 'user-1');

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe(MODE_TOPICS.changed);
    expect(received[0].payload.newMode).toBe('code');
    expect(received[0].payload.changedBy).toBe('user-1');
  });

  it('defaults envelope source to the manager roomId', () => {
    const m = new ModeManager({ roomId: 'r-42' });
    const bus = new EventBus();
    const received: Array<MessageEnvelope<ModeChangeEvent>> = [];

    attachModeManagerToBus(m, bus);
    bus.subscribe<ModeChangeEvent>(MODE_TOPIC_WILDCARD, env => {
      received.push(env);
    });

    m.setMode('auto', 'u');

    expect(received[0].source).toBe('r-42');
  });

  it('honors an explicit source override', () => {
    const m = new ModeManager({ roomId: 'r-1' });
    const bus = new EventBus();
    const received: Array<MessageEnvelope<ModeChangeEvent>> = [];

    attachModeManagerToBus(m, bus, { source: 'custom' });
    bus.subscribe<ModeChangeEvent>(MODE_TOPIC_WILDCARD, env => {
      received.push(env);
    });

    m.setMode('code', 'u');

    expect(received[0].source).toBe('custom');
  });

  it('disposer detaches the forwarding listener', () => {
    const m = new ModeManager({ roomId: 'r-1' });
    const bus = new EventBus();
    const received: unknown[] = [];

    const dispose = attachModeManagerToBus(m, bus);
    bus.subscribe(MODE_TOPIC_WILDCARD, env => received.push(env));

    m.setMode('code', 'u');
    expect(received).toHaveLength(1);

    dispose();
    m.setMode('auto', 'u');

    expect(received).toHaveLength(1);
  });

  it('does not publish when setMode is a no-op', () => {
    const m = new ModeManager({ roomId: 'r-1', initialMode: 'code' });
    const bus = new EventBus();
    const received: unknown[] = [];

    attachModeManagerToBus(m, bus);
    bus.subscribe(MODE_TOPIC_WILDCARD, env => received.push(env));

    m.setMode('code', 'u');

    expect(received).toHaveLength(0);
  });
});
