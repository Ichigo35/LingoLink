/**
 * Service de gestion des sessions de conversation (§11).
 * Implémentation en Phase 3.
 */

import type { ConnectionMethod, ConversationSession } from '@/types';
import type { LanguageCode } from '@/config/languages';

export interface CreateSessionInput {
  creatorLanguage: LanguageCode;
  participantLanguage: LanguageCode;
  method: ConnectionMethod;
  /** Durée de validité du token en secondes (QR/lien temporaires). */
  ttlSeconds?: number;
}

export interface ConversationsService {
  createSession(input: CreateSessionInput): Promise<ConversationSession>;
  joinByToken(token: string): Promise<ConversationSession>;
  getSession(sessionId: string): Promise<ConversationSession>;
  leaveSession(sessionId: string): Promise<void>;
  endSession(sessionId: string): Promise<void>;
}

export const CONVERSATIONS_NOT_IMPLEMENTED = 'conversations_service_phase_3' as const;
