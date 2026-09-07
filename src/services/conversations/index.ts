/**
 * Service de gestion des sessions de conversation (§11) — implémentation.
 * Toutes les requêtes passent par le backend (Cloudflare Worker) avec le
 * cookie de session Better Auth.
 */

import type { LanguageCode } from '@/config/languages';
import { apiRequest } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';
import type { ConnectionMethod, ConversationSession } from '@/types';

async function authHeader(): Promise<string | null> {
  return (await authClient.getCookie()) ?? null;
}

export interface CreateSessionInput {
  creatorLanguage: LanguageCode;
  participantLanguage: LanguageCode;
  method?: ConnectionMethod;
  ttlSeconds?: number;
}

interface SessionResponse {
  session: ConversationSession;
}

export const conversationsService = {
  async createSession(input: CreateSessionInput): Promise<ConversationSession> {
    const { session } = await apiRequest<SessionResponse>('/api/sessions', {
      method: 'POST',
      body: input,
      cookie: await authHeader(),
    });
    return session;
  },

  async joinByToken(token: string): Promise<ConversationSession> {
    const { session } = await apiRequest<SessionResponse>('/api/sessions/join', {
      method: 'POST',
      body: { token },
      cookie: await authHeader(),
    });
    return session;
  },

  async joinByCode(code: string): Promise<ConversationSession> {
    const { session } = await apiRequest<SessionResponse>('/api/sessions/join', {
      method: 'POST',
      body: { code },
      cookie: await authHeader(),
    });
    return session;
  },

  async getSession(sessionId: string): Promise<ConversationSession> {
    const { session } = await apiRequest<SessionResponse>(
      `/api/sessions/${encodeURIComponent(sessionId)}`,
      { cookie: await authHeader() },
    );
    return session;
  },

  async leaveSession(sessionId: string): Promise<ConversationSession> {
    const { session } = await apiRequest<SessionResponse>(
      `/api/sessions/${encodeURIComponent(sessionId)}/leave`,
      { method: 'POST', cookie: await authHeader() },
    );
    return session;
  },

  async endSession(sessionId: string): Promise<ConversationSession> {
    const { session } = await apiRequest<SessionResponse>(
      `/api/sessions/${encodeURIComponent(sessionId)}/end`,
      { method: 'POST', cookie: await authHeader() },
    );
    return session;
  },
};
