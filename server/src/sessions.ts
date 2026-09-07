import type { Context } from 'hono';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { type Kysely, sql } from 'kysely';

import type { AppEnv } from './context';
import type { Database } from './db';
import { isLanguageCode } from './languages';

type AppContext = Context<AppEnv>;

const DEFAULT_TTL_SECONDS = 600;
const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 3600;
const CONNECTION_METHODS = ['qr', 'link', 'contact', 'nearby'];
const SHORT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

function randomShortCode(): string {
  const buf = crypto.getRandomValues(new Uint8Array(8));
  let out = '';
  for (const b of buf) out += SHORT_CODE_ALPHABET[b % SHORT_CODE_ALPHABET.length];
  return out;
}

function normalizeShortCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** "ABCD1234" -> "ABCD-1234" pour l'affichage. */
export function formatShortCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

async function requireUser(c: AppContext): Promise<{ id: string } | null> {
  const session = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
  return session?.user ? { id: session.user.id } : null;
}

type SessionRow = Database['conversation_sessions'];

function toDto(row: SessionRow, scheme: string) {
  return {
    id: row.id,
    creatorId: row.creator_id,
    participantId: row.participant_id,
    creatorLanguage: row.creator_language,
    participantLanguage: row.participant_language,
    method: row.method,
    status: row.status,
    connectionToken: row.connection_token,
    shortCode: formatShortCode(row.short_code),
    joinUrl: `${scheme}://join/${row.connection_token}`,
    expiresAt: toIso(row.expires_at),
    createdAt: toIso(row.created_at) as string,
    activatedAt: toIso(row.activated_at),
    endedAt: toIso(row.ended_at),
  };
}

function toIso(value: Date | string | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** Session visible par l'utilisateur = créateur OU participant. */
function ownSessionQuery(db: Kysely<Database>, sessionId: string, userId: string) {
  return db
    .selectFrom('conversation_sessions')
    .selectAll()
    .where('id', '=', sessionId)
    .where((eb) =>
      eb.or([eb('creator_id', '=', userId), eb('participant_id', '=', userId)]),
    );
}

export function registerSessionRoutes(app: Hono<AppEnv>) {
  // Création d'une session (le créateur).
  app.post('/api/sessions', async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);

    const body = await c.req.json().catch(() => ({}));
    const { creatorLanguage, participantLanguage } = body ?? {};
    const method: string = CONNECTION_METHODS.includes(body?.method) ? body.method : 'qr';
    if (!isLanguageCode(creatorLanguage) || !isLanguageCode(participantLanguage)) {
      return c.json({ code: 'invalid_language', message: 'Langues invalides' }, 400);
    }
    if (creatorLanguage === participantLanguage) {
      return c.json({ code: 'same_language', message: 'Les deux langues sont identiques' }, 400);
    }
    const ttl = Math.min(
      MAX_TTL_SECONDS,
      Math.max(MIN_TTL_SECONDS, Number(body?.ttlSeconds) || DEFAULT_TTL_SECONDS),
    );

    const row = await c
      .get('db')
      .insertInto('conversation_sessions')
      .values({
        id: crypto.randomUUID(),
        creator_id: user.id,
        participant_id: null,
        creator_language: creatorLanguage,
        participant_language: participantLanguage,
        method,
        status: 'waiting',
        connection_token: randomToken(),
        short_code: randomShortCode(),
        expires_at: new Date(Date.now() + ttl * 1000),
        created_at: new Date(),
        activated_at: null,
        ended_at: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return c.json({ session: toDto(row, c.env.APP_SCHEME) }, 201);
  });

  // Rejoindre via token (QR / lien) ou code court (saisie manuelle).
  app.post('/api/sessions/join', async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);

    const body = await c.req.json().catch(() => ({}));
    const token: string | null = typeof body?.token === 'string' ? body.token.trim() : null;
    const code: string | null =
      typeof body?.code === 'string' ? normalizeShortCode(body.code) : null;
    if (!token && !code) {
      return c.json({ code: 'missing_token', message: 'Token ou code requis' }, 400);
    }

    try {
      const res = await sql<SessionRow>`
        select * from join_conversation_session(${token}, ${code}, ${user.id})
      `.execute(c.get('db'));
      const row = res.rows[0];
      if (!row) throw new Error('join_failed');
      return c.json({ session: toDto(row, c.env.APP_SCHEME) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const map: Record<string, [ContentfulStatusCode, string]> = {
        not_found: [404, 'Session introuvable'],
        expired: [410, 'Cette invitation a expiré'],
        not_joinable: [409, 'Cette session n’est plus disponible'],
        own_session: [400, 'Vous ne pouvez pas rejoindre votre propre session'],
      };
      for (const key of Object.keys(map)) {
        if (msg.includes(key)) {
          const [status, message] = map[key];
          return c.json({ code: key, message }, status);
        }
      }
      return c.json({ code: 'join_failed', message: 'Impossible de rejoindre' }, 500);
    }
  });

  // Détail d'une session (créateur ou participant uniquement).
  app.get('/api/sessions/:id', async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    const id = c.req.param('id');
    if (!id) return c.json({ code: 'not_found', message: 'Session introuvable' }, 404);

    const db = c.get('db');
    let row = await ownSessionQuery(db, id, user.id).executeTakeFirst();
    if (!row) return c.json({ code: 'not_found', message: 'Session introuvable' }, 404);

    // Expiration paresseuse.
    if (row.status === 'waiting' && row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      row = await db
        .updateTable('conversation_sessions')
        .set({ status: 'expired' })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
    }
    return c.json({ session: toDto(row, c.env.APP_SCHEME) });
  });

  app.post('/api/sessions/:id/leave', (c) => endSession(c, false));
  app.post('/api/sessions/:id/end', (c) => endSession(c, true));
}

async function endSession(c: AppContext, creatorOnly: boolean) {
  const user = await requireUser(c);
  if (!user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
  const id = c.req.param('id');
  if (!id) return c.json({ code: 'not_found', message: 'Session introuvable' }, 404);

  const db = c.get('db');
  const row = await ownSessionQuery(db, id, user.id).executeTakeFirst();
  if (!row) return c.json({ code: 'not_found', message: 'Session introuvable' }, 404);
  if (creatorOnly && row.creator_id !== user.id) {
    return c.json({ code: 'forbidden', message: 'Seul le créateur peut terminer' }, 403);
  }

  if (row.status === 'ended' || row.status === 'expired') {
    return c.json({ session: toDto(row, c.env.APP_SCHEME) });
  }
  const updated = await db
    .updateTable('conversation_sessions')
    .set({ status: 'ended', ended_at: new Date() })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();
  return c.json({ session: toDto(updated, c.env.APP_SCHEME) });
}
