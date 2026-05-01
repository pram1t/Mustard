import { describe, it, expect } from 'vitest';
import {
  formatPlanCreated,
  formatTaskStarted,
  formatTaskCompleted,
  formatTaskFailed,
  formatProgressBar,
  formatPlanSummary,
} from '../progress.js';
import type { OrchestratorResult } from '@pram1t/mustard-orchestrator';

describe('Progress Formatters', () => {
  describe('formatPlanCreated', () => {
    it('should include plan ID and step count', () => {
      const result = formatPlanCreated('abc12345-def6-7890-ghij-klmnopqrstuv', 5);
      expect(result).toContain('abc12345');
      expect(result).toContain('5');
      expect(result).toContain('Plan');
    });

    it('should truncate plan ID to first 8 chars', () => {
      const result = formatPlanCreated('abcdefgh-1234-5678-9012-345678901234', 3);
      expect(result).toContain('abcdefgh');
    });
  });

  describe('formatTaskStarted', () => {
    it('should include role and title', () => {
      const result = formatTaskStarted('step-1', 'Analyze code', 'architect');
      expect(result).toContain('architect');
      expect(result).toContain('Analyze code');
      expect(result).toContain('step-1');
    });
  });

  describe('formatTaskCompleted', () => {
    it('should include checkmark and duration', () => {
      const result = formatTaskCompleted('step-1', 'Analyze code', 2500);
      expect(result).toContain('✓');
      expect(result).toContain('Analyze code');
      expect(result).toContain('2.5s');
    });

    it('should format sub-second durations', () => {
      const result = formatTaskCompleted('step-1', 'Quick task', 150);
      expect(result).toContain('0.1s');
    });
  });

  describe('formatTaskFailed', () => {
    it('should include error marker and message', () => {
      const result = formatTaskFailed('step-1', 'Build project', 'Compilation error');
      expect(result).toContain('✗');
      expect(result).toContain('Build project');
      expect(result).toContain('Compilation error');
    });
  });

  describe('formatProgressBar', () => {
    it('should show 0% for no progress', () => {
      const result = formatProgressBar(0, 5);
      expect(result).toContain('0%');
      expect(result).toContain('0/5');
    });

    it('should show 100% for complete', () => {
      const result = formatProgressBar(5, 5);
      expect(result).toContain('100%');
      expect(result).toContain('5/5');
    });

    it('should show partial progress', () => {
      const result = formatProgressBar(2, 4);
      expect(result).toContain('50%');
      expect(result).toContain('2/4');
    });

    it('should handle zero total', () => {
      const result = formatProgressBar(0, 0);
      expect(result).toContain('0/0');
    });
  });

  describe('formatPlanSummary', () => {
    it('should format successful result', () => {
      const result: OrchestratorResult = {
        planId: 'test-plan-id',
        success: true,
        stepResults: [
          { stepId: 'step-1', status: 'completed', duration: 1000, output: 'done' },
          { stepId: 'step-2', status: 'completed', duration: 2000, output: 'done' },
        ],
        totalDuration: 3000,
        summary: 'Successfully completed all 2 steps.',
      };

      const output = formatPlanSummary(result);
      expect(output).toContain('✓');
      expect(output).toContain('3.0s');
      expect(output).toContain('2 completed');
      expect(output).toContain('0 failed');
    });

    it('should format failed result', () => {
      const result: OrchestratorResult = {
        planId: 'test-plan-id',
        success: false,
        stepResults: [
          { stepId: 'step-1', status: 'completed', duration: 1000, output: 'done' },
          { stepId: 'step-2', status: 'failed', duration: 500, error: 'timeout' },
        ],
        totalDuration: 1500,
        summary: 'Completed 1/2 steps. 1 step(s) failed.',
      };

      const output = formatPlanSummary(result);
      expect(output).toContain('✗');
      expect(output).toContain('1.5s');
      expect(output).toContain('1 completed');
      expect(output).toContain('1 failed');
    });
  });
});
