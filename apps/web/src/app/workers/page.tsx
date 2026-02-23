'use client';

import { useEffect, useState } from 'react';

interface WorkerDef {
  role: string;
  name: string;
  description: string;
  skills: number;
  toolsAllowed: number | string;
  toolsDenied: number;
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerDef[]>([]);

  useEffect(() => {
    fetch('/api/workers')
      .then((r) => r.json())
      .then((data) => setWorkers(data.data?.definitions ?? []))
      .catch(() => {});
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Workers</h2>
      <div className="grid grid-cols-2 gap-4">
        {workers.map((w) => (
          <div key={w.role} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-cyan-400 font-semibold">{w.name}</span>
              <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded">{w.role}</span>
            </div>
            <p className="text-sm text-zinc-400 mb-2">{w.description}</p>
            <div className="flex gap-4 text-xs text-zinc-500">
              <span>{w.skills} skills</span>
              <span>{w.toolsAllowed === 'all' ? 'all tools' : `${w.toolsAllowed} tools`}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
