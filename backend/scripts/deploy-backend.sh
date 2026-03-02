#!/usr/bin/env bash
set -euo pipefail

PM2_APP_NAME="${1:-cita-central-backend}"
LOG_LINES="${2:-120}"
SKIP_WHATSAPP_CHECKLIST="${SKIP_WHATSAPP_CHECKLIST:-false}"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="logs"
GATE_LOG_FILE="${GATE_LOG_FILE:-${LOG_DIR}/deploy-gate-${TS}.log}"

mkdir -p "${LOG_DIR}"

echo "[deploy] Building backend..."
npm run build

if [[ "${SKIP_WHATSAPP_CHECKLIST}" == "true" ]]; then
  echo "[deploy] ⚠️ Saltando gate de checklist WhatsApp (SKIP_WHATSAPP_CHECKLIST=true)"
  echo "[deploy] Gate checklist omitido por configuración" > "${GATE_LOG_FILE}"
  echo "[deploy] Gate log: ${GATE_LOG_FILE}"
else
  echo "[deploy] Ejecutando gate: npm run test:whatsapp:checklist"
  if ! npm run test:whatsapp:checklist 2>&1 | tee "${GATE_LOG_FILE}"; then
    echo "[deploy] ❌ Gate bloqueado: el checklist de WhatsApp devolvió FAIL"
    echo "[deploy] Gate log: ${GATE_LOG_FILE}"

    LATEST_REPORT="$(ls -1t docs/WHATSAPP_CHECKLIST_AUTOMATIZADO_*.md 2>/dev/null | head -n1 || true)"
    if [[ -n "${LATEST_REPORT}" ]]; then
      echo "[deploy] Resumen de escenarios en FAIL:"
      awk '/^### /{name=substr($0,5)} /^- Estado: FAIL/{print " - " name}' "${LATEST_REPORT}" || true
      echo "[deploy] Reporte completo: ${LATEST_REPORT}"
    fi

    exit 1
  fi

  echo "[deploy] ✅ Gate checklist aprobado"
  echo "[deploy] Gate log: ${GATE_LOG_FILE}"
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[deploy] Error: pm2 no está instalado o no está en PATH"
  exit 1
fi

echo "[deploy] Restart PM2 app: ${PM2_APP_NAME}"
pm2 restart "${PM2_APP_NAME}"

echo "[deploy] Últimos ${LOG_LINES} logs de ${PM2_APP_NAME}:"
pm2 logs "${PM2_APP_NAME}" --lines "${LOG_LINES}" --nostream

echo "[deploy] OK"
