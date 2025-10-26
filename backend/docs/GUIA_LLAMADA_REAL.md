# 📞 Guía Completa: Realizar Llamada Real con ElevenLabs + Zadarma

## ✅ Estado Actual

**Lo que YA funciona:**
- ✅ Generación de audio TTS con ElevenLabs (ultra-realista en español)
- ✅ API REST para iniciar llamadas
- ✅ Registro en base de datos
- ✅ Audio guardado y listo para reproducción

**Lo que falta:**
- ⏳ Configuración de Zadarma para llamadas salientes automáticas

---

## 🎯 Opciones para Realizar la Llamada Real

### Opción 1: Panel Web de Zadarma (⭐ MÁS RÁPIDO)

**Pasos:**

1. **Acceder al panel**
   - Ir a: https://my.zadarma.com/
   - Iniciar sesión con tus credenciales de Zadarma

2. **Usar el widget de llamadas**
   - En el panel, buscar el widget de llamadas
   - Marcar: `+584264377421`
   - Realizar la llamada

3. **Reproducir el audio (manual)**
   - Una vez que contesten
   - Leer el mensaje que fue generado por ElevenLabs:
   
   ```
   "Hola, buenos días. Este es un mensaje de prueba del sistema de 
   Fundación Biosanar IPS. Le estamos llamando para confirmar que 
   nuestro sistema de llamadas automatizadas está funcionando 
   correctamente..."
   ```

**Ventajas:**
- ✅ No requiere configuración técnica
- ✅ Puedes probar inmediatamente
- ✅ Verificas que el número está activo

**Desventajas:**
- ❌ Manual (no automatizado)
- ❌ Requiere intervención humana

---

### Opción 2: Configurar API de Zadarma para Automatización

Para automatizar completamente las llamadas, necesitas configurar:

#### Paso 1: Verificar Credenciales API

Las credenciales actuales en tu `.env`:

```env
ZADARMA_USER_KEY=524494-100
ZADARMA_SECRET_KEY=Ub4jdrUl24
```

**Verificar que sean válidas:**

1. Ir a https://my.zadarma.com/api/
2. Verificar API Key y Secret
3. Si son diferentes, actualizar el `.env`

#### Paso 2: Configurar Número SIP o Virtual

**Opción A: Número SIP**

1. Ir a: https://my.zadarma.com/sip/
2. Crear un nuevo número SIP
3. Anotar el ID del SIP (ejemplo: `100`, `101`, etc.)
4. Actualizar `.env`:
   ```env
   ZADARMA_PBX_ID=tu_sip_id
   ```

**Opción B: Número Virtual** (Recomendado para producción)

1. Ir a: https://my.zadarma.com/numbers/
2. Comprar un número de:
   - **Colombia**: +57 (para llamar a números colombianos)
   - **Venezuela**: +58 (para llamar a números venezolanos)
3. Configurar el número para llamadas salientes
4. Actualizar `.env`:
   ```env
   ELEVENLABS_PHONE_NUMBER=+57XXXXXXXXXX  # Tu número comprado
   ```

#### Paso 3: Crear Escenario de Llamadas

**¿Qué es un escenario?**
Un escenario es un flujo automatizado que define qué sucede cuando se hace una llamada.

**Pasos para crearlo:**

1. Ir a: https://my.zadarma.com/scenarios/
2. Clic en "Crear nuevo escenario"
3. Configurar:
   
   ```
   Nombre: "Recordatorios Automáticos Biosanar"
   
   Flujo:
   1. Recibir llamada entrante (desde API)
   2. Reproducir audio desde URL
   3. Esperar respuesta (opcional)
   4. Colgar
   ```

4. Guardar el escenario
5. Anotar el ID del escenario

#### Paso 4: Actualizar Código para Usar Escenario

Una vez tengas el escenario configurado, el código se actualiza así:

```typescript
// En zadarma-real-call.service.ts
async requestCallback(params: {
  from: string;  // Tu número SIP o virtual
  to: string;    // Número de destino
  scenario_id: string;  // ID del escenario creado
}) {
  // La API de Zadarma llamará automáticamente
  // y ejecutará el escenario configurado
}
```

---

### Opción 3: Usar Softphone SIP (Para Testing)

