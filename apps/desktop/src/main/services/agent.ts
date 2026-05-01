/**
 * Agent Service
 *
 * Wraps @mustard/core AgentLoop as a thin delegation layer.
 * No business logic — just lifecycle management and event forwarding.
 */

import { AgentLoop, createAgent } from '@mustard/core';
import type {
  AgentEvent as CoreAgentEvent,
  AgentConfig,
} from '@mustard/core';
import type { LLMRouter } from '@mustard/llm';
import type { IToolRegistry } from '@mustard/tools';
import { emitEvent, emitStatus } from '../ipc/event-emitter';
import { adaptCoreEvent } from './event-adapter';
import { assessToolRisk } from '../security/tool-security';
import { createErrorEvent } from '../../shared/event-types';
import type { AgentStatusInfo } from '../../shared/preload-api';

export class AgentService {
  private agent: AgentLoop | null = null;
  private abortController: AbortController | null = null;
  private sessionId: string;
  private router: LLMRouter;
  private tools: IToolRegistry;
  private cwd: string;

  constructor(router: LLMRouter, tools: IToolRegistry) {
    this.router = router;
    this.tools = tools;
    this.sessionId = `desktop_${Date.now()}`;
    this.cwd = process.cwd();
  }

  /**
   * Sets the working directory for the agent.
   * Resets the agent so it picks up the new cwd on next chat.
   */
  setCwd(dir: string): void {
    this.cwd = dir;
    // Reset agent so it creates a new one with the updated cwd
    if (this.agent) {
      this.agent = null;
    }
  }

  getCwd(): string {
    return this.cwd;
  }

  /**
   * Sends a message to the agent.
   * Returns immediately — events stream via emitEvent().
   */
  async chat(message: string): Promise<{ success: boolean }> {
    if (this.abortController) {
      return { success: false };
    }

    this.abortController = new AbortController();

    // Lazy agent creation
    if (!this.agent) {
      this.agent = createAgent(this.router, {
        tools: this.tools,
        sessionId: this.sessionId,
        cwd: this.cwd,
      });
    }

    emitStatus(this.sessionId, 'busy');

    // Fire and forget — events stream asynchronously
    this.consumeEvents(message).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      emitEvent(createErrorEvent(this.sessionId, 'INTERNAL_ERROR', msg, false));
      this.abortController = null;
      emitStatus(this.sessionId, 'idle');
    });

    return { success: true };
  }

  /**
   * Stops the current agent operation.
   */
  async stop(): Promise<{ success: boolean }> {
    if (!this.abortController) {
      return { success: false };
    }
    this.abortController.abort();
    emitStatus(this.sessionId, 'idle', 'Stopped by user');
    return { success: true };
  }

  /**
   * Gets the current agent status.
   */
  getStatus(): AgentStatusInfo {
    if (!this.agent) {
      return { state: 'idle' };
    }

    const state = this.agent.getState();

    if (state.lastError) {
      return { state: 'error', error: state.lastError };
    }
    if (state.isRunning) {
      return { state: 'busy', currentOperation: `Iteration ${state.iteration}` };
    }
    return { state: 'idle' };
  }

  /**
   * Cleans up the agent.
   */
  dispose(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.agent = null;
  }

  /**
   * Consumes the async generator from agent.run() and emits desktop events.
   */
  private async consumeEvents(message: string): Promise<void> {
    try {
      for await (const coreEvent of this.agent!.run(message, {
        signal: this.abortController!.signal,
      })) {
        const desktopEvent = adaptCoreEvent(coreEvent, this.sessionId);
        if (desktopEvent) {
          // Enrich tool_call events with risk assessment
          if (desktopEvent.type === 'tool_call') {
            const risk = assessToolRisk(desktopEvent.data.name);
            desktopEvent.data.riskLevel = risk.riskLevel;
            desktopEvent.data.requiresConfirmation = risk.requiresConfirmation;
          }
          emitEvent(desktopEvent);
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Expected when user calls stop()
        return;
      }
      const msg = error instanceof Error ? error.message : String(error);
      emitEvent(createErrorEvent(this.sessionId, 'INTERNAL_ERROR', msg, false));
    } finally {
      this.abortController = null;
      emitStatus(this.sessionId, 'idle');
    }
  }
}
