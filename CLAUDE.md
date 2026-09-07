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
- Auth : Neon Auth + Google OAuth ; mode invité = session anonyme locale.

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
- ⏳ Phase 2 — Auth (invité + Google) & profils.
- Phases 3→10 : sessions/QR, Realtime, pipeline Gemini, conversation complète,
  lien d'invitation, contacts, proximité, polish.

## Commandes

| But | Commande |
|-----|----------|
| Lancer l'app | `npx expo start` (puis `i` / `a` / QR Expo Go) |
| Typecheck | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Bundle de contrôle | `npx expo export --platform android --output-dir /tmp/x` |

## Expo

Expo SDK **57**. Lire https://docs.expo.dev/versions/v57.0.0/ avant d'écrire du
code Expo (l'API a changé).
