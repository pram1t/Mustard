import { describe, it, expect } from 'vitest';
import { assessToolRisk } from '../tool-security';

describe('assessToolRisk', () => {
  it('classifies Read as low risk', () => {
    const result = assessToolRisk('Read');
    expect(result.riskLevel).toBe('low');
    expect(result.requiresConfirmation).toBe(false);
  });

  it('classifies Glob as low risk', () => {
    const result = assessToolRisk('Glob');
    expect(result.riskLevel).toBe('low');
    expect(result.requiresConfirmation).toBe(false);
  });

  it('classifies Grep as low risk', () => {
    const result = assessToolRisk('Grep');
    expect(result.riskLevel).toBe('low');
    expect(result.requiresConfirmation).toBe(false);
  });

  it('classifies Write as medium risk', () => {
    const result = assessToolRisk('Write');
    expect(result.riskLevel).toBe('medium');
    expect(result.requiresConfirmation).toBe(false);
  });

  it('classifies Edit as medium risk', () => {
    const result = assessToolRisk('Edit');
    expect(result.riskLevel).toBe('medium');
    expect(result.requiresConfirmation).toBe(false);
  });

  it('classifies Bash as high risk requiring confirmation', () => {
    const result = assessToolRisk('Bash');
    expect(result.riskLevel).toBe('high');
    expect(result.requiresConfirmation).toBe(true);
    expect(result.reason).toContain('high risk');
  });

  it('classifies WebFetch as high risk requiring confirmation', () => {
    const result = assessToolRisk('WebFetch');
    expect(result.riskLevel).toBe('high');
    expect(result.requiresConfirmation).toBe(true);
  });

  it('classifies unknown tools as medium risk', () => {
    const result = assessToolRisk('SomeUnknownTool');
    expect(result.riskLevel).toBe('medium');
    expect(result.requiresConfirmation).toBe(false);
  });

  it('classifies MCP tools (with __) as high risk', () => {
    const result = assessToolRisk('filesystem__read_file');
    expect(result.riskLevel).toBe('high');
    expect(result.requiresConfirmation).toBe(true);
    expect(result.reason).toContain('external server');
  });

  it('classifies another MCP tool pattern as high risk', () => {
    const result = assessToolRisk('github__create_issue');
    expect(result.riskLevel).toBe('high');
    expect(result.requiresConfirmation).toBe(true);
  });
});
