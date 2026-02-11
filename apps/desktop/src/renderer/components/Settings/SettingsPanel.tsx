import type { ReactNode } from 'react';
import { useSettingsStore } from '../../stores/settings';
import { ProviderSettings } from './ProviderSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { ShortcutsSettings } from './ShortcutsSettings';
import { AboutSettings } from './AboutSettings';
import './Settings.css';

export function SettingsPanel(): ReactNode {
  const activeTab = useSettingsStore((s) => s.activeTab);

  return (
    <div className="settings-panel">
      {activeTab === 'provider' && <ProviderSettings />}
      {activeTab === 'appearance' && <AppearanceSettings />}
      {activeTab === 'shortcuts' && <ShortcutsSettings />}
      {activeTab === 'about' && <AboutSettings />}
    </div>
  );
}
