import { describe, it, expect } from 'vitest';
import { validateArtifactContent } from '../validators.js';

describe('Artifact Validators', () => {
  describe('requirements', () => {
    it('should accept valid requirements', () => {
      const result = validateArtifactContent('requirements', {
        stories: ['As a user, I can log in'],
        acceptanceCriteria: ['Login page loads under 2s'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty stories', () => {
      const result = validateArtifactContent('requirements', { stories: [] });
      expect(result.success).toBe(false);
    });

    it('should reject missing stories', () => {
      const result = validateArtifactContent('requirements', {});
      expect(result.success).toBe(false);
    });
  });

  describe('architecture', () => {
    it('should accept valid architecture', () => {
      const result = validateArtifactContent('architecture', {
        components: [{ name: 'API Gateway', description: 'Routes requests' }],
        dataFlows: [{ from: 'Client', to: 'API', description: 'HTTP requests' }],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty components', () => {
      const result = validateArtifactContent('architecture', { components: [] });
      expect(result.success).toBe(false);
    });
  });

  describe('api_spec', () => {
    it('should accept valid API spec', () => {
      const result = validateArtifactContent('api_spec', {
        endpoints: [{ method: 'GET', path: '/users', description: 'List users' }],
        authentication: 'Bearer token',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid HTTP method', () => {
      const result = validateArtifactContent('api_spec', {
        endpoints: [{ method: 'INVALID', path: '/', description: 'Bad' }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('code', () => {
    it('should accept valid code artifact', () => {
      const result = validateArtifactContent('code', {
        files: [{ path: 'src/index.ts', content: 'console.log("hello")' }],
        dependencies: ['express'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty files', () => {
      const result = validateArtifactContent('code', { files: [] });
      expect(result.success).toBe(false);
    });
  });

  describe('test_plan', () => {
    it('should accept valid test plan', () => {
      const result = validateArtifactContent('test_plan', {
        testCases: [{ name: 'Login', description: 'Test login flow', type: 'e2e' }],
        coverageTarget: 80,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid coverage target', () => {
      const result = validateArtifactContent('test_plan', {
        testCases: [{ name: 'T', description: 'D' }],
        coverageTarget: 150,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('security_audit', () => {
    it('should accept valid audit', () => {
      const result = validateArtifactContent('security_audit', {
        findings: [{ severity: 'high', title: 'XSS', description: 'Found XSS in form' }],
        overallRisk: 'medium',
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty findings', () => {
      const result = validateArtifactContent('security_audit', { findings: [] });
      expect(result.success).toBe(true);
    });
  });

  describe('documentation', () => {
    it('should accept valid documentation', () => {
      const result = validateArtifactContent('documentation', {
        title: 'Getting Started',
        content: '# Hello\nWelcome to the docs.',
        format: 'markdown',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('code_review', () => {
    it('should accept valid review', () => {
      const result = validateArtifactContent('code_review', {
        summary: 'Looks good overall',
        comments: [{ file: 'index.ts', line: 42, comment: 'Add error handling' }],
        approved: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('error messages', () => {
    it('should provide helpful error paths', () => {
      const result = validateArtifactContent('code', { files: [{ path: 123 }] });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.includes('path'))).toBe(true);
      }
    });
  });
});
