#!/bin/bash

# Script de Despliegue del Módulo EPS/Especialidades
# Sistema: Biosanarcall Medical Management
# Fecha: 2025-01-11

set -e  # Detener en caso de error

echo "================================================"
echo "  Despliegue: Módulo EPS/Especialidades"
echo "================================================"
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directorios
FRONTEND_DIR="/home/ubuntu/app/frontend"
NGINX_DIR="/var/www/biosanarcall/html"
BACKUP_DIR="/home/ubuntu/app/backups/frontend-$(date +%Y%m%d-%H%M%S)"

echo -e "${BLUE}[1/7]${NC} Verificando directorios..."
if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}Error: No se encuentra el directorio del frontend${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Directorios verificados${NC}"
echo ""

echo -e "${BLUE}[2/7]${NC} Creando backup del frontend actual..."
sudo mkdir -p "$BACKUP_DIR"
if [ -d "$NGINX_DIR" ]; then
    sudo cp -r "$NGINX_DIR"/* "$BACKUP_DIR/" 2>/dev/null || echo "Sin archivos previos"
    echo -e "${GREEN}✓ Backup creado en: $BACKUP_DIR${NC}"
else
    echo -e "${YELLOW}⚠ No hay frontend previo para respaldar${NC}"
fi
echo ""

echo -e "${BLUE}[3/7]${NC} Instalando dependencias..."
cd "$FRONTEND_DIR"
npm install --silent
echo -e "${GREEN}✓ Dependencias instaladas${NC}"
echo ""

echo -e "${BLUE}[4/7]${NC} Compilando frontend..."
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Compilación exitosa${NC}"
else
    echo -e "${RED}✗ Error en la compilación${NC}"
    exit 1
fi
echo ""

echo -e "${BLUE}[5/7]${NC} Verificando archivos compilados..."
if [ ! -d "$FRONTEND_DIR/dist" ]; then
    echo -e "${RED}Error: No se generó la carpeta dist${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Archivos compilados verificados${NC}"
echo ""

echo -e "${BLUE}[6/7]${NC} Desplegando en nginx..."
sudo mkdir -p "$NGINX_DIR"
sudo rm -rf "$NGINX_DIR"/*
sudo cp -r "$FRONTEND_DIR/dist"/* "$NGINX_DIR/"
sudo chown -R www-data:www-data "$NGINX_DIR"
sudo chmod -R 755 "$NGINX_DIR"
echo -e "${GREEN}✓ Archivos desplegados en nginx${NC}"
echo ""

echo -e "${BLUE}[7/7]${NC} Reiniciando nginx..."
sudo nginx -t
if [ $? -eq 0 ]; then
    sudo systemctl reload nginx
    echo -e "${GREEN}✓ Nginx reiniciado correctamente${NC}"
else
    echo -e "${RED}✗ Error en la configuración de nginx${NC}"
    echo -e "${YELLOW}Restaurando backup...${NC}"
    sudo rm -rf "$NGINX_DIR"/*
    sudo cp -r "$BACKUP_DIR"/* "$NGINX_DIR/"
    sudo systemctl reload nginx
    exit 1
fi
echo ""

echo "================================================"
echo -e "${GREEN}✓ DESPLIEGUE COMPLETADO EXITOSAMENTE${NC}"
echo "================================================"
echo ""
echo -e "${YELLOW}Información:${NC}"
echo "  - URL: https://biosanarcall.site"
echo "  - Módulo: Settings → Gestión de Recursos → EPS/Especialidades"
echo "  - Backup: $BACKUP_DIR"
echo ""
echo -e "${YELLOW}Próximos pasos:${NC}"
echo "  1. Acceder a https://biosanarcall.site"
echo "  2. Iniciar sesión como administrador"
echo "  3. Ir a Settings (Configuración)"
echo "  4. Ir a la pestaña 'Gestión de Recursos'"
echo "  5. Hacer clic en la nueva pestaña 'EPS/Especialidades'"
echo ""
echo -e "${GREEN}✓ Listo para usar!${NC}"
echo ""
