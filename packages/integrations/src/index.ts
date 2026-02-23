/**
 * @openagent/integrations
 *
 * External service integrations for OpenAgent V2.
 * Currently supports: GitHub, Webhooks
 */

export { GitHubClient } from './github/index.js';
export type {
  CreateIssueOptions,
  CreatePROptions,
  GitHubConfig,
  GitHubRepo,
  GitHubPR,
  GitHubIssue,
  GitHubFile,
  GitHubBranch,
  GitHubCommit,
  RepoAnalysis,
} from './github/index.js';

export { WebhookManager, WebhookSender } from './webhooks/index.js';
export type {
  WebhookConfig,
  WebhookPayload,
  WebhookRegistration,
  WebhookResult,
} from './webhooks/index.js';
