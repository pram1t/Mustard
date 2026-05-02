/**
 * SessionManager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SessionManager } from '../manager.js';
import type { SessionData } from '../types.js';
import type { ContextState } from '../../context/types.js';

describe('SessionManager', () => {
  let testDir: string;
  let manager: SessionManager;

  beforeEach(() => {
    // Create a unique test directory
    testDir = path.join(os.tmpdir(), `session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    manager = new SessionManager(testDir);
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testDir, file));
      }
      fs.rmdirSync(testDir);
    }
  });

  /**
   * Create a mock context state for testing
   */
  function createMockContext(): ContextState {
    return {
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' },
      ],
      tokenCount: 100,
      systemTokens: 20,
      wasCompacted: false,
      messagesRemoved: 0,
    };
  }

  /**
   * Create a mock session data for testing
   */
  function createMockSession(id?: string): SessionData {
    return {
      id: id || manager.generateId(),
      version: 1,
      metadata: {
        cwd: '/test/path',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 3,
        provider: 'openai',
        model: 'gpt-4o',
      },
      context: createMockContext(),
    };
  }

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = manager.generateId();
      const id2 = manager.generateId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^session_\d+_[a-z0-9]+$/);
    });

    it('should generate IDs with session prefix', () => {
      const id = manager.generateId();
      expect(id.startsWith('session_')).toBe(true);
    });
  });

  describe('getSessionDir', () => {
    it('should return the configured session directory', () => {
      expect(manager.getSessionDir()).toBe(testDir);
    });

    it('should default to ~/.mustard/sessions', () => {
      const defaultManager = new SessionManager();
      expect(defaultManager.getSessionDir()).toBe(
        path.join(os.homedir(), '.mustard', 'sessions')
      );
    });
  });

  describe('save', () => {
    it('should create session file on disk', () => {
      const session = createMockSession('test-session-1');
      manager.save(session);

      const filePath = path.join(testDir, 'test-session-1.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should save session data as JSON', () => {
      const session = createMockSession('test-session-2');
      manager.save(session);

      const filePath = path.join(testDir, 'test-session-2.json');
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.id).toBe('test-session-2');
      expect(parsed.version).toBe(1);
      expect(parsed.metadata.cwd).toBe('/test/path');
      expect(parsed.context.messages).toHaveLength(3);
    });

    it('should update updatedAt timestamp on save', () => {
      const session = createMockSession('test-session-3');
      const originalUpdatedAt = session.metadata.updatedAt;

      // Wait a bit to ensure timestamp difference
      manager.save(session);

      const loaded = manager.load('test-session-3');
      expect(loaded).not.toBeNull();
      expect(new Date(loaded!.metadata.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalUpdatedAt).getTime()
      );
    });

    it('should update messageCount on save', () => {
      const session = createMockSession('test-session-4');
      session.metadata.messageCount = 0; // Wrong count

      manager.save(session);

      const loaded = manager.load('test-session-4');
      expect(loaded?.metadata.messageCount).toBe(3); // Corrected from context
    });

    it('should create session directory if not exists', () => {
      const newDir = path.join(testDir, 'nested', 'sessions');
      const nestedManager = new SessionManager(newDir);
      const session = createMockSession('nested-session');

      nestedManager.save(session);

      expect(fs.existsSync(newDir)).toBe(true);
      expect(fs.existsSync(path.join(newDir, 'nested-session.json'))).toBe(true);

      // Clean up nested directory
      fs.unlinkSync(path.join(newDir, 'nested-session.json'));
      fs.rmdirSync(newDir);
      fs.rmdirSync(path.join(testDir, 'nested'));
    });
  });

  describe('load', () => {
    it('should return session data for existing session', () => {
      const session = createMockSession('load-test-1');
      manager.save(session);

      const loaded = manager.load('load-test-1');

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe('load-test-1');
      expect(loaded?.metadata.cwd).toBe('/test/path');
      expect(loaded?.context.messages).toHaveLength(3);
    });

    it('should return null for non-existent session', () => {
      const loaded = manager.load('non-existent-session');
      expect(loaded).toBeNull();
    });

    it('should preserve all context state', () => {
      const session = createMockSession('load-test-2');
      session.context.wasCompacted = true;
      session.context.messagesRemoved = 5;
      manager.save(session);

      const loaded = manager.load('load-test-2');

      expect(loaded?.context.wasCompacted).toBe(true);
      expect(loaded?.context.messagesRemoved).toBe(5);
      expect(loaded?.context.tokenCount).toBe(100);
      expect(loaded?.context.systemTokens).toBe(20);
    });
  });

  describe('list', () => {
    it('should return empty array when no sessions exist', () => {
      const sessions = manager.list();
      expect(sessions).toEqual([]);
    });

    it('should return all sessions', () => {
      manager.save(createMockSession('list-test-1'));
      manager.save(createMockSession('list-test-2'));
      manager.save(createMockSession('list-test-3'));

      const sessions = manager.list();

      expect(sessions).toHaveLength(3);
      expect(sessions.map((s) => s.id).sort()).toEqual([
        'list-test-1',
        'list-test-2',
        'list-test-3',
      ]);
    });

    it('should sort sessions by updatedAt (newest first)', async () => {
      // Directly write session files to control exact timestamps
      // (save() automatically updates updatedAt to current time)
      const session1 = createMockSession('sort-test-1');
      session1.metadata.updatedAt = '2024-01-01T00:00:00Z';

      const session2 = createMockSession('sort-test-2');
      session2.metadata.updatedAt = '2024-01-03T00:00:00Z';

      const session3 = createMockSession('sort-test-3');
      session3.metadata.updatedAt = '2024-01-02T00:00:00Z';

      // Ensure directory exists
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      // Write files directly to preserve exact timestamps
      fs.writeFileSync(path.join(testDir, 'sort-test-1.json'), JSON.stringify(session1, null, 2));
      fs.writeFileSync(path.join(testDir, 'sort-test-2.json'), JSON.stringify(session2, null, 2));
      fs.writeFileSync(path.join(testDir, 'sort-test-3.json'), JSON.stringify(session3, null, 2));

      const sessions = manager.list();

      expect(sessions[0].id).toBe('sort-test-2'); // Newest
      expect(sessions[1].id).toBe('sort-test-3'); // Middle
      expect(sessions[2].id).toBe('sort-test-1'); // Oldest
    });

    it('should return correct session list items', () => {
      const session = createMockSession('list-item-test');
      session.metadata.cwd = '/my/project';
      session.metadata.createdAt = '2024-06-15T10:00:00Z';
      session.metadata.updatedAt = '2024-06-15T12:00:00Z';
      manager.save(session);

      const sessions = manager.list();

      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toEqual({
        id: 'list-item-test',
        createdAt: '2024-06-15T10:00:00Z',
        updatedAt: expect.any(String), // Updated by save()
        messageCount: 3,
        cwd: '/my/project',
      });
    });
  });

  describe('delete', () => {
    it('should delete existing session', () => {
      manager.save(createMockSession('delete-test-1'));

      const result = manager.delete('delete-test-1');

      expect(result).toBe(true);
      expect(manager.load('delete-test-1')).toBeNull();
    });

    it('should return false for non-existent session', () => {
      const result = manager.delete('non-existent-session');
      expect(result).toBe(false);
    });

    it('should remove file from disk', () => {
      manager.save(createMockSession('delete-test-2'));
      const filePath = path.join(testDir, 'delete-test-2.json');

      expect(fs.existsSync(filePath)).toBe(true);

      manager.delete('delete-test-2');

      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true for existing session', () => {
      manager.save(createMockSession('exists-test-1'));
      expect(manager.exists('exists-test-1')).toBe(true);
    });

    it('should return false for non-existent session', () => {
      expect(manager.exists('non-existent')).toBe(false);
    });
  });

  describe('createSession', () => {
    it('should create session data with provided options', () => {
      const context = createMockContext();
      const session = manager.createSession({
        cwd: '/custom/path',
        context,
        provider: 'anthropic',
        model: 'claude-3',
      });

      expect(session.id).toMatch(/^session_/);
      expect(session.version).toBe(1);
      expect(session.metadata.cwd).toBe('/custom/path');
      expect(session.metadata.provider).toBe('anthropic');
      expect(session.metadata.model).toBe('claude-3');
      expect(session.metadata.messageCount).toBe(3);
      expect(session.context).toBe(context);
    });

    it('should use provided ID if specified', () => {
      const context = createMockContext();
      const session = manager.createSession({
        id: 'custom-id-123',
        cwd: '/path',
        context,
      });

      expect(session.id).toBe('custom-id-123');
    });

    it('should set createdAt and updatedAt to current time', () => {
      const before = new Date();
      const session = manager.createSession({
        cwd: '/path',
        context: createMockContext(),
      });
      const after = new Date();

      const createdAt = new Date(session.metadata.createdAt);
      const updatedAt = new Date(session.metadata.updatedAt);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
