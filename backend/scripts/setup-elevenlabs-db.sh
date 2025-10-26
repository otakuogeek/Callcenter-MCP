#!/bin/bash

# Script para crear las tablas de ElevenLabs en la base de datos

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔧 Iniciando creación de tablas de ElevenLabs...${NC}"

# Cargar variables de entorno
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Verificar que las variables estén configuradas
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    echo -e "${RED}❌ Error: Variables de entorno DB_HOST, DB_USER o DB_NAME no configuradas${NC}"
    exit 1
fi

# Ejecutar migración
echo -e "${YELLOW}📊 Ejecutando migración SQL...${NC}"

mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < migrations/create_elevenlabs_tables.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Tablas de ElevenLabs creadas exitosamente${NC}"
    
    # Verificar tablas creadas
    echo -e "${YELLOW}📋 Verificando tablas creadas...${NC}"
    
    mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
        SHOW TABLES LIKE 'elevenlabs%';
    "
    
    echo -e "${GREEN}✅ Migración completada${NC}"
else
    echo -e "${RED}❌ Error al crear tablas de ElevenLabs${NC}"
    exit 1
fi
