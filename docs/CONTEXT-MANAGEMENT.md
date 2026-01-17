# Context Management

This document describes how OpenAgent manages conversation context and handles token limits.

## Overview

Context management solves the fundamental challenge of working within LLM context limits while maintaining coherent, long-running conversations.

## Core Concepts

### Token Budget

Every LLM has a maximum context length:

| Provider | Model | Max Context |
|----------|-------|-------------|
| OpenAI | GPT-4o | 128K tokens |
| Anthropic | Claude Opus/Sonnet | 200K tokens |
| Google | Gemini 1.5 Pro | 1M tokens |
| Ollama | Varies | 4K-128K tokens |

The context manager tracks token usage and triggers compaction before overflow.

### Message Types

```typescript
type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

interface Message {
  role: MessageRole;
  content: string | ContentPart[];
  name?: string;           // Tool name for tool messages
  tool_call_id?: string;   // Links tool result to tool call
  timestamp?: number;      // For ordering
  tokenCount?: number;     // Cached token count
}
```

## Context Manager Implementation

```typescript
// packages/core/src/context/manager.ts

import type { Message } from '@openagent/llm';

interface ContextManagerConfig {
  /** Maximum tokens for context */
  maxTokens: number;

  /** Threshold to trigger compaction (percentage of maxTokens) */
  compactionThreshold?: number;

  /** Minimum recent messages to preserve during compaction */
  preserveRecentCount?: number;

  /** Token counter function */
  countTokens?: (text: string) => number;
}

export class ContextManager {
  readonly sessionId: string;
  private messages: Message[] = [];
  private tokenCount: number = 0;
  private config: Required<ContextManagerConfig>;

  constructor(config: ContextManagerConfig) {
    this.sessionId = generateSessionId();
    this.config = {
      compactionThreshold: 0.8, // 80% of max triggers compaction
      preserveRecentCount: 10,
      countTokens: estimateTokens,
      ...config,
    };
  }

  /**
   * Add a message to the context
   */
  addMessage(message: Message): void {
    // Calculate token count for this message
    const content = typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content);
    const tokens = this.config.countTokens(content);

    this.messages.push({
      ...message,
      timestamp: Date.now(),
      tokenCount: tokens,
    });

    this.tokenCount += tokens;
  }

  /**
   * Get all messages for LLM context
   */
  getMessages(): Message[] {
    return this.messages.map(({ timestamp, tokenCount, ...msg }) => msg);
  }

  /**
   * Check if compaction is needed
   */
  needsCompaction(): boolean {
    const threshold = this.config.maxTokens * this.config.compactionThreshold;
    return this.tokenCount > threshold;
  }

  /**
   * Compact the context by summarizing older messages
   */
  async compact(): Promise<void> {
    if (this.messages.length <= this.config.preserveRecentCount) {
      return; // Nothing to compact
    }

    // Split into preserve and summarize sections
    const preserveCount = this.config.preserveRecentCount;
    const toSummarize = this.messages.slice(0, -preserveCount);
    const toPreserve = this.messages.slice(-preserveCount);

    // Generate summary of older messages
    const summary = await this.generateSummary(toSummarize);

    // Create new message array with summary
    const summaryMessage: Message = {
      role: 'system',
      content: `[Previous conversation summary]\n${summary}`,
      tokenCount: this.config.countTokens(summary),
    };

    this.messages = [summaryMessage, ...toPreserve];
    this.recalculateTokenCount();
  }

  /**
   * Generate a summary of messages
   * This would use the LLM in production
   */
  private async generateSummary(messages: Message[]): Promise<string> {
    // In production, this calls the LLM with a summarization prompt
    // For now, create a structured summary

    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    const toolResults = messages.filter(m => m.role === 'tool');

    let summary = 'The conversation covered:\n';

    // Summarize user requests
    if (userMessages.length > 0) {
      summary += '\nUser requests:\n';
      for (const msg of userMessages.slice(-5)) {
        const content = typeof msg.content === 'string'
          ? msg.content.slice(0, 200)
          : '[complex content]';
        summary += `- ${content}...\n`;
      }
    }

    // Summarize key actions
    if (toolResults.length > 0) {
      summary += '\nActions taken:\n';
      const toolNames = [...new Set(toolResults.map(m => m.name))];
      for (const name of toolNames) {
        const count = toolResults.filter(m => m.name === name).length;
        summary += `- ${name}: ${count} calls\n`;
      }
    }

    // Summarize key findings
    if (assistantMessages.length > 0) {
      const lastAssistant = assistantMessages[assistantMessages.length - 1];
      const content = typeof lastAssistant.content === 'string'
        ? lastAssistant.content.slice(0, 500)
        : '[complex content]';
      summary += `\nLast response summary: ${content}...\n`;
    }

    return summary;
  }

  /**
   * Recalculate total token count
   */
  private recalculateTokenCount(): void {
    this.tokenCount = this.messages.reduce(
      (sum, msg) => sum + (msg.tokenCount || 0),
      0
    );
  }

  /**
   * Check if context is empty
   */
  isEmpty(): boolean {
    return this.messages.length === 0;
  }

  /**
   * Get current token count
   */
  getTokenCount(): number {
    return this.tokenCount;
  }

  /**
   * Get remaining token budget
   */
  getRemainingTokens(): number {
    return this.config.maxTokens - this.tokenCount;
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.messages = [];
    this.tokenCount = 0;
  }
}

/**
 * Estimate token count (4 chars ≈ 1 token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
```

