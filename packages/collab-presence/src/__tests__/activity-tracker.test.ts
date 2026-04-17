import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ActivityTracker } from '../activity-tracker.js';

describe('ActivityTracker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('should start in active state', () => {
    const tracker = new ActivityTracker('human');
    expect(tracker.getState()).toBe('active');
    tracker.destroy();
  });

  it('recordKeystroke transitions to typing', () => {
    const tracker = new ActivityTracker('human');
    tracker.recordKeystroke();
    expect(tracker.getState()).toBe('typing');
    tracker.destroy();
  });

  it('recordCursorMove transitions to active', () => {
    const tracker = new ActivityTracker('human');
    tracker.recordKeystroke(); // typing
    tracker.recordCursorMove();
    expect(tracker.getState()).toBe('active');
    tracker.destroy();
  });

  it('recordFileOpen transitions to viewing', () => {
    const tracker = new ActivityTracker('human');
    tracker.recordFileOpen();
    expect(tracker.getState()).toBe('viewing');
    tracker.destroy();
  });

  it('recordBlur transitions to away', () => {
    const tracker = new ActivityTracker('human');
    tracker.recordBlur();
    expect(tracker.getState()).toBe('away');
    tracker.destroy();
  });

  it('recordFocus transitions to active', () => {
    const tracker = new ActivityTracker('human');
    tracker.recordBlur();
    tracker.recordFocus();
    expect(tracker.getState()).toBe('active');
    tracker.destroy();
  });

  it('auto-transitions to idle after timeout', () => {
    const tracker = new ActivityTracker('human', { idleTimeout: 1000, awayTimeout: 5000 });
    tracker.recordKeystroke();

    vi.advanceTimersByTime(1001);
    expect(tracker.getState()).toBe('idle');
    tracker.destroy();
  });

  it('auto-transitions from idle to away after awayTimeout', () => {
    const tracker = new ActivityTracker('human', { idleTimeout: 1000, awayTimeout: 3000 });
    tracker.recordKeystroke();

    vi.advanceTimersByTime(1001); // → idle
    expect(tracker.getState()).toBe('idle');

    vi.advanceTimersByTime(2001); // → away (3000 - 1000 = 2000ms after idle)
    expect(tracker.getState()).toBe('away');
    tracker.destroy();
  });

  it('activity resets idle timer', () => {
    const tracker = new ActivityTracker('human', { idleTimeout: 1000, awayTimeout: 5000 });
    tracker.recordKeystroke();

    vi.advanceTimersByTime(500);
    tracker.recordKeystroke(); // resets timer

    vi.advanceTimersByTime(500);
    expect(tracker.getState()).toBe('typing'); // still typing, not idle

    tracker.destroy();
  });

  it('onStateChange fires on transitions', () => {
    const tracker = new ActivityTracker('human');
    const states: string[] = [];
    tracker.onStateChange(s => states.push(s));

    tracker.recordKeystroke(); // active → typing
    tracker.recordCursorMove(); // typing → active

    expect(states).toEqual(['typing', 'active']);
    tracker.destroy();
  });

  it('onStateChange unsubscribe works', () => {
    const tracker = new ActivityTracker('human');
    const states: string[] = [];
    const unsub = tracker.onStateChange(s => states.push(s));

    tracker.recordKeystroke();
    unsub();
    tracker.recordCursorMove();

    expect(states).toEqual(['typing']); // only first transition
    tracker.destroy();
  });

  describe('AI states', () => {
    it('setThinking transitions to thinking (AI only)', () => {
      const tracker = new ActivityTracker('ai');
      tracker.setThinking();
      expect(tracker.getState()).toBe('thinking');
      tracker.destroy();
    });

    it('setExecuting transitions to executing (AI only)', () => {
      const tracker = new ActivityTracker('ai');
      tracker.setExecuting();
      expect(tracker.getState()).toBe('executing');
      tracker.destroy();
    });

    it('setThinking is no-op for human', () => {
      const tracker = new ActivityTracker('human');
      tracker.setThinking();
      expect(tracker.getState()).toBe('active');
      tracker.destroy();
    });

    it('setIdle transitions to idle', () => {
      const tracker = new ActivityTracker('ai');
      tracker.setExecuting();
      tracker.setIdle();
      expect(tracker.getState()).toBe('idle');
      tracker.destroy();
    });
  });

  it('does not fire duplicate state changes', () => {
    const tracker = new ActivityTracker('human');
    const states: string[] = [];
    tracker.onStateChange(s => states.push(s));

    tracker.recordKeystroke(); // → typing
    tracker.recordKeystroke(); // still typing, no fire

    expect(states).toEqual(['typing']);
    tracker.destroy();
  });
});
