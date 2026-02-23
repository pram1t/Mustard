/**
 * Lightweight GitHub REST API client.
 * No external dependencies — uses native fetch().
 */

import type {
  CreateIssueOptions,
  CreatePROptions,
  GitHubApiError,
  GitHubBranch,
  GitHubCommit,
  GitHubConfig,
  GitHubFile,
  GitHubIssue,
  GitHubPR,
  GitHubRepo,
  RepoAnalysis,
} from './types.js';

export class GitHubClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(private config: GitHubConfig) {
    this.baseUrl = config.baseUrl ?? 'https://api.github.com';
    this.headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'User-Agent': config.userAgent ?? 'openagent/1.0',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  // ─── Low-level HTTP ────────────────────────────────────────────

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({ message: res.statusText }))) as GitHubApiError;
      const error = new Error(`GitHub API ${res.status}: ${err.message}`);
      (error as any).status = res.status;
      throw error;
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  private get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  // ─── Repository ────────────────────────────────────────────────

  async getRepo(repo: GitHubRepo) {
    return this.get<Record<string, any>>(`/repos/${repo.owner}/${repo.repo}`);
  }

  async listBranches(repo: GitHubRepo): Promise<GitHubBranch[]> {
    return this.get<GitHubBranch[]>(`/repos/${repo.owner}/${repo.repo}/branches?per_page=100`);
  }

  async listFiles(repo: GitHubRepo, path = '', ref?: string): Promise<GitHubFile[]> {
    const q = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    return this.get<GitHubFile[]>(`/repos/${repo.owner}/${repo.repo}/contents/${path}${q}`);
  }

  async getFileContent(repo: GitHubRepo, path: string, ref?: string): Promise<string> {
    const q = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const data = await this.get<{ content: string; encoding: string }>(
      `/repos/${repo.owner}/${repo.repo}/contents/${path}${q}`,
    );
    if (data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return data.content;
  }

  async listCommits(repo: GitHubRepo, opts?: { sha?: string; per_page?: number }): Promise<GitHubCommit[]> {
    const params = new URLSearchParams();
    if (opts?.sha) params.set('sha', opts.sha);
    params.set('per_page', String(opts?.per_page ?? 10));
    const raw = await this.get<Array<{ sha: string; commit: any; html_url: string }>>(
      `/repos/${repo.owner}/${repo.repo}/commits?${params}`,
    );
    return raw.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      author: { name: c.commit.author.name, date: c.commit.author.date },
      html_url: c.html_url,
    }));
  }

  /**
   * Analyze a repository — returns structure, branches, recent commits, metadata.
   */
  async analyzeRepo(repo: GitHubRepo): Promise<RepoAnalysis> {
    const [repoData, branches, commits, files] = await Promise.all([
      this.getRepo(repo),
      this.listBranches(repo),
      this.listCommits(repo, { per_page: 10 }),
      this.listFiles(repo).catch(() => [] as GitHubFile[]),
    ]);

    return {
      name: repoData.name,
      fullName: repoData.full_name,
      description: repoData.description,
      language: repoData.language,
      defaultBranch: repoData.default_branch,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      openIssues: repoData.open_issues_count,
      topics: repoData.topics ?? [],
      branches,
      recentCommits: commits,
      fileTree: files,
    };
  }

  // ─── Pull Requests ─────────────────────────────────────────────

  async createPR(repo: GitHubRepo, opts: CreatePROptions): Promise<GitHubPR> {
    return this.post<GitHubPR>(`/repos/${repo.owner}/${repo.repo}/pulls`, opts);
  }

  async getPR(repo: GitHubRepo, number: number): Promise<GitHubPR> {
    return this.get<GitHubPR>(`/repos/${repo.owner}/${repo.repo}/pulls/${number}`);
  }

  async listPRs(repo: GitHubRepo, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubPR[]> {
    return this.get<GitHubPR[]>(`/repos/${repo.owner}/${repo.repo}/pulls?state=${state}&per_page=30`);
  }

  async updatePR(repo: GitHubRepo, number: number, updates: Partial<Pick<CreatePROptions, 'title' | 'body'>>): Promise<GitHubPR> {
    return this.patch<GitHubPR>(`/repos/${repo.owner}/${repo.repo}/pulls/${number}`, updates);
  }

  async addPRComment(repo: GitHubRepo, number: number, body: string): Promise<{ id: number; body: string }> {
    return this.post<{ id: number; body: string }>(`/repos/${repo.owner}/${repo.repo}/issues/${number}/comments`, { body });
  }

  // ─── Issues ────────────────────────────────────────────────────

  async createIssue(repo: GitHubRepo, opts: CreateIssueOptions): Promise<GitHubIssue> {
    return this.post<GitHubIssue>(`/repos/${repo.owner}/${repo.repo}/issues`, opts);
  }

  async getIssue(repo: GitHubRepo, number: number): Promise<GitHubIssue> {
    return this.get<GitHubIssue>(`/repos/${repo.owner}/${repo.repo}/issues/${number}`);
  }

  async listIssues(repo: GitHubRepo, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubIssue[]> {
    return this.get<GitHubIssue[]>(`/repos/${repo.owner}/${repo.repo}/issues?state=${state}&per_page=30`);
  }

  async addIssueComment(repo: GitHubRepo, number: number, body: string): Promise<{ id: number; body: string }> {
    return this.post<{ id: number; body: string }>(`/repos/${repo.owner}/${repo.repo}/issues/${number}/comments`, { body });
  }

  async closeIssue(repo: GitHubRepo, number: number): Promise<GitHubIssue> {
    return this.patch<GitHubIssue>(`/repos/${repo.owner}/${repo.repo}/issues/${number}`, { state: 'closed' });
  }
}
