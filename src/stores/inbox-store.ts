import { create } from 'zustand';

import type { InboxEvent } from '@/services/inbox';

type ConversationInvite = Extract<InboxEvent, { type: 'conversation_invite' }>;

interface InboxState {
  /** Invitation de conversation reçue en temps réel (affichée en modale globale). */
  pendingInvite: ConversationInvite | null;
  /** Incrémenté à chaque évènement contact — déclenche un refetch des écrans contacts. */
  contactsVersion: number;
  setInvite: (invite: ConversationInvite) => void;
  clearInvite: () => void;
  bumpContacts: () => void;
}

export const useInboxStore = create<InboxState>((set) => ({
  pendingInvite: null,
  contactsVersion: 0,
  setInvite: (pendingInvite) => set({ pendingInvite }),
  clearInvite: () => set({ pendingInvite: null }),
  bumpContacts: () => set((s) => ({ contactsVersion: s.contactsVersion + 1 })),
}));
