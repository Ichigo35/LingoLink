/**
 * Accès typé aux variables d'environnement publiques.
 *
 * RÈGLE DE SÉCURITÉ : seules les variables préfixées `EXPO_PUBLIC_` sont
 * embarquées dans l'app. Aucune clé secrète (Gemini, connexion Neon, secrets
 * OAuth) ne doit jamais transiter par ce fichier — elles vivent uniquement
 * côté backend (Cloudflare Worker). Voir `server/README.md`.
 */

function required(name: string, value: string | undefined, fallback?: string): string {
  if (value && value.length > 0) return value;
  if (fallback !== undefined) return fallback;
  if (__DEV__) {
    console.warn(`[env] Variable manquante: ${name} — utilisation d'une valeur vide.`);
    return '';
  }
  throw new Error(`[env] Variable d'environnement requise absente: ${name}`);
}

export const env = {
  /** URL de base de l'API backend (Cloudflare Worker). */
  apiBaseUrl: required(
    'EXPO_PUBLIC_API_BASE_URL',
    process.env.EXPO_PUBLIC_API_BASE_URL,
    'http://localhost:8787',
  ),
  /** Environnement logique de l'app. */
  appEnv: (process.env.EXPO_PUBLIC_APP_ENV as 'development' | 'staging' | 'production') ?? 'development',
} as const;

export const isDev = env.appEnv === 'development';
