import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Kysely } from 'kysely';

import { registerAiRoutes } from './ai';
import { createAuth } from './auth';
import { registerContactRoutes } from './contacts';
import type { AppEnv } from './context';
import { type Database, createDialect } from './db';
import { hasGoogleOAuth } from './env';
import { registerInboxRoutes } from './inbox';
import { registerMessageRoutes } from './messages';
import { registerNearbyRoutes } from './nearby';
import { registerRealtimeRoutes } from './realtime';
import { registerSessionRoutes } from './sessions';

export { SessionRoom } from './session-room';
export { UserInbox } from './user-inbox';

const app = new Hono<AppEnv>();

app.use(
  '*',
  cors({
    origin: (origin) => origin ?? '*',
    allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
);

// Instancie Better Auth + Kysely par requête (contexte Workers).
app.use('*', async (c, next) => {
  const dialect = createDialect(c.env);
  c.set('auth', createAuth(c.env, dialect));
  c.set('db', new Kysely<Database>({ dialect }));
  await next();
});

app.get('/api/health', (c) => c.json({ ok: true, service: 'lingolink-api' }));

app.get('/api/config', (c) =>
  c.json({ googleEnabled: hasGoogleOAuth(c.env), aiEnabled: Boolean(c.env.GEMINI_API_KEY) }),
);

/** Disponibilité d'un username (3–20 caractères, a-z 0-9 _). */
app.get('/api/profile/username-available', async (c) => {
  const raw = (c.req.query('u') ?? '').toLowerCase().trim();
  if (!/^[a-z0-9_]{3,20}$/.test(raw)) {
    return c.json({ available: false, reason: 'format' as const });
  }
  const existing = await c
    .get('db')
    .selectFrom('user')
    .select('id')
    .where('username', '=', raw)
    .executeTakeFirst();
  return c.json({ available: !existing, reason: existing ? ('taken' as const) : null });
});

registerSessionRoutes(app);
registerRealtimeRoutes(app);
registerAiRoutes(app);
registerMessageRoutes(app);
registerInboxRoutes(app);
registerContactRoutes(app);
registerNearbyRoutes(app);

// Toutes les routes Better Auth (session, social, anonymous, update-user, ...).
app.on(['GET', 'POST'], '/api/auth/*', (c) => c.get('auth').handler(c.req.raw));

app.notFound((c) => c.json({ code: 'not_found', message: 'Route inconnue' }, 404));

export default app;
