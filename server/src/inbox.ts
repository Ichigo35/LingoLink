import { Hono } from 'hono';

import type { AppEnv } from './context';
import type { Env } from './env';
import { mintTicket, verifyTicket } from './tickets';

/** Pousse un évènement JSON à toutes les connexions ouvertes d'un utilisateur. */
export async function notifyUser(env: Env, userId: string, event: unknown): Promise<void> {
  try {
    const stub = env.USER_INBOX.get(env.USER_INBOX.idFromName(userId));
    await stub.fetch('https://inbox/notify', { method: 'POST', body: JSON.stringify(event) });
  } catch {
    /* best-effort */
  }
}

export function registerInboxRoutes(app: Hono<AppEnv>) {
  app.post('/api/inbox/ticket', async (c) => {
    const session = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    const ticket = await mintTicket(c.env.BETTER_AUTH_SECRET, {
      sub: session.user.id,
      scope: 'inbox',
    });
    const wsBase = c.env.BETTER_AUTH_URL.replace(/^http/, 'ws').replace(/\/$/, '');
    return c.json({ ticket, wsUrl: `${wsBase}/api/inbox/rt` });
  });

  app.get('/api/inbox/rt', async (c) => {
    if (c.req.header('Upgrade') !== 'websocket') return c.text('expected websocket', 426);
    const claims = await verifyTicket(c.env.BETTER_AUTH_SECRET, c.req.query('ticket'));
    if (!claims || claims.scope !== 'inbox') return c.text('unauthorized', 401);
    const stub = c.env.USER_INBOX.get(c.env.USER_INBOX.idFromName(claims.sub));
    return stub.fetch(new Request('https://inbox/connect', c.req.raw));
  });
}
