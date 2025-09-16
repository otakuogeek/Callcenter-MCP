#!/bin/bash

# Script para iniciar el servidor SIP proxy
echo "🌐 Iniciando servidor SIP proxy para Zadarma..."

# Cargar configuración específica del SIP proxy
export $(grep -v '^#' /home/ubuntu/app/voice-call-service/.env.sip-proxy | xargs)

# Detener cualquier proceso anterior en el puerto 3001
echo "🔄 Verificando puertos..."
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️ Puerto 3001 está en uso, deteniendo proceso..."
    pkill -f "node.*3001" || true
    sleep 2
fi

# Detener cualquier proceso anterior en el puerto 5060 (SIP)
if lsof -Pi :5060 -sUDP:LISTEN -t >/dev/null ; then
    echo "⚠️ Puerto 5060 está en uso, deteniendo proceso..."
    pkill -f "node.*5060" || true
    sleep 2
fi

# Cambiar al directorio del proyecto
cd /home/ubuntu/app/voice-call-service

# Iniciar el servidor
echo "🚀 Iniciando servidor con SIP proxy..."
npm start

echo "✅ Servidor SIP proxy iniciado"
echo "📞 Servidor SIP escuchando en puerto 5060"
echo "🌐 API HTTP escuchando en puerto 3001"
echo ""
echo "Para conectar Zadarma, configure:"
echo "  Servidor SIP: $(curl -s ifconfig.me):5060"
echo "  Protocolo: UDP"
echo ""
echo "Rutas de API disponibles:"
echo "  GET  /api/sip-proxy/status"
echo "  POST /api/sip-proxy/start"
echo "  POST /api/sip-proxy/stop"