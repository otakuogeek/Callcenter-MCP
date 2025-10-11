#!/bin/bash

# Script para iniciar el servidor MCP Simple Patient Register
# Biosanarcall Medical System

echo "🏥 Biosanarcall MCP Simple Patient Register"
echo "=========================================="

# Verificar si Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js no está instalado"
    exit 1
fi

# Verificar si PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    echo "❌ Error: PM2 no está instalado"
    echo "💡 Instalar con: npm install -g pm2"
    exit 1
fi

# Cambiar al directorio del proyecto
cd "$(dirname "$0")"

# Verificar si existe el archivo compilado
if [ ! -f "dist/server-simple-register.js" ]; then
    echo "📦 Compilando TypeScript..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ Error en la compilación"
        exit 1
    fi
fi

# Verificar si ya está ejecutándose
if pm2 describe mcp-simple-register &> /dev/null; then
    echo "♻️  El servidor ya está ejecutándose. Reiniciando..."
    pm2 restart mcp-simple-register
else
    echo "🚀 Iniciando servidor MCP..."
    pm2 start ecosystem-simple-register.config.json
fi

echo ""
echo "✅ Servidor iniciado exitosamente!"
echo ""
echo "📊 Estado:"
pm2 list | grep mcp-simple-register

echo ""
echo "🔧 Endpoints disponibles:"
echo "  - Health check: http://localhost:8978/health"
echo "  - MCP endpoint: http://localhost:8978/mcp"
echo "  - Info general: http://localhost:8978/"
echo ""
echo "📋 Herramienta disponible:"
echo "  - registerPatientSimple: Registro de pacientes con datos mínimos"
echo ""
echo "📝 Campos requeridos:"
echo "  - document: Cédula del paciente"
echo "  - name: Nombre completo"
echo "  - phone: Teléfono principal"
echo "  - insurance_eps_id: ID de la EPS"
echo ""
echo "📝 Campos opcionales:"
echo "  - email: Correo electrónico"
echo "  - birth_date: Fecha de nacimiento (YYYY-MM-DD)"
echo "  - gender: Género (Masculino/Femenino/Otro/No especificado)"
echo "  - address: Dirección"
echo "  - municipality_id: ID del municipio"
echo "  - notes: Notas adicionales"
echo ""
echo "🔍 Para ver logs: pm2 logs mcp-simple-register"
echo "⏹️  Para detener: pm2 stop mcp-simple-register"
echo ""

# Mostrar health check
echo "🏥 Estado de salud del servidor:"
sleep 2
curl -s http://localhost:8978/health | python3 -m json.tool 2>/dev/null || echo "⚠️  El servidor está iniciando, espere unos segundos..."