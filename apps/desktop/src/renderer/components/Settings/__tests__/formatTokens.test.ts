import { describe, it, expect } from 'vitest';
import { formatTokens } from '../ProviderSettings';

describe('formatTokens', () => {
  it('formats millions without decimal when exact', () => {
    expect(formatTokens(1_000_000)).toBe('1M tokens');
    expect(formatTokens(2_000_000)).toBe('2M tokens');
  });

  it('formats millions with decimal when fractional', () => {
    expect(formatTokens(2_500_000)).toBe('2.5M tokens');
    expect(formatTokens(1_500_000)).toBe('1.5M tokens');
  });

  it('formats thousands without decimal when exact', () => {
    expect(formatTokens(128_000)).toBe('128K tokens');
    expect(formatTokens(4_000)).toBe('4K tokens');
  });

  it('formats thousands with decimal when fractional', () => {
    expect(formatTokens(4_096)).toBe('4.1K tokens');
    expect(formatTokens(8_192)).toBe('8.2K tokens');
  });

  it('formats small numbers directly', () => {
    expect(formatTokens(500)).toBe('500 tokens');
    expect(formatTokens(0)).toBe('0 tokens');
    expect(formatTokens(999)).toBe('999 tokens');
  });
});
