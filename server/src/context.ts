import type { Kysely } from 'kysely';

import type { createAuth } from './auth';
import type { Database } from './db';
import type { Env } from './env';

export type AppVariables = {
  auth: ReturnType<typeof createAuth>;
  db: Kysely<Database>;
};

export type AppEnv = { Bindings: Env; Variables: AppVariables };
