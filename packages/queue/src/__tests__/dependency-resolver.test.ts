import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyResolver } from '../dependency-resolver.js';
import type { DependencyNode } from '../types.js';

describe('DependencyResolver', () => {
  let resolver: DependencyResolver;

  beforeEach(() => {
    resolver = new DependencyResolver();
  });

  // ===========================================================================
  // RESOLVE (TOPOLOGICAL SORT)
  // ===========================================================================

  describe('resolve', () => {
    it('should resolve linear dependencies', () => {
      const nodes: DependencyNode[] = [
        { id: 'c', dependencies: ['b'] },
        { id: 'b', dependencies: ['a'] },
        { id: 'a', dependencies: [] },
      ];

      const order = resolver.resolve(nodes);
      expect(order).toEqual(['a', 'b', 'c']);
    });

    it('should resolve parallel tasks (no deps)', () => {
      const nodes: DependencyNode[] = [
        { id: 'a', dependencies: [] },
        { id: 'b', dependencies: [] },
        { id: 'c', dependencies: [] },
      ];

      const order = resolver.resolve(nodes);
      expect(order).toHaveLength(3);
      expect(new Set(order)).toEqual(new Set(['a', 'b', 'c']));
    });

    it('should resolve diamond dependency pattern', () => {
      // a → b, a → c, b → d, c → d
      const nodes: DependencyNode[] = [
        { id: 'a', dependencies: [] },
        { id: 'b', dependencies: ['a'] },
        { id: 'c', dependencies: ['a'] },
        { id: 'd', dependencies: ['b', 'c'] },
      ];

      const order = resolver.resolve(nodes);

      // a must come before b and c, both must come before d
      expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
      expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'));
      expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'));
      expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
    });

    it('should handle single node', () => {
      const order = resolver.resolve([{ id: 'only', dependencies: [] }]);
      expect(order).toEqual(['only']);
    });

    it('should throw on cycle', () => {
      const nodes: DependencyNode[] = [
        { id: 'a', dependencies: ['b'] },
        { id: 'b', dependencies: ['a'] },
      ];

      expect(() => resolver.resolve(nodes)).toThrow('cycle');
    });
  });

  // ===========================================================================
  // DETECT CYCLE
  // ===========================================================================

  describe('detectCycle', () => {
    it('should return null for acyclic graph', () => {
      const nodes: DependencyNode[] = [
        { id: 'a', dependencies: [] },
        { id: 'b', dependencies: ['a'] },
        { id: 'c', dependencies: ['b'] },
      ];

      expect(resolver.detectCycle(nodes)).toBeNull();
    });

    it('should detect simple cycle (a → b → a)', () => {
      const nodes: DependencyNode[] = [
        { id: 'a', dependencies: ['b'] },
        { id: 'b', dependencies: ['a'] },
      ];

      const cycle = resolver.detectCycle(nodes);
      expect(cycle).not.toBeNull();
      expect(cycle!.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect three-node cycle', () => {
      const nodes: DependencyNode[] = [
        { id: 'a', dependencies: ['c'] },
        { id: 'b', dependencies: ['a'] },
        { id: 'c', dependencies: ['b'] },
      ];

      const cycle = resolver.detectCycle(nodes);
      expect(cycle).not.toBeNull();
    });

    it('should return null for empty graph', () => {
      expect(resolver.detectCycle([])).toBeNull();
    });

    it('should handle self-loop', () => {
      const nodes: DependencyNode[] = [
        { id: 'a', dependencies: ['a'] },
      ];

      const cycle = resolver.detectCycle(nodes);
      expect(cycle).not.toBeNull();
    });
  });

  // ===========================================================================
  // DEPS SATISFIED
  // ===========================================================================

  describe('areDependenciesSatisfied', () => {
    const nodes: DependencyNode[] = [
      { id: 'a', dependencies: [] },
      { id: 'b', dependencies: ['a'] },
      { id: 'c', dependencies: ['a', 'b'] },
    ];

    it('should return true when all deps are in completed set', () => {
      const completed = new Set(['a', 'b']);
      expect(resolver.areDependenciesSatisfied('c', nodes, completed)).toBe(true);
    });

    it('should return false when some deps are missing', () => {
      const completed = new Set(['a']);
      expect(resolver.areDependenciesSatisfied('c', nodes, completed)).toBe(false);
    });

    it('should return true for node with no deps', () => {
      expect(resolver.areDependenciesSatisfied('a', nodes, new Set())).toBe(true);
    });

    it('should return false for unknown node', () => {
      expect(resolver.areDependenciesSatisfied('unknown', nodes, new Set())).toBe(false);
    });
  });
});
