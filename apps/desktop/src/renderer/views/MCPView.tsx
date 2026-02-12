import type { ReactNode } from 'react';
import { MCPServerList } from '../components/MCP/MCPServerList';
import { MCPAddServer } from '../components/MCP/MCPAddServer';
import './MCPView.css';

interface MCPViewProps {
  deepLinkParams?: Record<string, string>;
}

export function MCPView({ deepLinkParams: _deepLinkParams }: MCPViewProps): ReactNode {
  // TODO: Use _deepLinkParams?.server to scroll-to/highlight specific server
  return (
    <div className="mcp-view">
      <header className="mcp-header">
        <h2>MCP Servers</h2>
        <MCPAddServer />
      </header>
      <MCPServerList />
    </div>
  );
}
