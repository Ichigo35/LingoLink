# Backend Lingo Link — Cloudflare Worker

> Statut : **non implémenté** (arrive en Phase 3–5). Ce dossier documente
> l'architecture cible pour que l'app puisse s'y brancher dès maintenant.

## Rôle

Le backend est le **seul** endroit qui détient des secrets. L'app mobile ne
parle jamais directement à Neon ni à Gemini.

Responsabilités :

1. **Proxy Gemini** (`/ai/*`) — transcription + traduction. La clé
   `GEMINI_API_KEY` vit uniquement ici (secret Cloudflare / `.dev.vars`).
2. **Sessions** (`/sessions/*`) — création, génération et validation des
   tokens de connexion (aléatoires, opaques, avec expiration), jointure.
3. **Temps réel** — un **Durable Object** par session = room WebSocket
   (présence, messages, statut, fin de conversation).
4. **Accès base de données** — requêtes SQL vers Neon (Postgres) via le
   driver `@neondatabase/serverless`, avec application des règles d'accès.

## Stack cible

- Cloudflare Workers + Durable Objects (`wrangler`)
- `@neondatabase/serverless` pour Neon
- Auth : vérification des JWT Neon Auth (Google OAuth) + sessions invité

## Secrets (jamais commités)

| Nom | Où | Description |
|-----|-----|-------------|
| `GEMINI_API_KEY` | `server/.dev.vars` (local) / `wrangler secret` (prod) | Clé Google Gemini |
| `DATABASE_URL` | idem | Chaîne de connexion Neon (rôle applicatif) |
| `SESSION_TOKEN_SECRET` | idem | Secret HMAC pour signer/valider les tokens |

## Base de données

- Projet Neon : **LingoLink** (`proud-mountain-72949074`, région `aws-eu-central-1`, PG 17)
- Migrations SQL : `server/migrations/` (Phase 3)
