/**
 * OpenAgent V2 - Planner
 *
 * LLM-assisted request → task plan generation.
 * Sends a structured prompt to the LLM asking for a JSON task breakdown.
 */

import { randomUUID } from 'node:crypto';
import type { LLMRouter, TextChunk } from '@openagent/llm';
import type { ExecutionPlan, PlanStep } from './types.js';

/**
 * System prompt for plan generation.
 */
const PLANNER_SYSTEM_PROMPT = `You are a task planner for a multi-worker AI system. Given a user request, break it down into concrete steps.

Each step must specify:
- id: unique string identifier (e.g., "step-1")
- title: short title
- description: what this step accomplishes
- assignTo: one of "architect", "frontend", "backend"
- priority: one of "critical", "high", "normal", "low"
- dependencies: array of step IDs this step depends on (empty if none)
- prompt: the specific prompt to send to the assigned worker

Respond with ONLY a JSON array of steps. No markdown, no explanation.

Example:
[
  {"id":"step-1","title":"Analyze codebase","description":"Review project structure","assignTo":"architect","priority":"high","dependencies":[],"prompt":"Analyze the project structure and identify key components."},
  {"id":"step-2","title":"Implement feature","description":"Write the code","assignTo":"backend","priority":"normal","dependencies":["step-1"],"prompt":"Based on the architecture review, implement the feature."}
]`;

/**
 * Plans task breakdowns from user requests using an LLM.
 */
export class Planner {
  private readonly router: LLMRouter;

  constructor(router: LLMRouter) {
    this.router = router;
  }

  /**
   * Create an execution plan from a user request.
   */
  async createPlan(request: string, context?: string): Promise<ExecutionPlan> {
    const userMessage = context
      ? `Context:\n${context}\n\nRequest: ${request}`
      : `Request: ${request}`;

    // Collect LLM response
    let response = '';
    for await (const chunk of this.router.chat({
      messages: [
        { role: 'system', content: PLANNER_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    })) {
      if (chunk.type === 'text') {
        response += (chunk as TextChunk).content;
      }
    }

    // Parse JSON response
    const steps = this.parseSteps(response);

    return {
      id: randomUUID(),
      request,
      steps,
      createdAt: new Date(),
    };
  }

  /**
   * Parse LLM response into plan steps.
   * Handles cases where the LLM wraps JSON in markdown code blocks.
   */
  private parseSteps(response: string): PlanStep[] {
    let jsonStr = response.trim();

    // Strip markdown code fences if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    try {
      const parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed)) {
        throw new Error('Expected a JSON array of steps');
      }

      // Validate and normalize each step
      return parsed.map((step: any, index: number) => ({
        id: step.id ?? `step-${index + 1}`,
        title: step.title ?? `Step ${index + 1}`,
        description: step.description ?? '',
        assignTo: step.assignTo ?? 'backend',
        priority: step.priority ?? 'normal',
        dependencies: step.dependencies ?? [],
        prompt: step.prompt ?? step.description ?? '',
      }));
    } catch (err) {
      throw new Error(`Failed to parse planner response: ${(err as Error).message}\nResponse: ${response.substring(0, 200)}`);
    }
  }
}
