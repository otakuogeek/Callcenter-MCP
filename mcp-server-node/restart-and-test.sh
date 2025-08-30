#!/bin/bash

echo "🔄 REINICIANDO SERVIDOR MCP"
echo "=========================="

# Cambiar al directorio
cd /home/ubuntu/app/mcp-server-node

# Reiniciar con PM2
pm2 restart biosanarcall-mcp-node-mysql

# Verificar estado
sleep 2
pm2 status

# Test del nuevo endpoint GET
echo ""
echo "🧪 PROBANDO NUEVO ENDPOINT GET:"
curl -s -H "X-API-Key: biosanarcall_mcp_node_2025" https://biosanarcall.site/mcp-elevenlabs | jq

echo ""
echo "✅ Servidor reiniciado. Ahora puedes probar 'Test connection' en ElevenLabs"
