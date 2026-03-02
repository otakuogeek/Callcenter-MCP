#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APK_DIR="$ROOT_DIR/apk"

if [[ -z "${ANDROID_HOME:-}" && -d "/root/Android/Sdk/platform-tools" ]]; then
  export ANDROID_HOME="/root/Android/Sdk"
  export ANDROID_SDK_ROOT="/root/Android/Sdk"
  export PATH="$ANDROID_HOME/platform-tools:$PATH"
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "❌ adb no está instalado o no está en PATH"
  exit 1
fi

if [[ ! -d "$APK_DIR" ]]; then
  echo "❌ No existe la carpeta apk/. Ejecuta primero ./build_apk.sh"
  exit 1
fi

LATEST_APK="$({
  find "$APK_DIR" -maxdepth 1 -type f -name "axial-mobile-v*.apk" -printf "%f\n" 2>/dev/null || true
} | sort -V | tail -n 1)"

if [[ -z "$LATEST_APK" ]]; then
  echo "❌ No hay APKs en apk/. Ejecuta primero ./build_apk.sh"
  exit 1
fi

if [[ "$(adb devices | grep -v "List" | grep "device$" | wc -l)" -eq 0 ]]; then
  echo "❌ No hay dispositivos ADB conectados"
  exit 1
fi

TARGET_APK="$APK_DIR/$LATEST_APK"
echo "📱 Instalando APK: $TARGET_APK"
adb install -r "$TARGET_APK"
echo "✅ Instalación completada"
