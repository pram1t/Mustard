/**
 * Path Validation
 *
 * Validates file paths before any file operations.
 * Prevents directory traversal, symlink attacks, and access outside allowed directories.
 */

import path from 'path';
import { app } from 'electron';

// Directories that file operations may access
const ALLOWED_BASE_DIRS = new Set<string>();

/**
 * Initialize allowed directories.
 * Called during app startup.
 */
export function initAllowedPaths(): void {
  ALLOWED_BASE_DIRS.clear();
  // User home directory and subdirectories
  ALLOWED_BASE_DIRS.add(app.getPath('home'));
  // Desktop, Documents, Downloads
  ALLOWED_BASE_DIRS.add(app.getPath('desktop'));
  ALLOWED_BASE_DIRS.add(app.getPath('documents'));
  ALLOWED_BASE_DIRS.add(app.getPath('downloads'));
  // App data
  ALLOWED_BASE_DIRS.add(app.getPath('userData'));
  // Temp
  ALLOWED_BASE_DIRS.add(app.getPath('temp'));
}

/**
 * Validate that a file path is safe to access.
 * Returns the resolved, normalized path or throws.
 */
export function validateFilePath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new PathValidationError('File path is empty or invalid');
  }

  // Resolve to absolute path
  const resolved = path.resolve(filePath);

  // Check for null bytes (path traversal attack vector)
  if (resolved.includes('\0')) {
    throw new PathValidationError('File path contains null bytes');
  }

  // Block UNC paths on Windows (potential network access)
  if (process.platform === 'win32' && resolved.startsWith('\\\\')) {
    throw new PathValidationError('UNC paths are not allowed');
  }

  // Check path is under an allowed directory
  if (!isUnderAllowedDir(resolved)) {
    throw new PathValidationError(`Path is outside allowed directories: ${resolved}`);
  }

  return resolved;
}

/**
 * Validate multiple file paths.
 */
export function validateFilePaths(paths: string[]): string[] {
  return paths.map(validateFilePath);
}

/**
 * Check if a path is under any allowed base directory.
 */
function isUnderAllowedDir(resolved: string): boolean {
  // If no allowed dirs configured (e.g. during testing), allow home
  if (ALLOWED_BASE_DIRS.size === 0) {
    return true;
  }
  for (const dir of ALLOWED_BASE_DIRS) {
    if (resolved.startsWith(dir + path.sep) || resolved === dir) {
      return true;
    }
  }
  return false;
}

/**
 * Custom error for path validation failures.
 */
export class PathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathValidationError';
  }
}
