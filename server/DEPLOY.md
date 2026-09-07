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

# Secrets de production (une seule fois) :
npx wrangler secret put DATABASE_URL         # coller la chaîne Neon (endpoint -pooler)
npx wrangler secret put BETTER_AUTH_SECRET   # coller la valeur de .dev.vars
# (plus tard) :
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GEMINI_API_KEY

# Premier déploiement :
npx wrangler deploy
# -> note l'URL renvoyée : https://lingolink-api.<sous-domaine>.workers.dev
```

Ensuite, mettre à jour la variable publique `BETTER_AUTH_URL` dans
`wrangler.jsonc` (`vars.BETTER_AUTH_URL`) avec cette URL exacte, puis
`npx wrangler deploy` à nouveau.

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
