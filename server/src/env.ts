export interface Env {
  /** Chaîne de connexion Neon (endpoint pooler). */
  DATABASE_URL: string;
  /** Secret de signature des sessions Better Auth. */
  BETTER_AUTH_SECRET: string;
  /** URL publique du backend (baseURL Better Auth). */
  BETTER_AUTH_URL: string;
  /** Scheme deep link de l'app mobile (pour trustedOrigins). */
  APP_SCHEME: string;
  /** Google OAuth — vide = fournisseur désactivé. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Clé Gemini — utilisée à partir de la Phase 5. */
  GEMINI_API_KEY?: string;
}

export function hasGoogleOAuth(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}
