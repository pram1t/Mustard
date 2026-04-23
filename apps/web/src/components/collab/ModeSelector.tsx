'use client';

import type { PermissionMode } from '../../lib/collab-client.js';

const MODES: ReadonlyArray<{
  id: PermissionMode;
  label: string;
  description: string;
  badge: string;
}> = [
  {
    id: 'plan',
    label: 'Plan',
    description: 'Read-only proposals; nothing executes',
    badge: 'bg-blue-900/40 border-blue-700/50 text-blue-300',
  },
  {
    id: 'code',
    label: 'Code',
    description: 'Manual approval per write',
    badge: 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300',
  },
  {
    id: 'ask',
    label: 'Ask',
    description: 'Discussion only — no AI proposals',
    badge: 'bg-violet-900/40 border-violet-700/50 text-violet-300',
  },
  {
    id: 'auto',
    label: 'Auto',
    description: 'Safe ops auto-approve with countdown',
    badge: 'bg-amber-900/40 border-amber-700/50 text-amber-300',
  },
];

export interface ModeSelectorProps {
  current: PermissionMode;
  onChange: (next: PermissionMode) => void;
  disabled?: boolean;
}

export default function ModeSelector(props: ModeSelectorProps): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {MODES.map(m => {
        const active = m.id === props.current;
        return (
          <button
            key={m.id}
            type="button"
            disabled={props.disabled}
            onClick={() => props.onChange(m.id)}
            className={`text-left px-3 py-2 rounded border transition ${
              active
                ? `${m.badge} ring-1 ring-offset-0 ring-zinc-100/10`
                : 'bg-zinc-900/40 border-zinc-800 text-zinc-300 hover:border-zinc-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="font-semibold text-sm">{m.label}</div>
            <div className="text-[11px] text-zinc-400 leading-snug mt-0.5">
              {m.description}
            </div>
          </button>
        );
      })}
    </div>
  );
}
