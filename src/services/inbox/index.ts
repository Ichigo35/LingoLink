/**
 * Boîte de réception temps réel de l'utilisateur (un Durable Object par user).
 * Reçoit les invitations de conversation (contact, proximité) et notifications
 * de contact pendant que l'app est ouverte.
 */

import type { LanguageCode } from '@/config/languages';
import { apiRequest } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';
import type { ContactProfile } from '@/services/contacts';

export type InboxEvent =
  | {
      type: 'conversation_invite';
      sessionId: string;
      connectionToken: string;
      from: ContactProfile;
      creatorLanguage: LanguageCode;
      participantLanguage: LanguageCode;
    }
  | { type: 'contact_request'; from: ContactProfile }
  | { type: 'contact_accepted'; by: string };

type Listener = (event: InboxEvent) => void;

const MAX_BACKOFF_MS = 15_000;
const PING_MS = 25_000;

export interface InboxChannel {
  subscribe: (l: Listener) => () => void;
  close: () => void;
}

export function createInboxChannel(): InboxChannel {
  const listeners = new Set<Listener>();
  let ws: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  async function connect() {
    if (closed) return;
    try {
      const cookie = (await authClient.getCookie()) ?? null;
      const { ticket, wsUrl } = await apiRequest<{ ticket: string; wsUrl: string }>(
        '/api/inbox/ticket',
        { method: 'POST', cookie },
      );
      if (closed) return;
      const socket = new WebSocket(`${wsUrl}?ticket=${encodeURIComponent(ticket)}`);
      ws = socket;
      socket.onopen = () => {
        attempt = 0;
        pingTimer = setInterval(() => {
          try {
            socket.send('{"type":"ping"}');
          } catch {
            /* ignore */
          }
        }, PING_MS);
      };
      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(typeof e.data === 'string' ? e.data : '');
          if (data.type === 'pong') return;
          listeners.forEach((l) => l(data as InboxEvent));
        } catch {
          /* ignore */
        }
      };
      socket.onclose = () => {
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = null;
        ws = null;
        scheduleReconnect();
      };
      socket.onerror = () => {};
    } catch {
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
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
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
  };
}
