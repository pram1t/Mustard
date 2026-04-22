/**
 * Minimal glob matcher for file paths.
 *
 * Scoped to DEFAULT_SENSITIVE_PATTERNS + DEFAULT_RISK_RULES.riskyFilePatterns.
 * Intentionally tiny — no brace expansion, no extglob, no negation.
 *
 * Supported tokens:
 *   *   — any characters except "/"
 *   **  — any characters including "/"
 *   ?   — exactly one character except "/"
 *   other characters match literally (regex specials escaped)
 *
 * Path-vs-basename semantics (gitignore-inspired, defensive-by-default for
 * a security-facing detector):
 *   - Patterns containing "/" or "**" match the full path only.
 *   - Patterns with no "/" also match the basename of the path so that
 *     e.g. `.env` catches `src/config/.env` without forcing every caller
 *     to prefix patterns with `**\/`.
 *
 * Paths are normalized to forward slashes before matching.
 */

/** Normalize a path: backslash → slash, strip leading `./`. */
export function normalizePath(p: string): string {
  let out = p.replace(/\\/g, '/');
  if (out.startsWith('./')) out = out.slice(2);
  return out;
}

/** Basename of a normalized path. */
function basename(p: string): string {
  const i = p.lastIndexOf('/');
  return i === -1 ? p : p.slice(i + 1);
}

/**
 * Compile a glob pattern to a RegExp anchored at both ends.
 * Exported for testing + reuse.
 *
 * Leading `** /` is treated as "zero or more path segments" (gitignore
 * convention), so `** /foo` matches both `foo` and `a/b/foo`. This is
 * important for our sensitive-file patterns which are often written as
 * `** /.ssh/*` but should also match `.ssh/id_rsa` at the root.
 */
export function globToRegExp(pattern: string): RegExp {
  let src = pattern;
  let prefix = '';
  if (src.startsWith('**/')) {
    prefix = '(?:.*/)?';
    src = src.slice(3);
  }

  let out = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '*' && src[i + 1] === '*') {
      out += '.*';
      i++; // consume second '*'
    } else if (c === '*') {
      out += '[^/]*';
    } else if (c === '?') {
      out += '[^/]';
    } else if (/[.+^${}()|[\]\\]/.test(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
  }
  return new RegExp('^' + prefix + out + '$');
}

/**
 * Test whether `path` matches `pattern` under the package's rules.
 * Paths are normalized; both full-path and basename matches count for
 * patterns that have no explicit path segments.
 */
export function matchesGlob(path: string, pattern: string): boolean {
  const np = normalizePath(path);
  const re = globToRegExp(pattern);
  if (re.test(np)) return true;

  // Patterns without "/" also match the basename.
  if (!pattern.includes('/')) {
    if (re.test(basename(np))) return true;
  }
  return false;
}

/**
 * Test `path` against an ordered list of patterns. Returns the first
 * pattern that matches, or `null`.
 */
export function firstMatch(path: string, patterns: readonly string[]): string | null {
  for (const p of patterns) {
    if (matchesGlob(path, p)) return p;
  }
  return null;
}
