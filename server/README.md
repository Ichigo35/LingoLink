# Backend Lingo Link — Cloudflare Worker (`lingolink-api`)

Le backend est le **seul** endroit qui détient des secrets. L'app mobile ne
parle jamais directement à Neon ni à Gemini.

## État

- ✅ **Phase 2** — Authentification (Better Auth) : mode invité (anonyme) +
  Google OAuth, sessions, mise à jour du profil, dispo username.
- ✅ **Phase 3** — Sessions de conversation : `/api/sessions*` (voir table).
  Contrôle d'accès appliqué côté Worker (`ownSessionQuery`). RLS activée sur
  `conversation_sessions` mais inerte sur Neon (BYPASSRLS hérité).
- ✅ **Phase 4** — Temps réel : Durable Object `SessionRoom` (`src/session-room.ts`),
  auth par ticket HMAC (`src/tickets.ts`), routes `src/realtime.ts`.
- ⏳ Phase 5 — proxy Gemini (`/api/ai/*`).

## Stack

- Cloudflare Workers + Hono (`src/index.ts`)
- **Better Auth** 1.7 (`src/auth.ts`) — plugins `expo()` + `anonymous()`
- Neon Postgres via Kysely + `@neondatabase/serverless` (`src/db.ts`)
- **Durable Objects** (SQLite, éligible plan gratuit) — 1 `SessionRoom` par session,
  API WebSocket Hibernation. Le déploiement applique la migration DO tout seul.

## Endpoints

| Route | Rôle |
|-------|------|
| `GET /api/health` | ping |
| `GET /api/config` | `{ googleEnabled }` — l'app masque le bouton Google si false |
| `GET /api/profile/username-available?u=` | disponibilité d'un username |
| `POST /api/sessions` | crée une session (auth) → token + code court + `joinUrl` |
| `POST /api/sessions/join` | rejoint via `{token}` ou `{code}` (auth) |
| `GET /api/sessions/:id` | détail (créateur ou participant) |
| `POST /api/sessions/:id/leave` | quitter → session `ended` |
| `POST /api/sessions/:id/end` | terminer (créateur uniquement) |
| `POST /api/sessions/:id/realtime-ticket` | ticket HMAC court + `wsUrl` |
| `GET /api/rt/:id?ticket=` | upgrade WebSocket → Durable Object `SessionRoom` |
| `* /api/auth/*` | Better Auth (sign-in/anonymous, social/google, get-session, update-user, sign-out…) |

### Évènements WebSocket (serveur → client)

- `{ type: 'presence', participants: [{ id, role, online }] }`
- `{ type: 'session_status', session: <dto> }` (poussé sur join / leave / end)
- `{ type: 'message' | 'message_update', message }` (relais pair-à-pair, Phase 6)

Client → serveur : `{ type: 'ping' }`, `{ type: 'message' | 'message_update', message }`.

## Secrets (`.dev.vars` en local — gitignored ; `wrangler secret put` en prod)

| Nom | Description |
|-----|-------------|
| `DATABASE_URL` | Connexion Neon (endpoint `-pooler`) |
| `BETTER_AUTH_SECRET` | Secret de signature des sessions |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google (vide = fournisseur désactivé) |
| `GEMINI_API_KEY` | Clé Gemini (Phase 5) |

Variable publique : `BETTER_AUTH_URL` (dans `wrangler.jsonc`) = URL publique du Worker.

## Base de données

- Projet Neon : **LingoLink** (`proud-mountain-72949074`, `aws-eu-central-1`, PG 17)
- Migrations : `server/migrations/` (`0001_better_auth.sql`, `0002_sessions.sql`) — déjà appliquées.
- Régénérer le schéma auth : `npm run auth:generate` (après `set -a && . ./.dev.vars`).

Voir `DEPLOY.md` pour le déploiement.
