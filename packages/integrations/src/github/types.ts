/**
 * GitHub integration types.
 * Uses the GitHub REST API directly (no Octokit dependency) for a lightweight integration.
 */

export interface GitHubConfig {
  token: string;
  baseUrl?: string; // defaults to https://api.github.com
  userAgent?: string;
}

export interface GitHubRepo {
  owner: string;
  repo: string;
}

export interface GitHubPR {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  html_url: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  created_at: string;
  updated_at: string;
  merged: boolean;
  mergeable: boolean | null;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface CreatePROptions {
  title: string;
  body?: string;
  head: string;
  base: string;
  draft?: boolean;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  labels: Array<{ name: string }>;
  created_at: string;
  updated_at: string;
}

export interface CreateIssueOptions {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
}

export interface GitHubBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: { name: string; date: string };
  html_url: string;
}

export interface RepoAnalysis {
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  defaultBranch: string;
  stars: number;
  forks: number;
  openIssues: number;
  topics: string[];
  branches: GitHubBranch[];
  recentCommits: GitHubCommit[];
  fileTree: GitHubFile[];
}

export interface GitHubApiError {
  message: string;
  status: number;
  documentation_url?: string;
}
