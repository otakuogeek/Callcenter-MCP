#!/bin/bash
# test_mcp.sh - Script de prueba automatizado para Biosanarcall MCP

BASE_URL="https://biosanarcall.site/mcp-py-simple"
HEADERS="Content-Type: application/json"

echo "🔍 Probando servidor MCP Biosanarcall..."
echo "=========================================="

# Test 1: Health check
echo "1. 🩺 Health check..."
HEALTH=$(curl -s https://biosanarcall.site/mcp-py-health | jq -r .status 2>/dev/null)
if [ "$HEALTH" = "ok" ]; then
    echo "   ✅ Servidor saludable"
else
    echo "   ❌ Servidor no responde"
    exit 1
fi

# Test 2: Initialize
echo "2. 🔧 Initialize..."
INIT=$(curl -s -X POST "$BASE_URL" -H "$HEADERS" -H "X-API-Key: biosanarcall_mcp_2025" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | jq -r .result.serverInfo.name 2>/dev/null)
if [ "$INIT" = "biosanarcall-mcp-simple" ]; then
    echo "   ✅ Inicialización exitosa"
else
    echo "   ❌ Error en inicialización"
fi

# Test 3: List tools
echo "3. 🛠️  Listing tools..."
TOOLS_COUNT=$(curl -s -X POST "$BASE_URL" -H "$HEADERS" -H "X-API-Key: biosanarcall_mcp_2025" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | jq '.result.tools | length' 2>/dev/null)
echo "   📊 Herramientas disponibles: $TOOLS_COUNT"

# Test 4: Ping
echo "4. 🏓 Ping test..."
PING=$(curl -s -X POST "$BASE_URL" -H "$HEADERS" -H "X-API-Key: biosanarcall_mcp_2025" \
  -d '{"jsonrpc":"2.0","id":3,"method":"ping"}' | jq -r .result.pong 2>/dev/null)
if [ "$PING" = "true" ]; then
    echo "   ✅ Ping successful"
else
    echo "   ❌ Ping failed"
fi

# Test 5: Day summary (nueva herramienta)
echo "5. 📅 Day summary test..."
SUMMARY_RESULT=$(curl -s -X POST "$BASE_URL" -H "$HEADERS" -H "X-API-Key: biosanarcall_mcp_2025" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"summarizeDayAppointments","arguments":{"date":"2025-08-19"}}}' | jq -r .result.content[0].text 2>/dev/null)

if [[ "$SUMMARY_RESULT" == *"Sin citas"* ]] || [[ "$SUMMARY_RESULT" == *"Citas"* ]]; then
    echo "   ✅ Tool functional: $SUMMARY_RESULT"
else
    echo "   ⚠️  Tool response: $SUMMARY_RESULT"
fi

# Test 6: Tools endpoint REST
echo "6. 🔍 REST tools endpoint..."
REST_TOOLS=$(curl -s https://biosanarcall.site/tools | jq .count 2>/dev/null)
echo "   📊 Tools via REST: $REST_TOOLS"

# Test 7: Performance test
echo "7. ⚡ Performance test..."
START_TIME=$(date +%s%N)
curl -s https://biosanarcall.site/mcp-py-health > /dev/null
END_TIME=$(date +%s%N)
LATENCY=$(( (END_TIME - START_TIME) / 1000000 ))
echo "   🕐 Latencia: ${LATENCY}ms"

echo ""
echo "=========================================="
echo "✅ Pruebas completadas"
echo ""
echo "📋 URLs para configurar en clientes MCP:"
echo "   • Completo: https://biosanarcall.site/mcp-py"
echo "   • Simple: https://biosanarcall.site/mcp-py-simple"
echo "   • ElevenLabs: https://biosanarcall.site/elevenlabs"
echo ""
echo "🔧 Para solucionar error de autorización:"
echo "   export BACKEND_TOKEN=\"tu_jwt_token\""
echo "   # Reiniciar servidor MCP"
