'use client';

import type { CollabEvent, ConnectionState } from '../../lib/use-collab-socket.js';

const TOPIC_TINT: Record<string, string> = {
  'collab.ai.intent': 'text-cyan-300',
  'collab.permissions.mode': 'text-amber-300',
  'collab.room': 'text-emerald-300',
};

function tintFor(type: string): string {
  for (const prefix in TOPIC_TINT) {
    if (type.startsWith(prefix)) return TOPIC_TINT[prefix];
  }
  return 'text-zinc-300';
}

export interface EventLogProps {
  state: ConnectionState;
  events: CollabEvent[];
  onClear?: () => void;
}

export default function EventLog(props: EventLogProps): JSX.Element {
  const { state, events, onClear } = props;
  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-center gap-2 text-xs">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            state === 'open'
              ? 'bg-emerald-400'
              : state === 'connecting'
              ? 'bg-amber-400 animate-pulse'
              : 'bg-zinc-600'
          }`}
        />
        <span className="text-zinc-400 uppercase tracking-wide">
          live events ({state})
        </span>
        <span className="text-zinc-600">{events.length} buffered</span>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto text-zinc-500 hover:text-zinc-200"
          >
            clear
          </button>
        ) : null}
      </header>

      <div className="rounded border border-zinc-800 bg-zinc-950/60 max-h-96 overflow-auto font-mono text-[11px]">
        {events.length === 0 ? (
          <div className="p-3 text-zinc-600">No events yet.</div>
        ) : (
          <ul>
            {events
              .slice()
              .reverse()
              .map((e, i) => (
                <li
                  key={`${e.timestamp ?? i}-${i}`}
                  className="px-3 py-1.5 border-b border-zinc-900 last:border-b-0 flex items-start gap-2"
                >
                  <span className={`shrink-0 ${tintFor(e.type)}`}>{e.type}</span>
                  {e.source ? (
                    <span className="shrink-0 text-zinc-600">[{e.source}]</span>
                  ) : null}
                  <span className="text-zinc-400 truncate">
                    {summarize(e.payload)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function summarize(payload: unknown): string {
  if (payload === null || payload === undefined) return '';
  if (typeof payload === 'string') return payload;
  try {
    const json = JSON.stringify(payload);
    return json.length > 120 ? json.slice(0, 117) + '…' : json;
  } catch {
    return '[unserializable]';
  }
}