**Software recomendado:**
- Zoiper (https://www.zoiper.com/)
- Linphone (https://www.linphone.org/)
- MicroSIP (Windows)

**Pasos:**

1. **Descargar e instalar** un softphone

2. **Configurar SIP:**
   - Usuario: Tu usuario de Zadarma
   - Contraseña: Tu contraseña de Zadarma
   - Servidor: `sip.zadarma.com`
   - Puerto: `5060`

3. **Realizar llamada:**
   - Marcar: `+584264377421`
   - Cuando contesten, reproducir el audio manualmente

---

## 🔧 Solución Técnica: Integración Completa

### Arquitectura Propuesta

```
┌─────────────────┐
│   Tu API REST   │  POST /api/elevenlabs/call-with-zadarma
└────────┬────────┘
         ↓
┌─────────────────┐
│  ElevenLabs     │  Genera audio TTS
│  TTS API        │  → audio.mp3 (base64)
└────────┬────────┘
         ↓
┌─────────────────┐
│  Tu Servidor    │  Guarda audio en /uploads/call-audio/
│  (Node.js)      │  → audio accesible por HTTPS
└────────┬────────┘
         ↓
┌─────────────────┐
│  Zadarma API    │  request/callback con predicted audio
│                 │  →  Llama al número de destino
└────────┬────────┘
         ↓
    📞 Cliente
```

### Código de Integración

```typescript
// 1. Generar audio con ElevenLabs
const audioBuffer = await elevenLabsService.generateTTS(message);

// 2. Guardar audio en servidor (accesible por HTTPS)
const audioUrl = await saveAudioToPublicFolder(audioBuffer);
// Resultado: https://biosanarcall.site/audio/call_123.mp3

// 3. Iniciar llamada con Zadarma
const result = await zadarmaRealCallService.requestCallback({
  from: process.env.ELEVENLABS_PHONE_NUMBER, // Tu número SIP/virtual
  to: '+584264377421',
  predicted: audioUrl  // URL del audio a reproducir
});

// 4. Zadarma:
//    - Llama a tu SIP/número
//    - Cuando contestas (o auto-contesta), llama al destino
//    - Reproduce el audio automáticamente
```

---

## 💰 Costos Estimados

### Con Configuración Actual (Solo Audio TTS)

| Concepto | Costo |
|----------|-------|
| Audio TTS (280 caracteres) | $0.0084 USD |
| **Total actual** | **$0.0084 USD** |

### Con Integración Completa (Audio + Llamada)

| Concepto | Costo |
|----------|-------|
| Audio TTS | $0.0084 USD |
| Llamada VoIP a Venezuela (+58) | $0.02-0.05 USD/min |
| Duración estimada (20 seg) | ~$0.01-0.02 USD |
| **Total por llamada** | **~$0.02-0.03 USD** |

**Para 1000 llamadas mensuales:** ~$20-30 USD

---

## 📝 Checklist de Configuración

### Configuración Mínima (Manual)

- [ ] Acceso al panel de Zadarma
- [ ] Verificar que tienes saldo en la cuenta
- [ ] Probar llamada manual desde el panel

### Configuración Para Automatización

- [ ] Verificar credenciales API de Zadarma
- [ ] Configurar número SIP o comprar número virtual
- [ ] Crear escenario de llamadas
- [ ] Configurar webhook para estados de llamada
- [ ] Servir audio en URL pública (HTTPS)
- [ ] Actualizar código con scenario_id
- [ ] Probar llamada automatizada

---

## 🚀 Prueba Rápida AHORA MISMO

Si quieres probar inmediatamente:

```bash
# 1. El audio ya está generado
# Conversation ID: direct_1761499131963

# 2. Accede al panel de Zadarma
firefox https://my.zadarma.com/ &

# 3. Usa el widget de llamadas para llamar a:
# +584264377421

# 4. Lee el mensaje generado cuando contesten
```

---

## 📞 Soporte y Documentación

### Zadarma
- Panel: https://my.zadarma.com/
- API Docs: https://zadarma.com/en/support/api/
- Soporte: https://my.zadarma.com/support/

### ElevenLabs
- Docs: https://elevenlabs.io/docs
- API Reference: https://elevenlabs.io/docs/api-reference

---

## ✅ Resumen

**Estado actual:**
- ✅ Audio generado exitosamente
- ✅ Listo para prueba manual
- ⏳ Automatización requiere configuración adicional de Zadarma

**Próximo paso recomendado:**
1. **Inmediato**: Probar llamada manual desde panel de Zadarma
2. **Corto plazo**: Configurar número SIP/virtual
3. **Mediano plazo**: Crear escenario automatizado

**Tiempo estimado para automatización completa:** 1-2 horas

---

**Documento generado:** 26 de Octubre, 2025  
**Sistema:** Biosanarcall - ElevenLabs + Zadarma Integration  
**Audio generado para:** +584264377421 ✅
