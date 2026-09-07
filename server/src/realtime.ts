import { Hono } from 'hono';

import type { AppEnv } from './context';
import type { Env } from './env';
import { mintTicket, verifyTicket } from './tickets';

/** Pousse un évènement JSON à tous les clients connectés à la room d'une session. */
export async function notifyRoom(env: Env, sessionId: string, event: unknown): Promise<void> {
  try {
    const stub = env.SESSION_ROOM.get(env.SESSION_ROOM.idFromName(sessionId));
    await stub.fetch('https://room/notify', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  } catch {
    /* la diffusion temps réel est best-effort */
  }
}

export function registerRealtimeRoutes(app: Hono<AppEnv>) {
  // Ticket court pour ouvrir la connexion WebSocket (auth par cookie).
  app.post('/api/sessions/:id/realtime-ticket', async (c) => {
    const session = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) {
      return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    }
    const id = c.req.param('id');
    if (!id) return c.json({ code: 'not_found', message: 'Session introuvable' }, 404);

    const row = await c
      .get('db')
      .selectFrom('conversation_sessions')
      .select(['creator_id', 'participant_id'])
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row || (row.creator_id !== session.user.id && row.participant_id !== session.user.id)) {
      return c.json({ code: 'not_found', message: 'Session introuvable' }, 404);
    }

    const role = row.creator_id === session.user.id ? 'creator' : 'participant';
    const ticket = await mintTicket(c.env.BETTER_AUTH_SECRET, {
      sub: session.user.id,
      scope: `s:${id}`,
      role,
    });
    const wsBase = c.env.BETTER_AUTH_URL.replace(/^http/, 'ws').replace(/\/$/, '');
    return c.json({ ticket, wsUrl: `${wsBase}/api/rt/${id}` });
  });

  // Upgrade WebSocket -> routé vers le Durable Object de la session.
  app.get('/api/rt/:id', async (c) => {
    if (c.req.header('Upgrade') !== 'websocket') {
      return c.text('expected websocket', 426);
    }
    const id = c.req.param('id');
    const claims = await verifyTicket(c.env.BETTER_AUTH_SECRET, c.req.query('ticket'));
    if (!claims || claims.scope !== `s:${id}`) {
      return c.text('unauthorized', 401);
    }
    const stub = c.env.SESSION_ROOM.get(c.env.SESSION_ROOM.idFromName(id));
    const doReq = new Request(
      `https://room/connect?uid=${encodeURIComponent(claims.sub)}&role=${claims.role}`,
      c.req.raw,
    );
    return stub.fetch(doReq);
  });
}
