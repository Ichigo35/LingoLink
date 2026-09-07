export interface Env {
  /** Chaîne de connexion Neon (endpoint pooler). */
  DATABASE_URL: string;
  /** Durable Object : une "room" temps réel par session de conversation. */
  SESSION_ROOM: DurableObjectNamespace;
  /** Secret de signature des sessions Better Auth. */
  BETTER_AUTH_SECRET: string;
  /** URL publique du backend (baseURL Better Auth). */
  BETTER_AUTH_URL: string;
  /** Scheme deep link de l'app mobile (pour trustedOrigins). */
  APP_SCHEME: string;
  /** Google OAuth — vide = fournisseur désactivé. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Clé Gemini (proxy transcription + traduction). */
  GEMINI_API_KEY?: string;
  /** Modèle Gemini (défaut : gemini-2.5-flash). */
  GEMINI_MODEL?: string;
}

export function hasGoogleOAuth(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}
