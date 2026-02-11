/**
 * MCP Service
 *
 * Wraps @openagent/mcp MCPRegistry as a thin delegation layer.
 * Manages MCP server connections and tool listings.
 */

import type { MCPRegistry } from '@openagent/mcp';
import type {
  MCPServerInfo,
  MCPServerInput,
} from '../../shared/preload-api';

export class MCPService {
  private registry: MCPRegistry;

  constructor(registry: MCPRegistry) {
    this.registry = registry;
  }

  /**
   * Lists all configured MCP servers.
   */
  listServers(): MCPServerInfo[] {
    const states = this.registry.getAllServerStates();
    return states.map((state) => ({
      id: state.name,
      name: state.name,
      status: state.connected ? 'connected' as const : 'disconnected' as const,
      tools: (state.tools || []).map((t) => ({
        name: t.name,
        description: t.description || '',
      })),
    }));
  }

  /**
   * Adds a new MCP server.
   */
  async addServer(config: MCPServerInput): Promise<{ success: boolean; serverId: string }> {
    try {
      const serverId = config.id || config.name;

      this.registry.addServerConfig(serverId, {
        type: 'stdio',
        command: config.command,
        args: config.args,
        env: config.env,
      });

      await this.registry.connectServer(serverId);

      return { success: true, serverId };
    } catch (error) {
      console.error('[MCPService] addServer failed:', error);
      return { success: false, serverId: '' };
    }
  }

  /**
   * Removes an MCP server.
   */
  async removeServer(serverId: string): Promise<{ success: boolean }> {
    try {
      await this.registry.removeServer(serverId);
      return { success: true };
    } catch (error) {
      console.error('[MCPService] removeServer failed:', error);
      return { success: false };
    }
  }

  /**
   * Gets an MCP server's status.
   */
  getStatus(serverId: string): { id: string; status: 'connected' | 'disconnected' | 'error' } {
    const state = this.registry.getServerState(serverId);
    if (!state) {
      return { id: serverId, status: 'disconnected' };
    }
    return {
      id: state.name,
      status: state.connected ? 'connected' : 'disconnected',
    };
  }

  /**
   * Restarts an MCP server.
   */
  async restartServer(serverId: string): Promise<{ success: boolean }> {
    try {
      await this.registry.disconnectServer(serverId);
      await this.registry.connectServer(serverId);
      return { success: true };
    } catch (error) {
      console.error('[MCPService] restartServer failed:', error);
      return { success: false };
    }
  }
}
