#!/bin/bash

echo "🔧 Normalizando todos los números telefónicos en la base de datos..."
echo ""

# Obtener token de autenticación
TOKEN=$(curl -s -X POST http://127.0.0.1:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@demo.com","password":"demo123"}' | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Error: No se pudo obtener el token de autenticación"
  exit 1
fi

echo "✅ Token obtenido: ${TOKEN:0:30}..."
echo ""
echo "📋 Ejecutando normalización masiva de números telefónicos..."
echo "   • Agregando +57 a números colombianos sin código de país"
echo "   • Eliminando prefijos 0 innecesarios"
echo "   • Formateando números con 57XXXXXXXXXX a +57XXXXXXXXXX"
echo ""

# Ejecutar normalización
RESPONSE=$(curl -s -X POST http://127.0.0.1:4000/api/sms/normalize-phones \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN")

echo "📊 Resultados:"
echo "$RESPONSE" | jq '.'

echo ""
echo "✅ Proceso completado!"
echo ""
echo "💡 Ahora todos los números telefónicos están en formato internacional (+57XXXXXXXXXX)"
