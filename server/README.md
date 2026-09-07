# Backend Lingo Link — Cloudflare Worker (`lingolink-api`)

Le backend est le **seul** endroit qui détient des secrets. L'app mobile ne
parle jamais directement à Neon ni à Gemini.

## État

- ✅ **Phase 2** — Authentification (Better Auth) : mode invité (anonyme) +
  Google OAuth (activable), sessions, mise à jour du profil, dispo username.
- ⏳ Phase 3+ — sessions de conversation, tokens, temps réel (Durable Objects).
- ⏳ Phase 5 — proxy Gemini (`/api/ai/*`).

## Stack

- Cloudflare Workers + Hono (`src/index.ts`)
- **Better Auth** 1.7 (`src/auth.ts`) — plugins `expo()` + `anonymous()`
- Neon Postgres via Kysely + `@neondatabase/serverless` (`src/db.ts`)

## Endpoints

| Route | Rôle |
|-------|------|
| `GET /api/health` | ping |
| `GET /api/config` | `{ googleEnabled }` — l'app masque le bouton Google si false |
| `GET /api/profile/username-available?u=` | disponibilité d'un username |
| `* /api/auth/*` | Better Auth (sign-in/anonymous, social/google, get-session, update-user, sign-out…) |

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
- Migrations : `server/migrations/`. `0001_better_auth.sql` déjà appliqué.
- Régénérer le schéma auth : `npm run auth:generate` (après `set -a && . ./.dev.vars`).

Voir `DEPLOY.md` pour le déploiement.
