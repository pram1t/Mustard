import type { ReactNode } from 'react';
import { SettingsNav } from '../components/Settings/SettingsNav';
import { SettingsPanel } from '../components/Settings/SettingsPanel';
import './SettingsView.css';

export function SettingsView(): ReactNode {
  return (
    <div className="settings-view">
      <header className="settings-header">
        <h2>Settings</h2>
      </header>
      <div className="settings-body">
        <SettingsNav />
        <SettingsPanel />
      </div>
    </div>
  );
}
