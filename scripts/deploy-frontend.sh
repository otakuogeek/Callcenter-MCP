#!/usr/bin/env bash
set -euo pipefail

WEBROOT="/var/www/biosanarcall.site/public_html"
FRONT_DIR="/home/ubuntu/app/frontend"

log() { echo -e "[deploy-frontend] $*"; }

log "Entrando a ${FRONT_DIR}"
cd "$FRONT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  log "ERROR: npm no está instalado en el sistema." >&2
  exit 1
fi

log "Instalando dependencias (si es necesario)"
if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then
  npm ci
else
  npm install
fi

log "Construyendo build de producción"
npm run build

log "Creando webroot ${WEBROOT} si no existe"
sudo mkdir -p "$WEBROOT"

log "Sincronizando dist -> ${WEBROOT}"
sudo rsync -ah --delete --info=stats1,progress2 dist/ "$WEBROOT"/

log "Eliminando archivos residuales *:Zone.Identifier"
sudo find "$WEBROOT" -maxdepth 1 -type f -name '*Zone.Identifier*' -delete || true

log "Probando configuración de Nginx"
sudo nginx -t

log "Recargando Nginx"
sudo systemctl reload nginx || sudo service nginx reload

log "Verificación rápida"
curl -sI -H 'Host: biosanarcall.site' https://127.0.0.1/ -k | sed -n '1,3p'

log "Despliegue completado"
