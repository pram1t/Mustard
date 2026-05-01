/**
 * Context Manager
 *
 * Manages conversation context with automatic token-based compaction.
 * Prevents context overflow by tracking tokens and removing older messages.
 */

import type { Message, LLMProvider } from '@pram1t/mustard-llm';
import { getLogger } from '@pram1t/mustard-logger';
import type { ContextConfig, ContextState } from './types.js';
import { DEFAULT_CONTEXT_CONFIG } from './types.js';

/**
 * Context manager for conversation history.
 *
 * Tracks messages and token counts, automatically compacting
 * when the context approaches the maximum size.
 */
export class ContextManager {
  private config: ContextConfig;
  private provider: LLMProvider;
  private messages: Message[] = [];
  private tokenCount = 0;
  private systemTokens = 0;
  private wasCompacted = false;
  private messagesRemoved = 0;

  /**
   * Create a new context manager.
   *
   * @param config - Partial configuration (uses defaults for missing values)
   * @param provider - LLM provider for token counting
   */
  constructor(config: Partial<ContextConfig>, provider: LLMProvider) {
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...config };
    this.provider = provider;
  }

  /**
   * Set or replace the system message.
   * The system message is always the first message and is preserved during compaction.
   *
   * @param content - The system message content
   */
  async setSystemMessage(content: string): Promise<void> {
    const logger = getLogger();
    const systemMessage: Message = {
      role: 'system',
      content,
    };

    // Count tokens for the system message
    this.systemTokens = await this.provider.countTokens([systemMessage]);

    // Replace or add system message
    if (this.messages.length > 0 && this.messages[0].role === 'system') {
      // Update existing system message
      const oldSystemTokens = await this.provider.countTokens([this.messages[0]]);
      this.tokenCount = this.tokenCount - oldSystemTokens + this.systemTokens;
      this.messages[0] = systemMessage;
    } else {
      // Add new system message at the beginning
      this.messages.unshift(systemMessage);
      this.tokenCount += this.systemTokens;
    }

    logger.debug('System message set', {
      systemTokens: this.systemTokens,
      totalTokens: this.tokenCount,
    });
  }

  /**
   * Add a message to the context.
   *
   * @param message - The message to add
   */
  async addMessage(message: Message): Promise<void> {
    const logger = getLogger();

    // Count tokens for this message
    const messageTokens = await this.provider.countTokens([message]);

    // Add message
    this.messages.push(message);
    this.tokenCount += messageTokens;

    logger.debug('Message added to context', {
      role: message.role,
      tokens: messageTokens,
      totalTokens: this.tokenCount,
      messageCount: this.messages.length,
    });

    // Check if compaction is needed
    if (this.needsCompaction()) {
      await this.compact();
    }
  }

  /**
   * Add multiple messages to the context.
   *
   * @param messages - The messages to add
   */
  async addMessages(messages: Message[]): Promise<void> {
    for (const message of messages) {
      await this.addMessage(message);
    }
  }

  /**
   * Get all messages in the context.
   *
   * @returns Copy of the messages array
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Get the current token count.
   *
   * @returns Estimated token count
   */
  getTokenCount(): number {
    return this.tokenCount;
  }

  /**
   * Check if compaction is needed.
   *
   * @returns true if token count exceeds threshold
   */
  needsCompaction(): boolean {
    const threshold = this.config.maxTokens * this.config.compactionThreshold;
    return this.tokenCount > threshold;
  }

  /**
   * Compact the context by removing older messages.
   * Keeps the system message (if configured) and recent messages.
   */
  async compact(): Promise<void> {
    const logger = getLogger();
    const originalCount = this.messages.length;
    const originalTokens = this.tokenCount;

    logger.info('Compacting context', {
      messageCount: originalCount,
      tokenCount: originalTokens,
      threshold: this.config.maxTokens * this.config.compactionThreshold,
    });

    // Separate system message from other messages
    let systemMessage: Message | null = null;
    let otherMessages: Message[] = [];

    if (this.messages.length > 0 && this.messages[0].role === 'system') {
      systemMessage = this.messages[0];
      otherMessages = this.messages.slice(1);
    } else {
      otherMessages = [...this.messages];
    }

    // Keep only the most recent messages
    const keepCount = this.config.keepRecentMessages;
    const keptMessages = otherMessages.slice(-keepCount);

    // Rebuild messages array
    this.messages = [];
    if (this.config.keepSystemMessage && systemMessage) {
      this.messages.push(systemMessage);
    }
    this.messages.push(...keptMessages);

    // Recalculate token count
    this.tokenCount = await this.provider.countTokens(this.messages);

    // Update state
    this.wasCompacted = true;
    this.messagesRemoved = originalCount - this.messages.length;

    logger.info('Context compacted', {
      removedMessages: this.messagesRemoved,
      remainingMessages: this.messages.length,
      removedTokens: originalTokens - this.tokenCount,
      remainingTokens: this.tokenCount,
    });
  }

  /**
   * Get the current context state.
   *
   * @returns Snapshot of context state
   */
  getState(): ContextState {
    return {
      messages: [...this.messages],
      tokenCount: this.tokenCount,
      systemTokens: this.systemTokens,
      wasCompacted: this.wasCompacted,
      messagesRemoved: this.messagesRemoved,
    };
  }

  /**
   * Clear all messages and reset state.
   */
  clear(): void {
    const logger = getLogger();
    logger.debug('Context cleared', {
      clearedMessages: this.messages.length,
      clearedTokens: this.tokenCount,
    });

    this.messages = [];
    this.tokenCount = 0;
    this.systemTokens = 0;
    this.wasCompacted = false;
    this.messagesRemoved = 0;
  }

  /**
   * Get the current configuration.
   *
   * @returns Context configuration
   */
  getConfig(): ContextConfig {
    return { ...this.config };
  }

  /**
   * Update configuration.
   * Note: This does not trigger compaction even if new threshold is exceeded.
   *
   * @param config - Partial configuration to merge
   */
  updateConfig(config: Partial<ContextConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Restore context from a saved state.
   * Used for session resumption.
   *
   * @param state - The context state to restore
   */
  async restore(state: ContextState): Promise<void> {
    const logger = getLogger();

    // Restore messages
    this.messages = [...state.messages];
    this.wasCompacted = state.wasCompacted;
    this.messagesRemoved = state.messagesRemoved;

    // Recalculate token count for accuracy (model may have changed)
    this.tokenCount = await this.provider.countTokens(this.messages);

    // Find and count system message tokens
    const systemMsg = this.messages.find((m) => m.role === 'system');
    if (systemMsg) {
      this.systemTokens = await this.provider.countTokens([systemMsg]);
    } else {
      this.systemTokens = 0;
    }

    logger.info('Context restored', {
      messageCount: this.messages.length,
      tokenCount: this.tokenCount,
      wasCompacted: this.wasCompacted,
    });
  }
}
