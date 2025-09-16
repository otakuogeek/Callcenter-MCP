#!/bin/bash

# Script de configuración para webhooks de Zadarma
# Ejecutar después de configurar las variables de entorno

echo "🎯 Configurando webhooks de Zadarma para el sistema de llamadas de voz..."

# Credenciales reales de Zadarma (del panel)
ZADARMA_API_KEY="2eeea07f46fcf59e3a10"
ZADARMA_API_SECRET="c87065c63195ad4b3da"

# URL del webhook 
WEBHOOK_URL="https://biosanarcall.site/webhook/zadarma"

echo "📡 Configurando webhook URL: $WEBHOOK_URL"
echo "🔑 Usando API Key: $ZADARMA_API_KEY"

# Función para hacer llamadas a la API de Zadarma
call_zadarma_api() {
    local method="$1"
    local params="$2"
    local timestamp=$(date +%s)
    
    # Crear firma según documentación de Zadarma
    local string_to_sign="${method}${params}${timestamp}"
    local signature=$(echo -n "$string_to_sign" | openssl dgst -sha1 -hmac "$ZADARMA_API_SECRET" -binary | base64)
    
    # Hacer la llamada
    curl -X POST "https://api.zadarma.com/v1/${method}/" \
        -H "Authorization: ${ZADARMA_API_KEY}:${signature}:${timestamp}" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "$params"
}

echo "🔧 Configurando webhook para eventos de llamadas..."

# Configurar webhook para eventos de llamadas
WEBHOOK_PARAMS="url=${WEBHOOK_URL}&events=NOTIFY_START,NOTIFY_END,NOTIFY_RECORD,NOTIFY_ANSWER"

echo "📞 Configurando webhook con parámetros: $WEBHOOK_PARAMS"

# Llamar a la API para configurar el webhook
response=$(call_zadarma_api "webhooks" "$WEBHOOK_PARAMS")

echo "📋 Respuesta de Zadarma:"
echo "$response" | jq '.' 2>/dev/null || echo "$response"

echo ""
echo "✅ Configuración de webhook completada!"
echo ""
echo "📋 Pasos adicionales requeridos:"
echo "1. Verificar en el panel de Zadarma que el webhook está configurado"
echo "2. Configurar un número DID para recibir llamadas"
echo "3. Habilitar grabación de llamadas en la configuración"
echo "4. Configurar IVR si es necesario"
echo ""
echo "🔍 URLs importantes:"
echo "   • Webhook: $WEBHOOK_URL"
echo "   • Health check: https://biosanarcall.site/api/voice-health"
echo "   • Stats: https://biosanarcall.site/api/voice/stats"
echo ""
echo "🧪 Para probar el webhook manualmente:"
echo 'curl -X POST https://biosanarcall.site/webhook/zadarma \'
echo '  -H "Content-Type: application/json" \'
echo '  -d "{"'
echo '    "event": "NOTIFY_START",'
echo '    "pbx_call_id": "test123",'
echo '    "caller_id": "+584263774021",'
echo '    "called_did": "+12345678900",'
echo '    "call_start": "2024-12-19 10:30:00"'
echo '  }"'

echo ""
echo "✨ ¡Configuración de Zadarma lista para llamadas de voz!"