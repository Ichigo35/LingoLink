/**
 * Service d'authentification (§12) — implémentation Better Auth.
 *
 * Deux modes :
 * - `guest`  : session anonyme (`signIn.anonymous`), fonctions limitées.
 * - `account`: Google OAuth. Un invité peut être « promu » en compte Google
 *   (Better Auth relie automatiquement la session anonyme au nouveau compte).
 */

import { apiRequest } from '@/lib/api-client';
import { authClient, type SessionUser } from '@/lib/auth-client';
import type { LanguageCode } from '@/config/languages';

export interface ProfilePatch {
  name?: string;
  username?: string;
  preferredLanguage?: LanguageCode;
}

export const authService = {
  async signInAsGuest(): Promise<void> {
    const { error } = await authClient.signIn.anonymous();
    if (error) throw new Error(error.message ?? 'Échec de la connexion invité');
  },

  async signInWithGoogle(): Promise<void> {
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/',
    });
    if (error) throw new Error(error.message ?? 'Échec de la connexion Google');
  },

  async signOut(): Promise<void> {
    await authClient.signOut();
  },

  async updateProfile(patch: ProfilePatch): Promise<void> {
    const { error } = await authClient.updateUser(patch);
    if (error) throw new Error(error.message ?? 'Échec de la mise à jour du profil');
  },

  /** Vérifie la disponibilité d'un username côté serveur. */
  async isUsernameAvailable(username: string): Promise<{ available: boolean; reason: string | null }> {
    return apiRequest(`/api/profile/username-available?u=${encodeURIComponent(username)}`);
  },

  /** Indique si le backend a Google activé (identifiants OAuth présents). */
  async getServerConfig(): Promise<{ googleEnabled: boolean }> {
    return apiRequest('/api/config');
  },
};

export function isGuest(user: SessionUser | undefined | null): boolean {
  return Boolean(user && (user as { isAnonymous?: boolean }).isAnonymous);
}