## Session Persistence

```typescript
// packages/core/src/context/session.ts

import * as fs from 'fs/promises';
import * as path from 'path';

interface SessionData {
  id: string;
  messages: Message[];
  metadata: {
    createdAt: number;
    updatedAt: number;
    cwd: string;
    provider: string;
  };
}

export class SessionManager {
  private sessionsDir: string;

  constructor(baseDir: string = '~/.openagent/sessions') {
    this.sessionsDir = baseDir.replace('~', process.env.HOME || '');
  }

  /**
   * Save a session to disk
   */
  async save(context: ContextManager): Promise<string> {
    await fs.mkdir(this.sessionsDir, { recursive: true });

    const sessionPath = path.join(this.sessionsDir, `${context.sessionId}.json`);

    const data: SessionData = {
      id: context.sessionId,
      messages: context.getMessages(),
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        cwd: process.cwd(),
        provider: 'default',
      },
    };

    await fs.writeFile(sessionPath, JSON.stringify(data, null, 2));
    return context.sessionId;
  }

  /**
   * Load a session from disk
   */
  async load(sessionId: string): Promise<SessionData | null> {
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);

    try {
      const content = await fs.readFile(sessionPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * List all saved sessions
   */
  async list(): Promise<Array<{ id: string; metadata: SessionData['metadata'] }>> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessions: Array<{ id: string; metadata: SessionData['metadata'] }> = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const sessionPath = path.join(this.sessionsDir, file);
        const content = await fs.readFile(sessionPath, 'utf-8');
        const data: SessionData = JSON.parse(content);

        sessions.push({
          id: data.id,
          metadata: data.metadata,
        });
      }

      // Sort by updatedAt descending
      sessions.sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt);

      return sessions;
    } catch {
      return [];
    }
  }

  /**
   * Delete a session
   */
  async delete(sessionId: string): Promise<void> {
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);
    await fs.unlink(sessionPath);
  }

  /**
   * Fork a session (create a copy for exploration)
   */
  async fork(sessionId: string): Promise<string> {
    const original = await this.load(sessionId);
    if (!original) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const newId = generateSessionId();
    const newData: SessionData = {
      ...original,
      id: newId,
      metadata: {
        ...original.metadata,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    const sessionPath = path.join(this.sessionsDir, `${newId}.json`);
    await fs.writeFile(sessionPath, JSON.stringify(newData, null, 2));

    return newId;
  }
}
```

## Compaction Strategies

### 1. Simple Summarization

Summarize older messages into a single system message.

