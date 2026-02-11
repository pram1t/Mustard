import type { ReactNode } from 'react';
import { useUIStore } from '../../stores/ui';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps): ReactNode {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <div className={`layout${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <Header />
      <div className="layout-body">
        <Sidebar />
        <main className="layout-main">{children}</main>
      </div>
    </div>
  );
}
