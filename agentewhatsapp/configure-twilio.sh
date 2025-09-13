#!/bin/bash

# Script de configuración del webhook de Twilio para Biosanarcall WhatsApp Agent
# Este script configura automáticamente el webhook en Twilio

echo "🔧 Configurando Webhook de Twilio para Biosanarcall WhatsApp Agent"
echo "=================================================="

# Variables de configuración
ACCOUNT_SID="[your_twilio_account_sid]"
AUTH_TOKEN="[your_twilio_auth_token]"
WEBHOOK_URL="https://whatsapp.biosanarcall.site/webhook"

echo "📞 Account SID: $ACCOUNT_SID"
echo "🌐 Webhook URL: $WEBHOOK_URL"
echo ""

# Función para configurar el webhook del sandbox
configure_sandbox() {
    echo "🔧 Configurando Sandbox de WhatsApp..."
    
    curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$ACCOUNT_SID/IncomingPhoneNumbers.json" \
        -u "$ACCOUNT_SID:$AUTH_TOKEN" \
        -d "SmsUrl=$WEBHOOK_URL" \
        -d "SmsMethod=POST"
    
    echo "✅ Configuración de sandbox completada"
}

# Función para verificar el webhook
test_webhook() {
    echo ""
    echo "🧪 Probando webhook..."
    
    # Probar health check
    HEALTH_STATUS=$(curl -s https://whatsapp.biosanarcall.site/health | jq -r '.status' 2>/dev/null)
    
    if [ "$HEALTH_STATUS" = "healthy" ]; then
        echo "✅ Agente de WhatsApp funcionando correctamente"
    else
        echo "❌ Error: Agente no responde correctamente"
        exit 1
    fi
    
    # Probar conectividad MCP
    echo "🔌 Verificando conexión con servidor MCP..."
    MCP_TEST=$(curl -s -X POST https://biosanarcall.site/mcp-inspector \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq -r '.result.tools | length' 2>/dev/null)
    
    if [ "$MCP_TEST" -gt "30" ]; then
        echo "✅ Servidor MCP funcionando ($MCP_TEST herramientas disponibles)"
    else
        echo "⚠️  Advertencia: Servidor MCP puede tener problemas"
    fi
}

# Función para mostrar información de configuración
show_config() {
    echo ""
    echo "📋 INFORMACIÓN DE CONFIGURACIÓN"
    echo "================================"
    echo "🌐 Subdominio: https://whatsapp.biosanarcall.site"
    echo "📞 Webhook URL: $WEBHOOK_URL"
    echo "📱 Número WhatsApp: +14155238886"
    echo ""
    echo "🔧 Endpoints disponibles:"
    echo "   - Health: https://whatsapp.biosanarcall.site/health"
    echo "   - Stats:  https://whatsapp.biosanarcall.site/stats"
    echo "   - Info:   https://whatsapp.biosanarcall.site/"
    echo ""
    echo "📝 Configuración manual en Twilio Console:"
    echo "   1. Ve a: https://console.twilio.com/us1/develop/sms/whatsapp/sandbox"
    echo "   2. Configura Webhook URL: $WEBHOOK_URL"
    echo "   3. Método: POST"
    echo ""
}

# Ejecutar configuración
echo "🚀 Iniciando configuración..."

test_webhook

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ CONFIGURACIÓN COMPLETADA"
    show_config
    
    echo "🎉 El agente de WhatsApp está listo para recibir mensajes!"
    echo ""
    echo "📱 Para probar, envía un mensaje WhatsApp a: +14155238886"
    echo "💬 Mensaje de inicio: 'join nearby-explain'"
    echo ""
else
    echo "❌ Error en la configuración. Revisa los logs."
    exit 1
fi