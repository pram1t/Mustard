import { describe, it, expect } from 'vitest';
import {
  matchesGlob,
  globToRegExp,
  normalizePath,
  firstMatch,
} from '../glob-match.js';

describe('normalizePath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizePath('src\\a\\b.ts')).toBe('src/a/b.ts');
  });

  it('strips a leading ./', () => {
    expect(normalizePath('./src/a.ts')).toBe('src/a.ts');
  });

  it('leaves already-normalized paths alone', () => {
    expect(normalizePath('src/a.ts')).toBe('src/a.ts');
  });
});

describe('globToRegExp', () => {
  it('maps * to a single-segment wildcard', () => {
    const re = globToRegExp('*.pem');
    expect(re.test('key.pem')).toBe(true);
    expect(re.test('sub/key.pem')).toBe(false);
  });

  it('maps ** to any number of segments', () => {
    const re = globToRegExp('**/foo.ts');
    expect(re.test('foo.ts')).toBe(true);
    expect(re.test('a/b/c/foo.ts')).toBe(true);
  });

  it('maps ? to a single non-slash character', () => {
    const re = globToRegExp('?.txt');
    expect(re.test('a.txt')).toBe(true);
    expect(re.test('ab.txt')).toBe(false);
    expect(re.test('/.txt')).toBe(false);
  });

  it('escapes regex metacharacters', () => {
    const re = globToRegExp('a.b+c');
    expect(re.test('a.b+c')).toBe(true);
    expect(re.test('axbxc')).toBe(false);
  });
});

describe('matchesGlob', () => {
  it('matches simple patterns against basename when no slashes', () => {
    expect(matchesGlob('src/config/.env', '.env')).toBe(true);
    expect(matchesGlob('.env', '.env')).toBe(true);
    expect(matchesGlob('src/config/.envrc', '.env')).toBe(false);
  });

  it('matches .env.* variants', () => {
    expect(matchesGlob('.env.local', '.env.*')).toBe(true);
    expect(matchesGlob('src/.env.prod', '.env.*')).toBe(true);
    expect(matchesGlob('env.local', '.env.*')).toBe(false);
  });

  it('matches pem-style extensions anywhere via basename', () => {
    expect(matchesGlob('certs/server.pem', '*.pem')).toBe(true);
    expect(matchesGlob('server.pem', '*.pem')).toBe(true);
  });

  it('patterns with / only match full path', () => {
    expect(matchesGlob('a/b/credentials.json', '**/credentials.*')).toBe(true);
    expect(matchesGlob('credentials.json', '**/credentials.*')).toBe(true);
    expect(matchesGlob('/.ssh/id_rsa', '**/.ssh/*')).toBe(true);
    expect(matchesGlob('home/user/.ssh/id_rsa', '**/.ssh/*')).toBe(true);
    // With '/' in the pattern, basename fallback does not apply.
    expect(matchesGlob('credentials.json', 'creds/**')).toBe(false);
  });

  it('normalizes Windows-style paths before matching', () => {
    expect(matchesGlob('home\\user\\.ssh\\id_rsa', '**/.ssh/*')).toBe(true);
    expect(matchesGlob('.\\.env', '.env')).toBe(true);
  });

  it('handles id_rsa family patterns', () => {
    expect(matchesGlob('home/user/.ssh/id_rsa', '**/id_rsa*')).toBe(true);
    expect(matchesGlob('home/user/.ssh/id_rsa.pub', '**/id_rsa*')).toBe(true);
    expect(matchesGlob('home/user/.ssh/id_ed25519', '**/id_ed25519*')).toBe(true);
  });
});

describe('firstMatch', () => {
  it('returns the first matching pattern in order', () => {
    const patterns = ['.env', '*.pem', '**/credentials.*'];
    expect(firstMatch('src/.env', patterns)).toBe('.env');
    expect(firstMatch('server.pem', patterns)).toBe('*.pem');
    expect(firstMatch('a/b/credentials.txt', patterns)).toBe('**/credentials.*');
  });

  it('returns null when nothing matches', () => {
    expect(firstMatch('src/a.ts', ['*.pem', '.env'])).toBeNull();
  });

  it('respects ordering (first wins on overlap)', () => {
    // Both match, but '.env' comes first.
    const patterns = ['.env', '.env.*'];
    expect(firstMatch('.env', patterns)).toBe('.env');
  });
});
