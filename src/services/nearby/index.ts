/**
 * Découverte de proximité (§4 — méthode 4) — implémentation MVP serveur +
 * localisation approximative.
 *
 * Confidentialité : visibilité opt-in explicite, coordonnées arrondies côté
 * serveur, expiration automatique, jamais de position exacte affichée.
 */

import type { LanguageCode } from '@/config/languages';
import { apiRequest } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';

async function cookie(): Promise<string | null> {
  return (await authClient.getCookie()) ?? null;
}

export interface NearbyUser {
  profileId: string;
  displayName: string;
  language: LanguageCode | null;
  /** Distance en bucket (20 / 50 / 100 / 200 / 500 m). */
  approxDistanceM: number;
}

export const nearbyService = {
  async enableDiscovery(coords: { lat: number; lng: number }): Promise<{ expiresInSeconds: number }> {
    return apiRequest('/api/nearby/visible', {
      method: 'POST',
      body: coords,
      cookie: await cookie(),
    });
  },

  async disableDiscovery(): Promise<void> {
    await apiRequest('/api/nearby/visible', { method: 'DELETE', cookie: await cookie() }).catch(
      () => {},
    );
  },

  async getNearbyUsers(coords: { lat: number; lng: number }): Promise<NearbyUser[]> {
    const { users } = await apiRequest<{ users: NearbyUser[] }>(
      `/api/nearby?lat=${coords.lat}&lng=${coords.lng}`,
      { cookie: await cookie() },
    );
    return users;
  },

  async requestConversation(profileId: string): Promise<{ sessionId: string }> {
    return apiRequest(`/api/nearby/${encodeURIComponent(profileId)}/request`, {
      method: 'POST',
      cookie: await cookie(),
    });
  },
};
