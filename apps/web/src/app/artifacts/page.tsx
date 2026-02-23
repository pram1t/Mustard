'use client';

import { useEffect, useState } from 'react';

interface Artifact {
  id: string;
  name: string;
  type: string;
  status: string;
  createdBy: string;
}

export default function ArtifactsPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/artifacts')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.message);
        else setArtifacts(data.data ?? []);
      })
      .catch(() => setError('Failed to fetch artifacts'));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Artifacts</h2>
      {error && (
        <p className="text-zinc-500 text-sm">{error}</p>
      )}
      {artifacts.length === 0 && !error ? (
        <p className="text-zinc-500">No artifacts yet. Artifacts are created during task execution.</p>
      ) : (
        <div className="space-y-2">
          {artifacts.map((a) => (
            <div key={a.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <span className="font-medium">{a.name}</span>
                <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded">{a.type}</span>
                <span className="text-xs text-zinc-500">{a.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
