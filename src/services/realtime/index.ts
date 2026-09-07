/**
 * Service temps réel (§3).
 *
 * Une "room" WebSocket par session, portée par un Cloudflare Durable Object.
 * Gère : présence, join/leave, diffusion des messages (transcription /
 * traduction, y compris résultats partiels), statut de session, fin.
 * Implémentation en Phase 4.
 */

import type { ConversationMessage, SessionStatus } from '@/types';

export type RealtimeEvent =
  | { type: 'presence'; participants: { id: string; online: boolean }[] }
  | { type: 'session_status'; status: SessionStatus }
  | { type: 'message'; message: ConversationMessage }
  | { type: 'message_update'; message: ConversationMessage };

export type RealtimeListener = (event: RealtimeEvent) => void;

export interface RealtimeChannel {
  subscribe(listener: RealtimeListener): () => void;
  publishMessage(message: ConversationMessage): void;
  close(): void;
}

export interface RealtimeService {
  connect(sessionId: string, accessToken: string): Promise<RealtimeChannel>;
}

export const REALTIME_NOT_IMPLEMENTED = 'realtime_service_phase_4' as const;
