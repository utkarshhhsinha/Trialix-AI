#!/bin/bash
# Single Metro on 8081 + adb reverse so the emulator can reach the dev server.
set -e
cd "$(dirname "$0")/.."

ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"

echo "Stopping stale Metro/Expo processes on 8081/8082..."
for port in 8081 8082; do
  pid=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    kill $pid 2>/dev/null || true
  fi
done
sleep 1

if [ -x "$ADB" ]; then
  echo "Setting adb reverse for port 8081..."
  "$ADB" reverse tcp:8081 tcp:8081 2>/dev/null || true
fi

# Android emulator reaches the host machine at 10.0.2.2
export REACT_NATIVE_PACKAGER_HOSTNAME=10.0.2.2

echo "Starting Expo dev server on port 8081 (host: 10.0.2.2 for emulator)..."
exec npx expo start --dev-client --clear --port 8081
