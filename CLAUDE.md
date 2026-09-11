# Lingo Link — instructions projet

App mobile (iOS + Android) qui permet à deux personnes de langues différentes de
converser naturellement : chacun parle, l'app transcrit + traduit en direct sur
les deux téléphones. Cahier des charges complet fourni par l'utilisateur (22
sections). Répondre **toujours en français**.

## État (2026-09-11) — MVP complet + 10 itérations de retours terrain / revue UX

- **Worker** `lingolink-api` déployé, version **`6b59d71c`** (itér. 9 : page de
  rebond `/join` traduite). URL `https://lingolink-api.ichigo35.workers.dev`.
  Itér. 10 = app uniquement, **pas de redéploiement Worker nécessaire**.
- **Web** déployé sur Cloudflare Pages `lingolink-web` → `lingolink-web.pages.dev`
  (itér. 9) — **redeploy web recommandé** pour publier l'itér. 10
  (`bash scripts/deploy-web.sh`), pas encore fait à ce stade.
- **APK** `build-output/LingoLink.apk` — **pas encore rebuild** avec l'itér. 10 ;
  `bash scripts/build-apk.sh` à relancer avant de distribuer. App iOS sur simulateur.
- Migrations Neon `0001..0005` appliquées. Aucune migration depuis (les colonnes
  langue/statut sont du `text` libre).
- Liste « Reste à faire » initiale **terminée** : i18n de tous les écrans, purge
  de rétention (cron), rate limiting proxy Gemini, logo/icône, durcissement
  `wrangler.jsonc`, signature release Android.

### Journal des itérations (récent → ancien ; détail dans les sections `##`)

