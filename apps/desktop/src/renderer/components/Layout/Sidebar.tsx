import type { ReactNode } from 'react';
import { useHashRouter } from '../../hooks/useHashRouter';
import type { Route } from '../../hooks/useHashRouter';
import './Sidebar.css';

interface NavItem {
  label: string;
  route: Route;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Chat', route: '/', icon: '\u{1F4AC}' },
  { label: 'History', route: '/history', icon: '\u{1F4CB}' },
  { label: 'MCP', route: '/mcp', icon: '\u{1F50C}' },
];

export function Sidebar(): ReactNode {
  const { route, navigate } = useHashRouter();

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.route}
            className={`sidebar-item${route === item.route ? ' active' : ''}`}
            onClick={() => navigate(item.route)}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button
          className={`sidebar-item${route === '/settings' ? ' active' : ''}`}
          onClick={() => navigate('/settings')}
        >
          <span>&#x2699;</span>
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
