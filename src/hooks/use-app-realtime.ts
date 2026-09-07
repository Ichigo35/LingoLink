import { useEffect } from 'react';
import { AppState } from 'react-native';

import { contactsService } from '@/services/contacts';
import { createInboxChannel } from '@/services/inbox';
import { useInboxStore } from '@/stores/inbox-store';

const HEARTBEAT_MS = 30_000;

/**
 * Services temps réel globaux (montés une fois quand l'utilisateur est
 * connecté) : heartbeat de présence + boîte de réception (invitations,
 * notifications de contact).
 */
export function useAppRealtime(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;

    contactsService.pingPresence();
    const heartbeat = setInterval(() => contactsService.pingPresence(), HEARTBEAT_MS);
    const appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') contactsService.pingPresence();
    });

    const channel = createInboxChannel();
    const unsub = channel.subscribe((event) => {
      if (event.type === 'conversation_invite') {
        useInboxStore.getState().setInvite(event);
      } else {
        useInboxStore.getState().bumpContacts();
      }
    });

    return () => {
      clearInterval(heartbeat);
      appStateSub.remove();
      unsub();
      channel.close();
    };
  }, [isAuthenticated]);
}
