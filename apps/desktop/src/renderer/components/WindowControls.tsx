import { useState } from 'react';
import type { ReactNode } from 'react';
import './WindowControls.css';

// navigator.platform is deprecated but works reliably in Electron's Chromium
const isMac = navigator.platform.includes('Mac');

export function WindowControls(): ReactNode {
  if (isMac) return null;

  const [isMaximized, setIsMaximized] = useState(false);

  const handleMinimize = () => window.api.minimize();
  const handleMaximize = () => {
    window.api.toggleMaximize();
    setIsMaximized((prev) => !prev);
  };
  const handleClose = () => window.api.close();

  return (
    <div className="window-controls">
      <button className="window-control" onClick={handleMinimize} aria-label="Minimize">
        &#x2013;
      </button>
      <button className="window-control" onClick={handleMaximize} aria-label={isMaximized ? 'Restore' : 'Maximize'}>
        {isMaximized ? '\u2752' : '\u25A1'}
      </button>
      <button className="window-control close" onClick={handleClose} aria-label="Close">
        &#x2715;
      </button>
    </div>
  );
}
