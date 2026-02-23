import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workerCommand } from '../worker.js';

describe('workerCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  describe('list', () => {
    it('should list all built-in worker roles', async () => {
      await workerCommand('list');

      const output = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join('\n');
      expect(output).toContain('Available Worker Roles');
      expect(output).toContain('architect');
      expect(output).toContain('frontend');
      expect(output).toContain('backend');
      expect(output).toContain('qa');
      expect(output).toContain('devops');
      expect(output).toContain('security');
    });

    it('should show 10 built-in roles', async () => {
      await workerCommand('list');

      const output = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join('\n');
      expect(output).toContain('10 role(s)');
    });

    it('should default to list action', async () => {
      await workerCommand();

      const output = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join('\n');
      expect(output).toContain('Available Worker Roles');
    });
  });

  describe('info', () => {
    it('should show detailed info for architect role', async () => {
      await workerCommand('info', { role: 'architect' });

      const output = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join('\n');
      expect(output).toContain('Architect');
      expect(output).toContain('Description:');
      expect(output).toContain('Expertise:');
      expect(output).toContain('Responsibilities:');
      expect(output).toContain('Skills:');
      expect(output).toContain('Tool Access:');
      expect(output).toContain('Artifacts:');
      expect(output).toContain('Constraints:');
    });

    it('should show detailed info for backend role', async () => {
      await workerCommand('info', { role: 'backend' });

      const output = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join('\n');
      expect(output).toContain('Backend');
    });

    it('should error on missing role', async () => {
      await workerCommand('info', {});

      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.map((c: any[]) => c[0]).join('\n');
      expect(errorOutput).toContain('Worker role is required');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should error on unknown role', async () => {
      await workerCommand('info', { role: 'nonexistent' });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.map((c: any[]) => c[0]).join('\n');
      expect(errorOutput).toContain('Unknown worker role');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should show all valid roles', async () => {
      const roles = ['architect', 'frontend', 'backend', 'qa', 'devops', 'security', 'pm', 'tech_writer', 'ui_ux', 'dba'];
      for (const role of roles) {
        consoleLogSpy.mockClear();
        await workerCommand('info', { role });

        const output = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join('\n');
        expect(output).toContain('Description:');
      }
    });
  });
});
