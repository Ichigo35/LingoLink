/**
 * Service temps réel (§3) — implémentation Cloudflare Durable Objects.
 *
 * Une "room" WebSocket par session. Authentification par ticket court obtenu
 * via un endpoint HTTP authentifié (le cookie de session ne peut pas être
 * envoyé simplement lors de l'upgrade WebSocket).
 *
 * Reconnexion automatique avec backoff ; un ticket frais est demandé à chaque
 * tentative.
 */

import { apiRequest } from '@/lib/api-client';
import { getAuthCookie } from '@/lib/auth-client';
import type { ConversationMessage, ConversationSession } from '@/types';

export interface PresenceParticipant {
  id: string;
  role: 'creator' | 'participant';
  online: boolean;
}

export type RealtimeEvent =
  | { type: 'connection'; connected: boolean }
  | { type: 'presence'; participants: PresenceParticipant[] }
  | { type: 'session_status'; session: ConversationSession }
  | { type: 'message'; message: ConversationMessage }
  | { type: 'message_update'; message: ConversationMessage }
  | { type: 'message_deleted'; messageId: string };

export type OutgoingEvent = { type: 'ping' };

export type RealtimeListener = (event: RealtimeEvent) => void;

export interface RealtimeChannel {
  subscribe: (listener: RealtimeListener) => () => void;
  send: (event: OutgoingEvent) => void;
  close: () => void;
  isConnected: () => boolean;
}

interface TicketResponse {
  ticket: string;
  wsUrl: string;
}

const MAX_BACKOFF_MS = 15_000;
const PING_INTERVAL_MS = 25_000;

export function createRealtimeChannel(sessionId: string): RealtimeChannel {
  const listeners = new Set<RealtimeListener>();
  let ws: WebSocket | null = null;
  let closed = false;
  let connected = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  function emit(event: RealtimeEvent) {
    listeners.forEach((l) => l(event));
  }

  function setConnected(value: boolean) {
    if (connected === value) return;
    connected = value;
    emit({ type: 'connection', connected: value });
  }

  async function connect() {
    if (closed) return;
    try {
      const cookie = (await getAuthCookie()) ?? null;
      const { ticket, wsUrl } = await apiRequest<TicketResponse>(
        `/api/sessions/${encodeURIComponent(sessionId)}/realtime-ticket`,
        { method: 'POST', cookie },
      );
      if (closed) return;

      const socket = new WebSocket(`${wsUrl}?ticket=${encodeURIComponent(ticket)}`);
      ws = socket;

      socket.onopen = () => {
        attempt = 0;
        setConnected(true);
        pingTimer = setInterval(() => {
          try {
            socket.send(JSON.stringify({ type: 'ping' }));
          } catch {
            /* ignore */
          }
        }, PING_INTERVAL_MS);
      };

      socket.onmessage = (e) => {
        let data: RealtimeEvent | { type: 'pong' };
        try {
          data = JSON.parse(typeof e.data === 'string' ? e.data : '');
        } catch {
          return;
        }
        if (data.type === 'pong') return;
        emit(data as RealtimeEvent);
      };

      socket.onerror = () => {
        /* onclose suit */
      };

      socket.onclose = () => {
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = null;
        ws = null;
        setConnected(false);
        scheduleReconnect();
      };
    } catch {
      setConnected(false);
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (closed || reconnectTimer) return;
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
    attempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  connect();

  return {
    subscribe(listener) {
      listeners.add(listener);
      listener({ type: 'connection', connected });
      return () => listeners.delete(listener);
    },
    send(event) {
      try {
        ws?.send(JSON.stringify(event));
      } catch {
        /* ignore */
      }
    },
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      ws = null;
      listeners.clear();
    },
    isConnected: () => connected,
  };
}
