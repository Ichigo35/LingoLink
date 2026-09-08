# Lingo Link — instructions projet

App mobile (iOS + Android) qui permet à deux personnes de langues différentes de
converser naturellement : chacun parle, l'app transcrit + traduit en direct sur
les deux téléphones. Cahier des charges complet fourni par l'utilisateur (22
sections). Répondre **toujours en français**.

**État au 2026-09-08 : MVP complet + 5 itérations de retours terrain.** Backend
déployé (Worker `90e9aa76`, inchangé depuis itér. 3), **version web redéployée**
(`lingolink-web.pages.dev`), APK `build-output/LingoLink.apk` à jour (itér. 5),
app iOS sur simulateur.
**La liste "Reste à faire" initiale est terminée**
(2026-09-08) : i18n fr/en de tous les écrans, purge de rétention (cron),
rate limiting du proxy Gemini, logo/icône custom, durcissement wrangler
(`preview_urls: false`, `workers_dev: true`), signature release Android.
Backend redéployé avec tout ça (dernière version `596f309a`).
Suite = itérations / corrections / pistes libres (voir bas de fichier).

**Itération 2026-09-08 (2) — retours terrain d'un test à 2 téléphones :**
1. Échecs de traduction en cascade = quota gratuit Gemini `gemini-3.5-flash`
   (20 req/jour/projet) épuisé → **chaîne de repli multi-modèles** (§ Latence),
   messages d'erreur typés et affichés sur la bulle.
2. Barre du haut de la conversation cachée par l'heure/wifi (Android) →
   `SafeAreaView edges={['top','bottom']}` dans `conversation/[id].tsx`.
3. Lien WhatsApp non cliquable → **lien HTTPS `/join/<token>` + App Links
   Android** (§ Liens de partage).
4. Sortie d'un participant non signalée → alerte « L'autre personne a quitté »
   + invite à sortir (`conv.peerLeft*`), sur transition `status → ended`.
5. Builds locaux : **un seul fichier par plateforme, écrasé** (§ Builds).
Backend redéployé (version `e45159dd`).

**Itération 2026-09-08 (3) :**
6. **Traduction phrase-par-phrase** (VAD léger, `use-audio-capture.ts`) : pendant
   l'enregistrement, coupe le segment à chaque pause + envoi/traduction
   immédiate → un long monologue défile traduit au fil de l'eau. Coupe aussi à
   12 s. Vrai temps-réel bidi (Gemini Live) = toujours reporté.
7. **Version web** « rejoindre + converser » → Cloudflare **Pages**
   `lingolink-web.pages.dev` (§ Version web). La page `/join` propose
   « Continuer dans le navigateur » pour ceux sans l'app.
Backend redéployé (version `90e9aa76`).

**Itération 2026-09-08 (5) — retours terrain web :**
11. **`Alert.alert` ne s'affiche pas sur RN Web** → bouton « Quitter » inerte et
   pas d'alerte « l'autre personne a quitté » sur le web. Nouveau
   `src/components/ui/confirm-dialog.tsx` (`Modal` RN, marche web + natif) ;
   `conversation/[id].tsx` : états `leaveOpen` / `peerLeftDismissed` /
   `leaving`, deux `<ConfirmDialog>`. `Alert` retiré de cet écran.
