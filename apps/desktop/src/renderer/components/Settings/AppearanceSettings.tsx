import type { ReactNode } from 'react';
import { useUIStore } from '../../stores/ui';
import type { Theme, FontSize } from '../../stores/ui';
import './Settings.css';

const THEME_OPTIONS: { id: Theme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

const FONT_SIZE_OPTIONS: { id: FontSize; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
];

export function AppearanceSettings(): ReactNode {
  const theme = useUIStore((s) => s.theme);
  const fontSize = useUIStore((s) => s.fontSize);
  const setTheme = useUIStore((s) => s.setTheme);
  const setFontSize = useUIStore((s) => s.setFontSize);

  return (
    <div className="appearance-settings">
      <div className="settings-section">
        <h3>Theme</h3>
        <div className="option-group">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              className={`option-button${theme === opt.id ? ' active' : ''}`}
              onClick={() => setTheme(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h3>Font Size</h3>
        <div className="option-group">
          {FONT_SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              className={`option-button${fontSize === opt.id ? ' active' : ''}`}
              onClick={() => setFontSize(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
