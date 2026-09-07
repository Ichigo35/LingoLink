#!/usr/bin/env bash
# Pousse les secrets de production sur Cloudflare depuis server/.dev.vars.
# Usage : cd server && bash deploy-secrets.sh
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .dev.vars ]; then
  echo "server/.dev.vars introuvable." >&2
  exit 1
fi

# Charge les variables (KEY=VALUE, ignore commentaires/vides).
set -a
# shellcheck disable=SC1091
. ./.dev.vars
set +a

put() {
  local name="$1"
  local value="${!name:-}"
  if [ -z "$value" ]; then
    echo "  - $name : vide, ignoré"
    return
  fi
  printf '%s' "$value" | npx wrangler secret put "$name" >/dev/null
  echo "  ✓ $name"
}

echo "Envoi des secrets vers Cloudflare (lingolink-api) :"
put DATABASE_URL
put BETTER_AUTH_SECRET
put GOOGLE_CLIENT_ID
put GOOGLE_CLIENT_SECRET
put GEMINI_API_KEY
echo "Terminé. Lance maintenant : npx wrangler deploy"
