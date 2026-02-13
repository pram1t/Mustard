/**
 * OpenAgent V2 - Dependency Resolver
 *
 * Topological sort and cycle detection for task dependency graphs.
 */

import type { DependencyNode } from './types.js';

/**
 * Resolves task dependencies using topological sort.
 */
export class DependencyResolver {
  /**
   * Topologically sort tasks based on their dependencies.
   * Returns tasks in execution order (dependencies first).
   *
   * @throws Error if a cycle is detected
   */
  resolve(nodes: DependencyNode[]): string[] {
    const cycle = this.detectCycle(nodes);
    if (cycle) {
      throw new Error(`Dependency cycle detected: ${cycle.join(' → ')}`);
    }

    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Build graph
    for (const node of nodes) {
      graph.set(node.id, node.dependencies);
      if (!inDegree.has(node.id)) {
        inDegree.set(node.id, 0);
      }
    }

    // Calculate in-degrees
    for (const node of nodes) {
      for (const dep of node.dependencies) {
        inDegree.set(dep, (inDegree.get(dep) ?? 0));
      }
      // Node is "depended on" by others via the dependency list
    }

    // Recompute: for each node, each dependency points TO this node
    // So we need reverse: who depends on dep
    const dependents = new Map<string, string[]>();
    for (const node of nodes) {
      for (const dep of node.dependencies) {
        if (!dependents.has(dep)) dependents.set(dep, []);
        dependents.get(dep)!.push(node.id);
      }
    }

    // Recalculate in-degree properly
    inDegree.clear();
    for (const node of nodes) {
      inDegree.set(node.id, node.dependencies.length);
    }

    // Kahn's algorithm
    const queue: string[] = [];
    const result: string[] = [];

    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const deps = dependents.get(current) ?? [];
      for (const dep of deps) {
        const newDegree = (inDegree.get(dep) ?? 1) - 1;
        inDegree.set(dep, newDegree);
        if (newDegree === 0) {
          queue.push(dep);
        }
      }
    }

    return result;
  }

  /**
   * Detect a cycle in the dependency graph.
   * Returns the cycle path if found, or null if no cycle exists.
   */
  detectCycle(nodes: DependencyNode[]): string[] | null {
    const graph = new Map<string, string[]>();
    for (const node of nodes) {
      graph.set(node.id, node.dependencies);
    }

    const visited = new Set<string>();
    const inStack = new Set<string>();
    const parent = new Map<string, string>();

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        const cycle = this.dfs(node.id, graph, visited, inStack, parent);
        if (cycle) return cycle;
      }
    }

    return null;
  }

  /**
   * Check if all dependencies of a node are satisfied (in the completedSet).
   */
  areDependenciesSatisfied(nodeId: string, nodes: DependencyNode[], completedSet: Set<string>): boolean {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return false;
    return node.dependencies.every((dep) => completedSet.has(dep));
  }

  // ===========================================================================
  // PRIVATE
  // ===========================================================================

  private dfs(
    nodeId: string,
    graph: Map<string, string[]>,
    visited: Set<string>,
    inStack: Set<string>,
    parent: Map<string, string>
  ): string[] | null {
    visited.add(nodeId);
    inStack.add(nodeId);

    const deps = graph.get(nodeId) ?? [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        parent.set(dep, nodeId);
        const cycle = this.dfs(dep, graph, visited, inStack, parent);
        if (cycle) return cycle;
      } else if (inStack.has(dep)) {
        // Cycle found — reconstruct path
        const path: string[] = [dep, nodeId];
        let current = nodeId;
        while (current !== dep && parent.has(current)) {
          current = parent.get(current)!;
          if (current === dep) break;
          path.push(current);
        }
        path.reverse();
        return path;
      }
    }

    inStack.delete(nodeId);
    return null;
  }
}
