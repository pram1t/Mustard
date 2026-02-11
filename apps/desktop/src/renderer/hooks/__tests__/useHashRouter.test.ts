import { describe, it, expect } from 'vitest';
import { getRouteFromHash } from '../useHashRouter';

describe('getRouteFromHash', () => {
  it('returns / for empty hash', () => {
    expect(getRouteFromHash('')).toBe('/');
  });

  it('returns / for bare hash', () => {
    expect(getRouteFromHash('#')).toBe('/');
  });

  it('returns / for #/', () => {
    expect(getRouteFromHash('#/')).toBe('/');
  });

  it('returns /settings for #/settings', () => {
    expect(getRouteFromHash('#/settings')).toBe('/settings');
  });

  it('returns /mcp for #/mcp', () => {
    expect(getRouteFromHash('#/mcp')).toBe('/mcp');
  });

  it('returns /history for #/history', () => {
    expect(getRouteFromHash('#/history')).toBe('/history');
  });

  it('returns /about for #/about', () => {
    expect(getRouteFromHash('#/about')).toBe('/about');
  });

  it('returns / for unknown route', () => {
    expect(getRouteFromHash('#/unknown')).toBe('/');
  });

  it('returns / for random string', () => {
    expect(getRouteFromHash('#random')).toBe('/');
  });
});
