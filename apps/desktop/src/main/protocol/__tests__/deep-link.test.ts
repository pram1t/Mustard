import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isDefaultProtocolClient: vi.fn(() => false),
    setAsDefaultProtocolClient: vi.fn(),
  },
}));

import { parseDeepLink, extractDeepLinkFromArgs } from '../deep-link';

describe('parseDeepLink', () => {
  it('parses valid chat deep link', () => {
    const result = parseDeepLink('openagent://chat?message=hello');
    expect(result).toEqual({
      route: '/chat',
      params: { message: 'hello' },
    });
  });

  it('parses valid settings deep link', () => {
    const result = parseDeepLink('openagent://settings?tab=appearance');
    expect(result).toEqual({
      route: '/settings',
      params: { tab: 'appearance' },
    });
  });

  it('parses deep link without params', () => {
    const result = parseDeepLink('openagent://mcp');
    expect(result).toEqual({
      route: '/mcp',
      params: {},
    });
  });

  it('rejects non-openagent protocols', () => {
    expect(parseDeepLink('http://example.com')).toBeNull();
  });

  it('rejects malformed URLs', () => {
    expect(parseDeepLink('openagent://')).toBeNull();
  });

  it('rejects unknown routes', () => {
    expect(parseDeepLink('openagent://admin')).toBeNull();
  });

  it('rejects unknown parameters', () => {
    expect(parseDeepLink('openagent://chat?evil=payload')).toBeNull();
  });

  it('rejects URLs with auth info', () => {
    expect(parseDeepLink('openagent://user:pass@chat')).toBeNull();
  });

  it('rejects control characters in params', () => {
    expect(parseDeepLink('openagent://chat?message=hello\x00world')).toBeNull();
  });

  it('rejects overly long param values', () => {
    const longValue = 'a'.repeat(501);
    expect(parseDeepLink(`openagent://chat?message=${longValue}`)).toBeNull();
  });

  it('rejects empty/null input', () => {
    expect(parseDeepLink('')).toBeNull();
    expect(parseDeepLink(null as unknown as string)).toBeNull();
  });
});

describe('extractDeepLinkFromArgs', () => {
  it('extracts deep link from argv', () => {
    const argv = ['/path/to/app', '--', 'openagent://chat?message=test'];
    expect(extractDeepLinkFromArgs(argv)).toBe('openagent://chat?message=test');
  });

  it('returns null when no deep link in argv', () => {
    const argv = ['/path/to/app', '--flag', 'value'];
    expect(extractDeepLinkFromArgs(argv)).toBeNull();
  });

  it('ignores non-openagent URLs', () => {
    const argv = ['/path/to/app', 'http://evil.com'];
    expect(extractDeepLinkFromArgs(argv)).toBeNull();
  });
});
