import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { SettingsNav } from '../components/Settings/SettingsNav';
import { SettingsPanel } from '../components/Settings/SettingsPanel';
import { useSettingsStore } from '../stores/settings';
import type { SettingsTab } from '../stores/settings';
import './SettingsView.css';

const VALID_TABS: SettingsTab[] = ['provider', 'appearance', 'shortcuts', 'about'];

interface SettingsViewProps {
  deepLinkParams?: Record<string, string>;
}

export function SettingsView({ deepLinkParams }: SettingsViewProps): ReactNode {
  // Navigate to specific tab from deep link ?tab= param
  useEffect(() => {
    if (deepLinkParams?.tab && VALID_TABS.includes(deepLinkParams.tab as SettingsTab)) {
      useSettingsStore.getState().setActiveTab(deepLinkParams.tab as SettingsTab);
    }
  }, [deepLinkParams?.tab]);
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
