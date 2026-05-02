/**
 * Session Manager
 *
 * Manages session persistence to the filesystem.
 * Sessions are stored as JSON files in ~/.mustard/sessions/
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { getLogger } from '@pram1t/mustard-logger';
import type { SessionData, SessionListItem, SessionMetadata } from './types.js';
import type { ContextState } from '../context/types.js';

/**
 * Session Manager
 *
 * Provides save, load, list, and delete operations for sessions.
 */
export class SessionManager {
  private sessionDir: string;

  /**
   * Create a new session manager.
   *
   * @param baseDir - Optional custom base directory for sessions
   */
  constructor(baseDir?: string) {
    this.sessionDir = baseDir || path.join(os.homedir(), '.mustard', 'sessions');
  }

  /**
   * Get the session directory path.
   */
  getSessionDir(): string {
    return this.sessionDir;
  }

  /**
   * Ensure the session directory exists.
   */
  private ensureSessionDir(): void {
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  /**
   * Get the file path for a session.
   *
   * @param id - Session ID
   * @returns Full file path
   */
  private getSessionPath(id: string): string {
    return path.join(this.sessionDir, `${id}.json`);
  }

  /**
   * Generate a unique session ID.
   *
   * Format: session_{timestamp}_{uuid8}
   *
   * @returns Unique session ID
   */
  generateId(): string {
    return `session_${Date.now()}_${randomUUID().substring(0, 8)}`;
  }

  /**
   * Save a session to disk.
   *
   * @param data - Session data to save
   */
  save(data: SessionData): void {
    const logger = getLogger();
    this.ensureSessionDir();

    // Update metadata
    data.metadata.updatedAt = new Date().toISOString();
    data.metadata.messageCount = data.context.messages.length;

    const filePath = this.getSessionPath(data.id);

    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      logger.debug('Session saved', {
        sessionId: data.id,
        messageCount: data.metadata.messageCount,
      });
    } catch (error) {
      logger.error('Failed to save session', {
        sessionId: data.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Load a session from disk.
   *
   * @param id - Session ID to load
   * @returns Session data or null if not found
   */
  load(id: string): SessionData | null {
    const logger = getLogger();
    const filePath = this.getSessionPath(id);

    if (!fs.existsSync(filePath)) {
      logger.debug('Session not found', { sessionId: id });
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content) as SessionData;

      logger.debug('Session loaded', {
        sessionId: data.id,
        messageCount: data.metadata.messageCount,
      });

      return data;
    } catch (error) {
      logger.error('Failed to load session', {
        sessionId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * List all saved sessions.
   *
   * @returns Array of session list items, sorted by updatedAt (newest first)
   */
  list(): SessionListItem[] {
    const logger = getLogger();
    this.ensureSessionDir();

    try {
      const files = fs.readdirSync(this.sessionDir).filter((f) => f.endsWith('.json'));

      const sessions: SessionListItem[] = [];

      for (const file of files) {
        const id = file.replace('.json', '');
        const data = this.load(id);

        if (data) {
          sessions.push({
            id: data.id,
            createdAt: data.metadata.createdAt,
            updatedAt: data.metadata.updatedAt,
            messageCount: data.metadata.messageCount,
            cwd: data.metadata.cwd,
          });
        }
      }

      // Sort by updatedAt, newest first
      return sessions.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch (error) {
      logger.error('Failed to list sessions', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Delete a session.
   *
   * @param id - Session ID to delete
   * @returns True if deleted, false if not found
   */
  delete(id: string): boolean {
    const logger = getLogger();
    const filePath = this.getSessionPath(id);

    if (!fs.existsSync(filePath)) {
      logger.debug('Session not found for deletion', { sessionId: id });
      return false;
    }

    try {
      fs.unlinkSync(filePath);
      logger.debug('Session deleted', { sessionId: id });
      return true;
    } catch (error) {
      logger.error('Failed to delete session', {
        sessionId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Create a new session data object.
   *
   * @param options - Session creation options
   * @returns New session data ready to be saved
   */
  createSession(options: {
    id?: string;
    cwd: string;
    context: ContextState;
    provider?: string;
    model?: string;
  }): SessionData {
    const now = new Date().toISOString();

    return {
      id: options.id || this.generateId(),
      version: 1,
      metadata: {
        cwd: options.cwd,
        createdAt: now,
        updatedAt: now,
        messageCount: options.context.messages.length,
        provider: options.provider,
        model: options.model,
      },
      context: options.context,
    };
  }

  /**
   * Check if a session exists.
   *
   * @param id - Session ID to check
   * @returns True if session exists
   */
  exists(id: string): boolean {
    return fs.existsSync(this.getSessionPath(id));
  }
}
