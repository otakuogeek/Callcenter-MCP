#!/bin/bash

# Script para generar citas de muestra en Biosanar
# Este script ejecuta el generador de citas TypeScript

echo "🏥 BIOSANAR - Generador de Citas de Muestra"
echo "============================================"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Este script debe ejecutarse desde el directorio del backend"
    echo "   Navega a /home/ubuntu/app/backend y ejecuta: ./scripts/seed-appointments.sh"
    exit 1
fi

# Verificar que el archivo TypeScript existe
if [ ! -f "scripts/seed-appointments.ts" ]; then
    echo "❌ Error: No se encuentra el archivo scripts/seed-appointments.ts"
    exit 1
fi

# Verificar que las dependencias estén instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

# Verificar variables de entorno
if [ ! -f ".env" ]; then
    echo "❌ Error: No se encuentra el archivo .env"
    echo "   Asegúrate de tener configurada la conexión a la base de datos"
    exit 1
fi

echo "🔍 Verificando conexión a la base de datos..."

# Cargar variables de entorno de manera segura
source .env 2>/dev/null || true

# Verificar conexión MySQL
mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT 1;" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "❌ Error: No se puede conectar a la base de datos"
    echo "   Verifica las credenciales en el archivo .env"
    exit 1
fi

echo "✅ Conexión a la base de datos exitosa"
echo ""

# Mostrar información actual
echo "📊 Estado actual del sistema:"
echo "=============================="

PATIENTS_COUNT=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT COUNT(*) FROM patients;" -s -N 2>/dev/null)
DOCTORS_COUNT=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT COUNT(*) FROM doctors;" -s -N 2>/dev/null)
APPOINTMENTS_COUNT=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT COUNT(*) FROM appointments;" -s -N 2>/dev/null)

echo "👥 Pacientes: $PATIENTS_COUNT"
echo "👨‍⚕️ Doctores: $DOCTORS_COUNT"
echo "📅 Citas actuales: $APPOINTMENTS_COUNT"
echo ""

# Preguntar confirmación
read -p "¿Desea generar citas de muestra? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Operación cancelada"
    exit 0
fi

echo "🚀 Iniciando generación de citas..."
echo ""

# Ejecutar el script TypeScript usando ts-node
if command -v ts-node >/dev/null 2>&1; then
    ts-node scripts/seed-appointments.ts
else
    echo "⚠️ ts-node no encontrado, compilando TypeScript..."
    npx tsc scripts/seed-appointments.ts --outDir dist/scripts --target es2020 --module commonjs --esModuleInterop --resolveJsonModule
    node dist/scripts/seed-appointments.js
fi

SCRIPT_EXIT_CODE=$?

echo ""
if [ $SCRIPT_EXIT_CODE -eq 0 ]; then
    echo "✅ ¡Generación de citas completada exitosamente!"
    
    # Mostrar estadísticas finales
    echo ""
    echo "📊 Estadísticas finales:"
    echo "======================="
    
    NEW_APPOINTMENTS_COUNT=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT COUNT(*) FROM appointments;" -s -N 2>/dev/null)
    GENERATED_COUNT=$((NEW_APPOINTMENTS_COUNT - APPOINTMENTS_COUNT))
    
    echo "📅 Total de citas ahora: $NEW_APPOINTMENTS_COUNT"
    echo "✨ Citas generadas: $GENERATED_COUNT"
    
    # Mostrar próximas citas
    echo ""
    echo "📅 Próximas 5 citas:"
    echo "==================="
    mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
        SELECT 
            CONCAT('📅 ', DATE_FORMAT(a.scheduled_at, '%d/%m/%Y %H:%i')) as Fecha,
            CONCAT('👤 ', p.name) as Paciente,
            CONCAT('👨‍⚕️ ', d.name) as Doctor,
            CONCAT('🏥 ', s.name) as Especialidad,
            CONCAT('📍 ', l.name) as Ubicacion,
            CONCAT('📋 ', a.status) as Estado
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN doctors d ON a.doctor_id = d.id
        JOIN specialties s ON a.specialty_id = s.id
        JOIN locations l ON a.location_id = l.id
        WHERE a.scheduled_at >= NOW()
        ORDER BY a.scheduled_at ASC
        LIMIT 5
    " 2>/dev/null
    
else
    echo "❌ Error en la generación de citas"
    exit 1
fi

echo ""
echo "🎉 ¡Proceso completado! Ahora puedes revisar las citas en el sistema."
