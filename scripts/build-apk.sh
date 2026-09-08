#!/usr/bin/env bash
# Build APK release Android en local et l'écrit TOUJOURS au même endroit :
#   build-output/LingoLink.apk   (écrase la version précédente — jamais de fichier daté)
#
# Usage :
#   bash scripts/build-apk.sh            # arm64-v8a seul (~55 Mo, rapide)
#   bash scripts/build-apk.sh universal  # toutes ABIs (~132 Mo)
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:-arm64}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"

npx expo prebuild -p android --clean

GRADLE_ARGS=":app:assembleRelease"
[ "$MODE" = "arm64" ] && GRADLE_ARGS="$GRADLE_ARGS -PreactNativeArchitectures=arm64-v8a"

( cd android && ./gradlew $GRADLE_ARGS )

mkdir -p build-output
SRC="android/app/build/outputs/apk/release/app-release.apk"
[ -f "$SRC" ] || SRC="android/app/build/outputs/apk/release/app-arm64-v8a-release.apk"
cp -f "$SRC" build-output/LingoLink.apk
echo "→ build-output/LingoLink.apk ($(du -h build-output/LingoLink.apk | cut -f1))"
