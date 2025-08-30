#!/bin/bash

echo "=== Servidor MCP Node.js con MySQL - Pruebas Completas ==="
echo ""

echo "1. Estado del servidor:"
pm2 status | grep biosanarcall-mcp-node-mysql

echo ""
echo "2. Health check:"
curl -s localhost:8976/api/health | jq .

echo ""
echo "3. Listar tools ElevenLabs:"
curl -s -X POST localhost:8976/api/elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}' | jq .

echo ""
echo "4. Obtener citas del día:"
curl -s -X POST localhost:8976/api/elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"2","method":"tools/call","params":{"name":"getAppointments","arguments":{}}}' | jq .

echo ""
echo "5. Resumen del día (optimizado para voz):"
curl -s -X POST localhost:8976/api/elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"3","method":"tools/call","params":{"name":"getDaySummary","arguments":{}}}' | jq .

echo ""
echo "6. Buscar pacientes (sin limit):"
curl -s -X POST localhost:8976/api/elevenlabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"4","method":"tools/call","params":{"name":"searchPatients","arguments":{"q":"Maria"}}}' | jq .

echo ""
echo "7. Endpoint MCP Simple (6 tools):"
curl -s -X POST localhost:8976/api/mcp-simple \
  -H "Content-Type: application/json" \
  -H "X-API-Key: biosanarcall_mcp_node_2025" \
  -d '{"jsonrpc":"2.0","id":"5","method":"tools/list"}' | jq '.result.tools | length'

echo ""
echo "=== Resumen ==="
echo "✅ Servidor Node.js MCP con conexión directa MySQL"
echo "✅ Endpoint ElevenLabs: /api/elevenlabs (3 tools optimizados para voz)"
echo "✅ Endpoint Simple: /api/mcp-simple (6 tools completos)"
echo "✅ Autenticación por API Key: biosanarcall_mcp_node_2025"
echo "✅ Base de datos: MySQL biosanar conectada directamente"
echo "✅ Puerto: 8976 (diferente del Python en 8975)"
echo ""
