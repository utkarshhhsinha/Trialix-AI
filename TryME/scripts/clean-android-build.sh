#!/bin/bash
# Fixes Gradle Kotlin errors like: last-build 2.bin (macOS duplicate files)
set -e
cd "$(dirname "$0")/.."

echo "Removing duplicate Kotlin cache files (last-build 2.bin)..."
find node_modules android -name 'last-build 2.bin' -delete 2>/dev/null || true

echo "Removing Android build folders..."
rm -rf android/build android/.gradle
find node_modules -path '*/android/build' -type d -exec rm -rf {} + 2>/dev/null || true

echo "Gradle clean..."
cd android
./gradlew clean --no-daemon

echo "Done. Run: npx expo run:android"
