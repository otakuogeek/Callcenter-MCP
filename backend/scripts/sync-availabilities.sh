#!/bin/bash
# Script para sincronizar automáticamente las availabilities
# Se ejecuta cada 5 minutos via cron

LOG_FILE="/home/ubuntu/app/backend/logs/sync-availabilities.log"
DB_USER="biosanar_user"
DB_PASS="/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU"
DB_NAME="biosanar"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando sincronización automática" >> "$LOG_FILE"

# Ejecutar procedimiento almacenado
mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "CALL sync_all_availability_slots();" >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Sincronización completada exitosamente" >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Error en sincronización" >> "$LOG_FILE"
fi

# Mantener solo las últimas 1000 líneas del log
tail -n 1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
