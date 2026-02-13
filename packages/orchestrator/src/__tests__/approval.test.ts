import { describe, it, expect, vi } from 'vitest';
import { ApprovalManager, formatPlanForApproval } from '../approval.js';
import type { ExecutionPlan } from '../types.js';

function createTestPlan(stepCount: number = 2): ExecutionPlan {
  const steps = Array.from({ length: stepCount }, (_, i) => ({
    id: `step-${i + 1}`,
    title: `Step ${i + 1}`,
    description: `Description for step ${i + 1}`,
    assignTo: i === 0 ? 'architect' as const : 'backend' as const,
    priority: 'normal' as const,
    dependencies: i > 0 ? [`step-${i}`] : [],
    prompt: `Prompt for step ${i + 1}`,
  }));

  return {
    id: 'plan-1',
    request: 'Build a feature',
    steps,
    createdAt: new Date(),
  };
}

describe('ApprovalManager', () => {
  describe('hasPlanCallback', () => {
    it('should return false when no callback set', () => {
      const mgr = new ApprovalManager();
      expect(mgr.hasPlanCallback()).toBe(false);
    });

    it('should return true after setting callback', () => {
      const mgr = new ApprovalManager();
      mgr.setPlanApprovalCallback(async (plan, formatted) => ({
        decision: 'approve',
        plan,
      }));
      expect(mgr.hasPlanCallback()).toBe(true);
    });
  });

  describe('hasStepCallback', () => {
    it('should return false when no callback set', () => {
      const mgr = new ApprovalManager();
      expect(mgr.hasStepCallback()).toBe(false);
    });

    it('should return true after setting callback', () => {
      const mgr = new ApprovalManager();
      mgr.setStepApprovalCallback(async () => true);
      expect(mgr.hasStepCallback()).toBe(true);
    });
  });

  describe('requestPlanApproval', () => {
    it('should auto-approve when no callback is set', async () => {
      const mgr = new ApprovalManager();
      const plan = createTestPlan();
      const result = await mgr.requestPlanApproval(plan);
      expect(result.decision).toBe('approve');
      expect(result.plan).toBe(plan);
    });

    it('should call callback with plan and formatted text', async () => {
      const mgr = new ApprovalManager();
      const callback = vi.fn(async (plan: ExecutionPlan, formatted: string) => ({
        decision: 'approve' as const,
        plan,
      }));
      mgr.setPlanApprovalCallback(callback);

      const plan = createTestPlan();
      await mgr.requestPlanApproval(plan);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(plan, expect.any(String));
    });

    it('should return rejection when callback rejects', async () => {
      const mgr = new ApprovalManager();
      mgr.setPlanApprovalCallback(async (plan) => ({
        decision: 'reject',
        plan,
        reason: 'Not what I wanted',
      }));

      const plan = createTestPlan();
      const result = await mgr.requestPlanApproval(plan);

      expect(result.decision).toBe('reject');
      expect(result.reason).toBe('Not what I wanted');
    });

    it('should return modified plan when callback modifies', async () => {
      const mgr = new ApprovalManager();
      mgr.setPlanApprovalCallback(async (plan) => {
        // Remove the second step
        const modifiedPlan = { ...plan, steps: [plan.steps[0]] };
        return { decision: 'modify', plan: modifiedPlan };
      });

      const plan = createTestPlan(3);
      const result = await mgr.requestPlanApproval(plan);

      expect(result.decision).toBe('modify');
      expect(result.plan.steps).toHaveLength(1);
    });
  });

  describe('requestStepApproval', () => {
    it('should auto-approve when no callback is set', async () => {
      const mgr = new ApprovalManager();
      const approved = await mgr.requestStepApproval({
        step: createTestPlan().steps[0],
        stepIndex: 0,
        totalSteps: 2,
        previousResults: [],
      });
      expect(approved).toBe(true);
    });

    it('should call callback with step context', async () => {
      const mgr = new ApprovalManager();
      const callback = vi.fn(async () => true);
      mgr.setStepApprovalCallback(callback);

      const plan = createTestPlan();
      await mgr.requestStepApproval({
        step: plan.steps[0],
        stepIndex: 0,
        totalSteps: 2,
        previousResults: [],
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          stepIndex: 0,
          totalSteps: 2,
        })
      );
    });

    it('should return false when callback rejects step', async () => {
      const mgr = new ApprovalManager();
      mgr.setStepApprovalCallback(async () => false);

      const approved = await mgr.requestStepApproval({
        step: createTestPlan().steps[0],
        stepIndex: 0,
        totalSteps: 1,
        previousResults: [],
      });
      expect(approved).toBe(false);
    });
  });
});

describe('formatPlanForApproval', () => {
  it('should include plan request', () => {
    const plan = createTestPlan();
    const formatted = formatPlanForApproval(plan);
    expect(formatted).toContain('Build a feature');
  });

  it('should include step count', () => {
    const plan = createTestPlan(3);
    const formatted = formatPlanForApproval(plan);
    expect(formatted).toContain('3');
  });

  it('should include step titles and roles', () => {
    const plan = createTestPlan();
    const formatted = formatPlanForApproval(plan);
    expect(formatted).toContain('[architect]');
    expect(formatted).toContain('Step 1');
    expect(formatted).toContain('[backend]');
    expect(formatted).toContain('Step 2');
  });

  it('should include dependencies', () => {
    const plan = createTestPlan();
    const formatted = formatPlanForApproval(plan);
    expect(formatted).toContain('depends on: step-1');
  });

  it('should include step descriptions', () => {
    const plan = createTestPlan();
    const formatted = formatPlanForApproval(plan);
    expect(formatted).toContain('Description for step 1');
    expect(formatted).toContain('Description for step 2');
  });

  it('should include priority for non-normal steps', () => {
    const plan: ExecutionPlan = {
      id: 'plan-1',
      request: 'Test',
      steps: [{
        id: 'step-1',
        title: 'Critical step',
        description: 'Very important',
        assignTo: 'backend',
        priority: 'critical',
        dependencies: [],
        prompt: 'Do the thing',
      }],
      createdAt: new Date(),
    };
    const formatted = formatPlanForApproval(plan);
    expect(formatted).toContain('[critical]');
  });
});
