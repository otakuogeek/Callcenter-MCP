#!/bin/bash
# Script de migración: Reemplazar console.log por logger centralizado
# Fase 1 - Tarea 3: Logger Centralizado
# 
# Uso:
#   chmod +x backend/scripts/migrate-console-logs.sh
#   ./backend/scripts/migrate-console-logs.sh

set -e

echo "🔄 Iniciando migración de console.log → logger..."
echo ""

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROUTES_DIR="$BACKEND_DIR/src/routes"
SERVICES_DIR="$BACKEND_DIR/src/services"
CONFIG_DIR="$BACKEND_DIR/src/config"

count=0

# Función auxiliar: reemplazar en archivo
replace_in_file() {
  local file="$1"
  if [ ! -f "$file" ]; then
    return
  fi

  # Agregar import si no existe
  if ! grep -q "from.*logger" "$file"; then
    # Encontrar la última línea de imports
    local last_import=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)
    if [ -n "$last_import" ]; then
      sed -i "${last_import}a import { logger } from '../lib/logger';" "$file"
    fi
  fi

  # Reemplazos específicos (en orden de preferencia)
  # 1. console.error → logger.error (con contexto)
  sed -i "s/console\.error(\(.*\))/logger.error('Error', undefined, { context: \1 })/g" "$file"
  
  # 2. console.warn → logger.warn
  sed -i "s/console\.warn(\(.*\))/logger.warn('Warning', { data: \1 })/g" "$file"
  
  # 3. console.log → logger.info
  sed -i "s/console\.log(\(.*\))/logger.info('Log event', { data: \1 })/g" "$file"

  count=$((count + 1))
}

echo "📝 Reemplazando en rutas..."
for file in "$ROUTES_DIR"/*.ts; do
  [ -f "$file" ] && replace_in_file "$file"
done

echo "📝 Reemplazando en servicios..."
for file in "$SERVICES_DIR"/*.ts; do
  [ -f "$file" ] && replace_in_file "$file"
done

echo "📝 Reemplazando en configuración..."
for file in "$CONFIG_DIR"/*.ts; do
  [ -f "$file" ] && replace_in_file "$file"
done

echo ""
echo "✅ Migración completada: $count archivos procesados"
echo ""
echo "⚠️  Revisa los cambios:"
echo "  cd $BACKEND_DIR"
echo "  git diff"
echo ""
echo "💡 Próximos pasos:"
echo "  1. Revisar manualmente los cambios (puede haber falsos positivos)"
echo "  2. Ejecutar tests: npm test"
echo "  3. Hacer commit: git commit -am 'feat: centralize logging (Fase 1)'"
