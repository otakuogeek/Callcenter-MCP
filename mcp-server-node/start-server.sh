#!/bin/bash

echo "🚀 INICIANDO SERVIDOR MCP PARA ELEVENLABS"
echo "========================================="

# Ir al directorio
cd /home/ubuntu/app/mcp-server-node

# Matar procesos existentes
pkill -f "biosanarcall-mcp-node-mysql"
sleep 2

# Iniciar servidor
echo "📦 Iniciando con PM2..."
pm2 start ecosystem-mysql.config.json
sleep 3

# Verificar estado
echo "📊 Estado del servidor:"
pm2 list | grep biosanarcall-mcp-node-mysql

# Test básico
echo ""
echo "🧪 Test básico del servidor:"
curl -s https://biosanarcall.site/mcp-node-health | jq -r '.status // "ERROR"'

# Test MCP con autenticación
echo ""
echo "🔐 Test MCP con autenticación:"
curl -s -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"test","method":"tools/list"}' | jq -r '.result.tools | length // "ERROR"'

# MCP Inspector
echo ""
echo "🔍 PARA USAR MCP INSPECTOR:"
echo "1. Abrir: http://localhost:6274"
echo "2. Transport: Streamable HTTP"
echo "3. URL: https://biosanarcall.site/mcp-elevenlabs"
echo "4. Auth Header: X-API-Key = biosanarcall_mcp_node_2025"

echo ""
echo "✅ Servidor listo para ElevenLabs!"
