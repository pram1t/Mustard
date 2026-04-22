import { describe, it, expect } from 'vitest';
import { SensitiveFileDetector } from '../sensitive-files.js';

describe('SensitiveFileDetector with defaults', () => {
  it('detects .env files at any depth', () => {
    const det = new SensitiveFileDetector();
    expect(det.check('.env')?.pattern).toBe('.env');
    expect(det.check('packages/app/.env')?.pattern).toBe('.env');
  });

  it('detects .env.* variants', () => {
    const det = new SensitiveFileDetector();
    expect(det.check('.env.local')?.pattern).toBe('.env.*');
    expect(det.check('src/.env.production')?.pattern).toBe('.env.*');
  });

  it('detects PEM, key, and keystore files', () => {
    const det = new SensitiveFileDetector();
    expect(det.check('certs/server.pem')).not.toBeNull();
    expect(det.check('id.key')?.pattern).toBe('*.key');
    expect(det.check('vault.jks')?.pattern).toBe('*.jks');
    expect(det.check('secrets/server.keystore')?.pattern).toBe('*.keystore');
  });

  it('detects SSH keys and AWS/GCP credentials', () => {
    const det = new SensitiveFileDetector();
    expect(det.check('home/user/.ssh/id_rsa')).not.toBeNull();
    // `.aws/credentials` has no extension, so `**/credentials.*` (with
    // its literal dot) does not match — the `**/.aws/credentials` entry wins.
    expect(det.check('home/user/.aws/credentials')?.pattern).toBe(
      '**/.aws/credentials',
    );
    // `.gcp/credentials.json` DOES have an extension, and `**/credentials.*`
    // appears earlier in DEFAULT_SENSITIVE_PATTERNS, so first-match wins there.
    expect(det.check('home/user/.gcp/credentials.json')?.pattern).toBe(
      '**/credentials.*',
    );
  });

  it('returns null for non-sensitive paths', () => {
    const det = new SensitiveFileDetector();
    expect(det.check('src/index.ts')).toBeNull();
    expect(det.check('README.md')).toBeNull();
    expect(det.check('package.json')).toBeNull();
  });

  it('assigns severity=critical to all default patterns', () => {
    const det = new SensitiveFileDetector();
    const m = det.check('.env')!;
    expect(m.severity).toBe('critical');
  });

  it('populates a reason for default patterns', () => {
    const det = new SensitiveFileDetector();
    expect(det.check('.env')!.reason).toMatch(/environment/i);
    // `.ssh/id_rsa` matches `**/.ssh/*` first (listed before `**/id_rsa*`).
    expect(det.check('home/user/.ssh/id_rsa')!.reason).toMatch(/ssh/i);
  });

  it('isSensitive returns boolean parity with check', () => {
    const det = new SensitiveFileDetector();
    expect(det.isSensitive('.env')).toBe(true);
    expect(det.isSensitive('src/index.ts')).toBe(false);
  });
});

describe('SensitiveFileDetector custom patterns', () => {
  it('accepts a string list with configurable default severity', () => {
    const det = new SensitiveFileDetector({
      patterns: ['*.secret'],
      defaultSeverity: 'warning',
    });
    const m = det.check('vault.secret');
    expect(m?.severity).toBe('warning');
    expect(m?.pattern).toBe('*.secret');
    expect(m?.reason).toBe('sensitive file');
  });

  it('accepts explicit SensitivePatternEntry objects', () => {
    const det = new SensitiveFileDetector({
      patterns: [
        { pattern: '*.private', severity: 'critical', reason: 'custom secret' },
      ],
    });
    const m = det.check('a.private');
    expect(m?.severity).toBe('critical');
    expect(m?.reason).toBe('custom secret');
  });

  it('prependPattern gives the new pattern highest priority', () => {
    const det = new SensitiveFileDetector();
    det.prependPattern({ pattern: '.env', severity: 'warning', reason: 'downgraded' });
    const m = det.check('.env');
    expect(m?.severity).toBe('warning');
    expect(m?.reason).toBe('downgraded');
  });

  it('appendPattern adds at the end of the list', () => {
    const det = new SensitiveFileDetector({ patterns: [] });
    det.appendPattern('*.foo');
    det.appendPattern('*.bar');
    expect(det.listPatterns().map(e => e.pattern)).toEqual(['*.foo', '*.bar']);
  });

  it('removePattern removes the first matching entry', () => {
    const det = new SensitiveFileDetector({ patterns: ['*.a', '*.b'] });
    expect(det.removePattern('*.a')).toBe(true);
    expect(det.removePattern('*.a')).toBe(false);
    expect(det.listPatterns()).toHaveLength(1);
  });

  it('listPatterns returns a snapshot that does not mutate internal state', () => {
    const det = new SensitiveFileDetector({ patterns: ['*.a'] });
    const snap = det.listPatterns() as Array<{ pattern: string }>;
    snap.push({ pattern: '*.b' } as never);
    expect(det.listPatterns()).toHaveLength(1);
  });
});
