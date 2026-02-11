import type { ReactNode } from 'react';

export function MCPView(): ReactNode {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
      MCP Servers
    </div>
  );
}
