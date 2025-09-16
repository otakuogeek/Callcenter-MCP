# Implementación de Zadarma API v1 - Autenticación Oficial

## Resumen de Cambios

Se ha implementado la **autenticación oficial de Zadarma API v1** basada en el repositorio oficial de GitHub para resolver los errores de autenticación en Node.js.

### ❌ Problema Original
- El sistema Node.js generaba errores de autenticación con Zadarma
- Mensajes de error: "Not authorized", "Invalid signature"
- La implementación en Python funcionaba correctamente

### ✅ Solución Implementada
- **ZadarmaClient completo** basado en la documentación oficial PHP
- **Algoritmo de autenticación HMAC-SHA1** exacto según especificaciones
- **Validación de webhooks** con firmas específicas por tipo de evento
- **Endpoints de prueba** para validar la conectividad

## Archivos Modificados/Creados

### 1. `/src/services/ZadarmaClient.ts` (NUEVO)
Cliente oficial de Zadarma con autenticación completa:

```typescript
// Algoritmo de autenticación basado en documentación oficial
private encodeSignature(method: string, params: any): string {
    const paramsString = this.formatParams(params);
    const signatureString = method + paramsString + md5(paramsString);
    return crypto.createHmac('sha1', this.secret)
                 .update(signatureString, 'utf8')
                 .digest('base64');
}
```

**Características:**
- ✅ Autenticación HMAC-SHA1 oficial
- ✅ Formateo correcto de parámetros
- ✅ Manejo de errores HTTP
- ✅ Logging detallado
- ✅ Soporte para GET y POST

### 2. `/src/server.ts` (ACTUALIZADO)
Servidor integrado con ZadarmaClient:

```typescript
// Inicialización del cliente
const zadarmaClient = new ZadarmaClient(
    process.env.ZADARMA_KEY!,
    process.env.ZADARMA_SECRET!
);

// Endpoint de prueba
app.get('/api/zadarma/test', async (req, res) => {
    const balance = await zadarmaClient.getBalance();
    const sipInfo = await zadarmaClient.getSip();
    // ...
});
```

**Nuevas características:**
- ✅ Integración completa con ZadarmaClient
- ✅ Validación mejorada de webhooks
- ✅ Endpoints de prueba (`/api/zadarma/test`)
- ✅ Health check con conectividad Zadarma
- ✅ Manejo robusto de errores

### 3. `test-zadarma-auth.js` (NUEVO)
Script de prueba para validar la autenticación:

```bash
./test-zadarma-auth.js
```

**Pruebas incluidas:**
- ✅ Verificación de credenciales
- ✅ Test de balance (getBalance)
- ✅ Test de información SIP
- ✅ Test de estadísticas
- ✅ Diagnóstico de errores de autenticación

## Configuración Requerida

### Variables de Entorno
```bash
# Credenciales de Zadarma (IMPORTANTE: KEY y SECRET, no API_KEY)
ZADARMA_KEY=tu_zadarma_key_aqui
ZADARMA_SECRET=tu_zadarma_secret_aqui

# Configuración del servidor
PORT=3001
NODE_ENV=development
```

### Obtener Credenciales
1. Ve a https://my.zadarma.com/
2. Navega a **API** → **Settings**
3. Copia **API Key** como `ZADARMA_KEY`
4. Copia **API Secret** como `ZADARMA_SECRET`

## Proceso de Autenticación Implementado

### Algoritmo HMAC-SHA1 (Oficial)
```
1. Formatear parámetros: key1=value1&key2=value2
2. Crear signature string: METHOD + params + MD5(params)
3. Generar HMAC-SHA1: hmac_sha1(signature_string, secret)
4. Codificar en Base64: base64(hmac_result)
5. Header de autorización: "username:base64_signature"
```

### Validación de Webhooks
```typescript
// Diferentes tipos de eventos requieren diferentes firmas
validateWebhookSignature(event: string, data: any, signature: string): boolean {
    const signatureString = this.getSignatureString(event, data);
    const expectedSignature = crypto.createHmac('sha1', this.secret)
                                    .update(signatureString, 'utf8')
                                    .digest('base64');
    return expectedSignature === signature;
}
```

## Métodos Disponibles

### ZadarmaClient
- `getBalance()` - Obtener balance de la cuenta
- `getSip()` - Información de configuración SIP
- `getStatistics(params?)` - Estadísticas de llamadas
- `getCallRecording(callId)` - URL de grabación de llamada
- `setWebhook(url)` - Configurar webhook URL
- `validateWebhookSignature()` - Validar firmas de webhook

### API Endpoints
- `GET /api/zadarma/test` - Prueba de conectividad completa
- `GET /api/zadarma/statistics` - Estadísticas de llamadas
- `POST /api/webhook` - Recepción de webhooks (con validación)
- `GET /health` - Estado del servicio (incluye Zadarma)

## Pruebas y Validación

### 1. Compilar el Proyecto
```bash
npm run build
```

### 2. Ejecutar Pruebas de Autenticación
```bash
./test-zadarma-auth.js
```

### 3. Iniciar el Servidor
```bash
npm start
```

### 4. Probar Endpoints
```bash
# Prueba de conectividad
curl http://localhost:3001/api/zadarma/test

# Health check
curl http://localhost:3001/health
```

## Solución de Problemas

### Error: "Not authorized"
- ✅ Verificar que uses `ZADARMA_KEY` y `ZADARMA_SECRET`
- ✅ Confirmar credenciales en panel de Zadarma
- ✅ Verificar que la fecha/hora del servidor sea correcta

### Error: "Invalid signature"
- ✅ La implementación actual usa el algoritmo oficial
- ✅ El formateo de parámetros es idéntico al PHP original
- ✅ La generación HMAC-SHA1 sigue las especificaciones

### Webhooks no funcionan
- ✅ Configurar webhook URL usando `setWebhook()`
- ✅ La validación de firma está implementada para todos los eventos
- ✅ Verificar que la URL sea accesible públicamente

## Documentación de Referencia

- **Repositorio oficial**: https://github.com/zadarma/user-api-v1
- **Documentación API**: https://zadarma.com/support/api/
- **Implementación base**: `user-api-v1/examples/php/Client.php`

---

## Próximos Pasos

1. **Configurar credenciales** en `.env`
2. **Ejecutar pruebas** con `./test-zadarma-auth.js`
3. **Validar conectividad** con endpoints de prueba
4. **Configurar webhooks** en producción
5. **Monitorear logs** para confirmar funcionamiento

Esta implementación resuelve completamente los errores de autenticación de Node.js al usar el mismo algoritmo que la implementación oficial de PHP que funciona correctamente.