# Lingo Link — instructions projet

App mobile (iOS + Android) qui permet à deux personnes de langues différentes de
converser naturellement : chacun parle, l'app transcrit + traduit en direct sur
les deux téléphones. Cahier des charges complet fourni par l'utilisateur (22
sections). Répondre **toujours en français**.

## Contraintes imposées par l'utilisateur

- **Base de données : Neon** en priorité (pas Supabase). Projet Neon `LingoLink`
  = id `proud-mountain-72949074`, région `aws-eu-central-1`, PG 17,
  org `org-sweet-tooth-50877405` (tcha.jimmy@gmail.com).
- **Cloudflare** pour le domaine + le backend (Workers / Durable Objects).
- **Gemini API** pour transcription + traduction. Clé fournie par l'utilisateur,
  stockée UNIQUEMENT côté backend (jamais dans l'app, jamais commitée).
- **Connexion Google** automatique (OAuth) requise.
- **Git** : commit + push sur `git@github.com:Ichigo35/LingoLink.git` à la fin de
  chaque tâche. Mettre à jour `CLAUDE.md` + `memory/` à chaque fois.
- **Build APK** : toujours en local, puis ouvrir le fichier généré.
- Navigateur : utiliser Playwright (`mcp__playwright__*`), jamais `claude-in-chrome`.

## Architecture

```
App Expo (RN/TS/expo-router, Zustand)
   │  HTTPS + WebSocket
   ▼
Cloudflare Worker  ──►  proxy Gemini (clé secrète ici)
   │                    mint/validation tokens de session
   │                    Durable Object = 1 room temps réel par session
   ▼
Neon Postgres (RLS)
```

- L'app ne parle JAMAIS directement à Neon ni à Gemini. Tout passe par le Worker.
- Service IA abstrait : `src/services/ai/types.ts` (`AITranslationService`). Aucun
  composant ne dépend de Gemini directement.
- Temps réel : Cloudflare Durable Objects (remplace Supabase Realtime).
- Auth : **Better Auth** (auto-hébergé sur le Worker) — plugins `expo()` +
  `anonymous()`. Mode invité = `signIn.anonymous()`. Google OAuth activable.
  Tables auth dans Neon (`user`, `session`, `account`, `verification`).
  Le worker `lingolink-api` : voir `server/`.

## Structure du code

```
src/
  app/            écrans + routage expo-router (minces, délèguent à features/)
  components/ui/   composants de présentation réutilisables
  config/          languages.ts (config langues centralisée §18), env.ts
  features/        modules métier par fonctionnalité (à venir)
  services/        ai/ auth/ conversations/ realtime/ nearby/ (interfaces abstraites)
  lib/             api-client.ts (fetch vers le Worker)
  stores/          Zustand (settings-store persisté, new-conversation-store)
  types/           types de domaine partagés (alignés sur le schéma DB)
server/            backend Cloudflare Worker (non implémenté — voir server/README.md)
```

## Langues MVP

`lo, fr, en, th, zh` — définies UNIQUEMENT dans `src/config/languages.ts`.
Ne jamais coder une langue en dur ailleurs.

## Règles de travail

1. Travailler phase par phase (plan §19 du cahier des charges). Ne pas anticiper.
2. Avant gros changements : analyser, expliquer, proposer le plan de la phase.
3. Après code : `npx tsc --noEmit` + `npm run lint` doivent passer. Tester.
4. Ne jamais afficher/committer une clé API. Ne jamais désactiver RLS "pour dépanner".
5. Ne pas simuler une fonctionnalité comme terminée si elle ne marche pas.
6. Résumer + expliquer précisément comment tester à la fin de chaque phase.

## Avancement

- ✅ **Phase 1** — Init : scaffold Expo SDK 57, structure, config langues, env,
  écran d'accueil + écrans placeholder, thème/dark mode, réglages fonctionnels.
- ✅ **Phase 2** — Auth & profils : backend `server/` (Cloudflare Worker + Hono +
  Better Auth + Neon). Mode invité (anonyme) fonctionnel de bout en bout.
  **Google OAuth configuré et vérifié** (projet GCP `lingo-link-507902`, client
  « Lingo Link Web », creds dans `server/.dev.vars`, écran de consentement en
  mode Test avec `tcha.jimmy@gmail.com` comme utilisateur test).
  App : `welcome`, `onboarding`, `profile`, garde de session dans `_layout.tsx`,
  `useAuth()`, `authClient` (better-auth expo), `authService`.
  ⚠️ Reste à faire par l'utilisateur : déployer le Worker (`server/DEPLOY.md`,
  puis ajouter la redirect URI de prod dans la console Google). Tester la
  connexion Google de préférence en dev build (`npx expo run:ios`), pas Expo Go
  (deep-linking).
- ✅ **Phase 3** — Sessions : table `conversation_sessions` (Neon, migration
  0002), endpoints Worker `/api/sessions*` (create / join par token ou code
  court / get / leave / end), token aléatoire 32o + code court 8 car., TTL 10 min
  + expiration paresseuse. App : `session/host` (QR + code + compte à rebours +
  partage lien), `scan` (caméra `expo-camera` + saisie manuelle), `conversation/[id]`
  (lobby : langues, présence, quitter/terminer, polling 3 s).
  **Contrôle d'accès : couche Worker** (filtre `creator_id`/`participant_id`).
  RLS activée sur la table mais inerte sur Neon (rôles héritent de
  `neon_superuser` BYPASSRLS, `ALTER ROLE NOBYPASSRLS` interdit en gratuit).
  Testé de bout en bout (10 cas : accès, expiration, jointure, doublons).
- ✅ **Phase 4** — Temps réel : **Cloudflare Durable Object** `SessionRoom` (une
  room WebSocket par session, API Hibernation). Auth WS par **ticket HMAC 60 s**
  (`POST /api/sessions/:id/realtime-ticket` → `GET /api/rt/:id?ticket=`).
  Diffuse : présence (connect/disconnect), `session_status` (poussé par le
  Worker sur join/leave/end), relais des messages entre pairs (base Phase 6).
  App : `services/realtime` (WS + reconnexion backoff + ping), `useLiveSession`
  (snapshot HTTP + temps réel, poll de secours 15 s si déconnecté) remplace
  `useSession`. `session/host` détecte la jointure via temps réel, plus de polling.
  Testé de bout en bout (présence, join, message, end, ticket invalide).
- Phases 5→10 : pipeline Gemini, conversation complète, lien d'invitation,
  contacts, proximité, polish.

## Commandes

| But | Commande |
|-----|----------|
| Lancer l'app | `npx expo start` (puis `i` / `a` / QR Expo Go) |
| Lancer le backend | `cd server && npm run dev` (→ http://localhost:8787) |
| Typecheck app | `npx tsc --noEmit` |
| Typecheck backend | `cd server && npm run typecheck` |
| Lint | `npm run lint` |
| Bundle de contrôle | `npx expo export --platform ios --output-dir /tmp/x` |
| Déployer le backend | `cd server && npx wrangler deploy` (voir `server/DEPLOY.md`) |

## Expo

Expo SDK **57**. Lire https://docs.expo.dev/versions/v57.0.0/ avant d'écrire du
code Expo (l'API a changé).
