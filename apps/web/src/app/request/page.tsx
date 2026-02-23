'use client';

import { useState } from 'react';

interface PlanStep {
  id: string;
  title: string;
  description: string;
  assignTo: string;
  priority: string;
  dependencies: string[];
}

interface PlanData {
  planId: string;
  steps: PlanStep[];
}

export default function RequestPage() {
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitRequest = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setPlan(null);
    setResult(null);

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setPlan(data.data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const approvePlan = async () => {
    if (!plan) return;
    setExecuting(true);
    setError(null);

    try {
      const res = await fetch(`/api/plans/${plan.planId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setResult(data.data);
    } catch (e: any) {
      setError(e.message ?? 'Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">New Request</h2>

      <div className="mb-6">
        <textarea
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm resize-none focus:border-cyan-500 focus:outline-none"
          rows={3}
          placeholder="Describe what you want built..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button
          onClick={submitRequest}
          disabled={loading || !prompt.trim()}
          className="mt-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-zinc-700 rounded text-sm font-medium"
        >
          {loading ? 'Planning...' : 'Submit Request'}
        </button>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg p-4 mb-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {plan && !result && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
          <h3 className="font-semibold mb-3">Execution Plan ({plan.steps.length} steps)</h3>
          <div className="space-y-2 mb-4">
            {plan.steps.map((s, i) => (
              <div key={s.id} className="flex items-start gap-2 text-sm">
                <span className="text-zinc-500 w-5">{i + 1}.</span>
                <span className="text-cyan-400 w-20">[{s.assignTo}]</span>
                <div>
                  <span className="font-medium">{s.title}</span>
                  <p className="text-zinc-500 text-xs">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={approvePlan}
              disabled={executing}
              className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded text-sm font-medium"
            >
              {executing ? 'Executing...' : 'Approve & Execute'}
            </button>
            <button
              onClick={() => setPlan(null)}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={`border rounded-lg p-4 ${result.success ? 'bg-green-950 border-green-800' : 'bg-red-950 border-red-800'}`}>
          <h3 className="font-semibold mb-2">{result.success ? 'Success' : 'Failed'}</h3>
          <p className="text-sm text-zinc-400">{result.summary}</p>
          <p className="text-xs text-zinc-500 mt-1">Duration: {(result.totalDuration / 1000).toFixed(1)}s</p>
        </div>
      )}
    </div>
  );
}
