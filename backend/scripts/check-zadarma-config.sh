#!/bin/bash

# Script para diagnosticar configuración de Zadarma y preparar llamada

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🔍 DIAGNÓSTICO DE ZADARMA                               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

# Crear script temporal de Node.js para verificar Zadarma
cat > /tmp/check_zadarma.js << 'EOF'
const crypto = require('crypto');
const axios = require('axios');

const API_KEY = process.env.ZADARMA_USER_KEY || '524494-100';
const API_SECRET = process.env.ZADARMA_SECRET_KEY || 'Ub4jdrUl24';
const BASE_URL = 'https://api.zadarma.com';

function generateSignature(method, path, params = {}) {
  const sortedKeys = Object.keys(params).sort();
  const paramsStr = sortedKeys
    .map(key => `${key}=${params[key]}`)
    .join('&');

  const paramsMd5 = paramsStr 
    ? crypto.createHash('md5').update(paramsStr).digest('hex')
    : '';

  const baseString = paramsStr
    ? `${method}${path}${paramsStr}${paramsMd5}`
    : `${method}${path}`;
  
  const signature = crypto
    .createHmac('sha1', API_SECRET)
    .update(baseString)
    .digest('base64');
  
  return signature;
}

async function checkZadarma() {
  console.log('🔐 Verificando autenticación...\n');

  try {
    // 1. Verificar balance
    let path = '/v1/info/balance/';
    let method = 'GET';
    let signature = generateSignature(method, path);

    let response = await axios.get(`${BASE_URL}${path}`, {
      headers: {
        'Authorization': `${API_KEY}:${signature}`,
      },
    });

    console.log('✅ Balance de cuenta:');
    console.log('   Moneda:', response.data.currency);
    console.log('   Balance:', response.data.balance);
    console.log('');

    // 2. Obtener información de cuenta
    path = '/v1/info/';
    signature = generateSignature(method, path);

    response = await axios.get(`${BASE_URL}${path}`, {
      headers: {
        'Authorization': `${API_KEY}:${signature}`,
      },
    });

    console.log('📋 Información de cuenta:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    // 3. Obtener números SIP
    path = '/v1/sip/';
    signature = generateSignature(method, path);

    response = await axios.get(`${BASE_URL}${path}`, {
      headers: {
        'Authorization': `${API_KEY}:${signature}`,
      },
    });

    console.log('📞 Números SIP disponibles:');
    if (response.data && response.data.sips) {
      console.log(JSON.stringify(response.data.sips, null, 2));
    } else {
      console.log('   No hay números SIP configurados');
    }
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

checkZadarma();
EOF

# Ejecutar el script de verificación
echo -e "${YELLOW}Ejecutando diagnóstico...${NC}\n"
cd /home/ubuntu/app/backend && node /tmp/check_zadarma.js

echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ℹ️  PRÓXIMOS PASOS PARA LLAMADAS AUTOMÁTICAS            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${YELLOW}Para realizar llamadas completamente automáticas necesitas:${NC}\n"

echo -e "${GREEN}1. Configurar un número SIP en Zadarma${NC}"
echo "   - Ir a https://my.zadarma.com/sip/"
echo "   - Crear un nuevo número SIP"
echo "   - Anotar el ID del SIP"
echo ""

echo -e "${GREEN}2. O comprar un número virtual${NC}"
echo "   - Ir a https://my.zadarma.com/numbers/"
echo "   - Comprar un número de Colombia (+57) o Venezuela (+58)"
echo "   - Configurar el número para llamadas salientes"
echo ""

echo -e "${GREEN}3. Crear un escenario de llamadas${NC}"
echo "   - Ir a https://my.zadarma.com/scenarios/"
echo "   - Crear escenario que reproduzca audio automáticamente"
echo "   - Conectar el escenario con el número SIP"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}💡 ALTERNATIVA RÁPIDA:${NC}"
echo "Usar el panel web de Zadarma para hacer llamadas manuales"
echo "mientras se configura la automatización completa."
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Limpiar
rm /tmp/check_zadarma.js