- **Itér. 10** — **revue UX/UI experte + corrections** (aucune demande utilisateur
  précise, audit proactif de tous les écrans). Dépendance ajoutée :
  **`@expo/vector-icons`** (déjà transitive via Expo, installée en directe via
  `npx expo install`). (a) **système d'icônes emoji → vectoriel** : `Button`
  (nouveau prop `iconName` Ionicons, `icon` string gardé pour "G" Google) et
  `ActionCard` (`icon` devient `keyof typeof Ionicons.glyphMap` au lieu d'un
  emoji) ; tous les call sites (`index.tsx`, `new-conversation.tsx`,
  `session/host.tsx`, `conversation/[id].tsx`, `nearby.tsx`) migrés — rendu
  cohérent iOS/Android/web au lieu de glyphes emoji dépendants de la plateforme.
  (b) **cibles tactiles sous le minimum 44×44** portées à `minHeight: 44` +
  retour visuel `pressed` : icônes Profil/Réglages de l'accueil (désormais avec
  libellé texte sous l'icône — coupe court à la confusion « je ne sais pas où
  cliquer » déjà vécue en itér. 9), chip de langue en conversation
  (`conversation/[id].tsx`), boutons Accepter/Refuser (`contacts.tsx`). (c)
  **sélection couleur-seule corrigée** : Réglages (thème + langue d'UI) affiche
  désormais une coche `iconName="checkmark"` sur l'option active, plus seulement
  un remplissage de couleur. (d) **sélecteur de langue** (`language-selector.tsx`,
  `ui-language-bar.tsx`) : `ScrollView` horizontal peu découvrable → grille
  `flexWrap` (les 8 langues sont toutes visibles sans scroller). (e) **bug
  couleur en dur** dans `themed-text.tsx` (`linkPrimary` avait `#3c87f7` au lieu
  d'un token du thème — violait la règle documentée dans `theme.ts`, mais le
  type n'était utilisé nulle part donc sans impact visible) — corrigé pour
  retomber sur `theme.tint`. (f) **`Pressable` mort** dans `nearby.tsx` (la ligne
  utilisateur n'avait pas de `onPress`, seul le bouton interne réagissait) →
  simplifié en `View`. (g) **hint de recherche contacts** ajouté
  (`contacts.searchHint`, 8 langues) quand `0 < requête < 3` caractères, au lieu
  de ne rien afficher. (h) **feedback copie de lien renforcé** (`session/host.tsx`) :
  haptique de succès + bouton qui passe en `primary` avec icône `checkmark-circle`
  pendant 1,5 s, au lieu d'un simple changement de texte. Revue complète menée
  par un agent dédié (10 constats, tous corrigés) ; validé par `tsc`/`lint` +
  captures Playwright web (accueil invité, Réglages, écran « Rejoindre »).
  Pas de migration, pas de changement serveur.
- **Itér. 9** — **langue de l'invité qui rejoint via un lien** (retour terrain :
  téléphone lao → page de connexion en français, l'invité ne savait pas où
  cliquer, puis bloqué sur la page de rebond). (a) **page `/join/:token` du Worker
  traduite** dans les 8 langues d'UI via l'en-tête `Accept-Language`
  (`server/src/join.ts`, `T`/`pickLang`), `<html lang>` + `Content-Language`
  corrects, 2e ligne d'aide « le chargement peut prendre quelques secondes »,
  auto-redirection scheme repoussée à 1200 ms et conditionnée à
  `visibilityState`. (b) **le bouton « Continuer dans le navigateur » passe la
  langue au web** : `?hl=<code>` ajouté à l'URL web → `resolveInitialUiLanguage()`
  lit `?hl=`/`?lang=` en priorité sur le web (`src/i18n/device-locale.ts`
  `uiLanguageFromUrl()`) — rattrape les navigateurs mobiles dont
  `navigator.language` ne reflète pas la langue du téléphone (navigateur intégré
  WhatsApp, etc.). (c) **sélecteur de langue d'UI sur les écrans d'entrée** :
  `src/components/ui/ui-language-bar.tsx` (`UiLanguageBar`, pastilles
  drapeau+endonyme depuis `UI_LANGUAGES`, écrit `setUiLanguage`), ajouté à
  `welcome` (toujours) et `scan` (web) — les Réglages sont inaccessibles en mode
  invité web. (d) **écran `welcome` sensible à l'invitation** : quand un token est
  en attente (`pendingJoinStore`), bannière « Vous avez été invité… » + le bouton
  invité devient « Rejoindre la conversation » (`welcome.invited` /
  `welcome.invitedCta` / `welcome.signInFailed` ajoutés aux 8 blocs). Worker
  `6b59d71c`. Pas de migration.
- **Itér. 8** — (a) **retrait de la traduction phrase-par-phrase VAD** : pas assez
  fluide/précise → retour au « tap Parler → parler → tap Terminer → 1 traduction »
  (`use-audio-capture.ts` simplifié). (b) **titres rognés en haut** : `themed-text`
  `styles.default` impose `lineHeight: 24` ; les titres à `fontSize` 24-34 sans
  `lineHeight` héritaient 24 → glyphes coupés. `lineHeight` explicite ajouté
  (« Lingo Link » accueil/welcome/join + `h1` new-conversation/scan/onboarding/host).
  Pas de changement serveur.
- **Itér. 7** — (a) **changer sa langue en cours de conversation** : route
  `POST /api/sessions/:id/language` (chacun ne modifie que SON côté, broadcast
  `session_status`), barre de langue tappable dans `conversation/[id].tsx`
  (`LanguageSelector` dans un `Modal`), `conversationsService.setMyLanguage`.
  Messages déjà envoyés inchangés (langue figée à l'envoi). (b) **garde « une
  seule conversation à la fois »** (§ Garde). Worker `d02ac2e8`.
- **Itér. 6** — (a) langues de conversation **`ja` / `ko` / `hi`** ajoutées.
  (b) **UI multilingue + détection de la locale de l'appareil** (§ i18n) : 8 blocs
  de traduction, `expo-localization`, `resolveInitialUiLanguage()`. ⚠️ bloc `lo`
  traduit à la machine — à faire relire. (c) tuning VAD « direct plus réactif » —
  **annulé à l'itér. 8**. Worker `65ceeb07`, dépendance `expo-localization ~57.0.1`.
- **Itér. 5** — `ConfirmDialog` (`Modal` RN, marche web où `Alert.alert` est
  inerte) pour « Quitter » + « l'autre a quitté » ; écran QR sans code ; saisie
  web = lien collé. Web only.
- **Itér. 4** — invitation = lien seul ; fix audio web (`read-audio.web.ts`, vrai
  `blob.type`) ; bouton micro = appui unique (start/stop). Web only.
- **Itér. 3** (Worker `90e9aa76`) — VAD phrase-par-phrase (retiré itér. 8) ;
  version web sur Cloudflare Pages.
- **Itér. 2** (Worker `e45159dd`) — chaîne de repli multi-modèles Gemini (§ Latence) ;
  safe-area conversation ; lien HTTPS `/join/<token>` + App Links Android ;
  alerte départ participant ; builds = 1 fichier écrasé.

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
  features/        conversation/use-audio-capture.ts, conversation/conversation-guard.tsx
  hooks/           use-auth, use-live-session, use-app-realtime, use-theme, i18n via src/i18n
  i18n/            translations.ts (8 langues, TOUS les écrans) + useT()/translate()
                   + device-locale.ts (langue d'UI = locale de l'appareil)
  lib/             api-client.ts, auth-client.ts (better-auth expo)
  services/        ai/ auth/ conversations/ realtime/ inbox/ contacts/ nearby/
  stores/          settings (uiLanguage + uiLanguageExplicit), session, new-conversation, pending-join, inbox
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

Langues de **conversation** : `lo, fr, en, th, zh, ja, ko, hi` — UNIQUEMENT dans
`src/config/languages.ts` (app) et `server/src/languages.ts` (miroir) +
`LANGUAGE_NAMES` dans `server/src/ai.ts`. Jamais en dur ailleurs.

## i18n de l'interface (§18)

Langues d'UI = `UI_LANGUAGES` (`src/config/languages.ts`) : **fr (référence), en,
lo, th, zh, ja, ko, hi**. Tout passe par `src/i18n/` : `translations.ts` (objet
`TRANSLATIONS` à 8 blocs, `TranslationKey` dérive de `fr` ; l'accès typé
`TRANSLATIONS[lang][key]` dans `index.ts` force tsc à exiger EXACTEMENT les mêmes
clés dans chaque bloc) + `useT()` (hook) / `translate()` (hors React). Repli
d'exécution : `lang → en → fr → clé brute`. Interpolation :
`t('host.expiresIn', { time })` remplace `{time}`.
**Jamais de texte visible en dur dans un écran** — ajouter la clé dans les 8 blocs.
Bloc `lo` = traduction machine, à faire relire par un locuteur natif.

**Détection de la locale de l'appareil** : `src/i18n/device-locale.ts`
(`resolveInitialUiLanguage()` = 1ʳᵉ locale `expo-localization` `getLocales()`
présente dans `UI_LANGUAGES`, sinon `en`). `settings-store` : `uiLanguage` +
flag `uiLanguageExplicit` (persistés). Au rehydrate, si `!uiLanguageExplicit`,
`uiLanguage` est réévalué depuis la locale ; `setUiLanguage` (écran Réglages)
passe le flag à `true` et fige le choix. Le sélecteur de Réglages est généré
depuis `UI_LANGUAGES` (drapeau + endonyme). Web : `getLocales()` lit
`navigator.language`.
Les titres de la nav sont dans `_layout.tsx` via `useT()` (clés `nav.*`).

**Priorité `?hl=` sur le web (itér. 9)** : `uiLanguageFromUrl()` lit
`?hl=<code>` (ou `?lang=`) de l'URL et l'emporte sur `getLocales()`. La page de
rebond `/join` du Worker le renseigne avec la langue détectée côté serveur
(`Accept-Language`) → l'invité qui arrive par lien voit le web dans la bonne
langue même si `navigator.language` du navigateur mobile est faux. Correctif de
secours toujours visible : `UiLanguageBar` (`src/components/ui/ui-language-bar.tsx`)
sur `welcome` et `scan` (web) — pastilles drapeau+endonyme, écrit `setUiLanguage`
(donc `uiLanguageExplicit=true`). `welcome` affiche en plus une bannière
« invité » quand `pendingJoinStore` a un token.

## Rate limiting (proxy Gemini)

`server/src/rate-limit.ts` (`enforceRateLimit`, fail-open) + bindings
`ratelimits` dans `wrangler.jsonc` (`period` ∈ {10, 60} uniquement) :
- `MSG_RATE_LIMITER` — 20/60 s par user sur `POST /api/sessions/:id/messages` ;
- `AI_RATE_LIMITER` — 12/60 s par user sur `POST /api/ai/{process,translate}`.
Clé = `msg:<userId>` / `ai:<userId>`. Dépassement → `429 {code:"rate_limited"}`.
Best-effort par colo (pas global) — suffisant pour le contrôle de coût.
Better Auth garde son rate limiting intégré côté `/api/auth/*`.

## Capture audio

`src/features/conversation/use-audio-capture.ts` : enveloppe simple d'`expo-audio`,
**un seul segment par prise de parole**. Bouton **appui unique** :
1er tap → `capture.start()` (on parle librement, aussi longtemps qu'on veut),
2e tap → `capture.stop()` → le fichier complet part une seule fois en
transcription + traduction (`conversation/[id].tsx` `toggleRecord`, état local
`recording`, `micBusyRef` anti-double-tap, `capture.cancel()` au démontage).
**La segmentation automatique VAD phrase-par-phrase « en direct » a été retirée**
(itér. 8 — pas assez fluide/précise en pratique ; retour au record → stop →
traduis). Le serveur streame toujours la sortie Gemini et rediffuse au pair des
instantanés partiels (`messages.ts`, ~80 ms) → la bulle se remplit
progressivement, mais il n'y a plus qu'un message par prise de parole.

**Upload audio — spécifique plateforme** : `src/services/conversations/read-audio.ts`
(natif : `expo-file-system` lit le fichier local, mime déduit de l'extension) vs
`read-audio.web.ts` (web : `fetch(blob:)` → `blob.arrayBuffer()` + **vrai**
`blob.type`). Indispensable sur le web où `expo-audio` rend un `blob:` webm/opus
et où deviner le mime donnait `audio/mp4` → Gemini n'arrivait pas à transcrire.

## Une seule conversation à la fois (garde)

`src/features/conversation/conversation-guard.tsx` : `ConversationGuardProvider`
(monté dans `_layout.tsx` autour du `<Stack>`) + hook `useConversationGuard()` →
`guard(proceed)`. Si `session-store.session` existe avec un statut
`waiting|connecting|active`, `guard` ouvre un `ConfirmDialog`
« Quitter la conversation en cours pour accéder à la nouvelle ? » (Oui/Non) ;
« Oui » = `endSession` (créateur) / `leaveSession` (participant) + `clear()` puis
`proceed()`. Enveloppent leur action : `new-conversation` (`chooseMethod` pour
`qr`/`link`), `scan`, `join/[token]`, `contacts` (`startConversation`), `nearby`
(`connect`), `conversation-invite-modal` (`accept`).
`session-store.clear()` est appelé sur **toute sortie propre** (`conversation/[id].tsx`
`leave()` + dialog « peer left ») — sinon la garde bloquait à tort après coup.
`_layout.tsx` `useAuthRouting` : un deep link entrant ne redirige plus vers
`/join/:token` si l'utilisateur est sur `conversation/[id]` (token consommé au retour).

## Changer de langue en cours de conversation

`POST /api/sessions/:id/language` (`server/src/sessions.ts`) : chaque participant
ne modifie que **son** côté (`creator_language` / `participant_language` selon
`isCreator`), refuse si = langue de l'autre, diffuse `session_status` au room.
Client : `conversationsService.setMyLanguage`, barre de langue tappable sous le
topbar de `conversation/[id].tsx` (réutilise `LanguageSelector` dans un `Modal`).
Les messages déjà envoyés gardent leur `sourceLanguage`/`targetLanguage` (figés à
l'envoi dans `messages.ts`) ; seuls les suivants suivent la nouvelle langue.

## Liens de partage / deep links

- **`session.joinUrl` = URL HTTPS** `https://lingolink-api.ichigo35.workers.dev/join/<token>`
  (plus `lingolink://…` : non cliquable dans WhatsApp). Construit dans
  `server/src/sessions.ts` `toDto()` à partir de `BETTER_AUTH_URL`.
- **`server/src/join.ts`** :
  - `GET /join/:token` → page HTML légère qui rebondit vers
    `lingolink://join/<token>` (bouton de secours). Sert aussi de cible App Links.
    **Traduite (8 langues d'UI) via `Accept-Language`** (`T` + `pickLang`), le
    bouton navigateur pointe vers `<WEB_APP_URL>/join/<token>?hl=<code>`.
    Auto-redirection scheme après 1200 ms, seulement si l'onglet est visible.
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
  après la connexion invité, d'où retour à la saisie manuelle).
- **`JoinScreen` n'efface PLUS le token en attente à son montage** (itér. 9) :
  sur le web, l'invité non connecté qui ouvre `/join/<token>` est renvoyé vers
  `/welcome`, se connecte en invité, et `useAuthRouting` doit pouvoir le
  ramener sur `/join/<token>` — le token doit survivre à cet aller-retour.
  Il est effacé uniquement : jointure réussie, invitation définitivement
  invalide (`ApiRequestError`), ou sortie via `leave()` (bouton Annuler / Accueil
  — sinon `useAuthRouting` renvoie en boucle sur `/join`). La boucle authed est
  déjà bloquée par `current !== 'join'` dans `useAuthRouting`.
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

Pistes libres :
- Faire **relire les traductions d'UI** (surtout `lo`, idéalement `th`/`hi`) par
  un locuteur natif — le bloc `lo` est de la traduction machine.
- **Gemini Live API (bidi mot-à-mot)** : rouvrir seulement si la facturation
  Gemini est activée un jour (nécessiterait un streaming PCM natif + un proxy
  WebSocket Worker/DO). Le « direct » VAD phrase-par-phrase a été essayé puis
  retiré (itér. 8, pas assez fluide/précis).
- Monitoring d'erreurs (Sentry) — bloqué : besoin d'un DSN de l'utilisateur.
- Rate limiting Better Auth avec `storage: "database"` (migration `rateLimit`).
- Tests automatisés (Vitest `@cloudflare/vitest-pool-workers` côté server).
- AAB pour le Play Store — **repoussé** (demande explicite de l'utilisateur).
- `ai-test.tsx` : chaînes en dur, écran dev-only (`__DEV__`) — à i18n si un jour
  exposé en prod.
