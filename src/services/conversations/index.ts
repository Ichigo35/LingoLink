/**
 * Service de gestion des sessions de conversation (§11) — implémentation.
 * Toutes les requêtes passent par le backend (Cloudflare Worker) avec le
 * cookie de session Better Auth.
 */

import * as FileSystem from 'expo-file-system/legacy';

import type { LanguageCode } from '@/config/languages';
import { apiRequest } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';
import type { ConnectionMethod, ConversationMessage, ConversationSession } from '@/types';

function mimeForUri(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'caf') return 'audio/x-caf';
  if (ext === 'aac') return 'audio/aac';
  return 'audio/mp4';
}

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

  async listMessages(sessionId: string): Promise<ConversationMessage[]> {
    const { messages } = await apiRequest<{ messages: ConversationMessage[] }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/messages`,
      { cookie: await authHeader() },
    );
    return messages;
  },

  /** Envoie un segment audio ; la transcription/traduction est streamée via le temps réel. */
  async sendVoiceMessage(
    sessionId: string,
    audioUri: string,
    clientId: string,
  ): Promise<ConversationMessage> {
    const audioBase64 = await FileSystem.readAsStringAsync(audioUri, { encoding: 'base64' });
    const { message } = await apiRequest<{ message: ConversationMessage }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/messages`,
      {
        method: 'POST',
        cookie: await authHeader(),
        timeoutMs: 45_000,
        body: { audioBase64, mimeType: mimeForUri(audioUri), clientId },
      },
    );
    return message;
  },
};
