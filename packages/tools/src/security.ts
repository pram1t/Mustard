/**
 * Security Utilities
 *
 * Input sanitization and validation functions to prevent:
 * - Path traversal attacks
 * - ReDoS (Regular Expression Denial of Service)
 * - Command injection
 */

import * as path from 'path';
import * as fs from 'fs';
import { getConfig } from '@openagent/config';
import { getLogger } from '@openagent/logger';

/**
 * Maximum allowed path length
 */
const MAX_PATH_LENGTH = 4096;

/**
 * Maximum allowed regex pattern length
 */
const MAX_REGEX_LENGTH = 1000;

/**
 * Patterns that indicate potential path traversal
 */
const PATH_TRAVERSAL_PATTERNS = [
  '..', // Parent directory
  '\\.\\.',  // Escaped dots
  '%2e%2e', // URL encoded
  '%252e%252e', // Double URL encoded
];

/**
 * Sanitize and validate a file path.
 * Prevents path traversal attacks by:
 * 1. Resolving to absolute path
 * 2. Checking path is within allowed directory
 * 3. Detecting traversal patterns
 *
 * @param filePath - The path to validate
 * @param baseDir - The base directory paths should be within
 * @returns The normalized absolute path
 * @throws Error if path is invalid or attempts traversal
 */
export function sanitizePath(filePath: string, baseDir: string): string {
  const config = getConfig();
  const logger = getLogger();

  if (!config.security.sanitizeInputs) {
    // Sanitization disabled, just normalize
    return path.resolve(baseDir, filePath);
  }

  // Check path length
  if (filePath.length > MAX_PATH_LENGTH) {
    throw new Error(`Path exceeds maximum length of ${MAX_PATH_LENGTH} characters`);
  }

  // Check for null bytes (can bypass some checks)
  if (filePath.includes('\0')) {
    logger.warn('Path contains null byte', { filePath: filePath.substring(0, 50) });
    throw new Error('Path contains invalid characters');
  }

  // Detect explicit traversal patterns
  const lowerPath = filePath.toLowerCase();
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (lowerPath.includes(pattern)) {
      logger.warn('Path traversal attempt detected', { pattern, filePath: filePath.substring(0, 100) });
      throw new Error('Path traversal is not allowed');
    }
  }

  // Resolve to absolute path
  let absolutePath = path.resolve(baseDir, filePath);
  const normalizedBase = path.resolve(baseDir);

  // Resolve symlinks to prevent symlink attacks
  // This ensures we validate the actual target, not the symlink path
  try {
    absolutePath = fs.realpathSync(absolutePath);
  } catch {
    // File doesn't exist yet (write operation) - validate parent directory
    const dir = path.dirname(absolutePath);
    try {
      const resolvedDir = fs.realpathSync(dir);
      absolutePath = path.join(resolvedDir, path.basename(absolutePath));
    } catch {
      // Parent doesn't exist either, use original resolved path
    }
  }

  // Verify the resolved path is still within the base directory
  // Use path.relative() to properly check containment (prevents /home/user-admin bypass when base is /home/user)
  const relative = path.relative(normalizedBase, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    logger.warn('Path escapes base directory', {
      baseDir: normalizedBase,
      resolved: absolutePath.substring(0, 100),
    });
    throw new Error('Path must be within the working directory');
  }

  return absolutePath;
}

/**
 * Validate a regex pattern for safety.
 * Prevents ReDoS attacks by:
 * 1. Limiting pattern length
 * 2. Detecting catastrophic backtracking patterns
 *
 * @param pattern - The regex pattern to validate
 * @returns true if pattern is safe
 * @throws Error if pattern is potentially dangerous
 */
export function validateRegexPattern(pattern: string): boolean {
  const config = getConfig();
  const logger = getLogger();

  if (!config.security.sanitizeInputs) {
    return true;
  }

  // Check pattern length
  if (pattern.length > MAX_REGEX_LENGTH) {
    throw new Error(`Regex pattern exceeds maximum length of ${MAX_REGEX_LENGTH} characters`);
  }

  // Patterns that can cause catastrophic backtracking
  // These are simplified heuristics - not comprehensive
  const dangerousPatterns = [
    // Nested quantifiers with overlapping alternatives
    /\(\.\*\)\+\.\*/, // (.*)+.*
    /\(\.\+\)\+/, // (.+)+
    /\([^)]*\+\)\+/, // (...+)+
    /\(\.\*\?\)\*/, // (.*?)*
    // Multiple nested groups with quantifiers
    /\(\([^)]*\)\*\)\*/, // ((...)*)*
  ];

  for (const dangerous of dangerousPatterns) {
    if (dangerous.test(pattern)) {
      logger.warn('Potentially dangerous regex pattern detected', {
        pattern: pattern.substring(0, 100),
      });
      throw new Error('Regex pattern may cause performance issues');
    }
  }

  // Try to compile the regex to catch syntax errors
  try {
    new RegExp(pattern);
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${error}`);
  }

  return true;
}

/**
 * Sanitize command arguments.
 * Basic validation to prevent obvious command injection.
 *
 * Note: This is NOT a complete solution for command injection.
 * The BashTool should be used with extreme caution regardless.
 *
 * @param command - The command string
 * @returns true if command appears safe
 */
export function validateCommand(command: string): boolean {
  const config = getConfig();
  const logger = getLogger();

  if (!config.security.sanitizeInputs) {
    return true;
  }

  // Maximum command length
  const MAX_COMMAND_LENGTH = 32768;

  if (command.length > MAX_COMMAND_LENGTH) {
    throw new Error(`Command exceeds maximum length of ${MAX_COMMAND_LENGTH} characters`);
  }

  // Check for null bytes
  if (command.includes('\0')) {
    logger.warn('Command contains null byte');
    throw new Error('Command contains invalid characters');
  }

  return true;
}

/**
 * Log an audit event for tool execution.
 * Only logs if audit logging is enabled in config.
 *
 * @param toolName - Name of the tool being executed
 * @param params - Tool parameters (will be sanitized)
 * @param context - Execution context
 */
export function auditLog(
  toolName: string,
  params: Record<string, unknown>,
  context: { sessionId?: string; cwd?: string }
): void {
  const config = getConfig();

  if (!config.security.auditLogging) {
    return;
  }

  const logger = getLogger();

  // Sanitize params to avoid logging sensitive data
  const sanitizedParams: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.length > 200) {
      sanitizedParams[key] = value.substring(0, 200) + '...[truncated]';
    } else {
      sanitizedParams[key] = value;
    }
  }

  logger.info(`AUDIT: Tool executed - ${toolName}`, {
    audit: true,
    tool: toolName,
    params: sanitizedParams,
    sessionId: context.sessionId,
    cwd: context.cwd,
    timestamp: new Date().toISOString(),
  });
}
