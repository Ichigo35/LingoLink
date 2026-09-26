import { useEffect, useMemo, useRef, useState } from 'react';

import { ApiRequestError } from '@/lib/api-client';
import { conversationsService } from '@/services/conversations';
import {
  type PresenceParticipant,
  type RealtimeChannel,
  createRealtimeChannel,
} from '@/services/realtime';
import { useSessionStore } from '@/stores/session-store';
import type { ConversationMessage, ConversationSession } from '@/types';

interface LiveSession {
  session: ConversationSession | null;
  participants: PresenceParticipant[];
  messages: ConversationMessage[];
  /** true si l'autre personne est connectée en temps réel. */
  peerOnline: boolean;
  connected: boolean;
  loading: boolean;
  error: string | null;
}

interface LiveState {
  sid: string;
  participants: PresenceParticipant[];
  messages: Record<string, ConversationMessage>;
  connected: boolean;
  error: string | null;
}

const FALLBACK_POLL_MS = 15_000;
const EMPTY: LiveState = { sid: '', participants: [], messages: {}, connected: false, error: null };

/**
 * État complet d'une conversation en temps réel : session, présence, messages
 * (transcription/traduction progressive via le Durable Object). Snapshot HTTP
 * initial + fusion des évènements ; poll de secours si le WebSocket est coupé.
 */
export function useLiveSession(sessionId: string | undefined, selfUserId?: string): LiveSession {
  const { session, setSession } = useSessionStore();
  const [state, setState] = useState<LiveState>(EMPTY);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const patch = (fn: (prev: LiveState) => Partial<LiveState>) =>
      setState((prev) => {
        const base = prev.sid === sessionId ? prev : { ...EMPTY, sid: sessionId };
        return { ...base, ...fn(base) };
      });

    conversationsService
      .getSession(sessionId)
      .then((s) => !cancelled && setSession(s))
      .catch((e) => {
        if (!cancelled) {
          patch(() => ({
            error: e instanceof ApiRequestError ? e.message : 'Erreur de chargement',
          }));
        }
      });

    conversationsService
      .listMessages(sessionId)
      .then((list) => {
        if (cancelled) return;
        patch((base) => ({
          messages: { ...base.messages, ...Object.fromEntries(list.map((m) => [m.id, m])) },
        }));
      })
      .catch(() => {});

    const channel = createRealtimeChannel(sessionId);
    channelRef.current = channel;

    const unsub = channel.subscribe((event) => {
      if (cancelled) return;
      switch (event.type) {
        case 'connection':
          patch(() => ({ connected: event.connected }));
          break;
        case 'presence':
          patch(() => ({ participants: event.participants }));
          break;
        case 'session_status':
          setSession(event.session);
          break;
        case 'message':
        case 'message_update':
          patch((base) => ({ messages: { ...base.messages, [event.message.id]: event.message } }));
          break;
        case 'message_deleted':
          patch((base) => {
            const { [event.messageId]: _removed, ...rest } = base.messages;
            return { messages: rest };
          });
          break;
      }
    });

    const poll = setInterval(() => {
      if (cancelled || channel.isConnected()) return;
      conversationsService
        .getSession(sessionId)
        .then((s) => !cancelled && setSession(s))
        .catch(() => {});
      conversationsService
        .listMessages(sessionId)
        .then((list) => {
          if (cancelled) return;
          patch((base) => ({
            messages: { ...base.messages, ...Object.fromEntries(list.map((m) => [m.id, m])) },
          }));
        })
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

  const messages = useMemo(
    () =>
      Object.values(scoped.messages).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [scoped.messages],
  );

  const peerOnline = useMemo(() => {
    if (!selfUserId) return scoped.participants.length > 1;
    return scoped.participants.some((p) => p.id !== selfUserId && p.online);
  }, [scoped.participants, selfUserId]);

  return {
    session: current,
    participants: scoped.participants,
    messages,
    peerOnline,
    connected: scoped.connected,
    loading: !current && !scoped.error,
    error: scoped.error,
  };
}
