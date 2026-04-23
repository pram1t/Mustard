'use client';

import { useEffect, useState } from 'react';
import {
  CollabClient,
  CollabApiError,
  type Room,
} from '../../lib/collab-client';
import RoomList from '../../components/collab/RoomList';

const DEFAULT_BASE = 'http://127.0.0.1:3200';

export default function CollabRoomsPage() {
  const [client, setClient] = useState<CollabClient | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_BASE);
  const [creating, setCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  // Hydrate from localStorage once.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = window.localStorage.getItem('openagent.participantId') ?? '';
    const url =
      window.localStorage.getItem('openagent.collabBaseUrl') ?? DEFAULT_BASE;
    setParticipantId(id);
    setBaseUrl(url);
  }, []);

  // Build a client + log in whenever participantId/baseUrl is set.
  useEffect(() => {
    if (!participantId || !baseUrl) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const c = new CollabClient({ baseUrl });
        await c.login({
          participantId,
          participantName: participantId,
          type: 'human',
        });
        if (cancelled) return;
        setClient(c);
        const list = await c.listRooms();
        if (cancelled) return;
        setRooms(list);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof CollabApiError ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [participantId, baseUrl]);

  function persistIdentity(id: string, url: string): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('openagent.participantId', id);
    window.localStorage.setItem('openagent.collabBaseUrl', url);
  }

  async function handleCreate(): Promise<void> {
    if (!client || !newRoomName.trim()) return;
    setCreating(true);
    try {
      const room = await client.createRoom({ name: newRoomName.trim() });
      setRooms(prev => [room, ...prev]);
      setNewRoomName('');
    } catch (err) {
      setError(err instanceof CollabApiError ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  if (!participantId) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 rounded border border-zinc-800 bg-zinc-900/40">
        <h1 className="text-xl font-bold mb-1 text-cyan-400">Collab</h1>
        <p className="text-sm text-zinc-400 mb-4">
          Configure your participant identity to connect.
        </p>
        <form
          onSubmit={e => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const id = String(fd.get('id') ?? '').trim();
            const url = String(fd.get('url') ?? '').trim() || DEFAULT_BASE;
            if (!id) return;
            persistIdentity(id, url);
            setParticipantId(id);
            setBaseUrl(url);
          }}
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Participant id</span>
            <input
              name="id"
              required
              placeholder="alice"
              className="rounded bg-zinc-950 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-cyan-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Server URL</span>
            <input
              name="url"
              defaultValue={DEFAULT_BASE}
              className="rounded bg-zinc-950 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-cyan-500"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-cyan-600 hover:bg-cyan-500 text-white py-2 font-medium"
          >
            Connect
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cyan-400">Rooms</h1>
          <p className="text-sm text-zinc-500">
            Connected as <span className="text-zinc-300">{participantId}</span>
            {' · '}
            <span className="text-zinc-600">{baseUrl}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem('openagent.participantId');
            }
            setParticipantId('');
            setClient(null);
            setRooms([]);
          }}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Disconnect
        </button>
      </header>

      <section className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold uppercase text-zinc-400 mb-2">
          Create new room
        </h2>
        <div className="flex gap-2">
          <input
            value={newRoomName}
            onChange={e => setNewRoomName(e.target.value)}
            placeholder="My demo room"
            className="flex-1 rounded bg-zinc-950 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="button"
            disabled={creating || !newRoomName.trim()}
            onClick={handleCreate}
            className="rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-4 py-2 text-white"
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded border border-rose-700/50 bg-rose-900/20 p-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-zinc-500">Loading rooms…</div>
      ) : (
        <RoomList rooms={rooms} />
      )}
    </div>
  );
}