```typescript
async function simpleSummarization(messages: Message[], llm: LLMRouter): Promise<string> {
  const response = await llm.chat({
    messages: [
      {
        role: 'system',
        content: 'Summarize the following conversation concisely, preserving key information and decisions.',
      },
      {
        role: 'user',
        content: messages.map(m => `${m.role}: ${m.content}`).join('\n'),
      },
    ],
  });

  // Collect all text chunks
  let summary = '';
  for await (const chunk of response) {
    if (chunk.type === 'text') {
      summary += chunk.content;
    }
  }

  return summary;
}
```

### 2. Sliding Window

Keep the most recent N messages plus any critical context.

```typescript
function slidingWindow(
  messages: Message[],
  windowSize: number,
  criticalRoles: MessageRole[] = ['system']
): Message[] {
  // Always keep system messages
  const critical = messages.filter(m => criticalRoles.includes(m.role));

  // Get most recent messages
  const recent = messages
    .filter(m => !criticalRoles.includes(m.role))
    .slice(-windowSize);

  return [...critical, ...recent];
}
```

### 3. Importance-Based Pruning

Prune less important messages while keeping key information.

```typescript
interface ScoredMessage extends Message {
  importance: number;
}

function importanceBasedPruning(
  messages: Message[],
  targetTokens: number,
  countTokens: (text: string) => number
): Message[] {
  // Score each message
  const scored: ScoredMessage[] = messages.map((msg, i) => ({
    ...msg,
    importance: calculateImportance(msg, i, messages.length),
  }));

  // Sort by importance (keep highest)
  scored.sort((a, b) => b.importance - a.importance);

  // Take messages until we hit target
  const result: Message[] = [];
  let tokens = 0;

  for (const msg of scored) {
    const msgTokens = countTokens(
      typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    );

    if (tokens + msgTokens > targetTokens) {
      break;
    }

    result.push(msg);
    tokens += msgTokens;
  }

  // Re-sort by original order
  result.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  return result;
}

function calculateImportance(msg: Message, index: number, total: number): number {
  let score = 0;

  // Recency bonus
  score += (index / total) * 0.3;

  // Role-based scoring
  if (msg.role === 'system') score += 1.0;
  if (msg.role === 'user') score += 0.5;
  if (msg.role === 'tool') score += 0.2;

  // Content-based scoring
  const content = typeof msg.content === 'string' ? msg.content : '';
  if (content.includes('error') || content.includes('Error')) score += 0.3;
  if (content.includes('TODO') || content.includes('IMPORTANT')) score += 0.2;

  return score;
}
```

## Token Counting

### Accurate Token Counting (tiktoken)

```typescript
// For accurate OpenAI token counting
import { encoding_for_model } from 'tiktoken';

function countTokensAccurate(text: string, model: string = 'gpt-4o'): number {
  const encoding = encoding_for_model(model as any);
  const tokens = encoding.encode(text);
  encoding.free();
  return tokens.length;
}
```

### Estimation (No Dependencies)

```typescript
// Fast estimation without dependencies
function estimateTokens(text: string): number {
  // Rough estimate: 4 characters ≈ 1 token for English
  // Adjust for code which tends to be more token-dense
  const codePatterns = /[{}\[\]();<>]/g;
  const codeMatches = (text.match(codePatterns) || []).length;

  const baseEstimate = text.length / 4;
  const codeAdjustment = codeMatches * 0.5;

  return Math.ceil(baseEstimate + codeAdjustment);
}
```

## Usage Example

```typescript
// Create context manager for Claude
const context = new ContextManager({
  maxTokens: 200000,
  compactionThreshold: 0.75,
  preserveRecentCount: 20,
});

// Add messages
context.addMessage({ role: 'user', content: 'Hello!' });
context.addMessage({ role: 'assistant', content: 'Hi there!' });

// Check status
console.log(`Tokens used: ${context.getTokenCount()}`);
console.log(`Remaining: ${context.getRemainingTokens()}`);

// Compact if needed
if (context.needsCompaction()) {
  await context.compact();
}

// Save session
const sessionManager = new SessionManager();
await sessionManager.save(context);
```

## Next Steps

- See [AGENT-LOOP.md](AGENT-LOOP.md) for how context is used
- See [SESSION-MANAGEMENT.md](SESSION-MANAGEMENT.md) for persistence details
- See [CONFIGURATION.md](CONFIGURATION.md) for context settings
