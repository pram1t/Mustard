'use client';

import { useEffect, useState } from 'react';

interface HealthData {
  status: string;
  uptime: number;
  version: string;
  workers: number;
}

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setError('API server not connected. Start with: openagent server start'));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg p-4 mb-6 text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-500 uppercase mb-1">Status</div>
          <div className="text-lg font-semibold text-green-400">
            {health ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-500 uppercase mb-1">Active Workers</div>
          <div className="text-lg font-semibold">{health?.workers ?? 0}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="text-xs text-zinc-500 uppercase mb-1">Version</div>
          <div className="text-lg font-semibold">{health?.version ?? '-'}</div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Start</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-400">
          <li>Start the API server: <code className="text-cyan-400">openagent server start</code></li>
          <li>Submit a request: <code className="text-cyan-400">openagent request submit &quot;Build a REST API&quot;</code></li>
          <li>Monitor progress in the Tasks tab</li>
          <li>Review artifacts when complete</li>
        </ol>
      </div>
    </div>
  );
}