12. **Écran QR/hôte : plus de code affiché** (`session/host.tsx`, `host.linkHint`
   à la place de `host.codeLabel`) — le lien/QR suffit. La saisie manuelle web
   (`scan.tsx`) accepte maintenant **le lien collé** (`extractJoinToken` →
   `joinByToken`, sinon `joinByCode`), erreurs en inline (pas d'`Alert` web).
   Clés i18n `scan.*` reformulées « coller le lien », `home.joinWeb.sub`,
   `scan.codePlaceholder`.
Pas de redéploiement backend. Web redéployé.

**Itération 2026-09-08 (4) — retours terrain :**
8. **Invitation par message = lien seul, aucun code.** `host.shareMessage` ne
   contient plus `Code : {code}` (le code reste affiché sous le QR pour la saisie
   manuelle web en secours). Capture du token de jointure durcie : plus
   conditionnée à l'état de connexion (`useDeepLinkCapture` dans `_layout.tsx`) —
   sur le web `Linking.useURL()` pouvait se résoudre après la connexion invité et
   l'utilisateur retombait sur la saisie de code.
9. **Traduction cassée depuis le web** : `expo-audio` produit un `blob:` (webm/opus
   sur Chrome, mp4 sur Safari) et `expo-file-system` n'existe pas sur le web →
   l'audio partait étiqueté `audio/mp4` alors que c'était du webm. Fix :
   `src/services/conversations/read-audio.web.ts` lit le blob + son vrai
   `blob.type`. Gemini accepte `audio/webm`.
10. **Bouton micro = appui unique** (start/stop) au lieu de maintenir : 1er tap
   démarre, on parle librement (phrases traduites au fil de l'eau via le VAD),
   2e tap termine. `conversation/[id].tsx` (`toggleRecord`), clés i18n
   `conv.talk` / `conv.stopTalk`. Plus fiable, surtout sur le web (souris).
Pas de redéploiement backend (tout côté client). Web redéployé.

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
  `wrangler dev`. Trigger cron de rétention + rate limiters + `preview_urls: false`
  + `workers_dev: true` : ajoutés et **déployés** le 2026-09-08.
- **Google OAuth** : redirect URIs `http://localhost:8787/...` + `https://
  lingolink-api.ichigo35.workers.dev/api/auth/callback/google` enregistrées.
  Écran de consentement en mode **Test**, `tcha.jimmy@gmail.com` = utilisateur test.
- **Migrations Neon** : `0001`..`0005` appliquées (voir `server/migrations/`).
- **App `.env` / `.env.production`** : `EXPO_PUBLIC_API_BASE_URL` = URL de prod.
  Pour re-dev en local : remettre `http://localhost:8787` (simu iOS) ou
  `http://10.0.2.2:8787` (émulateur Android) + lancer `cd server && npm run dev`.

## Builds

**Nom de fichier des builds locaux (règle utilisateur 2026-09-08)** : un seul et
unique fichier par plateforme, nommé d'après le projet, **écrasé** à chaque build
— jamais de fichier daté ni suffixé. Cibles fixes dans `build-output/`
(gitignored) :
- `build-output/LingoLink.apk` (Android)
- `build-output/LingoLink.ipa` (iOS, si un jour on produit un archive)
Le build simulateur iOS (`expo run:ios`) ne produit pas d'artefact à conserver.

- **APK Android** : `bash scripts/build-apk.sh` (arm64 ≈ 55 Mo) ou
  `bash scripts/build-apk.sh universal` (≈ 132 Mo). Le script fait le prebuild,
  le `gradlew :app:assembleRelease` (avec `ANDROID_HOME` / `JAVA_HOME` openjdk@21)
  puis **copie vers `build-output/LingoLink.apk` en écrasant**.
- **Signature release** : plugin `plugins/withAndroidReleaseSigning.js` (réinjecté
  au prebuild). Si `credentials/keystore.properties` existe → APK signé avec le
  keystore de prod (`credentials/lingolink-release.jks`, alias `lingolink`,
  valide jusqu'en 2054).
  SHA-1 `43:83:02:96:B7:01:70:CC:FA:F8:8A:00:02:92:01:CB:8C:DA:8E:8B` ·
  SHA-256 `55:A8:0A:07:D4:FE:E3:1F:00:E4:F4:78:84:E5:E4:A8:DB:06:0A:DB:D9:84:B7:4E:21:CD:8B:F3:E6:78:A6:7C`
  (à enregistrer côté Google Cloud / Firebase seulement si un jour on passe au
  Google Sign-In natif ; le flux OAuth navigateur actuel n'en a pas besoin).
  Sinon → clé debug (test OK). `credentials/` gitignored — **à sauvegarder hors
  repo** (perte = plus de MAJ possible sur le store). Modèle :
  `credentials/keystore.properties.example`.
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
  complète (streaming progressif, audio 16 kHz mono).
  Étape suivante possible : Gemini Live API (bidi) — reporté.
- **Modèles Gemini — chaîne de repli** (`server/src/gemini.ts`) : `GEMINI_MODEL`
  (var wrangler) est une **liste séparée par des virgules**. Chaque modèle du
  niveau gratuit a un quota **journalier par projet** (ex. `gemini-3.5-flash` =
  20/jour !). Quand un modèle renvoie `RESOURCE_EXHAUSTED` (quota du jour), il est
  mis en pause dans l'isolat (`retryDelay` de l'API, ou 1 h) et on passe au
  suivant. Ordre actuel :
  `gemini-2.5-flash,gemini-3-flash-preview,gemini-3.7-flash,gemini-3.5-flash`.
  Un 429 « par minute » → petite attente puis bascule. `thinkingConfig` retiré
  automatiquement pour les modèles qui le refusent (400). Erreurs typées
  (`aiErrorInfo`) : `ai_quota` (503) / `ai_rate_limited` (429) / `ai_timeout` /
  `ai_blocked` → message précis renvoyé à l'app **et** collé sur la bulle en
  échec (`message.error`, non persisté).
  → Le vrai correctif volume = activer la facturation Gemini (décision utilisateur).

## Structure

```
src/
  app/            écrans + routage expo-router
  components/      themed-*, ui/, error-boundary, offline-banner, conversation-invite-modal
  config/          languages.ts (§18, centralisé), env.ts, session.ts
  features/        conversation/use-audio-capture.ts
  hooks/           use-auth, use-live-session, use-app-realtime, use-theme, i18n via src/i18n
  i18n/            translations.ts (fr/en, TOUS les écrans) + useT()/translate()
  lib/             api-client.ts, auth-client.ts (better-auth expo)
  services/        ai/ auth/ conversations/ realtime/ inbox/ contacts/ nearby/
  stores/          settings, session, new-conversation, pending-join, inbox
  types/
server/            backend Cloudflare Worker (voir server/README.md pour les endpoints)
  src/             index, auth, ai, gemini, sessions, messages, realtime, inbox,
                   contacts, nearby, invites, join, session-room, user-inbox,
                   tickets, tokens, db, retention, rate-limit
  migrations/       0001..0005
plugins/           withAndroidReleaseSigning.js (config plugin Expo, signature release)
assets/icon-src/   sources SVG du logo + build.sh (régénère assets/images/)
credentials/       keystore release (gitignored, sauf keystore.properties.example)
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

## Rate limiting (proxy Gemini)

`server/src/rate-limit.ts` (`enforceRateLimit`, fail-open) + bindings
`ratelimits` dans `wrangler.jsonc` (`period` ∈ {10, 60} uniquement) :
- `MSG_RATE_LIMITER` — 20/60 s par user sur `POST /api/sessions/:id/messages` ;
- `AI_RATE_LIMITER` — 12/60 s par user sur `POST /api/ai/{process,translate}`.
Clé = `msg:<userId>` / `ai:<userId>`. Dépassement → `429 {code:"rate_limited"}`.
Best-effort par colo (pas global) — suffisant pour le contrôle de coût.
Better Auth garde son rate limiting intégré côté `/api/auth/*`.

## Capture audio / VAD

`src/features/conversation/use-audio-capture.ts` : capture **avec segmentation
automatique**. Bouton **appui unique** (start/stop) : 1er tap → `capture.start()`,
2e tap → `capture.stop()` (`conversation/[id].tsx` `toggleRecord`, état local
`recording`, `micBusyRef` anti-double-tap, `capture.cancel()` au démontage).
Pendant l'enregistrement, un poll (~140 ms) lit `recorder.getStatus().metering` ;
après ≥1,1 s de parole suivie de ~850 ms sous `-40 dBFS`, le segment est coupé →
`onSegment()` (envoi + traduction immédiate) → nouveau segment. Coupe forcée à
12 s. `stop()` renvoie le dernier segment. `sendSegment()` partagé, compteur
`inFlight` (plusieurs envois en parallèle).

**Upload audio — spécifique plateforme** : `src/services/conversations/read-audio.ts`
(natif : `expo-file-system` lit le fichier local, mime déduit de l'extension) vs
`read-audio.web.ts` (web : `fetch(blob:)` → `blob.arrayBuffer()` + **vrai**
`blob.type`). Indispensable sur le web où `expo-audio` rend un `blob:` webm/opus
et où deviner le mime donnait `audio/mp4` → Gemini n'arrivait pas à transcrire.

## Liens de partage / deep links

- **`session.joinUrl` = URL HTTPS** `https://lingolink-api.ichigo35.workers.dev/join/<token>`
  (plus `lingolink://…` : non cliquable dans WhatsApp). Construit dans
  `server/src/sessions.ts` `toDto()` à partir de `BETTER_AUTH_URL`.
- **`server/src/join.ts`** :
  - `GET /join/:token` → page HTML légère qui rebondit vers
    `lingolink://join/<token>` (bouton de secours). Sert aussi de cible App Links.
  - `GET /.well-known/assetlinks.json` → vérif **App Links Android** (package
    `com.ichigo35.lingolink` + SHA-256 du keystore release). Android ouvre alors
    l'app directement, sans page intermédiaire.
- **App** : `app.json` → `android.intentFilters` (`autoVerify`, host
  `lingolink-api.ichigo35.workers.dev`, `pathPrefix /join`). `src/app/+native-intent.ts`
  ramène l'URL HTTPS entrante au chemin interne `/join/<token>`. Le QR encode
  aussi cette URL HTTPS (toujours scannable, `extractJoinToken` gère les 2 formes).
- **Le lien suffit, aucun code — nulle part.** `host.shareMessage` (i18n) ne met
  plus le `shortCode` dans le message ; l'écran QR/hôte (`session/host.tsx`) ne
  l'affiche plus non plus (`host.linkHint`). `useDeepLinkCapture` (`_layout.tsx`)
  mémorise le token quel que soit l'état d'auth (avant : conditionné à
  `!isAuthenticated` → perdu sur le web quand `Linking.useURL()` se résolvait
  après la connexion invité, d'où retour à la saisie manuelle). `JoinScreen`
  efface le token en attente à son montage (pas de boucle).
- **Saisie manuelle web** (`scan.tsx`, écran « Rejoindre ») = **coller le lien**
  reçu : `extractJoinToken` → `joinByToken`, repli `joinByCode` si ce n'est pas
  une URL/token. Erreurs affichées en inline (`Alert` ne s'affiche pas sur le web).
- **`Alert.alert` est inerte sur RN Web** → utiliser `components/ui/confirm-dialog.tsx`
  (`ConfirmDialog`, basé sur `Modal`) pour toute confirmation à 2 boutons visible
  côté web. Fait pour « Quitter/Terminer » et « l'autre personne a quitté »
  (`conversation/[id].tsx`).
- **iOS Universal Links** : pas fait (besoin d'un Team ID Apple / compte
  Developer). La page de rebond couvre iOS en attendant (tap Safari → scheme).

## Version web (Cloudflare Pages)

Périmètre volontairement réduit : **mode invité + rejoindre par code/lien +
écran de conversation** (micro navigateur + traduction). Pas de création de
session / contacts / proximité / Google sur le web.

- **Build + deploy** : `bash scripts/deploy-web.sh` → `expo export -p web`
  (`app.json` `web.output: "single"`, SPA) + `dist/_redirects` (`/* /index.html
  200`) → `wrangler pages deploy` sur le projet **`lingolink-web`** →
  `https://lingolink-web.pages.dev`.
- **Auth web = jeton bearer** (pas de cookie) : le web est sur un autre domaine
  que l'API → cookies cross-site peu fiables (Safari). Serveur : plugin
  `bearer()` de Better Auth. Client (`src/lib/auth-client.ts`) : sur
  `Platform.OS === 'web'`, pas de plugin `expo`, le jeton `set-auth-token` est
  stocké en `localStorage` (`lingolink_bearer`) et renvoyé en
  `Authorization: Bearer` (via `fetchOptions.auth` + injecté dans `api-client.ts`).
  Natif inchangé (plugin `@better-auth/expo` + SecureStore).
  `getAuthCookie()` / `getBearerToken()` centralisent l'accès.
- **`WEB_APP_URL`** (var wrangler) = URL du web : dans `trustedOrigins` Better
  Auth + bouton « Continuer dans le navigateur » de la page `/join`.
- **Écrans gardés** `Platform.OS === 'web'` : `welcome` (invité seul),
  `index` (carte « Rejoindre » seule), `scan` (saisie de code, pas de `CameraView`).
- Le VAD (`use-audio-capture`) dépend du niveau `metering` (AudioContext
  analyser) : dispo sur Chrome/Firefox, plus incertain ailleurs → au pire seule
  la coupe à 12 s + le 2e tap s'appliquent (dégradation acceptable).
- **Audio web** : `read-audio.web.ts` envoie le blob avec son vrai `blob.type`
  (`audio/webm` sur Chrome). Étape passée : mime forcé à `audio/mp4` → échec de
  transcription Gemini.

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
5. `wrangler deploy` : l'agent peut le lancer directement (autorisé 2026-09-08).

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
| Build APK | `bash scripts/build-apk.sh` (voir **Builds**) |
| Déployer le web | `bash scripts/deploy-web.sh` → `lingolink-web.pages.dev` |
| Test backend (scripts) | dans le scratchpad de session : `*-test.mjs` (rt, msg, contacts, nearby) |

## Expo

Expo SDK **57**, RN **0.86**, React 19.2. Lire
https://docs.expo.dev/versions/v57.0.0/ avant du code Expo (l'API a changé).
Lint `react-hooks/set-state-in-effect` : faux positifs fréquents sur les actions
async en effet → `eslint-disable-next-line` avec justification (pattern déjà utilisé).

## Reste à faire (idées)

**Itération 2026-09-08 — tous les items de la liste initiale sont faits** :
i18n fr/en de tous les écrans (§ i18n), rétention cron (§ Rétention), rate
limiting Gemini (§ Rate limiting), logo/icône custom (§ Builds), durcissement
`wrangler.jsonc`, signature release Android (§ Builds). Backend redéployé.

Pistes libres restantes :
- Monitoring d'erreurs (Sentry) — bloqué : besoin d'un DSN de l'utilisateur.
- Rate limiting Better Auth avec `storage: "database"` (migration `rateLimit`).
- Tests automatisés (Vitest `@cloudflare/vitest-pool-workers` côté server).
- AAB pour le Play Store — **repoussé** (demande explicite de l'utilisateur).
- `ai-test.tsx` : chaînes en dur, écran dev-only (`__DEV__`) — à i18n si un jour
  exposé en prod.
