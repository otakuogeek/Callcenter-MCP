#!/usr/bin/env bash
set -e

# Script auxiliar para verificar que el frontend está disponible antes de generar el manual
# Por defecto verifica producción (https://biosanarcall.site)

BASE_URL="${BASE_URL:-https://biosanarcall.site}"

echo "Verificando si el frontend está disponible en $BASE_URL..."

# Intentar conectarse al frontend (con -k para ignorar cert issues si es https local)
if curl -s -k --max-time 10 "$BASE_URL" > /dev/null 2>&1; then
  echo "✓ Frontend disponible en $BASE_URL"
  exit 0
else
  echo ""
  echo "✗ Error: No se puede conectar al frontend en $BASE_URL"
  echo ""
  if [[ "$BASE_URL" == "http://localhost"* ]]; then
    echo "Asegúrate de que el frontend dev server esté corriendo:"
    echo "  cd frontend"
    echo "  npm run dev"
  else
    echo "Verifica que el servidor Nginx esté activo y sirviendo desde frontend/dist/"
    echo "  sudo systemctl status nginx"
    echo ""
    echo "Si quieres usar dev local en lugar de producción:"
    echo "  BASE_URL=http://localhost:8080 bash scripts/manual/run_manual_fixed.sh"
  fi
  echo ""
  exit 1
fi
