import type { ReactNode } from 'react';
import { useHashRouter } from '../hooks/useHashRouter';
import { ChatView } from '../views/ChatView';
import { SettingsView } from '../views/SettingsView';
import { MCPView } from '../views/MCPView';
import { HistoryView } from '../views/HistoryView';

export function Router(): ReactNode {
  const { route, params } = useHashRouter();

  switch (route) {
    case '/':
    case '/chat':
      return <ChatView deepLinkParams={params} />;
    case '/settings':
      return <SettingsView deepLinkParams={params} />;
    case '/mcp':
      return <MCPView deepLinkParams={params} />;
    case '/history':
      return <HistoryView />;
    case '/about':
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
          About — OpenAgent Desktop
        </div>
      );
    default:
      return <ChatView deepLinkParams={params} />;
  }
}
