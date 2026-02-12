import { describe, it, expect } from 'vitest';
import { getRouteFromHash } from '../useHashRouter';

describe('getRouteFromHash', () => {
  it('returns / for empty hash', () => {
    expect(getRouteFromHash('')).toEqual({ route: '/', params: {} });
  });

  it('returns / for bare hash', () => {
    expect(getRouteFromHash('#')).toEqual({ route: '/', params: {} });
  });

  it('returns / for #/', () => {
    expect(getRouteFromHash('#/')).toEqual({ route: '/', params: {} });
  });

  it('returns /settings for #/settings', () => {
    expect(getRouteFromHash('#/settings')).toEqual({ route: '/settings', params: {} });
  });

  it('returns /mcp for #/mcp', () => {
    expect(getRouteFromHash('#/mcp')).toEqual({ route: '/mcp', params: {} });
  });

  it('returns /history for #/history', () => {
    expect(getRouteFromHash('#/history')).toEqual({ route: '/history', params: {} });
  });

  it('returns /about for #/about', () => {
    expect(getRouteFromHash('#/about')).toEqual({ route: '/about', params: {} });
  });

  it('returns / for unknown route', () => {
    expect(getRouteFromHash('#/unknown')).toEqual({ route: '/', params: {} });
  });

  it('returns / for random string', () => {
    expect(getRouteFromHash('#random')).toEqual({ route: '/', params: {} });
  });

  // New tests for /chat route and params
  it('returns /chat for #/chat', () => {
    expect(getRouteFromHash('#/chat')).toEqual({ route: '/chat', params: {} });
  });

  it('parses query params from hash', () => {
    expect(getRouteFromHash('#/chat?message=hello')).toEqual({
      route: '/chat',
      params: { message: 'hello' },
    });
  });

  it('parses multiple query params', () => {
    expect(getRouteFromHash('#/chat?message=hello&provider=openai')).toEqual({
      route: '/chat',
      params: { message: 'hello', provider: 'openai' },
    });
  });

  it('parses settings tab param', () => {
    expect(getRouteFromHash('#/settings?tab=appearance')).toEqual({
      route: '/settings',
      params: { tab: 'appearance' },
    });
  });

  it('handles encoded query param values', () => {
    expect(getRouteFromHash('#/chat?message=hello%20world')).toEqual({
      route: '/chat',
      params: { message: 'hello world' },
    });
  });

  it('returns / for unknown route but preserves params', () => {
    expect(getRouteFromHash('#/unknown?foo=bar')).toEqual({
      route: '/',
      params: { foo: 'bar' },
    });
  });

  it('returns empty params for route without query string', () => {
    expect(getRouteFromHash('#/mcp')).toEqual({ route: '/mcp', params: {} });
  });
});
