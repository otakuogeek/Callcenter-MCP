#!/usr/bin/env bash
# cleanup.sh — script seguro para identificar y (opcionalmente) eliminar archivos innecesarios
# Uso:
#   ./scripts/cleanup.sh           -> dry-run (lista los archivos candidatos)
#   ./scripts/cleanup.sh --delete  -> elimina archivos después de confirmación

set -euo pipefail

DRY_RUN=true
PRUNE_LOGS=false
MIN_LOG_SIZE_MB=50

while [[ ${1:-} != "" ]]; do
  case "$1" in
    --delete) DRY_RUN=false; shift ;;
    --prune-logs) PRUNE_LOGS=true; shift ;;
    --min-log-size) MIN_LOG_SIZE_MB="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Opción desconocida: $1"; exit 1 ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Workspace: $ROOT_DIR"

# Patrones a considerar para limpieza (añadir o quitar según convenga)
PATTERNS=(
  "*backup*.sql"
  "*.bak"
  "*.log"
  "*.pyc"
  "*.Zone.Identifier"
  "*.DS_Store"
  "Thumbs.db"
)

# Excluir rutas que normalmente se mantienen o contienen datos de producción
EXCLUDES=(
  "./backend/uploads"
  "./backend/logs/.gitkeep"
  "./frontend/dist"
  # Excluir entornos virtuales y módulos instalados
  "*/venv/*"
  "*/.venv/*"
  "*/node_modules/*"
  "./frontend/node_modules"
  "./mcp-server-python/venv"
  "./venv"
  "./backend/node_modules"
)

# Construir la porción de exclusión para find
EXCLUDE_EXPR=""
for e in "${EXCLUDES[@]}"; do
  EXCLUDE_EXPR+=" -path '$ROOT_DIR/$e' -prune -o"
done

# Construir expresión de patrones
PAT_EXPR=""
for p in "${PATTERNS[@]}"; do
  if [[ -z "$PAT_EXPR" ]]; then
    PAT_EXPR+=" -iname '$p'"
  else
    PAT_EXPR+=" -o -iname '$p'"
  fi
done

# Ejecutar find (usamos eval para expandir las cadenas construidas)
FIND_CMD="find '$ROOT_DIR' $EXCLUDE_EXPR \( $PAT_EXPR \) -print0"

# Obtener lista de archivos
IFS=$'\n' read -r -d '' -a FILES < <(eval "$FIND_CMD" | xargs -0 -I{} printf "%s\n" "{}" && printf '\0') || true

if [ ${#FILES[@]} -eq 0 ]; then
  echo "No se encontraron archivos candidatos."
  exit 0
fi

echo
echo "Archivos candidatos (ordenados por tamaño):"
printf '%s\n' "${FILES[@]}" | xargs -d '\n' -r du -b | sort -nr | awk '{printf "%8.1fM %s\n", $1/1024/1024, $2}'

if $DRY_RUN; then
  echo
  echo "Dry-run: no se eliminará nada. Ejecuta './scripts/cleanup.sh --delete' para borrar tras confirmar." 
  exit 0
fi

if $PRUNE_LOGS; then
  echo
  echo "Prune logs: truncando archivos .log mayores de ${MIN_LOG_SIZE_MB}MB (tras confirmación)."
  LOGS_CMD="find '$ROOT_DIR' $EXCLUDE_EXPR -iname '*.log' -print0"
  mapfile -t LOG_FILES < <(eval "$LOGS_CMD" | xargs -0 -I{} printf "%s\n" "{}")
  if [ ${#LOG_FILES[@]} -eq 0 ]; then
    echo "No se encontraron archivos .log para considerar."
  else
    printf '%s\n' "${LOG_FILES[@]}" | xargs -d '\n' -r du -b | awk -v min=$((MIN_LOG_SIZE_MB*1024*1024)) '$1>min {printf "%s\n", $2}' > /tmp/_large_logs.txt || true
    if [ -s /tmp/_large_logs.txt ]; then
      echo "Archivos .log grandes:" 
      xargs -a /tmp/_large_logs.txt -d '\n' -r du -h
      read -r -p "¿Truncar estos logs? escribe 'si' para confirmar: " C
      if [[ "$C" == "si" ]]; then
        xargs -a /tmp/_large_logs.txt -d '\n' -r -I{} sh -c 'truncate -s 0 "$1" && echo "Truncado: $1"' -- {}
      else
        echo "No se truncaron logs."
      fi
      rm -f /tmp/_large_logs.txt
    else
      echo "No hay logs mayores a ${MIN_LOG_SIZE_MB}MB."
    fi
  fi
fi

read -r -p "¿Deseas eliminar los archivos listados? escribe 'si' para confirmar: " CONFIRM
if [[ "$CONFIRM" != "si" ]]; then
  echo "Cancelado por el usuario. No se eliminará nada."
  exit 0
fi

echo "Eliminando..."
printf '%s\n' "${FILES[@]}" | xargs -d '\n' -r rm -v --

echo "Listo."
