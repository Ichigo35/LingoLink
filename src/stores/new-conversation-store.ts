/**
 * État éphémère du parcours "Nouvelle conversation" (§6) :
 * choix des langues puis choix de la méthode de connexion.
 * Non persisté — réinitialisé à chaque nouveau parcours.
 */

import { create } from 'zustand';

import type { LanguageCode } from '@/config/languages';
import type { ConnectionMethod } from '@/types';

interface NewConversationState {
  myLanguage: LanguageCode | null;
  otherLanguage: LanguageCode | null;
  method: ConnectionMethod | null;

  setLanguages: (my: LanguageCode, other: LanguageCode) => void;
  setMethod: (method: ConnectionMethod) => void;
  reset: () => void;
}

export const useNewConversationStore = create<NewConversationState>((set) => ({
  myLanguage: null,
  otherLanguage: null,
  method: null,

  setLanguages: (myLanguage, otherLanguage) => set({ myLanguage, otherLanguage }),
  setMethod: (method) => set({ method }),
  reset: () => set({ myLanguage: null, otherLanguage: null, method: null }),
}));
