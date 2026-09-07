/**
 * Session de conversation courante. Non persisté : une session est éphémère.
 * Le temps réel (Phase 4) remplacera le polling qui alimente ce store.
 */

import { create } from 'zustand';

import type { ConversationSession } from '@/types';

interface SessionState {
  session: ConversationSession | null;
  setSession: (session: ConversationSession) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  clear: () => set({ session: null }),
}));
