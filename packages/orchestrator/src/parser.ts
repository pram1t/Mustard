/**
 * OpenAgent V2 - Request Parser
 *
 * LLM-assisted intent classification that runs before the planner.
 * Classifies the user request into intent, scope, complexity, and priority.
 */

import type { LLMRouter, TextChunk } from '@mustard/llm';

// =============================================================================
// TYPES
// =============================================================================

export type RequestIntent =
  | 'new_feature'
  | 'bug_fix'
  | 'refactor'
  | 'testing'
  | 'documentation'
  | 'security_audit'
  | 'performance'
  | 'devops'
  | 'design'
  | 'research'
  | 'other';

export type RequestScope = 'small' | 'medium' | 'large' | 'epic';
export type RequestComplexity = 'simple' | 'moderate' | 'complex' | 'very_complex';

export interface ParsedRequest {
  /** Original request text */
  originalRequest: string;

  /** Classified intent */
  intent: RequestIntent;

  /** Estimated scope */
  scope: RequestScope;

  /** Estimated complexity */
  complexity: RequestComplexity;

  /** Suggested priority */
  suggestedPriority: 'critical' | 'high' | 'normal' | 'low';

  /** Which worker roles are likely needed */
  suggestedWorkers: string[];

  /** Brief summary of what needs to be done */
  summary: string;

  /** Optional context to pass to planner */
  context?: string;
}

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const PARSER_SYSTEM_PROMPT = `You are a request analyzer for a multi-worker AI development system. Given a user request, classify it.

Respond with ONLY a JSON object (no markdown, no explanation) with these fields:
- intent: one of "new_feature", "bug_fix", "refactor", "testing", "documentation", "security_audit", "performance", "devops", "design", "research", "other"
- scope: one of "small" (single file/function), "medium" (few files), "large" (multiple components), "epic" (system-wide)
- complexity: one of "simple" (straightforward), "moderate" (some decisions), "complex" (many moving parts), "very_complex" (requires deep planning)
- suggestedPriority: one of "critical", "high", "normal", "low"
- suggestedWorkers: array of worker roles needed, from: architect, frontend, backend, qa, devops, security, pm, tech_writer, ui_ux, dba
- summary: 1-2 sentence summary of what needs to be done

Example:
{"intent":"new_feature","scope":"medium","complexity":"moderate","suggestedPriority":"normal","suggestedWorkers":["architect","backend","qa"],"summary":"Add user authentication with JWT tokens to the API."}`;

// =============================================================================
// PARSER
// =============================================================================

/**
 * Parses and classifies user requests before planning.
 */
export class RequestParser {
  private readonly router: LLMRouter;

  constructor(router: LLMRouter) {
    this.router = router;
  }

  /**
   * Parse a user request into a structured classification.
   */
  async parse(request: string, context?: string): Promise<ParsedRequest> {
    const userMessage = context
      ? `Context:\n${context}\n\nRequest: ${request}`
      : `Request: ${request}`;

    let response = '';
    for await (const chunk of this.router.chat({
      messages: [
        { role: 'system', content: PARSER_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    })) {
      if (chunk.type === 'text') {
        response += (chunk as TextChunk).content;
      }
    }

    const parsed = this.parseResponse(response);

    return {
      originalRequest: request,
      intent: parsed.intent,
      scope: parsed.scope,
      complexity: parsed.complexity,
      suggestedPriority: parsed.suggestedPriority,
      suggestedWorkers: parsed.suggestedWorkers,
      summary: parsed.summary,
      context,
    };
  }

  private parseResponse(response: string): Omit<ParsedRequest, 'originalRequest' | 'context'> {
    let jsonStr = response.trim();

    // Strip markdown code fences if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    try {
      const parsed = JSON.parse(jsonStr);

      return {
        intent: this.validateIntent(parsed.intent),
        scope: this.validateEnum(parsed.scope, ['small', 'medium', 'large', 'epic'], 'medium') as RequestScope,
        complexity: this.validateEnum(parsed.complexity, ['simple', 'moderate', 'complex', 'very_complex'], 'moderate') as RequestComplexity,
        suggestedPriority: this.validateEnum(parsed.suggestedPriority, ['critical', 'high', 'normal', 'low'], 'normal') as ParsedRequest['suggestedPriority'],
        suggestedWorkers: Array.isArray(parsed.suggestedWorkers) ? parsed.suggestedWorkers : ['backend'],
        summary: parsed.summary ?? 'No summary provided.',
      };
    } catch (err) {
      // Fallback: return reasonable defaults rather than crash
      return {
        intent: 'other',
        scope: 'medium',
        complexity: 'moderate',
        suggestedPriority: 'normal',
        suggestedWorkers: ['backend'],
        summary: 'Could not parse request classification.',
      };
    }
  }

  private validateIntent(value: unknown): RequestIntent {
    const valid: RequestIntent[] = [
      'new_feature', 'bug_fix', 'refactor', 'testing', 'documentation',
      'security_audit', 'performance', 'devops', 'design', 'research', 'other',
    ];
    return valid.includes(value as RequestIntent) ? (value as RequestIntent) : 'other';
  }

  private validateEnum<T extends string>(value: unknown, valid: T[], fallback: T): T {
    return valid.includes(value as T) ? (value as T) : fallback;
  }
}
