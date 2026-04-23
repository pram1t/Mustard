'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CollabClient,
  CollabApiError,
  type Intent,
  type Participant,
  type PermissionMode,
  type Room,
} from '../../../lib/collab-client';
import { useCollabSocket } from '../../../lib/use-collab-socket';
import ParticipantList from '../../../components/collab/ParticipantList';
import IntentList from '../../../components/collab/IntentList';
import ModeSelector from '../../../components/collab/ModeSelector';
import EventLog from '../../../components/collab/EventLog';

const DEFAULT_BASE = 'http://127.0.0.1:3200';

export default function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: roomId } = use(params);

  const [participantId, setParticipantId] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_BASE);
  const [token, setToken] = useState<string | undefined>();

  // Hydrate identity + base URL from localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setParticipantId(
      window.localStorage.getItem('openagent.participantId') ?? '',
    );
    setBaseUrl(
      window.localStorage.getItem('openagent.collabBaseUrl') ?? DEFAULT_BASE,
    );
  }, []);

  const client = useMemo(() => {
    if (!participantId) return null;
    return new CollabClient({ baseUrl });
  }, [participantId, baseUrl]);

  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [mode, setMode] = useState<PermissionMode>('plan');
  const [me, setMe] = useState<Participant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!client) return;
    try {
      const [roomData, intentList] = await Promise.all([
        client.getRoom(roomId),
        client.listIntents(roomId),
      ]);
      setRoom(roomData.room);
      setParticipants(roomData.participants);
      setMode(roomData.mode);
      setIntents(intentList);
    } catch (err) {
      setError(err instanceof CollabApiError ? err.message : String(err));
    }
  }, [client, roomId]);

  // Login + initial load + auto-join.
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const login = await client.login({
          participantId,
          participantName: participantId,
          type: 'human',
          roomId,
        });
        if (cancelled) return;
        setToken(login.token);

        const joined = await client.joinRoom(roomId, {
          name: participantId,
          type: 'human',
        });
        if (cancelled) return;
        setMe(joined);

        await reload();
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
  }, [client, participantId, roomId, reload]);

  // Live event subscription
  const { state, events, clear } = useCollabSocket({
    baseUrl,
    token,
    roomId,
    disabled: !token,
  });

  // Refresh on certain incoming events
  useEffect(() => {
    if (events.length === 0) return;
    const last = events[events.length - 1];
    if (
      last.type.startsWith('collab.ai.intent') ||
      last.type === 'collab.permissions.mode.changed' ||
      last.type === 'collab.room.participant_joined' ||
      last.type === 'collab.room.participant_left'
    ) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length]);

  async function handleSetMode(next: PermissionMode): Promise<void> {
    if (!client) return;
    try {
      await client.setMode(roomId, next);
      setMode(next);
    } catch (err) {
      setError(err instanceof CollabApiError ? err.message : String(err));
    }
  }

  async function handleApprove(intent: Intent): Promise<void> {
    if (!client) return;
    try {
      await client.approveIntent(roomId, intent.id, participantId);
      await reload();
    } catch (err) {
      setError(err instanceof CollabApiError ? err.message : String(err));
    }
  }

  async function handleReject(intent: Intent): Promise<void> {
    if (!client) return;
    try {
      await client.rejectIntent(roomId, intent.id, 'rejected via UI');
      await reload();
    } catch (err) {
      setError(err instanceof CollabApiError ? err.message : String(err));
    }
  }

  async function handleLeave(): Promise<void> {
    if (!client || !me) return;
    try {
      await client.leaveRoom(roomId, me.id);
      setMe(null);
      await reload();
    } catch (err) {
      setError(err instanceof CollabApiError ? err.message : String(err));
    }
  }

  if (!participantId) {
    return (
      <div className="text-sm text-zinc-500">
        Set your identity on the{' '}
        <a href="/collab" className="text-cyan-400 hover:underline">
          Collab home
        </a>{' '}
        first.
      </div>
    );
  }

  if (loading) return <div className="text-sm text-zinc-500">Loading room…</div>;

  if (error && !room) {
    return (
      <div className="rounded border border-rose-700/50 bg-rose-900/20 p-3 text-sm text-rose-300">
        {error}
      </div>
    );
  }

  if (!room) return <div className="text-sm text-zinc-500">Room not found.</div>;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cyan-400">{room.name}</h1>
          <p className="text-sm text-zinc-500">
            {room.projectPath ?? '(no project path)'}
            {' · '}
            <a href="/collab" className="hover:text-zinc-300 hover:underline">
              ← all rooms
            </a>
          </p>
        </div>
      </header>

      {error ? (
        <div className="rounded border border-rose-700/50 bg-rose-900/20 p-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="text-sm font-semibold uppercase text-zinc-400 mb-2">
              Mode
            </h2>
            <ModeSelector current={mode} onChange={handleSetMode} />
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase text-zinc-400 mb-2">
              Intents
            </h2>
            <IntentList
              intents={intents}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section>
            <h2 className="text-sm font-semibold uppercase text-zinc-400 mb-2">
              Participants
            </h2>
            <ParticipantList
              participants={participants}
              currentParticipantId={me?.id}
              onLeave={handleLeave}
            />
          </section>

          <EventLog state={state} events={events} onClear={clear} />
        </aside>
      </section>
    </div>
  );
}
