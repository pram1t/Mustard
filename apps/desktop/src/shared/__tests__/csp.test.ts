import { describe, it, expect } from 'vitest';
import {
  buildCSPString,
  getCSP,
  PRODUCTION_CSP,
  DEVELOPMENT_CSP,
} from '../csp';

describe('PRODUCTION_CSP', () => {
  it('should not contain unsafe-eval in script-src', () => {
    expect(PRODUCTION_CSP['script-src']).not.toContain("'unsafe-eval'");
  });

  it('should not contain unsafe-inline in script-src', () => {
    expect(PRODUCTION_CSP['script-src']).not.toContain("'unsafe-inline'");
  });

  it('should restrict default-src to self', () => {
    expect(PRODUCTION_CSP['default-src']).toEqual(["'self'"]);
  });

  it('should block object-src', () => {
    expect(PRODUCTION_CSP['object-src']).toEqual(["'none'"]);
  });

  it('should block frame-src', () => {
    expect(PRODUCTION_CSP['frame-src']).toEqual(["'none'"]);
  });

  it('should block media-src', () => {
    expect(PRODUCTION_CSP['media-src']).toEqual(["'none'"]);
  });

  it('should block frame-ancestors', () => {
    expect(PRODUCTION_CSP['frame-ancestors']).toEqual(["'none'"]);
  });

  it('should allow unsafe-inline only in style-src', () => {
    expect(PRODUCTION_CSP['style-src']).toContain("'unsafe-inline'");
  });
});

describe('DEVELOPMENT_CSP', () => {
  it('should allow unsafe-inline for scripts (Vite HMR)', () => {
    expect(DEVELOPMENT_CSP['script-src']).toContain("'unsafe-inline'");
  });

  it('should allow ws: and wss: for HMR WebSocket', () => {
    expect(DEVELOPMENT_CSP['connect-src']).toContain('ws:');
    expect(DEVELOPMENT_CSP['connect-src']).toContain('wss:');
  });

  it('should still not contain unsafe-eval', () => {
    expect(DEVELOPMENT_CSP['script-src']).not.toContain("'unsafe-eval'");
  });

  it('should still block object-src', () => {
    expect(DEVELOPMENT_CSP['object-src']).toEqual(["'none'"]);
  });

  it('should still block frame-src', () => {
    expect(DEVELOPMENT_CSP['frame-src']).toEqual(["'none'"]);
  });
});

describe('buildCSPString', () => {
  it('should join directives with semicolons', () => {
    const result = buildCSPString(PRODUCTION_CSP);
    expect(result).toContain("default-src 'self'");
    expect(result).toContain("script-src 'self'");
    expect(result).toContain(';');
  });

  it('should join multiple values with spaces', () => {
    const result = buildCSPString(PRODUCTION_CSP);
    expect(result).toContain("style-src 'self' 'unsafe-inline'");
  });

  it('should include all directives', () => {
    const result = buildCSPString(PRODUCTION_CSP);
    expect(result).toContain('default-src');
    expect(result).toContain('script-src');
    expect(result).toContain('style-src');
    expect(result).toContain('img-src');
    expect(result).toContain('connect-src');
    expect(result).toContain('object-src');
    expect(result).toContain('frame-src');
    expect(result).toContain('frame-ancestors');
  });
});

describe('getCSP', () => {
  it('should return DEVELOPMENT_CSP when isDev is true', () => {
    expect(getCSP(true)).toBe(DEVELOPMENT_CSP);
  });

  it('should return PRODUCTION_CSP when isDev is false', () => {
    expect(getCSP(false)).toBe(PRODUCTION_CSP);
  });
});
