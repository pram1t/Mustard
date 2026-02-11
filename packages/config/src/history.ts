/**
 * History Manager
 *
 * Manages session history stored in .openagent/history/ using JSONL format.
 * Supports append-only writes and history rotation.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getHistoryDir } from './project.js';
import type { HistoryEntry } from './types.js';

/**
 * Ensure history directory exists
 */
async function ensureHistoryDir(cwd: string): Promise<string> {
  const historyDir = await getHistoryDir(cwd);
  await fs.mkdir(historyDir, { recursive: true });
  return historyDir;
}

/**
 * Get path to a session's history file
 */
function getSessionPath(historyDir: string, sessionId: string): string {
  // Sanitize session ID to prevent path traversal
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(historyDir, `${safeId}.jsonl`);
}

/**
 * Append an entry to session history
 */
export async function appendToHistory(
  cwd: string,
  sessionId: string,
  entry: HistoryEntry
): Promise<void> {
  const historyDir = await ensureHistoryDir(cwd);
  const sessionPath = getSessionPath(historyDir, sessionId);

  // Ensure timestamp is set
  const entryWithTimestamp: HistoryEntry = {
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
  };

  // Append as JSONL (one JSON object per line)
  const line = JSON.stringify(entryWithTimestamp) + '\n';
  await fs.appendFile(sessionPath, line, 'utf-8');
}

/**
 * Load all history entries for a session
 */
export async function loadHistory(
  cwd: string,
  sessionId: string
): Promise<HistoryEntry[]> {
  const historyDir = await getHistoryDir(cwd);
  const sessionPath = getSessionPath(historyDir, sessionId);

  try {
    const content = await fs.readFile(sessionPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    return lines.map((line, index) => {
      try {
        return JSON.parse(line) as HistoryEntry;
      } catch (error) {
        console.warn(`Invalid JSON at line ${index + 1} in ${sessionPath}`);
        return null;
      }
    }).filter((entry): entry is HistoryEntry => entry !== null);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * List all session IDs in history
 */
export async function listSessions(cwd: string): Promise<string[]> {
  const historyDir = await getHistoryDir(cwd);

  try {
    const files = await fs.readdir(historyDir);
    return files
      .filter((file) => file.endsWith('.jsonl'))
      .map((file) => file.slice(0, -6)); // Remove .jsonl extension
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Get session metadata (entry count, first/last timestamp)
 */
export async function getSessionInfo(
  cwd: string,
  sessionId: string
): Promise<{
  entryCount: number;
  firstEntry: Date | null;
  lastEntry: Date | null;
  sizeBytes: number;
} | null> {
  const historyDir = await getHistoryDir(cwd);
  const sessionPath = getSessionPath(historyDir, sessionId);

  try {
    const stat = await fs.stat(sessionPath);
    const entries = await loadHistory(cwd, sessionId);

    let firstEntry: Date | null = null;
    let lastEntry: Date | null = null;

    if (entries.length > 0) {
      firstEntry = new Date(entries[0].timestamp);
      lastEntry = new Date(entries[entries.length - 1].timestamp);
    }

    return {
      entryCount: entries.length,
      firstEntry,
      lastEntry,
      sizeBytes: stat.size,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Clear history for a specific session
 */
export async function clearSessionHistory(
  cwd: string,
  sessionId: string
): Promise<boolean> {
  const historyDir = await getHistoryDir(cwd);
  const sessionPath = getSessionPath(historyDir, sessionId);

  try {
    await fs.unlink(sessionPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/**
 * Clear all history
 */
export async function clearAllHistory(cwd: string): Promise<number> {
  const sessions = await listSessions(cwd);
  let deleted = 0;

  for (const sessionId of sessions) {
    if (await clearSessionHistory(cwd, sessionId)) {
      deleted++;
    }
  }

  return deleted;
}

/**
 * Rotate history based on age and size limits
 */
export async function rotateHistory(
  cwd: string,
  options: {
    maxAgeDays?: number;
    maxSizeBytes?: number;
    maxSessions?: number;
  } = {}
): Promise<{ deletedSessions: string[]; freedBytes: number }> {
  const { maxAgeDays = 30, maxSizeBytes, maxSessions } = options;
  const historyDir = await getHistoryDir(cwd);
  const sessions = await listSessions(cwd);

  const deletedSessions: string[] = [];
  let freedBytes = 0;

  // Collect session info
  const sessionInfos: Array<{
    sessionId: string;
    lastEntry: Date;
    sizeBytes: number;
  }> = [];

  for (const sessionId of sessions) {
    const info = await getSessionInfo(cwd, sessionId);
    if (info) {
      sessionInfos.push({
        sessionId,
        lastEntry: info.lastEntry || new Date(0),
        sizeBytes: info.sizeBytes,
      });
    }
  }

  // Sort by last entry date (oldest first)
  sessionInfos.sort((a, b) => a.lastEntry.getTime() - b.lastEntry.getTime());

  const now = new Date();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  // Delete old sessions
  for (const info of sessionInfos) {
    const age = now.getTime() - info.lastEntry.getTime();
    if (age > maxAgeMs) {
      const sessionPath = getSessionPath(historyDir, info.sessionId);
      try {
        await fs.unlink(sessionPath);
        deletedSessions.push(info.sessionId);
        freedBytes += info.sizeBytes;
      } catch {
        // Ignore deletion errors
      }
    }
  }

  // Remove deleted sessions from list
  const remainingSessions = sessionInfos.filter(
    (info) => !deletedSessions.includes(info.sessionId)
  );

  // Enforce max sessions limit
  if (maxSessions && remainingSessions.length > maxSessions) {
    const toDelete = remainingSessions.slice(0, remainingSessions.length - maxSessions);
    for (const info of toDelete) {
      const sessionPath = getSessionPath(historyDir, info.sessionId);
      try {
        await fs.unlink(sessionPath);
        deletedSessions.push(info.sessionId);
        freedBytes += info.sizeBytes;
      } catch {
        // Ignore deletion errors
      }
    }
  }

  // Enforce max size limit (delete oldest until under limit)
  if (maxSizeBytes) {
    const finalRemaining = sessionInfos.filter(
      (info) => !deletedSessions.includes(info.sessionId)
    );
    let totalSize = finalRemaining.reduce((sum, info) => sum + info.sizeBytes, 0);

    for (const info of finalRemaining) {
      if (totalSize <= maxSizeBytes) break;

      const sessionPath = getSessionPath(historyDir, info.sessionId);
      try {
        await fs.unlink(sessionPath);
        deletedSessions.push(info.sessionId);
        freedBytes += info.sizeBytes;
        totalSize -= info.sizeBytes;
      } catch {
        // Ignore deletion errors
      }
    }
  }

  return { deletedSessions, freedBytes };
}

/**
 * Export history to a single JSON file
 */
export async function exportHistory(
  cwd: string,
  sessionId: string,
  outputPath: string
): Promise<void> {
  const entries = await loadHistory(cwd, sessionId);
  await fs.writeFile(outputPath, JSON.stringify(entries, null, 2), 'utf-8');
}

/**
 * Import history from a JSON file
 */
export async function importHistory(
  cwd: string,
  sessionId: string,
  inputPath: string,
  options: { append?: boolean } = {}
): Promise<number> {
  const content = await fs.readFile(inputPath, 'utf-8');
  const entries = JSON.parse(content) as HistoryEntry[];

  if (!options.append) {
    await clearSessionHistory(cwd, sessionId);
  }

  for (const entry of entries) {
    await appendToHistory(cwd, sessionId, entry);
  }

  return entries.length;
}
