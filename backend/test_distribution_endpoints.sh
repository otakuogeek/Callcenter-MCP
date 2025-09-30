#!/bin/bash

# Script para probar los nuevos endpoints de distribución
# Ejecutar desde el directorio backend

echo "=== Probando endpoints de distribución ==="

# Obtener token de autenticación (ajustar credenciales según sea necesario)
echo "1. Obteniendo token de autenticación..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@biosanarcall.com", "password": "admin123"}')

TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Error: No se pudo obtener el token de autenticación"
  echo "Respuesta: $TOKEN_RESPONSE"
  exit 1
fi

echo "Token obtenido exitosamente"

# Función para hacer peticiones autenticadas
make_request() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  if [ -z "$data" ]; then
    curl -s -X $method "http://localhost:4000/api$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json"
  else
    curl -s -X $method "http://localhost:4000/api$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data"
  fi
}

echo ""
echo "2. Probando endpoint de opciones de filtros..."
FILTER_OPTIONS=$(make_request GET "/availabilities/filters/options")
echo "Respuesta: $FILTER_OPTIONS" | jq '.'

echo ""
echo "3. Probando endpoint de distribuciones activas..."
ACTIVE_DIST=$(make_request GET "/availabilities/active")
echo "Respuesta: $ACTIVE_DIST" | jq '.'

echo ""
echo "4. Probando endpoint de distribuciones por rango..."
RANGE_DIST=$(make_request GET "/availabilities/distributions/range?start_date=2024-01-01&end_date=2024-12-31")
echo "Respuesta: $RANGE_DIST" | jq '.'

echo ""
echo "5. Probando endpoint de estadísticas de distribución..."
STATS_DIST=$(make_request GET "/availabilities/distributions/stats")
echo "Respuesta: $STATS_DIST" | jq '.'

echo ""
echo "6. Probando endpoint de actualización de cupos asignados..."
# Obtener el primer availability_id de las distribuciones
AVAILABILITY_ID=$(echo $RANGE_DIST | jq -r '.data[0].availability_id // empty')

if [ -n "$AVAILABILITY_ID" ] && [ "$AVAILABILITY_ID" != "null" ]; then
  echo "Actualizando cupos para availability_id: $AVAILABILITY_ID"
  UPDATE_RESULT=$(make_request PUT "/availabilities/distributions/$AVAILABILITY_ID/assigned" '{"assigned": 5}')
  echo "Respuesta: $UPDATE_RESULT" | jq '.'
else
  echo "No se encontró un availability_id válido para probar la actualización"
fi

echo ""
echo "=== Pruebas completadas ==="