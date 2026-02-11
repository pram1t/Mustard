/**
 * Input Fuzzing Tests
 *
 * Tests that various inputs are properly sanitized and don't cause crashes.
 * Covers path validation, deep link parsing, and external URL validation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import os from 'os';

// ── Mocks ────────────────────────────────────────────────────────────────────

const MOCK_HOME = path.resolve(os.tmpdir(), 'fuzz-home');

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn((name: string) => {
      const paths: Record<string, string> = {
        home: MOCK_HOME,
        desktop: path.join(MOCK_HOME, 'Desktop'),
        documents: path.join(MOCK_HOME, 'Documents'),
        downloads: path.join(MOCK_HOME, 'Downloads'),
        userData: path.resolve(os.tmpdir(), 'fuzz-appdata'),
        temp: path.resolve(os.tmpdir(), 'fuzz-tmp'),
      };
      return paths[name] || path.join(MOCK_HOME, name);
    }),
  },
  session: {
    defaultSession: {
      webRequest: { onBeforeRequest: vi.fn() },
    },
  },
  shell: {
    openExternal: vi.fn(),
  },
}));

import { validateFilePath, initAllowedPaths } from '../path-validation';
import { parseDeepLink } from '../../protocol/deep-link';
import { validateExternalURL } from '../network-security';

describe('Input Fuzzing', () => {
  describe('Path validation fuzzing', () => {
    beforeEach(() => {
      initAllowedPaths();
    });

    const maliciousPaths = [
      '',
      ' ',
      '\0',
      'file\0.txt',
      '../../../etc/passwd',
      '....//....//....//etc/passwd',
      'CON', // Windows reserved
      'NUL',
      'COM1',
      'PRN',
      'AUX',
      'LPT1',
      'a'.repeat(10000), // Very long path
      '/%00/test',
      '/dev/null',
      '\\\\server\\share', // UNC path
      'C:\\Windows\\System32\\cmd.exe',
    ];

    for (const input of maliciousPaths) {
      it(`rejects malicious path: ${JSON.stringify(input).slice(0, 50)}`, () => {
        expect(() => validateFilePath(input)).toThrow();
      });
    }
  });

  describe('Deep link fuzzing', () => {
    // URLs that must be rejected at the protocol level
    const rejectedURLs = [
      '',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'openagent://admin/delete',
      'openagent://chat?message=' + 'A'.repeat(10000),
      'openagent://user:pass@chat',
      'http://evil.com',
      'file:///etc/passwd',
      'openagent://chat?evil=true',
      'openagent://../../etc/passwd',
    ];

    for (const url of rejectedURLs) {
      it(`rejects malicious deep link: ${JSON.stringify(url).slice(0, 60)}`, () => {
        const result = parseDeepLink(url);
        expect(result).toBeNull();
      });
    }

    // URLs with HTML in params pass deep link validation but get sanitized by DOMPurify in renderer
    it('allows HTML in params (sanitized by renderer DOMPurify)', () => {
      const result = parseDeepLink('openagent://chat?message=<b>bold</b>');
      // Deep link parser allows this - actual XSS defense is in renderer
      expect(result).not.toBeNull();
    });

    // Null bytes get stripped by URL constructor, result is valid
    it('handles null bytes stripped by URL parsing', () => {
      const result = parseDeepLink('openagent://chat?message=\x00\x01\x02');
      // URL constructor strips control chars, result may be valid with empty message
      // This is acceptable - defense in depth at renderer layer
      if (result) {
        expect(result.route).toBe('/chat');
      }
    });
  });

  describe('External URL fuzzing', () => {
    const maliciousURLs = [
      '',
      'javascript:alert(1)',
      'data:text/html,evil',
      'http://example.com',
      'ftp://example.com',
      'file:///etc/passwd',
      'https://localhost',
      'https://127.0.0.1',
      'https://0.0.0.0',
      'https://user:pass@example.com',
      'https://example.com:8080',
      'https://10.0.0.1/admin',
      'https://192.168.1.1',
      'https://[::1]',
    ];

    for (const url of maliciousURLs) {
      it(`rejects malicious external URL: ${JSON.stringify(url).slice(0, 60)}`, () => {
        const result = validateExternalURL(url);
        expect(result).toBeNull();
      });
    }
  });
});
