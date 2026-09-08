#!/usr/bin/env bash
# Régénère les assets d'icône / splash de Lingo Link à partir des SVG sources.
# Dépendance : ImageMagick 7 (`magick`).  Usage : bash assets/icon-src/build.sh
#
# Design : bulle de dialogue blanche + 3 points bleus (#2F6BFF), minimaliste.
# NB : le moteur SVG d'ImageMagick n'gère que les fills plats — pas de
# gradient, pas de `stroke` seul. Garder les SVG en aplats.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
OUT="$SRC/../images"
BRAND="#2F6BFF"

render() { # svg  out  -> PNG 1024, supersample ×2 pour l'anti-aliasing
  magick -background none -density 384 "$1" -resize 2048x2048 -filter Lanczos -resize 1024x1024 "$2"
}

render "$SRC/glyph.svg"        "$SRC/.glyph.png"
render "$SRC/bubble-white.svg" "$SRC/.bubble.png"
render "$SRC/dots-black.svg"   "$SRC/.dots.png"

# Monochrome Android : bulle blanche MOINS les 3 points (trous alpha).
magick "$SRC/.bubble.png" "$SRC/.dots.png" -alpha set -compose DstOut -composite "$SRC/.mono.png"

# iOS + Android legacy : icône opaque (l'App Store refuse l'alpha).
magick -size 1024x1024 "xc:$BRAND" "$SRC/.glyph.png" -gravity center -composite \
  -alpha remove -alpha off -depth 8 -strip "$OUT/icon.png"

# Splash : glyph transparent (Expo le pose sur backgroundColor).
magick "$SRC/.glyph.png" -depth 8 -strip "$OUT/splash-icon.png"

# Android adaptatif (contenu dans la zone sûre ~76 %).
magick -size 1024x1024 "xc:$BRAND" -depth 8 -strip "$OUT/android-icon-background.png"
magick "$SRC/.glyph.png" -resize 76% -background none -gravity center -extent 1024x1024 \
  -depth 8 -strip "$OUT/android-icon-foreground.png"
magick "$SRC/.mono.png" -resize 76% -background none -gravity center -extent 1024x1024 \
  -depth 8 -strip "$OUT/android-icon-monochrome.png"

# Favicon web.
magick "$OUT/icon.png" -resize 196x196 -depth 8 -strip "$OUT/favicon.png"

rm -f "$SRC"/.glyph.png "$SRC"/.bubble.png "$SRC"/.dots.png "$SRC"/.mono.png
echo "OK — assets régénérés dans assets/images/"
