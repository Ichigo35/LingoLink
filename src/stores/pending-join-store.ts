/**
 * Token d'invitation en attente : quand l'app est ouverte via un deep link
 * `lingolink://join/<token>` alors que l'utilisateur n'est pas encore connecté,
 * on mémorise le token pour reprendre la jointure après l'authentification.
 */

import { create } from 'zustand';

interface PendingJoinState {
  token: string | null;
  set: (token: string) => void;
  clear: () => void;
}

export const usePendingJoinStore = create<PendingJoinState>((set) => ({
  token: null,
  set: (token) => set({ token }),
  clear: () => set({ token: null }),
}));
