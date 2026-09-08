# Lingo Link — instructions projet

App mobile (iOS + Android) qui permet à deux personnes de langues différentes de
converser naturellement : chacun parle, l'app transcrit + traduit en direct sur
les deux téléphones. Cahier des charges complet fourni par l'utilisateur (22
sections). Répondre **toujours en français**.

**État au 2026-09-08 : les 10 phases du plan sont terminées, le backend est
déployé, l'APK Android est buildé, l'app tourne sur simulateur iOS.** Le MVP est
fonctionnel de bout en bout. **i18n (fr/en) : TOUS les écrans sont traduits** —
parcours principal + écrans secondaires (profil, contacts, proximité, réglages,
onboarding, host, join, scan, modale d'invitation, error-boundary, titres de la
nav). Suite = itérations / corrections / polish visuel.

## Contraintes imposées par l'utilisateur

- **Base : Neon** (pas Supabase). Projet `LingoLink` = `proud-mountain-72949074`,
  `aws-eu-central-1`, PG 17, org `org-sweet-tooth-50877405` (tcha.jimmy@gmail.com).
- **Cloudflare** pour le backend (Workers + Durable Objects) et le domaine futur.
- **Gemini API** pour transcription + traduction. Clé dans `server/.dev.vars` /
  secrets Cloudflare uniquement — jamais dans l'app, jamais commitée.
- **Connexion Google** OAuth (configurée, projet GCP `lingo-link-507902`).
- **Git** : commit + push sur `git@github.com:Ichigo35/LingoLink.git` à la fin de
  chaque tâche. MAJ `CLAUDE.md` + `memory/` à chaque fois.
- **Build APK toujours en local** puis ouvrir le fichier.
- Navigateur : Playwright (`mcp__playwright__*`), pas `claude-in-chrome` — SAUF
  exception explicite de l'utilisateur (utilisée pour la config Google Cloud).

## Déploiement (fait)

- **Backend** : `https://lingolink-api.ichigo35.workers.dev` (Cloudflare Worker
  `lingolink-api`, compte tcha.jimmy@gmail.com `34cf747a1eaf3858a49e4fafaf9580e0`).
  5 secrets poussés via `server/deploy-secrets.sh`. `wrangler.jsonc`
  `vars.BETTER_AUTH_URL` = URL de prod ; `server/.dev.vars` garde `localhost` pour
  `wrangler dev`. ⚠️ le trigger cron de rétention (ajouté 2026-09-08) s'active au
  prochain `wrangler deploy`.
- **Google OAuth** : redirect URIs `http://localhost:8787/...` + `https://
  lingolink-api.ichigo35.workers.dev/api/auth/callback/google` enregistrées.
  Écran de consentement en mode **Test**, `tcha.jimmy@gmail.com` = utilisateur test.
- **Migrations Neon** : `0001`..`0005` appliquées (voir `server/migrations/`).
- **App `.env` / `.env.production`** : `EXPO_PUBLIC_API_BASE_URL` = URL de prod.
  Pour re-dev en local : remettre `http://localhost:8787` (simu iOS) ou
  `http://10.0.2.2:8787` (émulateur Android) + lancer `cd server && npm run dev`.

## Builds

- **APK Android** : `npx expo prebuild -p android --clean` puis
  `cd android && ANDROID_HOME="$HOME/Library/Android/sdk"
  JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  ./gradlew :app:assembleRelease [-PreactNativeArchitectures=arm64-v8a]`.
  Signé avec la clé debug (OK pour test). Résultat copié dans `build-output/`
  (gitignored). arm64 ≈ 55 Mo, universel ≈ 132 Mo.
- **iOS simulateur** : `npx expo run:ios` (build Xcode + pod install la 1ʳᵉ fois,
  ~2 Go DerivedData). Si le process se fige après le build : booter + installer à
  la main via `xcrun simctl boot|install|launch` (l'`.app` est dans DerivedData
  `Build/Products/Debug-iphonesimulator/LingoLink.app`, bundle id
  `com.ichigo35.lingolink`). Metro sert le JS sur :8081.
