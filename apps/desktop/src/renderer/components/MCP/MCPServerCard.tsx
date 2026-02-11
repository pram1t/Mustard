import { useState } from 'react';
import type { ReactNode } from 'react';
import type { MCPServerInfo } from '../../../shared/preload-api';
import './MCP.css';

interface MCPServerCardProps {
  server: MCPServerInfo;
  onRemove: () => void;
}

function getStatusClass(status: MCPServerInfo['status']): string {
  switch (status) {
    case 'connected':
      return 'status-connected';
    case 'connecting':
      return 'status-connecting';
    case 'disconnected':
      return 'status-disconnected';
    case 'error':
      return 'status-error';
  }
}

export function MCPServerCard({ server, onRemove }: MCPServerCardProps): ReactNode {
  const [expanded, setExpanded] = useState(false);

  const statusClass = getStatusClass(server.status);

  return (
    <div className={`mcp-server-card ${statusClass}`}>
      <button
        className="mcp-server-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="mcp-server-status">
          <span className={`status-dot ${statusClass}`} />
          <span className="status-text">{server.status}</span>
        </div>
        <div className="mcp-server-name">{server.name}</div>
        <div className="mcp-server-tools">
          {server.tools.length} tool{server.tools.length !== 1 ? 's' : ''}
        </div>
        <span className="mcp-server-toggle">
          {expanded ? '\u25BC' : '\u25B6'}
        </span>
      </button>

      {expanded && (
        <div className="mcp-server-body">
          <section className="mcp-server-section">
            <h4>Tools</h4>
            {server.tools.length > 0 ? (
              <ul className="mcp-tool-list">
                {server.tools.map((tool) => (
                  <li key={tool.name} className="mcp-tool-item">
                    <span className="mcp-tool-name">{tool.name}</span>
                    <span className="mcp-tool-desc">{tool.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mcp-no-tools">No tools available</p>
            )}
          </section>

          {server.error && (
            <section className="mcp-server-section mcp-server-error">
              <h4>Error</h4>
              <p>{server.error}</p>
            </section>
          )}

          <div className="mcp-server-actions">
            <button className="mcp-action-remove" onClick={onRemove}>
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
