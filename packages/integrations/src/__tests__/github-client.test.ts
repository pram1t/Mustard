import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubClient } from '../github/client.js';
import type { GitHubRepo } from '../github/types.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const repo: GitHubRepo = { owner: 'test-org', repo: 'test-repo' };

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  });
}

describe('GitHubClient', () => {
  let client: GitHubClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
    client = new GitHubClient({ token: 'ghp_test123' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets correct auth headers', async () => {
    mockFetch.mockReturnValue(jsonResponse({ name: 'test-repo' }));
    await client.getRepo(repo);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/test-org/test-repo',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer ghp_test123',
          'X-GitHub-Api-Version': '2022-11-28',
        }),
      }),
    );
  });

  it('uses custom base URL', async () => {
    const ghes = new GitHubClient({ token: 'tok', baseUrl: 'https://github.corp.com/api/v3' });
    mockFetch.mockReturnValue(jsonResponse({ name: 'repo' }));
    await ghes.getRepo(repo);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://github.corp.com/api/v3/repos/test-org/test-repo',
      expect.anything(),
    );
  });

  it('throws on API errors', async () => {
    mockFetch.mockReturnValue(jsonResponse({ message: 'Not Found' }, 404));
    await expect(client.getRepo(repo)).rejects.toThrow('GitHub API 404: Not Found');
  });

  // ─── PRs ───────────────────────────────────────────────────

  it('creates a pull request', async () => {
    const prData = { number: 42, title: 'feat: add tests', html_url: 'https://github.com/...' };
    mockFetch.mockReturnValue(jsonResponse(prData));

    const pr = await client.createPR(repo, {
      title: 'feat: add tests',
      head: 'feature-branch',
      base: 'main',
    });

    expect(pr.number).toBe(42);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/pulls'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('lists open PRs', async () => {
    mockFetch.mockReturnValue(jsonResponse([{ number: 1 }, { number: 2 }]));
    const prs = await client.listPRs(repo);
    expect(prs).toHaveLength(2);
  });

  it('adds a comment to a PR', async () => {
    mockFetch.mockReturnValue(jsonResponse({ id: 100, body: 'LGTM' }));
    const comment = await client.addPRComment(repo, 42, 'LGTM');
    expect(comment.body).toBe('LGTM');
  });

  // ─── Issues ────────────────────────────────────────────────

  it('creates an issue', async () => {
    const issueData = { number: 7, title: 'Bug', state: 'open', html_url: 'https://...' };
    mockFetch.mockReturnValue(jsonResponse(issueData));

    const issue = await client.createIssue(repo, { title: 'Bug', body: 'Something broke' });
    expect(issue.number).toBe(7);
  });

  it('closes an issue', async () => {
    mockFetch.mockReturnValue(jsonResponse({ number: 7, state: 'closed' }));
    const issue = await client.closeIssue(repo, 7);
    expect(issue.state).toBe('closed');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/issues/7'),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  // ─── Repo analysis ────────────────────────────────────────

  it('analyzes a repository', async () => {
    mockFetch
      .mockReturnValueOnce(jsonResponse({
        name: 'test-repo',
        full_name: 'test-org/test-repo',
        description: 'A test repo',
        language: 'TypeScript',
        default_branch: 'main',
        stargazers_count: 100,
        forks_count: 10,
        open_issues_count: 5,
        topics: ['testing'],
      }))
      .mockReturnValueOnce(jsonResponse([{ name: 'main', commit: { sha: 'abc' }, protected: true }]))
      .mockReturnValueOnce(jsonResponse([
        { sha: 'abc', commit: { message: 'init', author: { name: 'dev', date: '2025-01-01' } }, html_url: '#' },
      ]))
      .mockReturnValueOnce(jsonResponse([{ name: 'README.md', path: 'README.md', sha: 'x', size: 100, type: 'file' }]));

    const analysis = await client.analyzeRepo(repo);
    expect(analysis.name).toBe('test-repo');
    expect(analysis.language).toBe('TypeScript');
    expect(analysis.branches).toHaveLength(1);
    expect(analysis.recentCommits).toHaveLength(1);
    expect(analysis.fileTree).toHaveLength(1);
  });

  // ─── File content ──────────────────────────────────────────

  it('gets file content (base64)', async () => {
    mockFetch.mockReturnValue(jsonResponse({
      content: Buffer.from('hello world').toString('base64'),
      encoding: 'base64',
    }));

    const content = await client.getFileContent(repo, 'README.md');
    expect(content).toBe('hello world');
  });

  it('lists commits', async () => {
    mockFetch.mockReturnValue(jsonResponse([
      { sha: 'a1', commit: { message: 'first', author: { name: 'dev', date: '2025-01-01' } }, html_url: '#1' },
      { sha: 'b2', commit: { message: 'second', author: { name: 'dev', date: '2025-01-02' } }, html_url: '#2' },
    ]));

    const commits = await client.listCommits(repo, { per_page: 2 });
    expect(commits).toHaveLength(2);
    expect(commits[0].message).toBe('first');
  });
});
