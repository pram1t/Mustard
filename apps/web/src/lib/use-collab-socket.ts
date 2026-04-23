'use client';

/**
 * React hook that subscribes to /ws on the collab server and surfaces
 * an in-component event log + the connection state.
 *
 * Reconnects with exponential backoff (capped) on close. Cleans up on
 * unmount. Pass `roomId` to receive only events whose envelope.source
 * matches that roomId.
 */

import { useEffect, useRef, useState } from 'react';

export type ConnectionState = 'connecting' | 'open' | 'closed';

export interface CollabEvent {
  type: string;
  payload: unknown;
  source?: string;
  timestamp?: number;
}

export interface UseCollabSocketOptions {
  baseUrl: string; // http(s)://... — will be converted to ws(s)://
  token: string | undefined;
  roomId?: string;
  /** Cap on retained events. Default 200. */
  maxEvents?: number;
  /** Disable the hook (no socket created). Default false. */
  disabled?: boolean;
}

export function useCollabSocket(options: UseCollabSocketOptions): {
  state: ConnectionState;
  events: CollabEvent[];
  reconnectCount: number;
  /** Manually clear the event buffer. */
  clear: () => void;
} {
  const { baseUrl, token, roomId, disabled } = options;
  const maxEvents = options.maxEvents ?? 200;

  const [state, setState] = useState<ConnectionState>('closed');
  const [events, setEvents] = useState<CollabEvent[]>([]);
  const [reconnectCount, setReconnectCount] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (disabled || !token) {
      setState('closed');
      return;
    }

    let cancelled = false;
    let attempt = 0;

    function open() {
      if (cancelled) return;
      const wsUrl = baseUrl.replace(/^http/, 'ws');
      const params = new URLSearchParams();
      params.set('token', token!);
      if (roomId) params.set('roomId', roomId);
      const url = `${wsUrl}/ws?${params.toString()}`;

      setState('connecting');
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        if (cancelled) return;
        attempt = 0;
        setReconnectCount(c => c + 1);
        setState('open');
      });

      socket.addEventListener('message', e => {
        if (cancelled) return;
        try {
          const parsed = JSON.parse(e.data) as CollabEvent;
          setEvents(prev => {
            const next = prev.concat(parsed);
            return next.length > maxEvents ? next.slice(-maxEvents) : next;
          });
        } catch {
          /* drop malformed frames */
        }
      });

      const onCloseOrError = () => {
        if (cancelled) return;
        setState('closed');
        // Backoff: 0.5s, 1s, 2s, 4s, capped at 8s
        const delay = Math.min(8000, 500 * 2 ** attempt);
        attempt += 1;
        reconnectTimer.current = setTimeout(open, delay);
      };
      socket.addEventListener('close', onCloseOrError);
      socket.addEventListener('error', onCloseOrError);
    }

    open();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
      const s = socketRef.current;
      socketRef.current = null;
      if (s && s.readyState === s.OPEN) {
        try {
          s.close(1000, 'unmounting');
        } catch {
          /* ignore */
        }
      }
    };
  }, [baseUrl, token, roomId, disabled, maxEvents]);

  return {
    state,
    events,
    reconnectCount,
    clear: () => setEvents([]),
  };
}
