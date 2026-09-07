import type { Context } from 'hono';
import { Hono } from 'hono';
import { type Kysely, sql } from 'kysely';

import type { AppEnv } from './context';
import type { Database } from './db';
import { notifyUser } from './inbox';
import { isLanguageCode } from './languages';
import { randomShortCode, randomToken } from './tokens';

const ONLINE_WINDOW = "interval '90 seconds'";
const SESSION_TTL_SECONDS = 900;

interface Profile {
  id: string;
  username: string | null;
  displayName: string | null;
  preferredLanguage: string | null;
}

function profileFrom(row: {
  id: string;
  username: string | null;
  name: string | null;
  preferredLanguage: string | null;
}): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.name && row.name !== 'Anonymous' ? row.name : null,
    preferredLanguage: row.preferredLanguage,
  };
}

async function me(c: Context<AppEnv>) {
  const session = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
  return session?.user ? { id: session.user.id } : null;
}

async function myUserRow(db: Kysely<Database>, id: string) {
  return db
    .selectFrom('user')
    .select(['id', 'username', 'name', 'preferredLanguage'])
    .where('id', '=', id)
    .executeTakeFirst();
}

const rand = () => crypto.randomUUID();

export function registerContactRoutes(app: Hono<AppEnv>) {
  // Heartbeat de présence.
  app.post('/api/presence/ping', async (c) => {
    const user = await me(c);
    if (!user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    await sql`
      insert into user_presence (user_id, last_seen_at) values (${user.id}, now())
      on conflict (user_id) do update set last_seen_at = now()
    `.execute(c.get('db'));
    return c.json({ ok: true });
  });

  // Recherche d'un utilisateur par username.
  app.get('/api/users/search', async (c) => {
    const user = await me(c);
    if (!user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    const q = (c.req.query('q') ?? '').toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    if (q.length < 3) return c.json({ users: [] });

    const db = c.get('db');
    const rows = await db
      .selectFrom('user')
      .leftJoin('contacts', (join) =>
        join.onRef('contacts.contact_id', '=', 'user.id').on('contacts.user_id', '=', user.id),
      )
      .select(['user.id', 'user.username', 'user.name', 'user.preferredLanguage'])
      .where('user.username', 'like', `${q}%`)
      .where('user.id', '!=', user.id)
      .where('contacts.user_id', 'is', null)
      .limit(20)
      .execute();
    return c.json({ users: rows.map(profileFrom) });
  });

  // Liste des contacts + statut en ligne.
  app.get('/api/contacts', async (c) => {
    const user = await me(c);
    if (!user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    const rows = await sql<{
      id: string;
      username: string | null;
      name: string | null;
      preferredLanguage: string | null;
      online: boolean;
      created_at: Date;
    }>`
      select u.id, u.username, u.name, u."preferredLanguage",
             coalesce(p.last_seen_at > now() - ${sql.raw(ONLINE_WINDOW)}, false) as online,
             ct.created_at
      from contacts ct
      join "user" u on u.id = ct.contact_id
      left join user_presence p on p.user_id = u.id
      where ct.user_id = ${user.id}
      order by online desc, u.name asc
    `.execute(c.get('db'));
    return c.json({
      contacts: rows.rows.map((r) => ({
        ...profileFrom(r),
        isOnline: r.online,
        createdAt: (r.created_at instanceof Date ? r.created_at : new Date(r.created_at)).toISOString(),
      })),
    });
  });

  app.delete('/api/contacts/:contactId', async (c) => {
    const user = await me(c);
    if (!user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    const other = c.req.param('contactId');
    await c
      .get('db')
      .deleteFrom('contacts')
      .where((eb) =>
        eb.or([
          eb.and([eb('user_id', '=', user.id), eb('contact_id', '=', other)]),
          eb.and([eb('user_id', '=', other), eb('contact_id', '=', user.id)]),
        ]),
      )
      .execute();
    return c.json({ ok: true });
  });

  // Demandes de contact reçues (en attente).
  app.get('/api/contacts/requests', async (c) => {
    const user = await me(c);
    if (!user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    const db = c.get('db');
    const rows = await db
      .selectFrom('contact_requests as r')
      .innerJoin('user as u', 'u.id', 'r.from_user')
      .select([
        'r.id as id',
        'r.created_at as created_at',
        'u.id as fromId',
        'u.username as username',
        'u.name as name',
        'u.preferredLanguage as preferredLanguage',
      ])
      .where('r.to_user', '=', user.id)
      .where('r.status', '=', 'pending')
      .orderBy('r.created_at', 'desc')
      .execute();
    return c.json({
      requests: rows.map((r) => ({
        id: r.id,
        createdAt: (r.created_at instanceof Date ? r.created_at : new Date(r.created_at)).toISOString(),
        from: profileFrom({
          id: r.fromId,
          username: r.username,
          name: r.name,
          preferredLanguage: r.preferredLanguage,
        }),
      })),
    });
  });

  // Envoyer une demande de contact (par username).
  app.post('/api/contacts/requests', async (c) => {
    const user = await me(c);
    if (!user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    const db = c.get('db');
    const meRow = await myUserRow(db, user.id);
    if (!meRow?.username) {
      return c.json({ code: 'no_username', message: 'Choisissez d’abord un nom d’utilisateur' }, 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const username = String(body?.username ?? '').toLowerCase().trim();
    const target = await db
      .selectFrom('user')
      .select(['id'])
      .where('username', '=', username)
      .executeTakeFirst();
    if (!target) return c.json({ code: 'user_not_found', message: 'Utilisateur introuvable' }, 404);
    if (target.id === user.id) {
      return c.json({ code: 'self', message: 'C’est vous' }, 400);
    }

    const already = await db
      .selectFrom('contacts')
      .select('user_id')
      .where('user_id', '=', user.id)
      .where('contact_id', '=', target.id)
      .executeTakeFirst();
    if (already) return c.json({ code: 'already_contact', message: 'Déjà dans vos contacts' }, 409);

    // Demande inverse déjà en attente -> acceptation automatique.
    const reverse = await db
      .selectFrom('contact_requests')
      .selectAll()
      .where('from_user', '=', target.id)
      .where('to_user', '=', user.id)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (reverse) {
      await acceptRequest(db, reverse.id, user.id);
      void notifyUser(c.env, target.id, { type: 'contact_accepted', by: user.id });
      return c.json({ status: 'accepted' });
    }

    const existing = await db
      .selectFrom('contact_requests')
      .select('id')
      .where('from_user', '=', user.id)
      .where('to_user', '=', target.id)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (existing) return c.json({ status: 'pending' });

    await db
      .insertInto('contact_requests')
      .values({
        id: rand(),
        from_user: user.id,
        to_user: target.id,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();
    void notifyUser(c.env, target.id, {
      type: 'contact_request',
      from: profileFrom(meRow),
    });
    return c.json({ status: 'pending' });
  });

  app.post('/api/contacts/requests/:id/accept', async (c) => {
    const user = await me(c);
    if (!user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    const db = c.get('db');
    const req = await db
      .selectFrom('contact_requests')
      .selectAll()
      .where('id', '=', c.req.param('id'))
      .where('to_user', '=', user.id)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (!req) return c.json({ code: 'not_found', message: 'Demande introuvable' }, 404);
    await acceptRequest(db, req.id, user.id);
    void notifyUser(c.env, req.from_user, { type: 'contact_accepted', by: user.id });
    return c.json({ ok: true });
  });

  app.post('/api/contacts/requests/:id/decline', async (c) => {
    const user = await me(c);
    if (!user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    await c
      .get('db')
      .updateTable('contact_requests')
      .set({ status: 'declined', updated_at: new Date() })
      .where('id', '=', c.req.param('id'))
      .where('to_user', '=', user.id)
      .where('status', '=', 'pending')
      .execute();
    return c.json({ ok: true });
  });

  // Démarrage rapide d'une conversation avec un contact.
  app.post('/api/contacts/:contactId/conversation', async (c) => {
    const user = await me(c);
    if (!user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    const db = c.get('db');
    const other = c.req.param('contactId');

    const link = await db
      .selectFrom('contacts')
      .select('user_id')
      .where('user_id', '=', user.id)
      .where('contact_id', '=', other)
      .executeTakeFirst();
    if (!link) return c.json({ code: 'not_contact', message: 'Ce n’est pas un contact' }, 404);

    const [meRow, otherRow] = await Promise.all([myUserRow(db, user.id), myUserRow(db, other)]);
    const myLang = meRow?.preferredLanguage;
    const otherLang = otherRow?.preferredLanguage;
    if (!isLanguageCode(myLang) || !isLanguageCode(otherLang)) {
      return c.json({ code: 'missing_language', message: 'Langue préférée manquante' }, 400);
    }
    if (myLang === otherLang) {
      return c.json({ code: 'same_language', message: 'Vous parlez la même langue' }, 400);
    }

    const sessionId = rand();
    const token = randomToken();
    const now = new Date();
    await db
      .insertInto('conversation_sessions')
      .values({
        id: sessionId,
        creator_id: user.id,
        participant_id: null,
        creator_language: myLang,
        participant_language: otherLang,
        method: 'contact',
        status: 'waiting',
        connection_token: token,
        short_code: randomShortCode(),
        expires_at: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
        created_at: now,
        activated_at: null,
        ended_at: null,
      })
      .execute();

    void notifyUser(c.env, other, {
      type: 'conversation_invite',
      sessionId,
      connectionToken: token,
      from: profileFrom(meRow!),
      creatorLanguage: myLang,
      participantLanguage: otherLang,
    });

    return c.json({ sessionId });
  });
}

async function acceptRequest(db: Kysely<Database>, requestId: string, accepterId: string) {
  const req = await db
    .selectFrom('contact_requests')
    .selectAll()
    .where('id', '=', requestId)
    .executeTakeFirst();
  if (!req) return;
  await db
    .updateTable('contact_requests')
    .set({ status: 'accepted', updated_at: new Date() })
    .where('id', '=', requestId)
    .execute();
  const now = new Date();
  await db
    .insertInto('contacts')
    .values([
      { user_id: req.from_user, contact_id: req.to_user, created_at: now },
      { user_id: req.to_user, contact_id: req.from_user, created_at: now },
    ])
    .onConflict((oc) => oc.columns(['user_id', 'contact_id']).doNothing())
    .execute();
  void accepterId;
}
