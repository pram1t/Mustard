import type { ReactNode } from 'react';
import { useSettingsStore } from '../../stores/settings';
import type { SettingsTab } from '../../stores/settings';
import './Settings.css';

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'provider', label: 'Provider', icon: '\u{1F511}' },
  { id: 'appearance', label: 'Appearance', icon: '\u{1F3A8}' },
  { id: 'shortcuts', label: 'Shortcuts', icon: '\u2328' },
  { id: 'about', label: 'About', icon: '\u2139\uFE0F' },
];

export function SettingsNav(): ReactNode {
  const activeTab = useSettingsStore((s) => s.activeTab);
  const setActiveTab = useSettingsStore((s) => s.setActiveTab);

  return (
    <nav className="settings-nav">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`settings-nav-item${activeTab === tab.id ? ' active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="settings-nav-icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
