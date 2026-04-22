/**
 * Sensitive file detector.
 *
 * Matches a file path against a set of glob patterns (defaulting to
 * DEFAULT_SENSITIVE_PATTERNS). Intended to gate auto-approval: any
 * match forces a manual-approval flow regardless of mode.
 *
 * Severity:
 *   - 'critical' — private keys, credentials, SSH identities. The
 *     set of all default patterns ships as critical by default.
 *   - 'warning'  — reserved for user-added patterns that are
 *     "touchy-but-not-secret" (not used by defaults).
 */

import type { SensitiveFileMatch } from './types.js';
import { DEFAULT_SENSITIVE_PATTERNS } from './types.js';
import { matchesGlob } from './glob-match.js';

// ============================================================================
// Defaults
// ============================================================================

/**
 * Canonical reasons for each default pattern. Used when a built-in
 * pattern matches; user-supplied patterns get a generic reason.
 */
const DEFAULT_REASONS: Record<string, string> = {
  '.env': 'environment variable file',
  '.env.*': 'environment variable file',
  '*.pem': 'PEM-encoded key or certificate',
  '*.key': 'private key file',
  '*.p12': 'PKCS#12 keystore',
  '*.pfx': 'PKCS#12 keystore',
  '*.jks': 'Java keystore',
  '*.keystore': 'keystore file',
  '**/credentials.*': 'credentials file',
  '**/secrets.*': 'secrets file',
  '**/.ssh/*': 'SSH configuration or key',
  '**/id_rsa*': 'RSA private key',
  '**/id_ed25519*': 'Ed25519 private key',
  '**/.aws/credentials': 'AWS credentials file',
  '**/.gcp/credentials.json': 'GCP credentials file',
};

/**
 * Entry describing one pattern + its classification.
 */
export interface SensitivePatternEntry {
  pattern: string;
  severity: 'warning' | 'critical';
  reason?: string;
}

// ============================================================================
// Detector
// ============================================================================

export interface SensitiveFileDetectorOptions {
  /**
   * Patterns to check against. Defaults to DEFAULT_SENSITIVE_PATTERNS.
   * Mixed-shape input is accepted: plain strings default to critical,
   * SensitivePatternEntry objects use their own severity/reason.
   */
  patterns?: ReadonlyArray<string | SensitivePatternEntry>;

  /** Default severity for plain-string patterns. Default: 'critical'. */
  defaultSeverity?: 'warning' | 'critical';
}

export class SensitiveFileDetector {
  private entries: SensitivePatternEntry[];
  private readonly defaultSeverity: 'warning' | 'critical';

  constructor(options: SensitiveFileDetectorOptions = {}) {
    this.defaultSeverity = options.defaultSeverity ?? 'critical';
    const source = options.patterns ?? DEFAULT_SENSITIVE_PATTERNS;
    this.entries = source.map(p => this.normalize(p));
  }

  /**
   * Check `path` against every configured pattern. Returns the first
   * match, or `null`.
   */
  check(path: string): SensitiveFileMatch | null {
    for (const entry of this.entries) {
      if (matchesGlob(path, entry.pattern)) {
        return {
          path,
          pattern: entry.pattern,
          severity: entry.severity,
          reason: entry.reason ?? DEFAULT_REASONS[entry.pattern] ?? 'sensitive file',
        };
      }
    }
    return null;
  }

  /** True iff any configured pattern matches. */
  isSensitive(path: string): boolean {
    return this.check(path) !== null;
  }

  /** Add a pattern at the highest priority (checked first). */
  prependPattern(entry: string | SensitivePatternEntry): void {
    this.entries.unshift(this.normalize(entry));
  }

  /** Add a pattern at the end of the list (lowest priority). */
  appendPattern(entry: string | SensitivePatternEntry): void {
    this.entries.push(this.normalize(entry));
  }

  /** Remove the first entry matching the given pattern string. */
  removePattern(pattern: string): boolean {
    const i = this.entries.findIndex(e => e.pattern === pattern);
    if (i === -1) return false;
    this.entries.splice(i, 1);
    return true;
  }

  /** Snapshot of configured entries (order preserved). */
  listPatterns(): readonly SensitivePatternEntry[] {
    return this.entries.slice();
  }

  // ------------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------------

  private normalize(
    entry: string | SensitivePatternEntry,
  ): SensitivePatternEntry {
    if (typeof entry === 'string') {
      return {
        pattern: entry,
        severity: this.defaultSeverity,
        reason: DEFAULT_REASONS[entry],
      };
    }
    return { ...entry };
  }
}
