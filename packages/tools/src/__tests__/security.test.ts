/**
 * Security Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import {
  sanitizePath,
  validateRegexPattern,
  validateCommand,
} from '../security';
import { resetConfig } from '@openagent/config';

describe('Security', () => {
  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    resetConfig();
  });

  describe('sanitizePath', () => {
    const baseDir = os.tmpdir();

    it('should allow valid paths within base directory', () => {
      const result = sanitizePath('subdir/file.txt', baseDir);
      expect(result).toBe(path.join(baseDir, 'subdir/file.txt'));
    });

    it('should allow absolute paths within base directory', () => {
      const validPath = path.join(baseDir, 'subdir', 'file.txt');
      const result = sanitizePath(validPath, baseDir);
      expect(result).toBe(validPath);
    });

    it('should reject path traversal with ..', () => {
      expect(() => sanitizePath('../etc/passwd', baseDir)).toThrow('Path traversal is not allowed');
    });

    it('should reject URL-encoded path traversal', () => {
      expect(() => sanitizePath('%2e%2e/etc/passwd', baseDir)).toThrow('Path traversal is not allowed');
    });

    it('should reject paths with null bytes', () => {
      expect(() => sanitizePath('file.txt\0.exe', baseDir)).toThrow('invalid characters');
    });

    it('should reject very long paths', () => {
      const longPath = 'a'.repeat(5000);
      expect(() => sanitizePath(longPath, baseDir)).toThrow('exceeds maximum length');
    });
  });

  describe('validateRegexPattern', () => {
    it('should allow valid regex patterns', () => {
      expect(validateRegexPattern('hello.*world')).toBe(true);
      expect(validateRegexPattern('^[a-z]+$')).toBe(true);
      expect(validateRegexPattern('\\d{3}-\\d{4}')).toBe(true);
    });

    it('should reject very long patterns', () => {
      const longPattern = 'a'.repeat(1500);
      expect(() => validateRegexPattern(longPattern)).toThrow('exceeds maximum length');
    });

    it('should reject invalid regex syntax', () => {
      expect(() => validateRegexPattern('[unclosed')).toThrow('Invalid regex pattern');
      expect(() => validateRegexPattern('(?invalid)')).toThrow('Invalid regex pattern');
    });

    it('should detect potentially dangerous patterns', () => {
      // These patterns could cause catastrophic backtracking
      expect(() => validateRegexPattern('(.*)+.*')).toThrow('performance issues');
      expect(() => validateRegexPattern('(.+)+')).toThrow('performance issues');
    });
  });

  describe('validateCommand', () => {
    it('should allow valid commands', () => {
      expect(validateCommand('ls -la')).toBe(true);
      expect(validateCommand('git status')).toBe(true);
      expect(validateCommand('npm install --save-dev typescript')).toBe(true);
    });

    it('should reject commands with null bytes', () => {
      expect(() => validateCommand('ls\0rm -rf /')).toThrow('invalid characters');
    });

    it('should reject very long commands', () => {
      const longCommand = 'echo ' + 'a'.repeat(40000);
      expect(() => validateCommand(longCommand)).toThrow('exceeds maximum length');
    });
  });
});
