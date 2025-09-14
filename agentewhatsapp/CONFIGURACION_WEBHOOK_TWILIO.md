# Configuración de Webhooks de Twilio WhatsApp

## Problema Identificado

El agente WhatsApp estaba recibiendo webhooks de **status de entrega** en lugar de **mensajes entrantes**, causando errores al intentar responder a números incorrectos.

## Solución Implementada

### 1. Endpoints Separados

- **Mensajes Entrantes**: `https://whatsapp.biosanarcall.site/webhook`
- **Status de Entrega**: `https://whatsapp.biosanarcall.site/webhook/status`

### 2. Configuración Requerida en Twilio Console

#### Para el Sandbox de WhatsApp:
1. Ir a: **Console > Develop > Messaging > Try it out > Send a WhatsApp message**
2. En "Sandbox Configuration":
   - **Webhook URL for incoming messages**: `https://whatsapp.biosanarcall.site/webhook`
   - **HTTP Method**: POST

#### Para Número Productivo (cuando esté disponible):
1. Ir a: **Console > Develop > Messaging > Senders > WhatsApp senders**
2. Seleccionar el número de WhatsApp
3. En "Webhook Configuration":
   - **Webhook URL for incoming messages**: `https://whatsapp.biosanarcall.site/webhook`
   - **Status callback URL**: `https://whatsapp.biosanarcall.site/webhook/status`
   - **HTTP Method**: POST

## Verificación

### 1. Probar Mensaje Entrante Simulado:
```bash
curl -X POST https://whatsapp.biosanarcall.site/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp%3A%2B1234567890&Body=Hola&MessageSid=test123&ProfileName=TestUser"
```

### 2. Probar Envío Manual:
```bash
curl -X POST https://whatsapp.biosanarcall.site/send-message \
  -H "Content-Type: application/json" \
  -d '{"to": "whatsapp:+NUMERO_REAL", "message": "Mensaje de prueba"}'
```

## Logs de Verificación

- **Messages entrantes**: Aparecerán como "Tipo de mensaje detectado" en logs
- **Status de entrega**: Aparecerán como "Status de entrega recibido" en logs

## Estado Actual

✅ **Modelo GPT-5-mini**: Funcionando correctamente
✅ **Filtro de webhooks**: Implementado
✅ **Endpoints separados**: Configurados
⚠️  **Configuración Twilio**: Pendiente actualizar en Console

## Próximos Pasos

1. Actualizar configuración en Twilio Console con los endpoints correctos
2. Probar envío de mensaje real desde WhatsApp
3. Verificar que el agente responde correctamente

## Notas Técnicas

- El agente filtra automáticamente webhooks de status (`MessageStatus`, `SmsStatus`)
- Se previenen loops ignorando mensajes del propio número del bot
- El modelo GPT-5-mini usa `max_completion_tokens` en lugar de `max_tokens`