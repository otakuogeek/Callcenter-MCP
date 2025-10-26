# ⚠️ CONFIGURACIÓN DEL SERVICIO DE SMS ZADARMA

## Estado Actual

❌ **Las credenciales proporcionadas no están funcionando**

### Credenciales Recibidas
- **API Key**: `95bedd9dbcc065b5ef54`
- **API Secret**: `66fc39c8dae8c5ad99f2`

### Error Detectado
```
HTTP/1.1 401 Unauthorized
{"status":"error","message":"Not authorized"}
```

## Pasos para Solucionar

### 1. Verificar en el Panel de Zadarma

Accede a: https://my.zadarma.com/api/

Verifica:
- ✅ Que las credenciales API estén **activas**
- ✅ Que tengan permisos para **SMS** habilitados
- ✅ Que la cuenta tenga **saldo suficiente**
- ✅ Que la IP del servidor esté en la **lista blanca** (si aplica)

### 2. Verificar Formato de Credenciales

Las credenciales API de Zadarma tienen dos tipos:

**A) API Key/Secret para API REST** (lo que estamos usando)
- Se genera en: Settings → API → Generate API key
- Formato: `xxxxxxxxxxxxxxxxxxxxxx`

**B) Usuario/Contraseña para SIP** (diferente)
- Se usa para llamadas VoIP
- Formato: `XXXXXX-XXX`

### 3. Habilitar API de SMS

En el panel de Zadarma:
1. Ve a **API** → **Settings**
2. Asegúrate de que **SMS API** esté habilitado
3. Verifica los **permisos** de la API key generada

### 4. Verificar Saldo

La cuenta debe tener saldo para enviar SMS:
- Mínimo: ~$0.05 USD por SMS (varía según destino)
- Verifica en: https://my.zadarma.com/balance/

### 5. Generar Nuevas Credenciales

Si las credenciales actuales no funcionan:

1. **Ir a**: https://my.zadarma.com/api/
2. **Hacer clic en**: "Generate new API key"
3. **Copiar inmediatamente**:
   - API Key
   - API Secret
4. **Actualizar** en `/home/ubuntu/app/backend/.env`:
   ```bash
   ZADARMA_SMS_API_KEY=nueva_key_aqui
   ZADARMA_SMS_API_SECRET=nuevo_secret_aqui
   ```
5. **Reiniciar backend**:
   ```bash
   pm2 restart cita-central-backend --update-env
   ```

## Alternativas de Configuración

### Opción A: Usar Credenciales Diferentes

Si tienes acceso a otra cuenta de Zadarma o credenciales diferentes, actualiza el archivo `.env`:

```bash
cd /home/ubuntu/app/backend
nano .env

# Actualizar líneas:
ZADARMA_SMS_API_KEY=tu_nueva_key
ZADARMA_SMS_API_SECRET=tu_nuevo_secret
```

### Opción B: Verificar Restricciones de IP

Algunas cuentas de Zadarma requieren IP whitelisting:

1. Obtener IP del servidor:
   ```bash
   curl ifconfig.me
   ```

2. Agregar la IP en panel Zadarma:
   - Settings → API → IP Whitelist
   - Agregar la IP obtenida

### Opción C: Contactar Soporte Zadarma

Si nada funciona:
- Email: support@zadarma.com
- Teléfono: Disponible en el panel
- Chat: https://zadarma.com

## Prueba Manual de Credenciales

Para verificar manualmente si las credenciales funcionan:

```bash
# 1. Generar firma MD5
cat > /tmp/test_zadarma_auth.js << 'EOF'
const crypto = require('crypto');
const API_KEY = 'TU_API_KEY_AQUI';
const API_SECRET = 'TU_API_SECRET_AQUI';
const method = 'GET';
const path = '/v1/info/balance/';
const baseString = `${method}${path}${API_SECRET}`;
const signature = crypto.createHash('md5').update(baseString).digest('hex');
console.log(`curl "https://api.zadarma.com${path}" -H "Authorization: ${API_KEY}:${signature}"`);
EOF

node /tmp/test_zadarma_auth.js

# 2. Ejecutar el comando generado
# Deberías ver el saldo de la cuenta si las credenciales son correctas
```

## Estado del Código

✅ **El código del servicio SMS está correctamente implementado**
✅ **Las rutas API están registradas**
✅ **Las variables de entorno están configuradas**
❌ **Las credenciales necesitan verificación/actualización**

## Próximos Pasos

1. **URGENTE**: Verificar credenciales en panel de Zadarma
2. Si es necesario, generar nuevas credenciales
3. Actualizar `.env` con credenciales válidas
4. Reiniciar backend
5. Probar envío de SMS al número: +57 310 5672307

## Archivos Modificados

- ✅ `/backend/src/services/zadarma-sms.service.ts` - Servicio implementado
- ✅ `/backend/src/routes/sms.routes.ts` - Rutas API creadas
- ✅ `/backend/.env` - Variables de entorno agregadas
- ✅ `/docs/SERVICIO_SMS_ZADARMA.md` - Documentación completa
- ✅ `/test_sms_service.sh` - Script de pruebas

---

**Fecha**: 25 de octubre de 2025  
**Estado**: Pendiente de validación de credenciales Zadarma
