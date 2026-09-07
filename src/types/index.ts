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
  method: ConnectionMethod;
  expiresAt: ISODateString | null;
  createdAt: ISODateString;
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
  createdAt: ISODateString;
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
