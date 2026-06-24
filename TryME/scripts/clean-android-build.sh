#!/bin/bash
# Safe Android cache reset — avoids breaking CMake/codegen (do NOT delete node_modules/android/build)
set -e
cd "$(dirname "$0")/.."

echo "Removing duplicate Kotlin cache files (last-build 2.bin)..."
find node_modules android -name 'last-build 2.bin' -delete 2>/dev/null || true

echo "Removing stale CMake + Android build caches..."
rm -rf android/app/.cxx
rm -rf android/build android/.gradle android/app/build

echo "Done. Rebuild with: npm run android"
echo "Or use Expo Go (JS only): npx expo start --go --clear"
