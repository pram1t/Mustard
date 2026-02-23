'use client';

import { useEffect, useState } from 'react';

interface TaskEntry {
  id: string;
  title: string;
  role?: string;
  status: string;
  duration?: number;
  error?: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-zinc-700',
  running: 'bg-blue-800',
  completed: 'bg-green-800',
  failed: 'bg-red-800',
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskEntry[]>([]);

  useEffect(() => {
    const fetchTasks = () =>
      fetch('/api/tasks')
        .then((r) => r.json())
        .then((data) => setTasks(data.data ?? []))
        .catch(() => {});

    fetchTasks();
    const interval = setInterval(fetchTasks, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Tasks</h2>
      {tasks.length === 0 ? (
        <p className="text-zinc-500">No tasks yet. Submit a request to get started.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-center gap-4">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[t.status] ?? 'bg-zinc-700'}`}>
                {t.status}
              </span>
              <span className="font-medium flex-1">{t.title}</span>
              {t.role && <span className="text-xs text-zinc-500">{t.role}</span>}
              {t.duration != null && (
                <span className="text-xs text-zinc-500">{(t.duration / 1000).toFixed(1)}s</span>
              )}
              {t.error && <span className="text-xs text-red-400">{t.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
