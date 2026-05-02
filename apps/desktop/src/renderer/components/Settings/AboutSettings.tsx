import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AppInfo } from '../../../shared/preload-api';
import './Settings.css';

export function AboutSettings(): ReactNode {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    window.api.getAppInfo().then(setAppInfo).catch(() => {});
  }, []);

  if (!appInfo) {
    return <div className="settings-loading">Loading...</div>;
  }

  return (
    <div className="about-settings">
      <div className="settings-section">
        <h3>Mustard Desktop</h3>
        <dl className="about-info">
          <dt>Version</dt>
          <dd>{appInfo.version}</dd>
          <dt>Platform</dt>
          <dd>{appInfo.platform} ({appInfo.arch})</dd>
          <dt>Environment</dt>
          <dd>{appInfo.isDev ? 'Development' : 'Production'}</dd>
        </dl>
      </div>
    </div>
  );
}
