import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebhookManager } from '../webhooks/manager.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function httpResponse(status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
  });
}

describe('WebhookManager', () => {
  let manager: WebhookManager;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
    mockFetch.mockReturnValue(httpResponse(200));
    manager = new WebhookManager();
  });

  afterEach(() => {
    manager.destroy();
    vi.restoreAllMocks();
  });

  it('registers a webhook', () => {
    const reg = manager.register(
      { url: 'https://example.com/hook' },
      ['task.*'],
    );
    expect(reg.id).toBeDefined();
    expect(reg.enabled).toBe(true);
    expect(reg.eventPatterns).toEqual(['task.*']);
  });

  it('lists registered webhooks', () => {
    manager.register({ url: 'https://a.com' }, ['task.*']);
    manager.register({ url: 'https://b.com' }, ['plan.*']);
    expect(manager.list()).toHaveLength(2);
  });

  it('unregisters a webhook', () => {
    const reg = manager.register({ url: 'https://example.com/hook' }, ['*']);
    manager.unregister(reg.id);
    expect(manager.list()).toHaveLength(0);
  });

  it('dispatches events to matching webhooks', async () => {
    manager.register({ url: 'https://a.com' }, ['task.*']);
    manager.register({ url: 'https://b.com' }, ['plan.*']);

    const results = await manager.dispatch('task.completed', { id: '1' });
    expect(results.size).toBe(1);

    // Only task.* webhook should have been called
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://a.com',
      expect.anything(),
    );
  });

  it('dispatches to wildcard * webhooks', async () => {
    manager.register({ url: 'https://a.com' }, ['*']);
    const results = await manager.dispatch('anything.here', { data: true });
    expect(results.size).toBe(1);
  });

  it('skips disabled webhooks', async () => {
    const reg = manager.register({ url: 'https://a.com' }, ['task.*']);
    manager.setEnabled(reg.id, false);

    const results = await manager.dispatch('task.completed', { id: '1' });
    expect(results.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('re-enables disabled webhooks', async () => {
    const reg = manager.register({ url: 'https://a.com' }, ['task.*']);
    manager.setEnabled(reg.id, false);
    manager.setEnabled(reg.id, true);

    const results = await manager.dispatch('task.completed', { id: '1' });
    expect(results.size).toBe(1);
  });

  it('matches exact event patterns', async () => {
    manager.register({ url: 'https://a.com' }, ['task.completed']);

    const r1 = await manager.dispatch('task.completed', {});
    expect(r1.size).toBe(1);

    mockFetch.mockClear();
    const r2 = await manager.dispatch('task.failed', {});
    expect(r2.size).toBe(0);
  });

  it('destroy clears all registrations', () => {
    manager.register({ url: 'https://a.com' }, ['*']);
    manager.register({ url: 'https://b.com' }, ['*']);
    manager.destroy();
    expect(manager.list()).toHaveLength(0);
  });
});
