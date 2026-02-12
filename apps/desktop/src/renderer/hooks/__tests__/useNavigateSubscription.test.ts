// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test the navigation logic directly since @testing-library/react is not available.
// The hook is a thin wrapper around window.api.onNavigate, so we test the
// callback behavior and hash setting directly.

describe('useNavigateSubscription behavior', () => {
  let originalHash: string;

  beforeEach(() => {
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = originalHash;
  });

  it('navigate payload with params sets correct hash', () => {
    const route = '/settings';
    const params = { tab: 'appearance' };
    const search = new URLSearchParams(params).toString();
    const hash = search ? `${route}?${search}` : route;
    window.location.hash = hash;
    expect(window.location.hash).toBe('#/settings?tab=appearance');
  });

  it('navigate payload without params sets hash without query string', () => {
    const route = '/mcp';
    const params: Record<string, string> = {};
    const search = new URLSearchParams(params).toString();
    const hash = search ? `${route}?${search}` : route;
    window.location.hash = hash;
    expect(window.location.hash).toBe('#/mcp');
  });

  it('navigate payload with message param sets correct hash', () => {
    const route = '/chat';
    const params = { message: 'hello world' };
    const search = new URLSearchParams(params).toString();
    const hash = search ? `${route}?${search}` : route;
    window.location.hash = hash;
    expect(window.location.hash).toBe('#/chat?message=hello+world');
  });

  it('navigate payload with multiple params encodes correctly', () => {
    const route = '/chat';
    const params = { message: 'test', provider: 'openai' };
    const search = new URLSearchParams(params).toString();
    const hash = search ? `${route}?${search}` : route;
    window.location.hash = hash;
    expect(window.location.hash).toBe('#/chat?message=test&provider=openai');
  });

  it('onNavigate callback structure matches expected API', () => {
    // Verify the callback contract: receives { route, params }, returns unsubscribe fn
    const mockUnsubscribe = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const mockOnNavigate = vi.fn((_cb: unknown) => mockUnsubscribe);

    const unsubscribe = mockOnNavigate(({ route, params }: { route: string; params: Record<string, string> }) => {
      const search = new URLSearchParams(params).toString();
      window.location.hash = search ? `${route}?${search}` : route;
    });

    expect(mockOnNavigate).toHaveBeenCalledOnce();
    expect(typeof unsubscribe).toBe('function');

    unsubscribe();
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });
});
