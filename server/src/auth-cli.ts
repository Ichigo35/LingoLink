/**
 * Config Better Auth statique, uniquement pour la CLI (`better-auth generate` /
 * `migrate`). Le runtime Workers utilise la fabrique de `auth.ts`.
 *
 * Nécessite `DATABASE_URL` dans l'environnement (charger `.dev.vars`).
 */
import { Pool } from '@neondatabase/serverless';
import { PostgresDialect } from 'kysely';

import { createAuth } from './auth';
import type { Env } from './env';

// SESSION_ROOM (Durable Object) n'est pas nécessaire pour la génération du schéma.
const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'cli-only-secret',
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? 'http://localhost:8787',
  APP_SCHEME: process.env.APP_SCHEME ?? 'lingolink',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
} as Env;

const dialect = new PostgresDialect({
  pool: new Pool({ connectionString: env.DATABASE_URL }),
});

export const auth = createAuth(env, dialect);
