import type { ReactNode } from 'react';
import { useHashRouter } from '../hooks/useHashRouter';
import { ChatView } from '../views/ChatView';
import { SettingsView } from '../views/SettingsView';
import { MCPView } from '../views/MCPView';
import { HistoryView } from '../views/HistoryView';

export function Router(): ReactNode {
  const { route } = useHashRouter();

  switch (route) {
    case '/':
      return <ChatView />;
    case '/settings':
      return <SettingsView />;
    case '/mcp':
      return <MCPView />;
    case '/history':
      return <HistoryView />;
    case '/about':
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
          About — OpenAgent Desktop
        </div>
      );
    default:
      return <ChatView />;
  }
}
