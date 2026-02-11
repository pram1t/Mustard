import type { ReactNode } from 'react';
import { MCPServerList } from '../components/MCP/MCPServerList';
import { MCPAddServer } from '../components/MCP/MCPAddServer';
import './MCPView.css';

export function MCPView(): ReactNode {
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
