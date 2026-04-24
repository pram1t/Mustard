'use client';

/**
 * React hook that binds a Y.Doc to the collab server's /yjs endpoint
 * via y-websocket's WebsocketProvider.
 *
 * Returns the Y.Doc plus connection state and a counter that bumps on
 * every doc update — handy for re-rendering bound components without
 * subscribing manually.
 */

import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export type YjsConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface UseYjsDocOptions {
  /** http(s):// base URL — converted to ws(s):// internally. */
  baseUrl: string;
  /** JWT token. Hook is inert when missing. */
  token: string | undefined;
  /** Room id (used as docName). Hook is inert when missing. */
  roomId: string | undefined;
  /** Disable the hook entirely (no provider created). */
  disabled?: boolean;
}

export interface UseYjsDocResult {
  doc: Y.Doc | null;
  state: YjsConnectionState;
  /** Bumps on every doc update — use as a render trigger. */
  revision: number;
}

export function useYjsDoc(options: UseYjsDocOptions): UseYjsDocResult {
  const { baseUrl, token, roomId, disabled } = options;
  const [state, setState] = useState<YjsConnectionState>('disconnected');
  const [revision, setRevision] = useState(0);
  const docRef = useRef<Y.Doc | null>(null);

  useEffect(() => {
    if (disabled || !token || !roomId) {
      setState('disconnected');
      docRef.current = null;
      return;
    }

    const wsBase = baseUrl.replace(/^http/, 'ws');
    const url = `${wsBase}/yjs`;

    const doc = new Y.Doc();
    docRef.current = doc;

    const provider = new WebsocketProvider(url, roomId, doc, {
      params: { token, roomId },
      // The browser ships a global WebSocket, so no polyfill needed.
    });

    setState('connecting');

    const onStatus = (event: { status: string }) => {
      if (event.status === 'connected') setState('connected');
      else if (event.status === 'disconnected') setState('disconnected');
      else if (event.status === 'connecting') setState('connecting');
    };
    provider.on('status', onStatus);

    const onUpdate = () => setRevision(r => r + 1);
    doc.on('update', onUpdate);

    return () => {
      try {
        provider.off('status', onStatus);
        doc.off('update', onUpdate);
        provider.destroy();
      } catch {
        /* ignore */
      }
      docRef.current = null;
    };
  }, [baseUrl, token, roomId, disabled]);

  return { doc: docRef.current, state, revision };
}
