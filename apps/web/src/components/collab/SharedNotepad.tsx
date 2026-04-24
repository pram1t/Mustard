'use client';

/**
 * SharedNotepad — minimal demo of live document sync.
 *
 * Binds a single Y.Text from the room's Y.Doc to a textarea. Anyone
 * connected to the same room sees keystrokes in real time. Persisted
 * server-side via SqliteYjsPersistence.
 *
 * This is intentionally minimal — Monaco editor + multi-cursor UI is a
 * separate UX phase. The point here is to prove the pipe works
 * end-to-end through the browser.
 */

import { useEffect, useRef } from 'react';
import { useYjsDoc, type YjsConnectionState } from '../../lib/use-yjs-doc';

export interface SharedNotepadProps {
  baseUrl: string;
  token: string | undefined;
  roomId: string;
}

const FIELD_KEY = 'collab-notepad';

const STATE_TINT: Record<YjsConnectionState, string> = {
  connected: 'bg-emerald-400',
  connecting: 'bg-amber-400 animate-pulse',
  disconnected: 'bg-zinc-600',
};

export default function SharedNotepad(props: SharedNotepadProps) {
  const { doc, state, revision } = useYjsDoc({
    baseUrl: props.baseUrl,
    token: props.token,
    roomId: props.roomId,
  });

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Pull the latest Y.Text content into the textarea when the doc
  // updates from outside (i.e. another participant typed).
  useEffect(() => {
    if (!doc || !textareaRef.current) return;
    const text = doc.getText(FIELD_KEY);
    const yValue = text.toString();
    if (textareaRef.current.value !== yValue) {
      // Preserve cursor position roughly
      const sel = textareaRef.current.selectionStart;
      textareaRef.current.value = yValue;
      try {
        textareaRef.current.setSelectionRange(
          Math.min(sel, yValue.length),
          Math.min(sel, yValue.length),
        );
      } catch {
        /* ignore */
      }
    }
  }, [doc, revision]);

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (!doc) return;
    const text = doc.getText(FIELD_KEY);
    const next = e.target.value;
    // Naive replace-all (fine for a notepad demo). For a real editor
    // we'd diff and apply delta inserts/deletes for character-level
    // CRDT correctness.
    doc.transact(() => {
      text.delete(0, text.length);
      text.insert(0, next);
    });
  }

  const ready = doc !== null && state === 'connected';

  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-center gap-2 text-xs">
        <span
          aria-hidden
          className={`inline-block w-2 h-2 rounded-full ${STATE_TINT[state]}`}
        />
        <span className="text-zinc-400 uppercase tracking-wide">
          shared notepad
        </span>
        <span className="text-zinc-600">{state}</span>
      </header>
      <textarea
        ref={textareaRef}
        rows={6}
        disabled={!ready}
        onChange={handleInput}
        placeholder={
          ready
            ? 'Type here — everyone in this room sees your keystrokes live.'
            : `Waiting for sync (${state})…`
        }
        className="w-full rounded border border-zinc-800 bg-zinc-950/60 p-3 text-sm font-mono text-zinc-100 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
      />
      <p className="text-[10px] text-zinc-600">
        Backed by Y.Doc → /yjs (WebSocket) → SqliteYjsPersistence on the
        server. Edits persist across server restart.
      </p>
    </section>
  );
}
