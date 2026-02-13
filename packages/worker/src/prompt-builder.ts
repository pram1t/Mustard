/**
 * OpenAgent V2 - Worker Prompt Builder
 *
 * Converts a WorkerDefinition into a system prompt string for the AgentLoop.
 */

import type { WorkerDefinition } from './types.js';

/**
 * Build a system prompt string from a worker definition.
 */
export function buildWorkerPrompt(definition: WorkerDefinition, override?: string): string {
  const { prompt } = definition;
  const sections: string[] = [];

  // Identity
  sections.push(`# ${definition.name}\n\n${prompt.identity}`);

  // Expertise
  if (prompt.expertise.length > 0) {
    sections.push(
      `## Expertise\n${prompt.expertise.map((e) => `- ${e}`).join('\n')}`
    );
  }

  // Responsibilities
  if (prompt.responsibilities.length > 0) {
    sections.push(
      `## Responsibilities\n${prompt.responsibilities.map((r) => `- ${r}`).join('\n')}`
    );
  }

  // Constraints
  if (prompt.constraints.length > 0) {
    sections.push(
      `## Constraints\n${prompt.constraints.map((c) => `- ${c}`).join('\n')}`
    );
  }

  // Artifacts
  if (prompt.artifacts.produces.length > 0 || prompt.artifacts.consumes.length > 0) {
    const artLines: string[] = [];
    if (prompt.artifacts.produces.length > 0) {
      artLines.push(`Produces: ${prompt.artifacts.produces.join(', ')}`);
    }
    if (prompt.artifacts.consumes.length > 0) {
      artLines.push(`Consumes: ${prompt.artifacts.consumes.join(', ')}`);
    }
    sections.push(`## Artifacts\n${artLines.join('\n')}`);
  }

  // Communication style
  if (prompt.communication) {
    sections.push(`## Communication\n${prompt.communication}`);
  }

  // Override / additional instructions
  if (override) {
    sections.push(`## Additional Instructions\n${override}`);
  }

  return sections.join('\n\n');
}
