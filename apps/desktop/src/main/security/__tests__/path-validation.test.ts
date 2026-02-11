import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import os from 'os';

// Use real temp dir for platform-compatible absolute paths
const MOCK_HOME = path.resolve(os.tmpdir(), 'mock-home');
const MOCK_DOCS = path.join(MOCK_HOME, 'Documents');
const MOCK_DESKTOP = path.join(MOCK_HOME, 'Desktop');
const MOCK_DOWNLOADS = path.join(MOCK_HOME, 'Downloads');
const MOCK_APPDATA = path.resolve(os.tmpdir(), 'mock-appdata');
const MOCK_TEMP = path.resolve(os.tmpdir(), 'mock-tmp');

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      const paths: Record<string, string> = {
        home: MOCK_HOME,
        desktop: MOCK_DESKTOP,
        documents: MOCK_DOCS,
        downloads: MOCK_DOWNLOADS,
        userData: MOCK_APPDATA,
        temp: MOCK_TEMP,
      };
      return paths[name] || path.join(MOCK_HOME, name);
    }),
  },
}));

import { validateFilePath, initAllowedPaths, PathValidationError } from '../path-validation';

describe('Path Validation', () => {
  beforeEach(() => {
    initAllowedPaths();
  });

  it('accepts paths under allowed directories', () => {
    const docPath = path.join(MOCK_DOCS, 'file.txt');
    const result = validateFilePath(docPath);
    expect(result).toBe(path.resolve(docPath));
  });

  it('rejects empty paths', () => {
    expect(() => validateFilePath('')).toThrow(PathValidationError);
  });

  it('rejects null-byte paths', () => {
    const malicious = path.join(MOCK_HOME, 'file\0.txt');
    expect(() => validateFilePath(malicious)).toThrow('null bytes');
  });

  it('rejects paths outside allowed directories', () => {
    // Use a path that's definitely outside all allowed dirs
    const outside = path.resolve('/definitely-not-allowed/passwd');
    expect(() => validateFilePath(outside)).toThrow('outside allowed');
  });

  it('resolves relative-style paths with ..', () => {
    const filePath = path.join(MOCK_DOCS, '..', 'Documents', 'test.txt');
    const result = validateFilePath(filePath);
    expect(result).toBe(path.resolve(filePath));
  });

  it('blocks directory traversal attempts', () => {
    // Try to traverse out of the allowed tree
    const traversal = path.join(MOCK_HOME, '..', '..', '..', '..', 'etc', 'passwd');
    const resolved = path.resolve(traversal);
    // On Windows this resolves to something like E:\etc\passwd which is outside allowed dirs
    expect(() => validateFilePath(traversal)).toThrow('outside allowed');
  });
});
