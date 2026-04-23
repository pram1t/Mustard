'use client';

import type { Intent } from '../../lib/collab-client.js';

const STATUS_BADGE: Record<Intent['status'], string> = {
  pending: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
  approved: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  rejected: 'bg-rose-900/40 text-rose-300 border-rose-700/50',
  executing: 'bg-cyan-900/40 text-cyan-300 border-cyan-700/50',
  completed: 'bg-zinc-800/60 text-zinc-300 border-zinc-700',
  failed: 'bg-rose-900/40 text-rose-300 border-rose-700/50',
  invalidated: 'bg-zinc-800/60 text-zinc-500 border-zinc-700',
};

const RISK_TINT: Record<Intent['risk'], string> = {
  safe: 'text-emerald-400',
  moderate: 'text-amber-400',
  dangerous: 'text-rose-400',
};

export interface IntentListProps {
  intents: Intent[];
  onApprove?: (intent: Intent) => void;
  onReject?: (intent: Intent) => void;
}

export default function IntentList(props: IntentListProps): JSX.Element {
  const { intents, onApprove, onReject } = props;
  if (intents.length === 0) {
    return (
      <div className="text-sm text-zinc-500 italic">No intents proposed yet.</div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {intents.map(intent => {
        const isPending = intent.status === 'pending';
        return (
          <li
            key={intent.id}
            className="rounded border border-zinc-800 bg-zinc-900/40 p-3 flex flex-col gap-1"
          >
            <header className="flex items-center gap-2 text-sm">
              <span
                className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${STATUS_BADGE[intent.status]}`}
              >
                {intent.status}
              </span>
              <span className="text-zinc-300 font-medium truncate flex-1">
                {intent.summary}
              </span>
              <span className={`text-xs ${RISK_TINT[intent.risk]}`}>
                risk: {intent.risk}
              </span>
            </header>

            <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>type: {intent.type}</span>
              <span>agent: {intent.agentId}</span>
              <span>confidence: {(intent.confidence * 100).toFixed(0)}%</span>
              <span className="text-zinc-500">
                proposed {timeAgo(intent.createdAt)}
              </span>
            </div>

            {intent.rationale ? (
              <p className="text-xs text-zinc-500 mt-1 leading-snug">
                {intent.rationale}
              </p>
            ) : null}

            {intent.rejectionReason ? (
              <p className="text-xs text-rose-400 mt-1">
                {intent.rejectionReason}
              </p>
            ) : null}

            {isPending && (onApprove || onReject) ? (
              <div className="flex gap-2 mt-2">
                {onApprove ? (
                  <button
                    type="button"
                    onClick={() => onApprove(intent)}
                    className="px-2 py-1 text-xs rounded bg-emerald-700 hover:bg-emerald-600 text-white"
                  >
                    Approve
                  </button>
                ) : null}
                {onReject ? (
                  <button
                    type="button"
                    onClick={() => onReject(intent)}
                    className="px-2 py-1 text-xs rounded bg-rose-800 hover:bg-rose-700 text-white"
                  >
                    Reject
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function timeAgo(ts: number): string {
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
