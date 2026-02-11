import type { ReactNode } from 'react';
import './Settings.css';

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');
const mod = isMac ? 'Cmd' : 'Ctrl';

const SHORTCUTS: { action: string; keys: string[] }[] = [
  { action: 'Send message', keys: ['Enter'] },
  { action: 'New line', keys: ['Shift', 'Enter'] },
  { action: 'Stop generation', keys: ['Escape'] },
  { action: 'Focus input', keys: [mod, 'L'] },
  { action: 'Toggle sidebar', keys: [mod, 'B'] },
  { action: 'Open settings', keys: [mod, ','] },
];

export function ShortcutsSettings(): ReactNode {
  return (
    <div className="shortcuts-settings">
      <div className="settings-section">
        <h3>Keyboard Shortcuts</h3>
        <table className="shortcuts-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Shortcut</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map((shortcut) => (
              <tr key={shortcut.action}>
                <td>{shortcut.action}</td>
                <td>
                  {shortcut.keys.map((key, i) => (
                    <span key={key}>
                      {i > 0 && ' + '}
                      <kbd>{key}</kbd>
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
