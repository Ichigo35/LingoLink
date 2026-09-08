import type { Context } from 'hono';

import type { AppEnv } from './context';

/**
 * Applique un rate limit Cloudflare sur `key`. Renvoie une réponse 429 si la
 * limite est dépassée, sinon `null` (la requête peut continuer).
 *
 * Fail-open : si le limiteur lui-même échoue, on laisse passer — une panne
 * d'infra ne doit pas couper une conversation en cours.
 */
export async function enforceRateLimit(
  c: Context<AppEnv>,
  limiter: RateLimit,
  key: string,
): Promise<Response | null> {
  try {
    const { success } = await limiter.limit({ key });
    if (success) return null;
  } catch {
    return null;
  }
  return c.json(
    { code: 'rate_limited', message: 'Trop de requêtes — réessayez dans un instant.' },
    429,
  );
}
