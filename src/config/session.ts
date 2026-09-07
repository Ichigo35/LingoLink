/** Constantes et helpers pour les sessions de conversation (§11). */

export const SESSION_TTL_SECONDS = 600; // 10 min (cf. exemple du cahier des charges)
export const SESSION_POLL_INTERVAL_MS = 3000; // avant le temps réel (Phase 4)

const JOIN_PATH_RE = /(?:lingolink:\/\/join\/|\/join\/)([A-Za-z0-9_-]+)/;

/**
 * Extrait le token d'un contenu scanné : accepte le deep link
 * `lingolink://join/<token>`, une URL `.../join/<token>`, ou le token brut.
 */
export function extractJoinToken(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const m = value.match(JOIN_PATH_RE);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(value)) return value;
  return null;
}

/** "05:03" à partir d'un nombre de secondes. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Secondes restantes avant expiration (>= 0), ou null si pas d'expiration. */
export function secondsUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
}
