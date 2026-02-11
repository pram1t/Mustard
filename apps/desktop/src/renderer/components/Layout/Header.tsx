import type { ReactNode } from 'react';
import { useUIStore } from '../../stores/ui';
import { WindowControls } from '../WindowControls';
import './Header.css';

export function Header(): ReactNode {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <header className="header">
      <button className="header-toggle" onClick={toggleSidebar} aria-label="Toggle sidebar">
        &#9776;
      </button>
      <span className="header-title">OpenAgent</span>
      <WindowControls />
    </header>
  );
}
