import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('electron', () => ({
  session: {
    defaultSession: {
      webRequest: {
        onBeforeRequest: vi.fn(),
      },
    },
  },
  shell: {
    openExternal: vi.fn(),
  },
  app: {
    isPackaged: false,
  },
}));

import { validateExternalURL, openExternalSafe } from '../network-security';
import { shell } from 'electron';

describe('Network Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateExternalURL', () => {
    it('accepts valid HTTPS URLs', () => {
      expect(validateExternalURL('https://example.com')).toBe('https://example.com/');
      expect(validateExternalURL('https://github.com/repo')).toBe('https://github.com/repo');
    });

    it('accepts mailto: URLs', () => {
      expect(validateExternalURL('mailto:user@example.com')).toBe('mailto:user@example.com');
    });

    it('rejects HTTP URLs', () => {
      expect(validateExternalURL('http://example.com')).toBeNull();
    });

    it('rejects file: URLs', () => {
      expect(validateExternalURL('file:///etc/passwd')).toBeNull();
    });

    it('rejects javascript: URLs', () => {
      expect(validateExternalURL('javascript:alert(1)')).toBeNull();
    });

    it('rejects data: URLs', () => {
      expect(validateExternalURL('data:text/html,<h1>evil</h1>')).toBeNull();
    });

    it('rejects localhost domains', () => {
      expect(validateExternalURL('https://localhost')).toBeNull();
      expect(validateExternalURL('https://127.0.0.1')).toBeNull();
    });

    it('rejects IP addresses', () => {
      expect(validateExternalURL('https://192.168.1.1')).toBeNull();
      expect(validateExternalURL('https://10.0.0.1')).toBeNull();
    });

    it('rejects URLs with auth info', () => {
      expect(validateExternalURL('https://user:pass@example.com')).toBeNull();
    });

    it('rejects non-standard ports', () => {
      expect(validateExternalURL('https://example.com:8080')).toBeNull();
    });

    it('rejects invalid URLs', () => {
      expect(validateExternalURL('not-a-url')).toBeNull();
      expect(validateExternalURL('')).toBeNull();
    });

    it('rejects URLs with embedded dangerous schemes', () => {
      expect(validateExternalURL('https://example.com/javascript:alert(1)')).toBeNull();
    });

    it('allows standard HTTPS port 443', () => {
      expect(validateExternalURL('https://example.com:443/path')).toBe('https://example.com/path');
    });
  });

  describe('openExternalSafe', () => {
    it('opens valid URLs', async () => {
      (shell.openExternal as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const result = await openExternalSafe('https://example.com');
      expect(result).toBe(true);
      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com/');
    });

    it('rejects invalid URLs without calling shell', async () => {
      const result = await openExternalSafe('http://evil.com');
      expect(result).toBe(false);
      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('returns false on shell error', async () => {
      (shell.openExternal as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
      const result = await openExternalSafe('https://example.com');
      expect(result).toBe(false);
    });
  });
});
