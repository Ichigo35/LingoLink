#!/usr/bin/env bash
# Régénère les assets d'icône / splash de Lingo Link à partir des SVG source.
# Dépendance : ImageMagick 7 (`magick`).  Usage : bash assets/icon-src/build.sh
#
# Logo (itér. 11, direction "Warm Bridge") : deux bulles de dialogue qui se
# chevauchent — le duo qui converse, cœur du produit. Blanc sur le corail de
# marque. Remplace l'ancien logo « deux maillons entrelacés ».
# NB : le moteur SVG d'ImageMagick ne gère que les aplats (pas de dégradé ni de
# `stroke` seul) — les deux bulles sont donc deux fichiers plats séparés,
# recomposés ici pour créer un fin liseré entre elles au point de recouvrement.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
OUT="$SRC/../images"
BRAND="#D14526"

# 1024, supersample ×2 pour l'anti-aliasing.
render() { magick -background none -density 384 "$1" -resize 2048x2048 -filter Lanczos -resize 1024x1024 "$2"; }

render "$SRC/bubble-back.svg" "$SRC/.back.png"
render "$SRC/bubble-front.svg" "$SRC/.front.png"

# Liseré : on creuse dans la bulle arrière la silhouette (légèrement dilatée)
# de la bulle avant, puis on repose la bulle avant par-dessus => un fin espace
# transparent apparaît entre les deux bulles au point de recouvrement.
magick "$SRC/.front.png" -morphology Dilate Octagon:10 "$SRC/.frontd.png"
magick "$SRC/.back.png" "$SRC/.frontd.png" -compose DstOut -composite "$SRC/.backcut.png"
magick "$SRC/.backcut.png" "$SRC/.front.png" -compose over -composite "$SRC/.glyph.png"

# iOS + Android legacy : icône opaque (l'App Store refuse l'alpha).
magick -size 1024x1024 "xc:$BRAND" "$SRC/.glyph.png" -gravity center -composite \
  -alpha remove -alpha off -depth 8 -strip "$OUT/icon.png"

# Splash : glyph transparent (Expo le pose sur backgroundColor).
magick "$SRC/.glyph.png" -depth 8 -strip "$OUT/splash-icon.png"

# Android adaptatif (contenu dans la zone sûre ~74 %).
magick -size 1024x1024 "xc:$BRAND" -depth 8 -strip "$OUT/android-icon-background.png"
magick "$SRC/.glyph.png" -resize 74% -background none -gravity center -extent 1024x1024 \
  -depth 8 -strip "$OUT/android-icon-foreground.png"
# Monochrome : même glyph blanc/transparent (Android n'utilise que l'alpha ;
# le liseré transparent entre les bulles ressort dans la teinte du thème).
magick "$SRC/.glyph.png" -resize 74% -background none -gravity center -extent 1024x1024 \
  -depth 8 -strip "$OUT/android-icon-monochrome.png"

# Favicon web.
magick "$OUT/icon.png" -resize 196x196 -depth 8 -strip "$OUT/favicon.png"

rm -f "$SRC"/.back.png "$SRC"/.front.png "$SRC"/.frontd.png "$SRC"/.backcut.png "$SRC"/.glyph.png
echo "OK — assets régénérés dans assets/images/"
