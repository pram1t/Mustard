import { useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { MCPServerInfo } from '../../../shared/preload-api';
import { MCPServerCard } from './MCPServerCard';
import './MCP.css';

export function MCPServerList(): ReactNode {
  const [servers, setServers] = useState<MCPServerInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadServers = useCallback(async () => {
    try {
      const list = await window.api.getMCPServers();
      setServers(list);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServers();
    const interval = setInterval(loadServers, 5000);
    return () => clearInterval(interval);
  }, [loadServers]);

  const handleRemove = useCallback(
    async (serverId: string) => {
      try {
        await window.api.removeMCPServer(serverId);
        await loadServers();
      } catch (error) {
        console.error('Failed to remove server:', error);
      }
    },
    [loadServers]
  );

  if (loading) {
    return <div className="mcp-loading">Loading servers...</div>;
  }

  if (servers.length === 0) {
    return (
      <div className="mcp-empty">
        <p>No MCP servers configured</p>
        <p className="mcp-empty-hint">
          Add an MCP server to extend the agent&apos;s capabilities
        </p>
      </div>
    );
  }

  return (
    <div className="mcp-server-list">
      {servers.map((server) => (
        <MCPServerCard
          key={server.id}
          server={server}
          onRemove={() => handleRemove(server.id)}
        />
      ))}
    </div>
  );
}
