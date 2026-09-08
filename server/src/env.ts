export interface Env {
  /** Chaîne de connexion Neon (endpoint pooler). */
  DATABASE_URL: string;
  /** Durable Object : une "room" temps réel par session de conversation. */
  SESSION_ROOM: DurableObjectNamespace;
  /** Durable Object : une boîte de réception temps réel par utilisateur. */
  USER_INBOX: DurableObjectNamespace;
  /** Rate limiter du pipeline vocal (POST /api/sessions/:id/messages). */
  MSG_RATE_LIMITER: RateLimit;
  /** Rate limiter des routes /api/ai/* (test / traduction texte). */
  AI_RATE_LIMITER: RateLimit;
  /** Secret de signature des sessions Better Auth. */
  BETTER_AUTH_SECRET: string;
  /** URL publique du backend (baseURL Better Auth). */
  BETTER_AUTH_URL: string;
  /** Scheme deep link de l'app mobile (pour trustedOrigins). */
  APP_SCHEME: string;
  /** URL de la version web (Cloudflare Pages) — page de rebond + trustedOrigins. */
  WEB_APP_URL?: string;
  /** Google OAuth — vide = fournisseur désactivé. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Clé Gemini (proxy transcription + traduction). */
  GEMINI_API_KEY?: string;
  /**
   * Chaîne de modèles Gemini, séparés par des virgules. Essayés dans l'ordre ;
   * quand un modèle a épuisé son quota du jour, on passe au suivant.
   * Défaut : voir DEFAULT_MODEL_CHAIN dans gemini.ts.
   */
  GEMINI_MODEL?: string;
  /** Rétention des sessions terminées/expirées, en heures (défaut 24, borné 1..720). */
  RETENTION_HOURS?: string;
}

export function hasGoogleOAuth(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}
