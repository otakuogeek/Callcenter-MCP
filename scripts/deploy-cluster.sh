#!/bin/bash
# ==============================================
# BIOSANAR IPS - DEPLOY CLUSTER (Server 1 + Server 2)
# ==============================================
# Uso: ./deploy-cluster.sh
# Descripción: Compila el backend en Server 1 y lo despliega a ambos nodos
# Requiere: sshpass instalado (apt install sshpass)
# ==============================================

set -e  # Salir si algún comando falla

# Configuración de servidores
SERVER1_PATH="/home/ubuntu/app/backend"
SERVER2_IP="72.62.164.88"
SERVER2_PASS="Silv5514@cor"
SERVER2_PATH="/home/ubuntu/app/backend"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=15"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()    { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
log_error()   { echo -e "${RED}[✗]${NC} $1"; }
log_section() { echo -e "\n${BLUE}==> $1${NC}"; }

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     BIOSANAR CLUSTER DEPLOYMENT SCRIPT       ║"
echo "║    Server 1: Local  |  Server 2: $SERVER2_IP ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# --- PASO 1: Compilar en Server 1 ---
log_section "PASO 1: Compilando backend en Server 1..."
cd "$SERVER1_PATH"
npm run build
log_info "Build completado: dist/server.js"

# --- PASO 2: Reiniciar Server 1 ---
log_section "PASO 2: Reiniciando backend en Server 1..."
pm2 restart cita-central-backend --update-env
sleep 3
pm2 status cita-central-backend | grep -E "online|status" | head -3
log_info "Server 1 actualizado"

# --- PASO 3: Sincronizar dist a Server 2 ---
log_section "PASO 3: Sincronizando código a Server 2 ($SERVER2_IP)..."
SSHPASS="$SERVER2_PASS" rsync -avz --progress \
  --rsh="sshpass -e ssh $SSH_OPTS" \
  "$SERVER1_PATH/dist/" \
  "root@$SERVER2_IP:$SERVER2_PATH/dist/" 2>&1 | tail -5
log_info "Código sincronizado a Server 2"

# --- PASO 4: Reiniciar Server 2 ---
log_section "PASO 4: Reiniciando backend en Server 2..."
sshpass -p "$SERVER2_PASS" ssh $SSH_OPTS root@$SERVER2_IP \
  "cd $SERVER2_PATH && pm2 restart cita-central-backend --update-env && sleep 3 && pm2 status cita-central-backend | tail -5"
log_info "Server 2 actualizado"

# --- PASO 5: Verificar cluster ---
log_section "PASO 5: Verificando cluster..."
sleep 2

# Test Server 1
S1_STATUS=$(curl -sk -o /dev/null -w "%{http_code}" \
  --connect-timeout 5 http://127.0.0.1:4000/api/auth/login \
  -X POST -H "Content-Type: application/json" -d '{"email":"a","password":"b"}')
[ "$S1_STATUS" = "400" ] && log_info "Server 1 OK (HTTP $S1_STATUS)" || log_error "Server 1: HTTP $S1_STATUS"

# Test Server 2
S2_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --connect-timeout 8 http://$SERVER2_IP:4000/api/auth/login \
  -X POST -H "Content-Type: application/json" -d '{"email":"a","password":"b"}')
[ "$S2_STATUS" = "400" ] && log_info "Server 2 OK (HTTP $S2_STATUS)" || log_warn "Server 2: HTTP $S2_STATUS (esperar 10s mas...)"

# Test Load Balancer
LB_STATUS=$(curl -sk -o /dev/null -w "%{http_code}" \
  --connect-timeout 5 https://biosanarcall.site/api/auth/login \
  -X POST -H "Content-Type: application/json" -d '{"email":"a","password":"b"}')
[ "$LB_STATUS" = "400" ] && log_info "Load Balancer OK (HTTP $LB_STATUS)" || log_error "Load Balancer: HTTP $LB_STATUS"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║          DEPLOY COMPLETADO EXITOSAMENTE      ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
