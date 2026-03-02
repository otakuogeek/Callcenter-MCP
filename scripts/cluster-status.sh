#!/bin/bash
# Monitoreo rápido del estado del cluster

SERVER2_IP="72.62.164.88"
SERVER2_PASS="Silv5514@cor"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=5"

echo ""
echo "======================================"
echo "   CLUSTER BIOSANAR - ESTADO ACTUAL   "
echo "======================================"
echo ""

# Server 1
echo "SERVER 1 (82.29.62.188 - Principal):"
pm2 status cita-central-backend 2>/dev/null | grep -E "cita-cen|name" | head -3
echo "  MariaDB: $(systemctl is-active mariadb)"
echo "  Redis:   $(systemctl is-active redis-server)"
echo "  Nginx:   $(systemctl is-active nginx)"
echo "  NFS:     $(systemctl is-active nfs-kernel-server)"

echo ""
echo "SERVER 2 ($SERVER2_IP - Réplica):"
sshpass -p "$SERVER2_PASS" ssh $SSH_OPTS root@$SERVER2_IP \
  "pm2 status cita-central-backend 2>/dev/null | grep -E 'cita-cen|name' | head -3; \
   echo '  NFS montado: '$(mount | grep uploads | wc -l)' punto(s)'" 2>&1

echo ""
echo "LOAD BALANCER (biosanarcall.site):"
LB=$(curl -sk -o /dev/null -w "%{http_code}" --connect-timeout 5 \
  https://biosanarcall.site/api/auth/login \
  -X POST -H "Content-Type: application/json" -d '{}')
echo "  API Response: HTTP $LB"
echo ""
