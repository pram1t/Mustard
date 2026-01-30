/**
 * GitTool
 *
 * Safe high-level git operations with validation and guards.
 * Beyond Claude Code - provides structured output and safety checks.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from '../base.js';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types.js';

const execAsync = promisify(exec);

/**
 * Dangerous operations that require explicit confirmation
 */
const DANGEROUS_OPERATIONS = ['push --force', 'reset --hard', 'clean -f', 'branch -D'];

/**
 * GitTool - Safe git operations
 */
export class GitTool extends BaseTool {
  readonly name = 'Git';
  readonly description = `Perform git operations with safety guards and structured output.

Supported operations:
- **status**: Show working tree status
- **log**: Show commit history
- **branch**: List or manage branches
- **diff**: Show changes (use Diff tool for file-specific diffs)
- **stash**: Stash changes
- **add**: Stage files
- **commit**: Create a commit
- **pull**: Fetch and merge changes
- **push**: Push to remote

Safety features:
- Validates operations before execution
- Guards against dangerous commands
- Returns structured output`;

  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Git operation to perform',
        enum: ['status', 'log', 'branch', 'diff', 'stash', 'add', 'commit', 'pull', 'push'],
      },
      args: {
        type: 'object',
        description: 'Operation-specific arguments',
        additionalProperties: true,
      },
    },
    required: ['operation'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const operation = params.operation as string;
      const args = (params.args as Record<string, unknown>) || {};

      // Check if we're in a git repository
      try {
        await execAsync('git rev-parse --git-dir', { cwd: context.cwd });
      } catch {
        return this.failure('Not in a git repository. Run "git init" first.');
      }

      // Route to operation handler
      switch (operation) {
        case 'status':
          return this.gitStatus(context);

        case 'log':
          return this.gitLog(context, args);

        case 'branch':
          return this.gitBranch(context, args);

        case 'diff':
          return this.gitDiff(context, args);

        case 'stash':
          return this.gitStash(context, args);

        case 'add':
          return this.gitAdd(context, args);

        case 'commit':
          return this.gitCommit(context, args);

        case 'pull':
          return this.gitPull(context, args);

        case 'push':
          return this.gitPush(context, args);

        default:
          return this.failure(`Unknown operation: ${operation}`);
      }
    });
  }

  private async runGit(
    command: string,
    cwd: string
  ): Promise<{ stdout: string; stderr: string }> {
    return execAsync(`git ${command}`, {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
    });
  }

  private async gitStatus(context: ExecutionContext): Promise<ToolResult> {
    const { stdout } = await this.runGit('status --porcelain=v2 --branch', context.cwd);

    if (!stdout.trim()) {
      return this.success('Working tree clean, nothing to commit.', {
        clean: true,
        staged: [],
        modified: [],
        untracked: [],
      });
    }

    const lines = stdout.trim().split('\n');
    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];
    let branch = 'unknown';

    for (const line of lines) {
      if (line.startsWith('# branch.head')) {
        branch = line.split(' ')[2] || 'unknown';
      } else if (line.startsWith('1') || line.startsWith('2')) {
        const parts = line.split('\t');
        const statusPart = parts[0].split(' ');
        const xy = statusPart[1];
        const filePath = parts[1] || statusPart[statusPart.length - 1];

        if (xy[0] !== '.') staged.push(filePath);
        if (xy[1] !== '.') modified.push(filePath);
      } else if (line.startsWith('?')) {
        untracked.push(line.substring(2));
      }
    }

    let output = `Branch: ${branch}\n\n`;

    if (staged.length > 0) {
      output += `Staged (${staged.length}):\n${staged.map(f => `  + ${f}`).join('\n')}\n\n`;
    }
    if (modified.length > 0) {
      output += `Modified (${modified.length}):\n${modified.map(f => `  M ${f}`).join('\n')}\n\n`;
    }
    if (untracked.length > 0) {
      output += `Untracked (${untracked.length}):\n${untracked.map(f => `  ? ${f}`).join('\n')}\n`;
    }

    return this.success(output.trim(), {
      clean: false,
      branch,
      staged,
      modified,
      untracked,
    });
  }

  private async gitLog(
    context: ExecutionContext,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const count = (args.count as number) || 10;
    const oneline = args.oneline !== false;

    const format = oneline
      ? '--pretty=format:"%h %s (%cr)"'
      : '--pretty=format:"%H%n%an <%ae>%n%ar%n%s%n%b%n---"';

    const { stdout } = await this.runGit(`log -${count} ${format}`, context.cwd);

    if (!stdout.trim()) {
      return this.success('No commits yet.', { commits: [] });
    }

    return this.success(`Recent commits (${count}):\n\n${stdout}`, {
      count,
      oneline,
    });
  }

  private async gitBranch(
    context: ExecutionContext,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const action = args.action as string | undefined;
    const name = args.name as string | undefined;

    if (action === 'create' && name) {
      await this.runGit(`branch "${name}"`, context.cwd);
      return this.success(`Created branch: ${name}`, { action: 'create', branch: name });
    }

    if (action === 'delete' && name) {
      // Use safe delete (-d) by default
      await this.runGit(`branch -d "${name}"`, context.cwd);
      return this.success(`Deleted branch: ${name}`, { action: 'delete', branch: name });
    }

    if (action === 'checkout' && name) {
      await this.runGit(`checkout "${name}"`, context.cwd);
      return this.success(`Switched to branch: ${name}`, { action: 'checkout', branch: name });
    }

    // Default: list branches
    const { stdout } = await this.runGit('branch -vv', context.cwd);
    return this.success(`Branches:\n${stdout}`, { action: 'list' });
  }

  private async gitDiff(
    context: ExecutionContext,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const staged = args.staged as boolean;
    const base = args.base as string | undefined;

    let command = 'diff';
    if (staged) command += ' --cached';
    if (base) command += ` ${base}`;

    const { stdout } = await this.runGit(command, context.cwd);

    if (!stdout.trim()) {
      return this.success('No changes.', { hasChanges: false });
    }

    return this.success(`\`\`\`diff\n${stdout}\n\`\`\``, { hasChanges: true });
  }

  private async gitStash(
    context: ExecutionContext,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const action = (args.action as string) || 'push';
    const message = args.message as string | undefined;

    if (action === 'push') {
      const cmd = message ? `stash push -m "${message}"` : 'stash push';
      await this.runGit(cmd, context.cwd);
      return this.success('Changes stashed.', { action: 'push' });
    }

    if (action === 'pop') {
      await this.runGit('stash pop', context.cwd);
      return this.success('Stash applied and removed.', { action: 'pop' });
    }

    if (action === 'list') {
      const { stdout } = await this.runGit('stash list', context.cwd);
      return this.success(stdout || 'No stashes.', { action: 'list' });
    }

    return this.failure(`Unknown stash action: ${action}`);
  }

  private async gitAdd(
    context: ExecutionContext,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const files = args.files as string[] | undefined;

    if (!files || files.length === 0) {
      return this.failure('No files specified. Use args.files: ["file1", "file2"]');
    }

    const fileList = files.map(f => `"${f}"`).join(' ');
    await this.runGit(`add ${fileList}`, context.cwd);

    return this.success(`Staged ${files.length} file(s):\n${files.map(f => `  + ${f}`).join('\n')}`, {
      staged: files,
    });
  }

  private async gitCommit(
    context: ExecutionContext,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const message = args.message as string | undefined;

    if (!message) {
      return this.failure('Commit message required. Use args.message: "Your message"');
    }

    // Escape quotes in message
    const escapedMessage = message.replace(/"/g, '\\"');

    const { stdout } = await this.runGit(`commit -m "${escapedMessage}"`, context.cwd);

    return this.success(`Commit created:\n${stdout}`, { message });
  }

  private async gitPull(
    context: ExecutionContext,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const remote = (args.remote as string) || 'origin';
    const branch = args.branch as string | undefined;

    const cmd = branch ? `pull ${remote} ${branch}` : `pull ${remote}`;
    const { stdout } = await this.runGit(cmd, context.cwd);

    return this.success(`Pull complete:\n${stdout}`, { remote, branch });
  }

  private async gitPush(
    context: ExecutionContext,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const remote = (args.remote as string) || 'origin';
    const branch = args.branch as string | undefined;
    const setUpstream = args.setUpstream as boolean;
    const force = args.force as boolean;

    // Safety check for force push
    if (force) {
      return this.failure(
        'Force push is dangerous and disabled by default.\n' +
        'Use the Bash tool with explicit confirmation if you really need force push.'
      );
    }

    let cmd = 'push';
    if (setUpstream) cmd += ' -u';
    cmd += ` ${remote}`;
    if (branch) cmd += ` ${branch}`;

    const { stdout } = await this.runGit(cmd, context.cwd);

    return this.success(`Push complete:\n${stdout || 'Everything up-to-date'}`, {
      remote,
      branch,
      setUpstream,
    });
  }
}
