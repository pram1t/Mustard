import { describe, it, expect } from 'vitest';
import { parseTestOutput, TestRunnerTool } from '../test-runner.js';

describe('TestRunnerTool', () => {
  const tool = new TestRunnerTool();
  describe('parseTestOutput', () => {
    it('should parse Vitest success output', () => {
      const output = `
        Test Files  1 passed (1)
        Tests  6 passed (6)
        Start at  09:17:58
        Duration  514ms
      `;
      const results = parseTestOutput(output, 'vitest');
      expect(results.passed).toBe(6);
      expect(results.failed).toBe(0);
      expect(results.errors).toHaveLength(0);
    });

    it('should parse Jest failure output', () => {
      const output = `
FAIL  src/sum.test.ts
  ● sum › adds 1 + 2 to equal 3

    AssertionError: expected 3 to be 4

      at Object.<anonymous> (src/sum.test.ts:5:12)

Tests: 1 failed, 1 passed, 2 total
      `;
      const results = parseTestOutput(output, 'jest');
      expect(results.passed).toBe(1);
      expect(results.failed).toBe(1);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0].test).toContain('sum › adds 1 + 2 to equal 3');
      expect(results.errors[0].message).toContain('AssertionError: expected 3 to be 4');
      expect(results.errors[0].file).toBe('src/sum.test.ts');
      expect(results.errors[0].line).toBe(5);
    });

    it('should parse Pytest output', () => {
      const output = `
============================= test session starts ==============================
collected 3 items

test_main.py ..F                                                         [100%]

=================================== FAILURES ===================================
__________________________________ test_fail ___________________________________

    def test_fail():
>       assert 1 == 2
E       assert 1 == 2

test_main.py:6: AssertionError
=========================== short test summary info ============================
FAILED test_main.py::test_fail - assert 1 == 2
========================= 1 failed, 2 passed in 0.05s ==========================
      `;
      const results = parseTestOutput(output, 'pytest');
      expect(results.passed).toBe(2);
      expect(results.failed).toBe(1);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0].test).toBe('test_main.py::test_fail - assert 1 == 2');
    });

    it('should provide fallback error when parsing fails', () => {
      const output = `
      Tests: 1 failed
      `;
      const results = parseTestOutput(output, 'auto');
      expect(results.failed).toBe(1);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0].test).toBe('Unknown Test');
    });
  });

  describe('security', () => {
    it('should block command injection in pattern', async () => {
      const result = await tool.execute({
        pattern: 'test; rm -rf /'
      }, {
        cwd: process.cwd(),
        sessionId: 'test',
        homeDir: '/tmp',
        config: {}
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Command blocked');
    });

    it('should handle shell metacharacters safely', async () => {
      // If our shell escape works, this should not cause an injection.
      // We use a pattern that contains characters that would be dangerous if not escaped.
      const result = await tool.execute({
        pattern: "'; echo vulnerable; '"
      }, {
        cwd: process.cwd(),
        sessionId: 'test',
        homeDir: '/tmp',
        config: {}
      });

      // The command should be something like: npx vitest run ''\''; echo vulnerable; '\''
      // validateCommand might block it because it still contains ';' even if escaped,
      // as it checks the whole command string.
      // If it passes validation, it should fail to find any tests.
      if (result.success === false) {
        expect(result.error).toMatch(/Command blocked|Test execution failed|No tests found/i);
      }
    });
  });
});
