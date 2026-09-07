# Déploiement du backend `lingolink-api` (Cloudflare Worker)

Compte Cloudflare déjà connecté via `wrangler` (OAuth, tcha.jimmy@gmail.com,
account `34cf747a1eaf3858a49e4fafaf9580e0`).

## 1. Développement local (aucun déploiement nécessaire)

```bash
cd server
npm install
npm run dev          # -> http://localhost:8787
```

Les secrets sont lus depuis `server/.dev.vars` (gitignored, déjà rempli).

- Simulateur iOS : l'app atteint `http://localhost:8787` directement.
- Émulateur Android : mettre `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8787` dans `.env`.

## 2. Déploiement (nécessaire pour tester sur un téléphone physique / prod)

```bash
cd server

# Secrets de production (une seule fois) — coller les valeurs de server/.dev.vars :
npx wrangler secret put DATABASE_URL
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
# (Phase 5) :
npx wrangler secret put GEMINI_API_KEY

# Premier déploiement :
npx wrangler deploy
# -> note l'URL renvoyée : https://lingolink-api.<sous-domaine>.workers.dev
```

Ensuite :
1. Mettre à jour `vars.BETTER_AUTH_URL` dans `wrangler.jsonc` avec cette URL, puis
   `npx wrangler deploy` à nouveau.
2. Dans la console Google Cloud (projet `lingo-link-507902` → Clients → « Lingo
   Link Web »), ajouter la redirect URI de prod :
   `https://lingolink-api.<sous-domaine>.workers.dev/api/auth/callback/google`.

Enfin, dans `../.env` de l'app :
```
EXPO_PUBLIC_API_BASE_URL=https://lingolink-api.<sous-domaine>.workers.dev
```

## 3. Migrations base de données

Le schéma Better Auth est déjà appliqué sur Neon (`server/migrations/0001_better_auth.sql`).
Pour régénérer après un changement de config auth :

```bash
set -a && . ./.dev.vars && set +a
npm run auth:generate      # écrit migrations/better-auth.sql
```
Puis appliquer le SQL sur Neon (console ou MCP).
