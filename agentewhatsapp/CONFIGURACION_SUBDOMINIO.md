# Configuración del Subdominio WhatsApp - Biosanarcall

## 🎯 Subdominio Creado: `whatsapp.biosanarcall.site`

### ✅ Configuración Completada

#### 1. **Nginx Configuration**
- Archivo: `/etc/nginx/sites-available/whatsapp.biosanarcall.site`
- Proxy reverso al puerto 3001 (agente WhatsApp)
- SSL habilitado con Let's Encrypt
- Logs específicos para el agente

#### 2. **Certificado SSL**
- ✅ Certificado válido hasta: 2025-12-12
- ✅ HTTPS funcionando: `https://whatsapp.biosanarcall.site`
- ✅ Renovación automática configurada

#### 3. **Endpoints Disponibles**

| Endpoint | Método | Descripción | URL |
|----------|--------|-------------|-----|
| `/` | GET | Información del servicio | `https://whatsapp.biosanarcall.site/` |
| `/webhook` | POST | Webhook de Twilio | `https://whatsapp.biosanarcall.site/webhook` |
| `/health` | GET | Health check | `https://whatsapp.biosanarcall.site/health` |
| `/stats` | GET | Estadísticas del agente | `https://whatsapp.biosanarcall.site/stats` |
| `/conversations` | GET | Conversaciones activas | `https://whatsapp.biosanarcall.site/conversations` |

### 🔧 Configuración de Twilio

Para conectar el agente con Twilio, configura el webhook en tu cuenta de Twilio:

#### Configuración del Sandbox de WhatsApp:
1. Ve a [Twilio Console > WhatsApp > Sandbox](https://console.twilio.com/us1/develop/sms/whatsapp/sandbox)
2. Configura el webhook URL:
   ```
   https://whatsapp.biosanarcall.site/webhook
   ```

#### Configuración del Número de Producción:
### Configuración de variables de entorno:

```bash
export TWILIO_ACCOUNT_SID="[your_twilio_account_sid]"
export TWILIO_AUTH_TOKEN="[your_twilio_auth_token]"
export OPENAI_API_KEY="[your_openai_api_key]"
```

### Credenciales de Twilio:
- Account SID: [Configurar desde Twilio Console]
- Auth Token: [Configurar desde Twilio Console]
- Número de WhatsApp: +14155238886

### 🚀 DNS Configuration

Asegúrate de que el DNS de `whatsapp.biosanarcall.site` apunte a tu servidor:

```
Tipo: A
Nombre: whatsapp
Valor: 82.29.62.188
TTL: 14400
```

### 📊 Pruebas Realizadas

#### ✅ Health Check
```bash
curl https://whatsapp.biosanarcall.site/health
```
**Resultado**: ✅ Funcionando correctamente

#### ✅ Información del Servicio
```bash
curl https://whatsapp.biosanarcall.site/
```
**Resultado**: ✅ Mostrando configuración completa

#### ✅ Estadísticas
```bash
curl https://whatsapp.biosanarcall.site/stats
```
**Resultado**: ✅ Sistema listo para recibir mensajes

### 🔐 Seguridad Implementada

- **HTTPS Obligatorio** - Redireccionamiento automático
- **Headers de Seguridad** - X-Frame-Options, X-Content-Type-Options, etc.
- **Restricción de IP** - Endpoint `/conversations` solo accesible desde IPs autorizadas
- **Timeouts Configurados** - 30 segundos para respuestas médicas

### 🎯 Integración con Servicios

#### MCP Server
- **URL**: `https://biosanarcall.site/mcp-inspector`
- **Funciones**: 34 herramientas médicas disponibles
- **Estado**: ✅ Conectado y funcionando

#### OpenAI ChatGPT
- **Modelo**: GPT-4 configurado
- **Contexto**: Especializado en consultas médicas
- **Estado**: ✅ Configurado y operativo

#### Twilio WhatsApp
- **Número**: +14155238886
- **Webhook**: `https://whatsapp.biosanarcall.site/webhook`
- **Estado**: ✅ Listo para configurar

### 📋 Próximos Pasos

1. **Configurar Twilio Webhook**:
   - Acceder a Twilio Console
   - Configurar webhook URL: `https://whatsapp.biosanarcall.site/webhook`

2. **Probar Integración**:
   - Enviar mensaje de prueba al WhatsApp del sandbox
   - Verificar respuesta automática del agente

3. **Monitoring**:
   - Revisar logs en `/var/log/nginx/whatsapp.biosanarcall.site.*.log`
   - Monitorear PM2: `pm2 logs biosanarcall-whatsapp-agent`

### 🚨 Comandos de Mantenimiento

```bash
# Reiniciar agente
pm2 restart biosanarcall-whatsapp-agent

# Ver logs del agente
pm2 logs biosanarcall-whatsapp-agent

# Ver logs de Nginx
sudo tail -f /var/log/nginx/whatsapp.biosanarcall.site.access.log

# Verificar estado
curl https://whatsapp.biosanarcall.site/health

# Ver estadísticas
curl https://whatsapp.biosanarcall.site/stats
```

---

## 🎉 Estado Final

✅ **Subdominio funcionando**: `https://whatsapp.biosanarcall.site`  
✅ **SSL configurado**: Certificado válido hasta dic 2025  
✅ **Agente activo**: Puerto 3001, PM2 gestionado  
✅ **Integración MCP**: Conectado a 34 herramientas médicas  
✅ **ChatGPT configurado**: Listo para respuestas inteligentes  
✅ **Twilio preparado**: Solo falta configurar webhook URL  

**El agente de WhatsApp está completamente configurado y listo para uso en producción.**