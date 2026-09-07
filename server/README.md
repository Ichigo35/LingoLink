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
- ✅ **Phase 5** — Proxy Gemini : `src/gemini.ts` (client REST + streaming + retry),
  `src/ai.ts` (`TranslationProvider` abstrait + `GeminiProvider`, routes `/api/ai/*`).
- ✅ **Phase 6** — Conversation : `src/messages.ts` (`/api/sessions/:id/messages`),
  transcription + traduction **streamées** vers la room DO (`message` /
  `message_update`). Modèle `gemini-3.5-flash`. Migration `0003_messages.sql`.
- ✅ **Phase 7** — Lien d'invitation : `GET /api/sessions/lookup` (aperçu public).
- ✅ **Phase 8** — Contacts : `src/contacts.ts`, Durable Object `UserInbox`
  (`src/user-inbox.ts`, `src/inbox.ts`) pour les invitations temps réel.
  Migration `0004_contacts.sql`. Tickets HMAC : champ `scope`.
- ✅ **Phase 9** — Proximité : `src/nearby.ts` (`/api/nearby*`), coords arrondies,
  distance en bucket, anti-spam. `src/invites.ts` = helper partagé
  `createConversationInvite`. Migration `0005_nearby.sql`.

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
| `GET /api/sessions/lookup?token=` \| `?code=` | aperçu public d'une invitation (langues, expiration) sans rejoindre |
| `POST /api/sessions` | crée une session (auth) → token + code court + `joinUrl` |
| `POST /api/sessions/join` | rejoint via `{token}` ou `{code}` (auth) |
| `GET /api/sessions/:id` | détail (créateur ou participant) |
| `POST /api/sessions/:id/leave` | quitter → session `ended` |
| `POST /api/sessions/:id/end` | terminer (créateur uniquement) |
| `POST /api/sessions/:id/realtime-ticket` | ticket HMAC court + `wsUrl` |
| `GET /api/rt/:id?ticket=` | upgrade WebSocket → Durable Object `SessionRoom` |
| `POST /api/ai/process` | `{audioBase64, mimeType, sourceLanguage, targetLanguage}` → `{transcript, translation}` (écran de test dev) |
| `POST /api/ai/translate` | `{text, sourceLanguage, targetLanguage}` → `{translation}` |
| `GET /api/sessions/:id/messages` | historique récent |
| `POST /api/sessions/:id/messages` | `{audioBase64, mimeType, clientId}` → crée le message, streame transcription+traduction vers la room, renvoie le message final |
| `POST /api/presence/ping` | heartbeat de présence |
| `GET /api/users/search?q=` | recherche par username (≥ 3 car.) |
| `GET \| DELETE /api/contacts` \| `/api/contacts/:id` | liste (avec `isOnline`) / suppression |
| `GET \| POST /api/contacts/requests` | demandes reçues / envoyer `{username}` |
| `POST /api/contacts/requests/:id/accept \| /decline` | répondre |
| `POST /api/contacts/:id/conversation` | démarrage rapide → session + invitation inbox |
| `POST /api/inbox/ticket` → `GET /api/inbox/rt?ticket=` | WebSocket boîte de réception (`UserInbox`) |
| `POST \| DELETE /api/nearby/visible` | opt-in / opt-out visibilité proximité (`{lat,lng}`, coords arrondies) |
| `GET /api/nearby?lat=&lng=` | personnes visibles autour (distance en bucket, jamais de coords) |
| `POST /api/nearby/:profileId/request` | demander une conversation (anti-spam 2 min) |
| `* /api/auth/*` | Better Auth (sign-in/anonymous, social/google, get-session, update-user, sign-out…) |

### Évènements WebSocket (serveur → client)

- `{ type: 'presence', participants: [{ id, role, online }] }`
- `{ type: 'session_status', session: <dto> }` (poussé sur join / leave / end)
- `{ type: 'message', message }` (nouveau message, statut `processing`)
- `{ type: 'message_update', message }` (transcription/traduction progressive → `completed`/`failed`)

Client → serveur : `{ type: 'ping' }`.

## Secrets (`.dev.vars` en local — gitignored ; `wrangler secret put` en prod)

| Nom | Description |
|-----|-------------|
| `DATABASE_URL` | Connexion Neon (endpoint `-pooler`) |
| `BETTER_AUTH_SECRET` | Secret de signature des sessions |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google (vide = fournisseur désactivé) |
| `GEMINI_API_KEY` | Clé Gemini (vide = `/api/ai/*` renvoie 503) |

Variable publique optionnelle : `GEMINI_MODEL` (défaut `gemini-2.5-flash`).

Variable publique : `BETTER_AUTH_URL` (dans `wrangler.jsonc`) = URL publique du Worker.

## Base de données

- Projet Neon : **LingoLink** (`proud-mountain-72949074`, `aws-eu-central-1`, PG 17)
- Migrations : `server/migrations/` (`0001_better_auth.sql`, `0002_sessions.sql`) — déjà appliquées.
- Régénérer le schéma auth : `npm run auth:generate` (après `set -a && . ./.dev.vars`).

Voir `DEPLOY.md` pour le déploiement.
