import { Pool } from '@neondatabase/serverless';
import { Kysely, PostgresDialect } from 'kysely';

import type { Env } from './env';

/**
 * Schéma minimal utilisé par les requêtes applicatives (hors Better Auth qui
 * gère ses propres tables). Étendu au fil des phases.
 */
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
}

export function createDialect(env: Env): PostgresDialect {
  return new PostgresDialect({
    pool: new Pool({ connectionString: env.DATABASE_URL }),
  });
}

export function createDb(env: Env): Kysely<Database> {
  return new Kysely<Database>({ dialect: createDialect(env) });
}
