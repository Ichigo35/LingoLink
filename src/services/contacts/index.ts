/**
 * Service contacts / amis (§3, méthode 3). Être ami n'est jamais obligatoire
 * pour discuter — c'est un raccourci.
 */

import type { LanguageCode } from '@/config/languages';
import { apiRequest } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';

async function cookie(): Promise<string | null> {
  return (await authClient.getCookie()) ?? null;
}

export interface ContactProfile {
  id: string;
  username: string | null;
  displayName: string | null;
  preferredLanguage: LanguageCode | null;
}

export interface Contact extends ContactProfile {
  isOnline: boolean;
  createdAt: string;
}

export interface IncomingRequest {
  id: string;
  createdAt: string;
  from: ContactProfile;
}

export const contactsService = {
  async pingPresence(): Promise<void> {
    await apiRequest('/api/presence/ping', { method: 'POST', cookie: await cookie() }).catch(() => {});
  },

  async search(query: string): Promise<ContactProfile[]> {
    const { users } = await apiRequest<{ users: ContactProfile[] }>(
      `/api/users/search?q=${encodeURIComponent(query)}`,
      { cookie: await cookie() },
    );
    return users;
  },

  async list(): Promise<Contact[]> {
    const { contacts } = await apiRequest<{ contacts: Contact[] }>('/api/contacts', {
      cookie: await cookie(),
    });
    return contacts;
  },

  async remove(contactId: string): Promise<void> {
    await apiRequest(`/api/contacts/${encodeURIComponent(contactId)}`, {
      method: 'DELETE',
      cookie: await cookie(),
    });
  },

  async incomingRequests(): Promise<IncomingRequest[]> {
    const { requests } = await apiRequest<{ requests: IncomingRequest[] }>(
      '/api/contacts/requests',
      { cookie: await cookie() },
    );
    return requests;
  },

  async sendRequest(username: string): Promise<{ status: 'pending' | 'accepted' }> {
    return apiRequest('/api/contacts/requests', {
      method: 'POST',
      body: { username },
      cookie: await cookie(),
    });
  },

  async acceptRequest(id: string): Promise<void> {
    await apiRequest(`/api/contacts/requests/${encodeURIComponent(id)}/accept`, {
      method: 'POST',
      cookie: await cookie(),
    });
  },

  async declineRequest(id: string): Promise<void> {
    await apiRequest(`/api/contacts/requests/${encodeURIComponent(id)}/decline`, {
      method: 'POST',
      cookie: await cookie(),
    });
  },

  /** Démarre une conversation avec un contact ; il reçoit une invitation temps réel. */
  async startConversation(contactId: string): Promise<{ sessionId: string }> {
    return apiRequest(`/api/contacts/${encodeURIComponent(contactId)}/conversation`, {
      method: 'POST',
      cookie: await cookie(),
    });
  },
};
