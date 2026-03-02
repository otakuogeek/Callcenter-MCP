#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APK_DIR="$ROOT_DIR/apk"
ANDROID_DIR="$ROOT_DIR/android"
RELEASE_APK="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
APP_NAME_PREFIX="axial-mobile-v"

export NODE_ENV="${NODE_ENV:-production}"

detect_android_sdk() {
  local candidates=()

  if [[ -n "${ANDROID_HOME:-}" ]]; then
    candidates+=("$ANDROID_HOME")
  fi
  if [[ -n "${ANDROID_SDK_ROOT:-}" ]]; then
    candidates+=("$ANDROID_SDK_ROOT")
  fi

  candidates+=("/root/Android/Sdk" "/home/ubuntu/Android/Sdk" "/opt/android-sdk" "/usr/lib/android-sdk")

  for path in "${candidates[@]}"; do
    if [[ -d "$path/platform-tools" ]]; then
      echo "$path"
      return 0
    fi
  done

  return 1
}

ensure_android_sdk_config() {
  local sdk_path
  if ! sdk_path="$(detect_android_sdk)"; then
    echo "❌ No se encontró Android SDK."
    echo "   Define ANDROID_HOME o instala SDK en una ruta estándar (ej: /root/Android/Sdk)."
    exit 1
  fi

  export ANDROID_HOME="$sdk_path"
  export ANDROID_SDK_ROOT="$sdk_path"
  export PATH="$sdk_path/platform-tools:$PATH"

  mkdir -p "$ANDROID_DIR"
  cat > "$ANDROID_DIR/local.properties" <<EOF
sdk.dir=$sdk_path
EOF

  echo "✅ Android SDK detectado: $sdk_path"
}

echo "🔨 Building & Installing Axial Mobile APK"
echo "========================================="
echo ""

mkdir -p "$APK_DIR"

get_next_version() {
  local latest_version
  latest_version="$({
    find "$APK_DIR" -maxdepth 1 -type f -name "${APP_NAME_PREFIX}*.apk" -printf "%f\n" 2>/dev/null || true
  } | sed -E "s/^${APP_NAME_PREFIX}([0-9]+(\.[0-9]+)?)\.apk$/\1/" | sort -V | tail -n 1)"

  if [[ -z "$latest_version" ]]; then
    echo "0.1"
  else
    awk -v v="$latest_version" 'BEGIN { printf "%.1f", v + 0.1 }'
  fi
}

if [[ ! -d "$ANDROID_DIR" ]]; then
  echo "📁 No existe carpeta android/. Generando proyecto nativo con Expo..."
  (cd "$ROOT_DIR" && npx expo prebuild -p android --no-install)
  echo "✅ Proyecto android/ creado"
  echo ""
fi

ensure_android_sdk_config

echo "📦 Compilando APK de release..."
(cd "$ANDROID_DIR" && ./gradlew assembleRelease --no-daemon --quiet)

if [[ ! -f "$RELEASE_APK" ]]; then
  echo "❌ No se encontró la APK compilada en: $RELEASE_APK"
  exit 1
fi

VERSION="$(get_next_version)"
OUTPUT_APK="$APK_DIR/${APP_NAME_PREFIX}${VERSION}.apk"
cp "$RELEASE_APK" "$OUTPUT_APK"

echo "✅ APK compilada exitosamente"
echo "📁 Guardada en: $OUTPUT_APK"
echo ""

if command -v adb >/dev/null 2>&1 && [[ "$(adb devices | grep -v "List" | grep "device$" | wc -l)" -gt 0 ]]; then
  echo "📱 Instalando en dispositivo..."
  adb install -r "$OUTPUT_APK"
  echo "✅ Instalación completada"
else
  echo "ℹ️  No hay dispositivo ADB conectado."
  echo "   Para instalar luego: ./install_apk.sh"
fi
