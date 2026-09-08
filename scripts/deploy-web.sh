#!/usr/bin/env bash
# Build la version web (Expo, SPA) et la déploie sur Cloudflare Pages (lingolink-web).
# → https://lingolink-web.pages.dev
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
npx expo export -p web --output-dir dist
printf '/*    /index.html   200\n' > dist/_redirects   # routage SPA (/join/<code>)

npx wrangler pages deploy dist --project-name=lingolink-web --branch=main --commit-dirty=true
