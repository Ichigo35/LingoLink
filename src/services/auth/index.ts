/**
 * Service d'authentification (§12).
 *
 * Deux modes : `guest` (session anonyme locale, fonctions limitées) et
 * `account` (Neon Auth + Google OAuth). Implémentation en Phase 2.
 */

import type { AuthState, Profile } from '@/types';

export interface AuthService {
  /** Restaure une session existante depuis le stockage sécurisé. */
  restore(): Promise<AuthState | null>;
  /** Crée une session invité (aucune identité persistée côté serveur). */
  signInAsGuest(displayName?: string): Promise<AuthState>;
  /** Connexion Google (OAuth via Neon Auth). */
  signInWithGoogle(): Promise<AuthState>;
  signOut(): Promise<void>;
  updateProfile(patch: Partial<Profile>): Promise<Profile>;
}

export const AUTH_NOT_IMPLEMENTED = 'auth_service_phase_2' as const;
