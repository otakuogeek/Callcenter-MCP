#!/bin/bash

# Script para aplicar la migración de la tabla CUPS
# Fecha: 2025-10-15

echo "================================================"
echo "Aplicando migración: Tabla CUPS"
echo "================================================"
echo ""

# Configuración de base de datos
DB_HOST="127.0.0.1"
DB_USER="biosanar_user"
DB_PASS="/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU"
DB_NAME="biosanar"

# Archivo de migración
MIGRATION_FILE="/home/ubuntu/app/backend/migrations/20251015_create_cups_table.sql"

echo "📋 Información de la migración:"
echo "   - Archivo: 20251015_create_cups_table.sql"
echo "   - Base de datos: $DB_NAME"
echo "   - Host: $DB_HOST"
echo ""

# Verificar que el archivo existe
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: El archivo de migración no existe"
    exit 1
fi

echo "🔍 Verificando conexión a la base de datos..."
if ! mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" -e "SELECT 1" &>/dev/null; then
    echo "❌ Error: No se puede conectar a la base de datos"
    exit 1
fi
echo "✅ Conexión exitosa"
echo ""

# Crear tabla migration_log si no existe
echo "🔧 Verificando tabla de log de migraciones..."
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" <<EOF
CREATE TABLE IF NOT EXISTS migration_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  migration_file VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
EOF
echo "✅ Tabla migration_log lista"
echo ""

# Verificar si la migración ya fue aplicada
ALREADY_APPLIED=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -sN -e "SELECT COUNT(*) FROM migration_log WHERE migration_file = '20251015_create_cups_table.sql'")

if [ "$ALREADY_APPLIED" -gt 0 ]; then
    echo "⚠️  La migración ya fue aplicada anteriormente"
    read -p "¿Deseas volver a aplicarla? (s/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        echo "❌ Migración cancelada"
        exit 0
    fi
    echo "🔄 Replicando migración..."
fi

# Aplicar migración
echo "🚀 Aplicando migración..."
if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$MIGRATION_FILE"; then
    echo "✅ Migración aplicada exitosamente"
else
    echo "❌ Error al aplicar la migración"
    exit 1
fi

echo ""
echo "📊 Verificando tablas creadas..."

# Verificar tabla cups
CUPS_COUNT=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -sN -e "SELECT COUNT(*) FROM cups")
echo "   - Tabla 'cups': ✅ ($CUPS_COUNT registros)"

# Verificar tabla cups_services
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SHOW TABLES LIKE 'cups_services'" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   - Tabla 'cups_services': ✅"
fi

# Verificar tabla cups_eps_config
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SHOW TABLES LIKE 'cups_eps_config'" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   - Tabla 'cups_eps_config': ✅"
fi

echo ""
echo "📋 Estructura de la tabla CUPS:"
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "DESCRIBE cups"

echo ""
echo "================================================"
echo "✅ Migración completada exitosamente"
echo "================================================"
echo ""
echo "📌 Próximos pasos:"
echo "   1. Crear rutas API para gestión de CUPS"
echo "   2. Crear componentes frontend para CRUD"
echo "   3. Importar datos completos de CUPS desde PDF"
echo ""
