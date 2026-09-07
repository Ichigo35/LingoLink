import type { Kysely } from 'kysely';

import type { Database } from './db';
import type { Env } from './env';
import { notifyUser } from './inbox';
import type { LanguageCode } from './languages';
import { randomShortCode, randomToken } from './tokens';

const INVITE_SESSION_TTL_SECONDS = 900;

interface InviteProfile {
  id: string;
  username: string | null;
  displayName: string | null;
  preferredLanguage: string | null;
}

/**
 * Crée une session "waiting" et pousse une invitation temps réel dans la boîte
 * de réception du destinataire (utilisé par les contacts et la proximité).
 */
export async function createConversationInvite(
  env: Env,
  db: Kysely<Database>,
  opts: {
    from: InviteProfile;
    toId: string;
    fromLanguage: LanguageCode;
    toLanguage: LanguageCode;
    method: 'contact' | 'nearby';
  },
): Promise<{ sessionId: string; connectionToken: string }> {
  const sessionId = crypto.randomUUID();
  const token = randomToken();
  const now = new Date();
  await db
    .insertInto('conversation_sessions')
    .values({
      id: sessionId,
      creator_id: opts.from.id,
      participant_id: null,
      creator_language: opts.fromLanguage,
      participant_language: opts.toLanguage,
      method: opts.method,
      status: 'waiting',
      connection_token: token,
      short_code: randomShortCode(),
      expires_at: new Date(Date.now() + INVITE_SESSION_TTL_SECONDS * 1000),
      created_at: now,
      activated_at: null,
      ended_at: null,
    })
    .execute();

  void notifyUser(env, opts.toId, {
    type: 'conversation_invite',
    sessionId,
    connectionToken: token,
    from: {
      id: opts.from.id,
      username: opts.from.username,
      displayName: opts.from.displayName,
      preferredLanguage: opts.from.preferredLanguage,
    },
    creatorLanguage: opts.fromLanguage,
    participantLanguage: opts.toLanguage,
  });

  return { sessionId, connectionToken: token };
}
