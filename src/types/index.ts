/**
 * Types de domaine partagés — alignés sur le schéma de base de données
 * (§9, §11, §14 du cahier des charges). Le backend expose les mêmes formes.
 */

import type { LanguageCode } from '@/config/languages';

export type UUID = string;
export type ISODateString = string;

/* ----------------------------- Profils / Auth ----------------------------- */

export interface Profile {
  id: UUID;
  username: string | null;
  displayName: string | null;
  preferredLanguage: LanguageCode;
  avatarUrl: string | null;
  createdAt: ISODateString;
}

export type AuthMode = 'guest' | 'account';

export interface AuthState {
  mode: AuthMode;
  userId: UUID | null;
  profile: Profile | null;
  /** Jeton d'accès backend (JWT court). */
  accessToken: string | null;
}

/* ------------------------------- Sessions -------------------------------- */

export type SessionStatus = 'waiting' | 'connecting' | 'active' | 'ended' | 'expired';

export type ConnectionMethod = 'qr' | 'link' | 'contact' | 'nearby';

export interface ConversationSession {
  id: UUID;
  creatorId: UUID;
  participantId: UUID | null;
  creatorLanguage: LanguageCode;
  participantLanguage: LanguageCode;
  status: SessionStatus;
  /** Jamais l'ID brut : token aléatoire opaque, validé côté serveur. */
  connectionToken: string;
  /** Code court formaté "XXXX-XXXX" pour la saisie manuelle. */
  shortCode: string;
  /** Lien de jointure HTTPS cliquable (rebondit vers l'app) : https://.../join/<token>. */
  joinUrl: string;
  method: ConnectionMethod;
  expiresAt: ISODateString | null;
  createdAt: ISODateString;
  activatedAt: ISODateString | null;
  endedAt: ISODateString | null;
}

/* ------------------------------- Messages -------------------------------- */

export type MessageStatus =
  | 'recording'
  | 'processing'
  | 'partial'
  | 'completed'
  | 'failed';

export interface ConversationMessage {
  id: UUID;
  sessionId: UUID;
  senderId: UUID;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  originalTranscript: string;
  translatedText: string;
  status: MessageStatus;
  /** Id local optionnel, pour réconcilier la bulle optimiste de l'émetteur. */
  clientId: string | null;
  /** true si le texte a été corrigé après l'envoi initial (transcription ou écrit). */
  edited: boolean;
  createdAt: ISODateString;
  /** Message d'erreur affichable quand `status === 'failed'` (transitoire, non persisté). */
  error?: string;
  /** Code d'erreur machine associé (ex. `ai_quota`, `ai_rate_limited`). */
  errorCode?: string;
}

/* ------------------------------- Contacts ------------------------------- */

export type ContactRequestStatus = 'pending' | 'accepted' | 'declined';

export interface Contact {
  id: UUID;
  profile: Profile;
  isOnline: boolean;
  createdAt: ISODateString;
}

export interface ContactRequest {
  id: UUID;
  fromProfile: Profile;
  toProfile: Profile;
  status: ContactRequestStatus;
  createdAt: ISODateString;
}

/* ------------------------------- Proximité ------------------------------ */

export interface NearbyUser {
  profileId: UUID;
  displayName: string;
  language: LanguageCode;
  /** Distance approximative en mètres, jamais de coordonnées GPS exactes. */
  approxDistanceM: number | null;
}
