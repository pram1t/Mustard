import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((value: string) => Buffer.from(`encrypted:${value}`)),
    decryptString: vi.fn((buf: Buffer) => {
      const str = buf.toString();
      return str.startsWith('encrypted:') ? str.slice('encrypted:'.length) : str;
    }),
  },
  app: {
    getPath: vi.fn(() => '/tmp/test-userData'),
    getAppPath: vi.fn(() => '/tmp/test-app'),
  },
}));

// Mock fs
const mockFiles = new Map<string, Buffer>();
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(async (filePath: string, encoding?: string) => {
      const content = mockFiles.get(filePath);
      if (!content) {
        const err = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
        (err as NodeJS.ErrnoException).code = 'ENOENT';
        throw err;
      }
      return encoding ? content.toString(encoding as BufferEncoding) : content;
    }),
    writeFile: vi.fn(async (filePath: string, data: Buffer | string) => {
      mockFiles.set(filePath, Buffer.isBuffer(data) ? data : Buffer.from(data));
    }),
    unlink: vi.fn(async (filePath: string) => {
      mockFiles.delete(filePath);
    }),
    mkdir: vi.fn(async () => {}),
  },
}));

import { CredentialService } from '../credentials';
import path from 'path';

const MOCK_USER_DATA = '/tmp/test-userData';
const MOCK_META_PATH = path.join(MOCK_USER_DATA, 'credentials.json');

describe('CredentialService', () => {
  let service: CredentialService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFiles.clear();
    service = new CredentialService();
  });

  it('initializes successfully with no existing data', async () => {
    await service.initialize();
    expect(service.list('api_key')).toEqual([]);
  });

  it('initializes and loads existing metadata', async () => {
    const meta = [
      { id: 'openai', type: 'api_key', label: 'test', createdAt: 1000, updatedAt: 2000 },
    ];
    mockFiles.set(MOCK_META_PATH, Buffer.from(JSON.stringify(meta)));

    await service.initialize();
    const keys = service.list('api_key');
    expect(keys).toHaveLength(1);
    expect(keys[0].id).toBe('openai');
  });

  it('stores and retrieves a credential', async () => {
    await service.initialize();
    await service.store('api_key', 'openai', 'sk-test-key-123', 'OpenAI Key');

    const value = await service.retrieve('api_key', 'openai');
    expect(value).toBe('sk-test-key-123');
  });

  it('has() returns true after storing', async () => {
    await service.initialize();
    expect(service.has('api_key', 'openai')).toBe(false);

    await service.store('api_key', 'openai', 'sk-test');
    expect(service.has('api_key', 'openai')).toBe(true);
  });

  it('delete() removes a credential', async () => {
    await service.initialize();
    await service.store('api_key', 'openai', 'sk-test');
    expect(service.has('api_key', 'openai')).toBe(true);

    await service.delete('api_key', 'openai');
    expect(service.has('api_key', 'openai')).toBe(false);
  });

  it('retrieve() returns null for non-existent credential', async () => {
    await service.initialize();
    const value = await service.retrieve('api_key', 'nonexistent');
    expect(value).toBeNull();
  });

  it('list() filters by credential type', async () => {
    await service.initialize();
    await service.store('api_key', 'openai', 'sk-1');
    await service.store('api_key', 'anthropic', 'sk-2');
    await service.store('mcp_secret', 'server1', 'secret-1');

    expect(service.list('api_key')).toHaveLength(2);
    expect(service.list('mcp_secret')).toHaveLength(1);
  });

  it('isSecureStorageAvailable() returns true when safeStorage available', () => {
    expect(service.isSecureStorageAvailable()).toBe(true);
  });

  it('getStorageBackend() returns backend info', () => {
    const info = service.getStorageBackend();
    expect(info.secure).toBe(true);
    expect(info.backend).toBeTruthy();
  });

  it('throws if not initialized', () => {
    expect(() => service.has('api_key', 'test')).toThrow('not initialized');
    expect(() => service.list('api_key')).toThrow('not initialized');
  });

  it('updates metadata on re-store', async () => {
    await service.initialize();
    await service.store('api_key', 'openai', 'sk-1', 'Initial');

    const meta1 = service.list('api_key')[0];
    expect(meta1.label).toBe('Initial');

    await service.store('api_key', 'openai', 'sk-2', 'Updated');
    const meta2 = service.list('api_key')[0];
    expect(meta2.label).toBe('Updated');
    expect(meta2.createdAt).toBe(meta1.createdAt);
    expect(meta2.updatedAt).toBeGreaterThanOrEqual(meta1.updatedAt);
  });
});
