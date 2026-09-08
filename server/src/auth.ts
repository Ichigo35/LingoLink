import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { anonymous, bearer } from 'better-auth/plugins';
import type { Dialect } from 'kysely';

import type { Env } from './env';
import { hasGoogleOAuth } from './env';

/**
 * Fabrique l'instance Better Auth pour une requête donnée.
 *
 * - `anonymous()` : mode invité (§12) — `signIn.anonymous()` côté app.
 * - `expo()` : gère le flux OAuth natif + le stockage des cookies dans l'app.
 * - Google : activé uniquement si les identifiants sont fournis.
 */
export function createAuth(env: Env, dialect: Dialect) {
  const isDev =
    env.BETTER_AUTH_URL.includes('localhost') || env.BETTER_AUTH_URL.includes('127.0.0.1');
  const devOrigins = isDev
    ? ['exp://', 'exp://192.168.*.*:*/**', 'exp://10.*.*.*:*/**', 'http://localhost:*']
    : [];
  const webOrigins = env.WEB_APP_URL ? [env.WEB_APP_URL] : [];

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: { dialect, type: 'postgres' },
    trustedOrigins: [`${env.APP_SCHEME}://`, ...webOrigins, ...devOrigins],
    emailAndPassword: { enabled: false },
    user: {
      additionalFields: {
        username: { type: 'string', required: false, input: true },
        preferredLanguage: { type: 'string', required: false, input: true },
      },
    },
    socialProviders: hasGoogleOAuth(env)
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID as string,
            clientSecret: env.GOOGLE_CLIENT_SECRET as string,
          },
        }
      : {},
    plugins: [expo(), anonymous(), bearer()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
