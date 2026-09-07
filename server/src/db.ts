import { Pool } from '@neondatabase/serverless';
import { Kysely, PostgresDialect } from 'kysely';

import type { Env } from './env';

/** Schéma utilisé par les requêtes applicatives (hors tables Better Auth). */
export interface Database {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    username: string | null;
    preferredLanguage: string | null;
    isAnonymous: boolean | null;
    createdAt: Date;
    updatedAt: Date;
  };
  conversation_sessions: {
    id: string;
    creator_id: string;
    participant_id: string | null;
    creator_language: string;
    participant_language: string;
    method: string;
    status: string;
    connection_token: string;
    short_code: string;
    expires_at: Date | null;
    created_at: Date;
    activated_at: Date | null;
    ended_at: Date | null;
  };
  conversation_messages: {
    id: string;
    session_id: string;
    sender_id: string;
    source_language: string;
    target_language: string;
    original_transcript: string;
    translated_text: string;
    status: string;
    client_id: string | null;
    created_at: Date;
    updated_at: Date;
  };
  contact_requests: {
    id: string;
    from_user: string;
    to_user: string;
    status: string;
    created_at: Date;
    updated_at: Date;
  };
  contacts: {
    user_id: string;
    contact_id: string;
    created_at: Date;
  };
  user_presence: {
    user_id: string;
    last_seen_at: Date;
  };
}

export function createDialect(env: Env): PostgresDialect {
  return new PostgresDialect({ pool: new Pool({ connectionString: env.DATABASE_URL }) });
}

/**
 * NOTE RLS : la RLS est activée sur `conversation_sessions` avec des policies
 * (voir migration 0002). Sur Neon, tous les rôles héritent de `neon_superuser`
 * qui a BYPASSRLS et il n'est pas possible de le retirer sur le plan gratuit —
 * les policies sont donc inertes en pratique. Le contrôle d'accès effectif est
 * assuré côté Worker : chaque endpoint filtre explicitement par
 * `creator_id = <user>` ou `participant_id = <user>`.
 */
