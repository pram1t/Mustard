/**
 * Tool Security — Risk Assessment
 *
 * Classifies tool calls by risk level and determines
 * whether user confirmation is required before execution.
 */

export type RiskLevel = 'low' | 'medium' | 'high';

export interface ToolRiskAssessment {
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  reason?: string;
}

/**
 * Risk classification for known built-in tools.
 */
const TOOL_RISK_MAP: Record<string, RiskLevel> = {
  // Low risk: read-only operations
  Read: 'low',
  Glob: 'low',
  Grep: 'low',
  TodoRead: 'low',
  ListShells: 'low',
  TaskOutput: 'low',
  Diff: 'low',

  // Medium risk: modifications with undo potential
  Write: 'medium',
  Edit: 'medium',
  MultiEdit: 'medium',
  NotebookEdit: 'medium',
  TodoWrite: 'medium',

  // High risk: shell execution, network, destructive
  Bash: 'high',
  Task: 'high',
  TaskStop: 'high',
  KillShell: 'high',
  WebFetch: 'high',
  WebSearch: 'high',
};

/**
 * Assesses the risk level of a tool call.
 *
 * - MCP tools (contain `__` separator) are always high risk
 * - Known built-in tools use the TOOL_RISK_MAP
 * - Unknown tools default to medium risk
 */
export function assessToolRisk(toolName: string): ToolRiskAssessment {
  // MCP tools execute on external servers — always high risk
  if (toolName.includes('__')) {
    return {
      riskLevel: 'high',
      requiresConfirmation: true,
      reason: `MCP tool '${toolName}' executes on external server`,
    };
  }

  const riskLevel = TOOL_RISK_MAP[toolName] ?? 'medium';

  return {
    riskLevel,
    requiresConfirmation: riskLevel === 'high',
    reason: riskLevel === 'high'
      ? `Tool '${toolName}' is classified as high risk`
      : undefined,
  };
}
