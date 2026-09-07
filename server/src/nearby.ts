import type { Context } from 'hono';
import { Hono } from 'hono';
import { sql } from 'kysely';

import type { AppEnv } from './context';
import { createConversationInvite } from './invites';
import { isLanguageCode } from './languages';

const DEFAULT_TTL_SECONDS = 300;
const MAX_TTL_SECONDS = 900;
/** Rayon de découverte. */
const RADIUS_M = 500;
/** Anti-spam : délai minimal entre deux demandes vers la même personne. */
const REQUEST_COOLDOWN_MS = 120_000;
const COORD_PRECISION = 3; // ~110 m

function round(n: number): number {
  const f = 10 ** COORD_PRECISION;
  return Math.round(n * f) / f;
}

/** Distance approx (équirectangulaire, suffisant à courte portée). */
function approxDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const x = ((lng2 - lng1) * Math.PI) / 180 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  const y = ((lat2 - lat1) * Math.PI) / 180;
  return Math.round(Math.sqrt(x * x + y * y) * R);
}

/** Bucket pour ne jamais révéler une distance précise. */
function distanceBucket(m: number): number {
  if (m <= 30) return 20;
  if (m <= 75) return 50;
  if (m <= 150) return 100;
  if (m <= 300) return 200;
  return 500;
}

async function me(c: Context<AppEnv>) {
  const session = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
  return session?.user ? { id: session.user.id } : null;
}

function parseCoord(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && Math.abs(n) <= 180 ? n : null;
}

export function registerNearbyRoutes(app: Hono<AppEnv>) {
  // Devenir visible (opt-in explicite).
  app.post('/api/nearby/visible', async (c) => {
    const user = await me(c);
    if (!user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    const body = await c.req.json().catch(() => ({}));
    const lat = parseCoord(body?.lat);
    const lng = parseCoord(body?.lng);
    if (lat == null || lng == null) {
      return c.json({ code: 'invalid_location', message: 'Position invalide' }, 400);
    }
    const ttl = Math.min(MAX_TTL_SECONDS, Math.max(60, Number(body?.ttlSeconds) || DEFAULT_TTL_SECONDS));
    await sql`
      insert into nearby_presence (user_id, lat, lng, updated_at, expires_at)
      values (${user.id}, ${round(lat)}, ${round(lng)}, now(), now() + ${sql.raw(`interval '${ttl} seconds'`)})
      on conflict (user_id) do update set lat = excluded.lat, lng = excluded.lng,
        updated_at = now(), expires_at = excluded.expires_at
    `.execute(c.get('db'));
    return c.json({ visible: true, expiresInSeconds: ttl });
  });

  // Redevenir invisible.
  app.delete('/api/nearby/visible', async (c) => {
    const user = await me(c);
    if (!user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    await c.get('db').deleteFrom('nearby_presence').where('user_id', '=', user.id).execute();
    return c.json({ visible: false });
  });

  // Personnes visibles autour (distance en bucket, jamais de coordonnées).
  app.get('/api/nearby', async (c) => {
    const user = await me(c);
    if (!user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    const lat = parseCoord(c.req.query('lat'));
    const lng = parseCoord(c.req.query('lng'));
    if (lat == null || lng == null) {
      return c.json({ code: 'invalid_location', message: 'Position invalide' }, 400);
    }
    // Boîte englobante large (~0.01° ≈ 1,1 km) puis filtrage précis.
    const rows = await sql<{
      id: string;
      name: string | null;
      username: string | null;
      preferredLanguage: string | null;
      lat: number;
      lng: number;
    }>`
      select u.id, u.name, u.username, u."preferredLanguage", p.lat, p.lng
      from nearby_presence p
      join "user" u on u.id = p.user_id
      where p.expires_at > now()
        and p.user_id <> ${user.id}
        and p.lat between ${lat - 0.01} and ${lat + 0.01}
        and p.lng between ${lng - 0.01} and ${lng + 0.01}
      limit 100
    `.execute(c.get('db'));

    const users = rows.rows
      .map((r) => ({
        profileId: r.id,
        displayName: r.name && r.name !== 'Anonymous' ? r.name : (r.username ?? 'Quelqu’un'),
        language: r.preferredLanguage,
        distanceM: approxDistanceM(lat, lng, r.lat, r.lng),
      }))
      .filter((u) => u.distanceM <= RADIUS_M)
      .map((u) => ({
        profileId: u.profileId,
        displayName: u.displayName,
        language: u.language,
        approxDistanceM: distanceBucket(u.distanceM),
      }))
      .sort((a, b) => a.approxDistanceM - b.approxDistanceM);

    return c.json({ users });
  });

  // Demander une conversation à une personne à proximité.
  app.post('/api/nearby/:profileId/request', async (c) => {
    const user = await me(c);
    if (!user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    const target = c.req.param('profileId');
    if (!target || target === user.id) {
      return c.json({ code: 'invalid_target', message: 'Cible invalide' }, 400);
    }
    const db = c.get('db');

    // La cible doit être visible actuellement.
    const visible = await db
      .selectFrom('nearby_presence')
      .select('user_id')
      .where('user_id', '=', target)
      .where('expires_at', '>', sql<Date>`now()`)
      .executeTakeFirst();
    if (!visible) {
      return c.json({ code: 'not_visible', message: 'Cette personne n’est plus disponible' }, 404);
    }

    // Anti-spam : une demande par paire toutes les 2 min.
    const recent = await db
      .selectFrom('nearby_requests')
      .select('created_at')
      .where('from_user', '=', user.id)
      .where('to_user', '=', target)
      .executeTakeFirst();
    if (recent) {
      const age = Date.now() - new Date(recent.created_at).getTime();
      if (age < REQUEST_COOLDOWN_MS) {
        return c.json({ code: 'too_soon', message: 'Demande déjà envoyée récemment' }, 429);
      }
      await db
        .deleteFrom('nearby_requests')
        .where('from_user', '=', user.id)
        .where('to_user', '=', target)
        .execute();
    }

    const [meRow, otherRow] = await Promise.all([
      db.selectFrom('user').select(['id', 'name', 'username', 'preferredLanguage']).where('id', '=', user.id).executeTakeFirst(),
      db.selectFrom('user').select(['preferredLanguage']).where('id', '=', target).executeTakeFirst(),
    ]);
    const myLang = meRow?.preferredLanguage;
    const otherLang = otherRow?.preferredLanguage;
    if (!isLanguageCode(myLang) || !isLanguageCode(otherLang)) {
      return c.json({ code: 'missing_language', message: 'Langue préférée manquante' }, 400);
    }
    if (myLang === otherLang) {
      return c.json({ code: 'same_language', message: 'Vous parlez la même langue' }, 400);
    }

    await db
      .insertInto('nearby_requests')
      .values({ from_user: user.id, to_user: target, created_at: new Date() })
      .onConflict((oc) => oc.columns(['from_user', 'to_user']).doUpdateSet({ created_at: new Date() }))
      .execute();

    const { sessionId } = await createConversationInvite(c.env, db, {
      from: {
        id: user.id,
        username: meRow?.username ?? null,
        displayName: meRow?.name && meRow.name !== 'Anonymous' ? meRow.name : null,
        preferredLanguage: myLang,
      },
      toId: target,
      fromLanguage: myLang,
      toLanguage: otherLang,
      method: 'nearby',
    });

    return c.json({ sessionId });
  });
}
