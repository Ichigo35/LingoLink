import { useEffect, useMemo, useRef, useState } from 'react';

import { ApiRequestError } from '@/lib/api-client';
import { conversationsService } from '@/services/conversations';
import {
  type OutgoingEvent,
  type PresenceParticipant,
  type RealtimeChannel,
  createRealtimeChannel,
} from '@/services/realtime';
import { useSessionStore } from '@/stores/session-store';
import type { ConversationSession } from '@/types';

interface LiveSession {
  session: ConversationSession | null;
  participants: PresenceParticipant[];
  /** true si l'autre personne est connectée en temps réel. */
  peerOnline: boolean;
  connected: boolean;
  loading: boolean;
  error: string | null;
  send: (event: OutgoingEvent) => void;
}

interface LiveState {
  sid: string;
  participants: PresenceParticipant[];
  connected: boolean;
  error: string | null;
}

const FALLBACK_POLL_MS = 15_000;
const EMPTY: LiveState = { sid: '', participants: [], connected: false, error: null };

/**
 * Charge une session (snapshot HTTP) puis la maintient à jour en temps réel via
 * le Durable Object : présence, changements de statut, fin de conversation.
 */
export function useLiveSession(sessionId: string | undefined, selfUserId?: string): LiveSession {
  const { session, setSession } = useSessionStore();
  // État rattaché à un `sid` : évite tout reset synchrone dans l'effet.
  const [state, setState] = useState<LiveState>(EMPTY);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const patch = (p: Partial<LiveState>) =>
      setState((prev) => ({ ...(prev.sid === sessionId ? prev : EMPTY), sid: sessionId, ...p }));

    conversationsService
      .getSession(sessionId)
      .then((s) => !cancelled && setSession(s))
      .catch((e) => {
        if (!cancelled) {
          patch({ error: e instanceof ApiRequestError ? e.message : 'Erreur de chargement' });
        }
      });

    const channel = createRealtimeChannel(sessionId);
    channelRef.current = channel;

    const unsub = channel.subscribe((event) => {
      if (cancelled) return;
      if (event.type === 'connection') patch({ connected: event.connected });
      else if (event.type === 'presence') patch({ participants: event.participants });
      else if (event.type === 'session_status') setSession(event.session);
    });

    const poll = setInterval(() => {
      if (cancelled || channel.isConnected()) return;
      conversationsService
        .getSession(sessionId)
        .then((s) => !cancelled && setSession(s))
        .catch(() => {});
    }, FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
      unsub();
      channel.close();
      channelRef.current = null;
    };
  }, [sessionId, setSession]);

  const current = session?.id === sessionId ? session : null;
  const scoped = state.sid === sessionId ? state : EMPTY;

  const peerOnline = useMemo(() => {
    if (!selfUserId) return scoped.participants.length > 1;
    return scoped.participants.some((p) => p.id !== selfUserId && p.online);
  }, [scoped.participants, selfUserId]);

  return {
    session: current,
    participants: scoped.participants,
    peerOnline,
    connected: scoped.connected,
    loading: !current && !scoped.error,
    error: scoped.error,
    send: (event) => channelRef.current?.send(event),
  };
}
