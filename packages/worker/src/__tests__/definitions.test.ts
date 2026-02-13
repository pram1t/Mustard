import { describe, it, expect } from 'vitest';
import {
  architectDefinition,
  frontendDefinition,
  backendDefinition,
  builtinDefinitions,
} from '../definitions.js';
import type { WorkerDefinition } from '../types.js';

function validateDefinition(def: WorkerDefinition) {
  expect(def.role).toBeDefined();
  expect(def.name).toBeDefined();
  expect(def.description).toBeDefined();
  expect(def.prompt).toBeDefined();
  expect(def.prompt.identity).toBeDefined();
  expect(def.prompt.expertise.length).toBeGreaterThan(0);
  expect(def.prompt.responsibilities.length).toBeGreaterThan(0);
  expect(def.prompt.constraints.length).toBeGreaterThan(0);
  expect(def.prompt.communication).toBeDefined();
  expect(def.prompt.artifacts).toBeDefined();
  expect(def.tools).toBeDefined();
  expect(def.skills.length).toBeGreaterThan(0);
}

describe('Worker Definitions', () => {
  describe('architectDefinition', () => {
    it('should have valid structure', () => {
      validateDefinition(architectDefinition);
    });

    it('should have role "architect"', () => {
      expect(architectDefinition.role).toBe('architect');
    });

    it('should restrict tools to read-only + analysis', () => {
      expect(architectDefinition.tools.allowed).toContain('Read');
      expect(architectDefinition.tools.allowed).toContain('Glob');
      expect(architectDefinition.tools.allowed).toContain('Grep');
      expect(architectDefinition.tools.denied).toContain('Write');
      expect(architectDefinition.tools.denied).toContain('Edit');
    });

    it('should produce architecture artifacts', () => {
      expect(architectDefinition.prompt.artifacts.produces).toContain('architecture');
    });
  });

  describe('frontendDefinition', () => {
    it('should have valid structure', () => {
      validateDefinition(frontendDefinition);
    });

    it('should have role "frontend"', () => {
      expect(frontendDefinition.role).toBe('frontend');
    });

    it('should allow all tools (empty allowed = no restrictions)', () => {
      expect(frontendDefinition.tools.allowed).toEqual([]);
      expect(frontendDefinition.tools.denied).toEqual([]);
    });

    it('should produce code artifacts', () => {
      expect(frontendDefinition.prompt.artifacts.produces).toContain('code');
    });
  });

  describe('backendDefinition', () => {
    it('should have valid structure', () => {
      validateDefinition(backendDefinition);
    });

    it('should have role "backend"', () => {
      expect(backendDefinition.role).toBe('backend');
    });

    it('should allow all tools', () => {
      expect(backendDefinition.tools.allowed).toEqual([]);
      expect(backendDefinition.tools.denied).toEqual([]);
    });

    it('should produce code and api_spec artifacts', () => {
      expect(backendDefinition.prompt.artifacts.produces).toContain('code');
      expect(backendDefinition.prompt.artifacts.produces).toContain('api_spec');
    });
  });

  describe('builtinDefinitions', () => {
    it('should contain all 3 MVP roles', () => {
      expect(Object.keys(builtinDefinitions)).toEqual(['architect', 'frontend', 'backend']);
    });

    it('should map roles to correct definitions', () => {
      expect(builtinDefinitions.architect).toBe(architectDefinition);
      expect(builtinDefinitions.frontend).toBe(frontendDefinition);
      expect(builtinDefinitions.backend).toBe(backendDefinition);
    });
  });
});