- `android/` et `ios/` sont **gitignored** (workflow managed, prebuild à la demande).
- **Icône / splash** : `app.json` → `icon` (top-level, plus de `ios.icon`),
  `expo-splash-screen` (`imageWidth: 200`), `android.adaptiveIcon`. Logo = deux
  anneaux à coins arrondis entrelacés (`assets/icon-src/link-ring.svg`, l'autre
  maillon = ce SVG pivoté 180°). Régénérer : `bash assets/icon-src/build.sh`
  (ImageMagick ; SVG en aplats — pas de gradient ni de `stroke` seul — mais
  `fill-rule="evenodd"` OK pour le trou de l'anneau).

## Architecture

```
App Expo (RN 0.86 / SDK 57 / TS / expo-router / Zustand)
   │  HTTPS + WebSocket (wss)
   ▼
Cloudflare Worker "lingolink-api" (Hono)
   ├─ Better Auth (expo + anonymous plugins) — auth auto-hébergée
   ├─ proxy Gemini (streamGenerateContent) — clé secrète ici
   ├─ tokens de session (aléatoires) + tickets WS (HMAC 60 s, scope)
   ├─ Durable Object SessionRoom — 1 room WS temps réel par session
   └─ Durable Object UserInbox — 1 boîte de réception WS par utilisateur
   ▼
Neon Postgres  (RLS activée mais inerte sur Neon → contrôle d'accès Worker)
```

- L'app ne parle JAMAIS directement à Neon ni à Gemini. Tout via le Worker.
- IA abstraite : `AITranslationService` (app) / `TranslationProvider` (Worker).
- **RLS Neon inerte** : tous les rôles héritent de `neon_superuser` (BYPASSRLS),
  `ALTER ROLE NOBYPASSRLS` interdit en gratuit. → chaque endpoint filtre par
  `creator_id`/`participant_id`/appartenance. Rôle `lingolink_app` créé, non utilisé.
- **Latence traduction** : ~2,3 s en prod pour transcription + traduction
  complète (streaming progressif, `gemini-3.5-flash`, audio 16 kHz mono).
  Étape suivante possible : Gemini Live API (bidi) — reporté.

## Structure

```
src/
  app/            écrans + routage expo-router
  components/      themed-*, ui/, error-boundary, offline-banner, conversation-invite-modal
  config/          languages.ts (§18, centralisé), env.ts, session.ts
  features/        conversation/use-audio-capture.ts
  hooks/           use-auth, use-live-session, use-app-realtime, use-theme, i18n via src/i18n
  i18n/            translations.ts (fr/en, parcours principal) + useT()
  lib/             api-client.ts, auth-client.ts (better-auth expo)
  services/        ai/ auth/ conversations/ realtime/ inbox/ contacts/ nearby/
  stores/          settings, session, new-conversation, pending-join, inbox
  types/
server/            backend Cloudflare Worker (voir server/README.md pour les endpoints)
  src/             index, auth, ai, gemini, sessions, messages, realtime, inbox,
                   contacts, nearby, invites, session-room, user-inbox, tickets,
                   tokens, db, retention
  migrations/       0001..0005
```

## Langues MVP

`lo, fr, en, th, zh` — UNIQUEMENT dans `src/config/languages.ts` (app) et
`server/src/languages.ts` (miroir). Jamais en dur ailleurs.

## i18n de l'interface (§18)

Langues d'UI : **fr (référence) + en**. Tout passe par `src/i18n/` :
`translations.ts` (objet `TRANSLATIONS.{fr,en}`, `TranslationKey` dérive de `fr`
donc les 2 blocs doivent avoir exactement les mêmes clés) + `useT()` (hook) /
`translate()` (hors React, ex. `error-boundary`). Interpolation :
`t('host.expiresIn', { time })` remplace `{time}` dans la chaîne.
**Jamais de texte visible en dur dans un écran** — ajouter une clé fr + en.
Choix de langue : écran Réglages (`uiLanguage` dans `settings-store`, persisté).
Les titres de la nav sont dans `_layout.tsx` via `useT()` (clés `nav.*`).

## Rétention (cron)

`server/src/retention.ts` + trigger `crons: ["17 * * * *"]` dans `wrangler.jsonc`
(→ `export default { fetch, scheduled }` dans `index.ts`). Chaque heure :
1. sessions `active` inactives > 24 h → `ended` ;
2. sessions `waiting` dont le QR/lien est expiré → `expired` ;
3. sessions `ended`/`expired` au-delà de `RETENTION_HOURS` (env, défaut 24, borné
   1..720) → **DELETE** (les `conversation_messages` partent en cascade) ;
4. `nearby_presence` expirée → DELETE ;
5. `nearby_requests` > 60 min → DELETE.
Idempotent. Test local : `npx wrangler dev --test-scheduled` puis
`curl "http://localhost:8787/__scheduled?cron=17+*+*+*+*"` (log `[retention] {...}`).
⚠️ `.dev.vars` pointe sur la **vraie** base Neon → le test local mute la prod.

## Règles de travail

1. Après code : `npx tsc --noEmit` (app) + `cd server && npx tsc --noEmit` +
   `npm run lint` doivent passer. Tester avant de dire que c'est fait.
2. Jamais afficher/committer une clé. Jamais désactiver RLS "pour dépanner".
3. Ne pas simuler une fonctionnalité comme terminée si elle ne marche pas.
4. Vérifier la doc réelle d'une API externe avant de l'intégrer (pas d'invention).
5. `wrangler deploy` est bloqué pour l'agent → demander à l'utilisateur.

## Commandes

| But | Commande |
|-----|----------|
| App (dev) | `npx expo start` (puis `i` / `a`) |
| App iOS simulateur | `npx expo run:ios` |
| Backend local | `cd server && npm run dev` (:8787) |
| Typecheck | `npx tsc --noEmit` · `cd server && npx tsc --noEmit` |
| Lint | `npm run lint` |
| Bundle de contrôle | `npx expo export -p ios --output-dir /tmp/x` |
| Déployer le backend | `cd server && bash deploy-secrets.sh && npx wrangler deploy` |
| Build APK | voir section **Builds** |
| Test backend (scripts) | dans le scratchpad de session : `*-test.mjs` (rt, msg, contacts, nearby) |

## Expo

Expo SDK **57**, RN **0.86**, React 19.2. Lire
https://docs.expo.dev/versions/v57.0.0/ avant du code Expo (l'API a changé).
Lint `react-hooks/set-state-in-effect` : faux positifs fréquents sur les actions
async en effet → `eslint-disable-next-line` avec justification (pattern déjà utilisé).

## Reste à faire (idées)

- ~~i18n des écrans secondaires~~ ✅ fait (2026-09-08).
- ~~Rétention : purge des sessions/messages terminés (cron)~~ ✅ fait (2026-09-08).
- ~~Icône/splash custom~~ ✅ fait (2026-09-08) — logo = **deux maillons/bulles
  entrelacés** (le « Link ») en blanc sur `#2F6BFF`. Sources + `build.sh`
  (ImageMagick, déterministe) dans `assets/icon-src/`. Placeholders du template
  Expo supprimés.
- ~~`preview_urls = false` / `workers_dev` explicite dans `wrangler.jsonc`~~ ✅ fait (2026-09-08).
- ai-test.tsx reste en dur (écran dev-only, `__DEV__`) — OK.
- APK signé release (clé de prod) si distribution hors test.
