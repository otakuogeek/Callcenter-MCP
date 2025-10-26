#!/bin/bash

echo "🧹 Script para forzar actualización del frontend en navegadores"
echo "=============================================================="
echo ""

# Verificar que estamos en el directorio correcto
cd /home/ubuntu/app/frontend || exit 1

# Mostrar archivos actuales
echo "📁 Archivos JavaScript actuales en dist:"
ls -lh dist/assets/*.js | awk '{print $9, $5, $6, $7, $8}'
echo ""

# Agregar timestamp único para forzar rebuild
TIMESTAMP=$(date +%s)
echo "⏰ Timestamp: $TIMESTAMP"
echo ""

# Agregar comentario con timestamp al archivo principal
echo "// Updated: $TIMESTAMP" >> src/main.tsx

# Recompilar
echo "🔨 Recompilando frontend..."
npm run build

# Revertir cambio
git checkout src/main.tsx 2>/dev/null || true

echo ""
echo "📁 Nuevos archivos JavaScript en dist:"
ls -lh dist/assets/*.js | awk '{print $9, $5, $6, $7, $8}'
echo ""

echo "✅ Frontend recompilado"
echo ""
echo "📢 INSTRUCCIONES PARA EL USUARIO:"
echo "=================================="
echo ""
echo "El frontend ha sido actualizado en el servidor."
echo "Para ver los cambios, debes limpiar el caché de tu navegador:"
echo ""
echo "🔹 OPCIÓN 1: Hard Refresh (RECOMENDADO)"
echo "   Windows/Linux: Ctrl + Shift + R  o  Ctrl + F5"
echo "   Mac: Cmd + Shift + R"
echo ""
echo "🔹 OPCIÓN 2: Herramientas de Desarrollador"
echo "   1. Presiona F12 para abrir DevTools"
echo "   2. Clic derecho en el botón Recargar"
echo "   3. Selecciona 'Vaciar caché y recargar de forma forzada'"
echo ""
echo "🔹 OPCIÓN 3: Ventana Incógnita"
echo "   Abre https://biosanarcall.site/queue en modo incógnito"
echo ""
echo "🔹 OPCIÓN 4: Limpiar caché manualmente"
echo "   Chrome: Configuración > Privacidad > Borrar datos de navegación"
echo "   Firefox: Opciones > Privacidad > Limpiar datos"
echo ""
