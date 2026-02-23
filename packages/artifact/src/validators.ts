/**
 * OpenAgent V2 - Artifact Content Validators
 *
 * Zod schemas for validating artifact content by type.
 */

import { z } from 'zod';
import type { ArtifactType } from './types.js';

// =============================================================================
// CONTENT SCHEMAS
// =============================================================================

export const requirementsSchema = z.object({
  stories: z.array(z.string()).min(1),
  acceptanceCriteria: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  priority: z.enum(['must', 'should', 'could', 'wont']).optional(),
});

export const architectureSchema = z.object({
  components: z.array(z.object({
    name: z.string(),
    description: z.string(),
    responsibilities: z.array(z.string()).optional(),
  })).min(1),
  dataFlows: z.array(z.object({
    from: z.string(),
    to: z.string(),
    description: z.string(),
  })).optional(),
  techDecisions: z.array(z.object({
    decision: z.string(),
    rationale: z.string(),
    alternatives: z.array(z.string()).optional(),
  })).optional(),
});

export const apiSpecSchema = z.object({
  endpoints: z.array(z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    path: z.string(),
    description: z.string(),
    requestBody: z.unknown().optional(),
    responseBody: z.unknown().optional(),
  })).min(1),
  authentication: z.string().optional(),
  baseUrl: z.string().optional(),
});

export const codeSchema = z.object({
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
    language: z.string().optional(),
  })).min(1),
  dependencies: z.array(z.string()).optional(),
  tests: z.array(z.object({
    path: z.string(),
    content: z.string(),
  })).optional(),
});

export const testPlanSchema = z.object({
  testCases: z.array(z.object({
    name: z.string(),
    description: z.string(),
    type: z.enum(['unit', 'integration', 'e2e', 'performance']).optional(),
    steps: z.array(z.string()).optional(),
    expected: z.string().optional(),
  })).min(1),
  coverageTarget: z.number().min(0).max(100).optional(),
});

export const securityAuditSchema = z.object({
  findings: z.array(z.object({
    severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
    title: z.string(),
    description: z.string(),
    recommendation: z.string().optional(),
  })),
  overallRisk: z.enum(['critical', 'high', 'medium', 'low']).optional(),
});

export const documentationSchema = z.object({
  title: z.string(),
  content: z.string(),
  sections: z.array(z.object({
    heading: z.string(),
    content: z.string(),
  })).optional(),
  format: z.enum(['markdown', 'html', 'plain']).optional(),
});

export const codeReviewSchema = z.object({
  summary: z.string(),
  comments: z.array(z.object({
    file: z.string().optional(),
    line: z.number().optional(),
    severity: z.enum(['critical', 'major', 'minor', 'suggestion']).optional(),
    comment: z.string(),
  })),
  approved: z.boolean().optional(),
});

// =============================================================================
// SCHEMA MAP
// =============================================================================

export const artifactSchemas: Record<ArtifactType, z.ZodType> = {
  requirements: requirementsSchema,
  architecture: architectureSchema,
  api_spec: apiSpecSchema,
  code: codeSchema,
  test_plan: testPlanSchema,
  security_audit: securityAuditSchema,
  documentation: documentationSchema,
  code_review: codeReviewSchema,
};

// =============================================================================
// VALIDATION FUNCTION
// =============================================================================

/**
 * Validate artifact content against the schema for its type.
 * Returns { success: true, data } or { success: false, errors }.
 */
export function validateArtifactContent(
  type: ArtifactType,
  content: unknown
): { success: true; data: unknown } | { success: false; errors: string[] } {
  const schema = artifactSchemas[type];
  if (!schema) {
    return { success: false, errors: [`Unknown artifact type: ${type}`] };
  }

  const result = schema.safeParse(content);
  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
  };
}
