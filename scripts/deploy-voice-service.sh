#!/bin/bash

# Script de despliegue automático para el servicio de llamadas de voz
# Uso: ./deploy-voice-service.sh [production|staging]

set -e

ENVIRONMENT=${1:-production}
PROJECT_ROOT="/home/ubuntu/app"
VOICE_SERVICE_PATH="$PROJECT_ROOT/voice-call-service"
NGINX_CONFIG_PATH="/etc/nginx/sites-available"
NGINX_ENABLED_PATH="/etc/nginx/sites-enabled"

echo "🚀 Iniciando despliegue del servicio de llamadas de voz..."
echo "📋 Entorno: $ENVIRONMENT"
echo "📁 Ruta del proyecto: $VOICE_SERVICE_PATH"

# Verificar que estamos en el directorio correcto
cd "$PROJECT_ROOT"

# 1. Copiar configuración de entorno
echo "📄 Configurando variables de entorno..."
if [ "$ENVIRONMENT" = "production" ]; then
    cp "$VOICE_SERVICE_PATH/.env.production" "$VOICE_SERVICE_PATH/.env"
else
    cp "$VOICE_SERVICE_PATH/.env.development" "$VOICE_SERVICE_PATH/.env"
fi

# 2. Instalar dependencias del servicio de voz
echo "📦 Instalando dependencias del servicio de voz..."
cd "$VOICE_SERVICE_PATH"
npm install --production

# 3. Compilar TypeScript
echo "🔨 Compilando código TypeScript..."
npm run build

# 4. Crear directorio de logs
echo "📝 Configurando logs..."
mkdir -p logs
chmod 755 logs

# 5. Configurar PM2 para el servicio de voz
echo "⚙️ Configurando PM2 para el servicio de voz..."
pm2 delete voice-call-service 2>/dev/null || true
pm2 start ecosystem.config.js --only voice-call-service
pm2 save

# 6. Configurar Nginx para webhooks
echo "🌐 Configurando Nginx para webhooks..."
sudo cp "$VOICE_SERVICE_PATH/config/nginx-voice-config.conf" "$NGINX_CONFIG_PATH/voice-webhooks"
sudo ln -sf "$NGINX_CONFIG_PATH/voice-webhooks" "$NGINX_ENABLED_PATH/"

# Verificar configuración de Nginx
sudo nginx -t

# Recargar Nginx
sudo systemctl reload nginx

# 7. Verificar estado del servicio
echo "🔍 Verificando estado del servicio..."
sleep 5
pm2 status voice-call-service

# Test básico del servicio
echo "🧪 Probando conectividad del servicio..."
curl -f http://localhost:3001/health || echo "⚠️ Servicio no responde en puerto 3001"

# 8. Mostrar logs recientes
echo "📋 Logs recientes del servicio:"
pm2 logs voice-call-service --lines 10

echo ""
echo "✅ Despliegue completado!"
echo "📊 Estado del servicio: pm2 status voice-call-service"
echo "📝 Ver logs: pm2 logs voice-call-service"
echo "🔄 Reiniciar: pm2 restart voice-call-service"
echo ""
echo "🔗 Endpoints disponibles:"
echo "   - Health Check: http://localhost:3001/health"
echo "   - Webhook Zadarma: https://biosanarcall.site/webhook/zadarma"
echo ""
echo "⚠️ Recordatorio: Configurar las credenciales reales en .env antes de usar en producción"