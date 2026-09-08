#!/usr/bin/env bash
# Régénère les assets d'icône / splash de Lingo Link à partir du SVG source.
# Dépendance : ImageMagick 7 (`magick`).  Usage : bash assets/icon-src/build.sh
#
# Logo : deux « maillons » (anneaux à coins arrondis, en forme de bulle) qui
# s'entrelacent — le « Link » de Lingo Link. Blanc sur #2F6BFF.
# NB : le moteur SVG d'ImageMagick ne gère que les aplats (pas de gradient ni de
# `stroke` seul) mais honore `fill-rule="evenodd"` (le trou de l'anneau).
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
OUT="$SRC/../images"
BRAND="#2F6BFF"

# 1024, supersample ×2 pour l'anti-aliasing.
render() { magick -background none -density 384 "$1" -resize 2048x2048 -filter Lanczos -resize 1024x1024 "$2"; }

render "$SRC/link-ring.svg" "$SRC/.a.png"
magick "$SRC/.a.png" -rotate 180 "$SRC/.b.png"

# Entrelacs : B derrière A ; on creuse un fin liseré (fond) autour de A dans B
# pour que le tressage se lise ; puis on repose le croisement haut-gauche de A
# par-dessus B => A devant en haut-gauche, B devant en bas-droite = maillon.
magick "$SRC/.a.png" -morphology Dilate Octagon:11 "$SRC/.ad.png"
magick "$SRC/.b.png" "$SRC/.ad.png" -compose DstOut -composite "$SRC/.bcut.png"
magick "$SRC/.a.png" "$SRC/.bcut.png" -compose over -composite "$SRC/.w.png"
magick "$SRC/.a.png" -crop 124x132+534+332 +repage "$SRC/.patch.png"
magick "$SRC/.w.png" "$SRC/.patch.png" -geometry +534+332 -compose over -composite "$SRC/.glyph.png"

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
# le liseré transparent entre les maillons ressort dans la teinte du thème).
magick "$SRC/.glyph.png" -resize 74% -background none -gravity center -extent 1024x1024 \
  -depth 8 -strip "$OUT/android-icon-monochrome.png"

# Favicon web.
magick "$OUT/icon.png" -resize 196x196 -depth 8 -strip "$OUT/favicon.png"

rm -f "$SRC"/.a.png "$SRC"/.b.png "$SRC"/.ad.png "$SRC"/.bcut.png "$SRC"/.w.png "$SRC"/.patch.png "$SRC"/.glyph.png
echo "OK — assets régénérés dans assets/images/"
