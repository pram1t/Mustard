import { describe, it, expect } from 'vitest';
import { resolveTheme } from '../useTheme';

describe('resolveTheme', () => {
  it('returns dark for dark theme regardless of system preference', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
  });

  it('returns light for light theme regardless of system preference', () => {
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('returns dark for system theme when system prefers dark', () => {
    expect(resolveTheme('system', true)).toBe('dark');
  });

  it('returns light for system theme when system prefers light', () => {
    expect(resolveTheme('system', false)).toBe('light');
  });
});
