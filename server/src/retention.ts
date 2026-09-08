import { Kysely } from 'kysely';

import { type Database, createDialect } from './db';
import type { Env } from './env';

/**
 * Purge de rétention (§ confidentialité / stockage minimal). Exécutée par le
 * trigger cron du Worker (voir `wrangler.jsonc` → `triggers.crons`).
 *
 * Rien de destructif sur des données vivantes : on ne touche qu'à ce qui est
 * déjà terminé, expiré ou abandonné depuis longtemps.
 *  1. sessions `active` sans activité depuis `ACTIVE_IDLE_HOURS`  → `ended`
 *  2. sessions `waiting` dont le QR/lien est expiré               → `expired`
 *  3. sessions `ended`/`expired` au-delà de `RETENTION_HOURS`     → DELETE
 *     (les `conversation_messages` partent en cascade — FK ON DELETE CASCADE)
 *  4. `nearby_presence` expirée                                   → DELETE
 *  5. `nearby_requests` (anti-spam) au-delà de `NEARBY_REQUEST_TTL_MINUTES` → DELETE
 */

const DEFAULT_RETENTION_HOURS = 24;
const MIN_RETENTION_HOURS = 1;
const MAX_RETENTION_HOURS = 24 * 30;
const ACTIVE_IDLE_HOURS = 24;
const NEARBY_REQUEST_TTL_MINUTES = 60;

export interface RetentionReport {
  ranAt: string;
  retentionHours: number;
  activeSessionsEnded: number;
  waitingSessionsExpired: number;
  sessionsDeleted: number;
  nearbyPresenceDeleted: number;
  nearbyRequestsDeleted: number;
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function runRetention(env: Env): Promise<RetentionReport> {
  const retentionHours = clampInt(
    env.RETENTION_HOURS,
    DEFAULT_RETENTION_HOURS,
    MIN_RETENTION_HOURS,
    MAX_RETENTION_HOURS,
  );
  const now = Date.now();
  const retentionCutoff = new Date(now - retentionHours * 3_600_000);
  const idleCutoff = new Date(now - ACTIVE_IDLE_HOURS * 3_600_000);
  const nearbyRequestCutoff = new Date(now - NEARBY_REQUEST_TTL_MINUTES * 60_000);

  const db = new Kysely<Database>({ dialect: createDialect(env) });
  try {
    // 1. Conversations laissées ouvertes puis abandonnées.
    const activeEnded = await db
      .updateTable('conversation_sessions')
      .set({ status: 'ended', ended_at: new Date() })
      .where('status', '=', 'active')
      .where('activated_at', '<', idleCutoff)
      .executeTakeFirst();

    // 2. Invitations jamais rejointes dont le délai est passé.
    const waitingExpired = await db
      .updateTable('conversation_sessions')
      .set({ status: 'expired' })
      .where('status', '=', 'waiting')
      .where('expires_at', '<', new Date(now))
      .executeTakeFirst();

    // 3. Purge des sessions terminées/expirées au-delà de la fenêtre de rétention.
    const sessionsDeleted = await db
      .deleteFrom('conversation_sessions')
      .where('status', 'in', ['ended', 'expired'])
      .where((eb) =>
        eb.or([
          eb('ended_at', '<', retentionCutoff),
          eb.and([eb('ended_at', 'is', null), eb('expires_at', '<', retentionCutoff)]),
        ]),
      )
      .executeTakeFirst();

    // 4. Présence "à proximité" expirée (opt-in, TTL court).
    const nearbyPresenceDeleted = await db
      .deleteFrom('nearby_presence')
      .where('expires_at', '<', new Date(now))
      .executeTakeFirst();

    // 5. Demandes "à proximité" (une par paire) au-delà du timeout anti-spam.
    const nearbyRequestsDeleted = await db
      .deleteFrom('nearby_requests')
      .where('created_at', '<', nearbyRequestCutoff)
      .executeTakeFirst();

    return {
      ranAt: new Date(now).toISOString(),
      retentionHours,
      activeSessionsEnded: Number(activeEnded.numUpdatedRows ?? 0n),
      waitingSessionsExpired: Number(waitingExpired.numUpdatedRows ?? 0n),
      sessionsDeleted: Number(sessionsDeleted.numDeletedRows ?? 0n),
      nearbyPresenceDeleted: Number(nearbyPresenceDeleted.numDeletedRows ?? 0n),
      nearbyRequestsDeleted: Number(nearbyRequestsDeleted.numDeletedRows ?? 0n),
    };
  } finally {
    await db.destroy();
  }
}
