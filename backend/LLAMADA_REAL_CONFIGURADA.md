# 📞 GUÍA: LLAMADA REAL CONFIGURADA

## ✅ Estado Actual

**AUDIO GENERADO:** ✅ Listo para usar  
**ARCHIVO:** `/home/ubuntu/app/backend/uploads/call-audio/call_584264377421_1761500355929.mp3`  
**NÚMERO DESTINO:** +584264377421  
**CONVERSATION ID:** direct_1761500355925

---

## 🎯 OPCIONES PARA HACER LA LLAMADA REAL

### ⭐ OPCIÓN 1: LLAMADA MANUAL VÍA ZADARMA (INMEDIATO)

**Tiempo: 2 minutos**

1. Ir a: https://my.zadarma.com/
2. Iniciar sesión con tus credenciales
3. Usar el widget de llamadas del panel (botón verde en la esquina)
4. Llamar a: **+584264377421**
5. Reproducir el audio manualmente desde tu computadora

**Archivo de audio:** `/home/ubuntu/app/backend/uploads/call-audio/call_584264377421_1761500355929.mp3`

---

### 🔧 OPCIÓN 2: CONFIGURAR SOFTPHONE SIP (TESTING)

**Tiempo: 10 minutos**

1. **Descargar softphone:**
   - Windows/Mac: https://www.zoiper.com/en/voip-softphone/download/current
   - Linux: `sudo apt install linphone`

2. **Obtener credenciales SIP de Zadarma:**
   - Ir a: https://my.zadarma.com/sip/
   - Crear usuario SIP si no existe (ej: 100)
   - Anotar: usuario, contraseña, servidor SIP

3. **Configurar en Zoiper/Linphone:**
   - Usuario: tu_usuario_sip
   - Contraseña: tu_password_sip
   - Dominio: pbx.zadarma.com
   - Puerto: 5060

4. **Hacer la llamada:**
   - Llamar a: +584264377421
   - Reproducir el audio MP3

---

### 🚀 OPCIÓN 3: AUTOMATIZACIÓN COMPLETA (REQUIERE CONFIG)

**Tiempo: 30-60 minutos**

#### PASO 1: Verificar/Actualizar Credenciales API de Zadarma

```bash
# 1. Ir a https://my.zadarma.com/api/
# 2. Generar nuevas claves API
# 3. Actualizar el .env:

ZADARMA_SMS_API_KEY=tu_nueva_api_key
ZADARMA_SMS_API_SECRET=tu_nuevo_api_secret
```

#### PASO 2: Tener un Número Virtual o SIP

**Opción A: Comprar número virtual**
- Ir a: https://my.zadarma.com/numbers/
- Comprar número de Colombia (+57) o Venezuela (+58)
- Costo aprox: $1-3 USD/mes

**Opción B: Usar SIP gratuito**
- Ir a: https://my.zadarma.com/sip/
- Crear/usar SIP existente (ej: 100)

#### PASO 3: Crear Escenario en Zadarma

1. Ir a: https://my.zadarma.com/scenarios/
2. Crear nuevo escenario: "Recordatorios Biosanar"
3. Configurar flujo:
   - Trigger: Llamada entrante desde API
   - Acción 1: Reproducir audio desde URL
   - Acción 2: Colgar

4. Anotar el `scenario_id`

#### PASO 4: Actualizar el Código

```bash
# Agregar al .env:
ZADARMA_SCENARIO_ID=tu_scenario_id
ZADARMA_VIRTUAL_NUMBER=+57_tu_numero
```

#### PASO 5: Probar Llamada Automatizada

```bash
curl -X POST http://localhost:4000/api/elevenlabs/call-real \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "phoneNumber": "+584264377421",
    "message": "Tu mensaje aquí"
  }'
```

---

## 💡 RECOMENDACIÓN

**Para empezar AHORA:** Usa la **Opción 1** (manual)

**Para testing:** Configura la **Opción 2** (softphone)

**Para producción:** Implementa la **Opción 3** (automatización completa)

---

## 📊 COSTOS ESTIMADOS

| Opción | Costo Inicial | Costo por Llamada |
|--------|---------------|-------------------|
| Manual | $0 | Solo tiempo del operador |
| Softphone | $0 | $0.02-0.03 USD |
| Automatizado | $1-3/mes (número) | $0.02-0.03 USD |

---

## 🔍 VERIFICAR ESTADO ACTUAL

```bash
# Ver archivos de audio generados:
ls -lh /home/ubuntu/app/backend/uploads/call-audio/

# Ver últimas llamadas en la base de datos:
cd /home/ubuntu/app/backend
mysql -h 127.0.0.1 -u biosanar_user -p'/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU' biosanar << 'EOF'
SELECT id, conversation_id, phone_number, status, created_at 
FROM elevenlabs_conversations 
ORDER BY created_at DESC 
LIMIT 5;
EOF
```

---

## 📞 ENDPOINT DISPONIBLE

```bash
POST /api/elevenlabs/call-real

# Hace lo siguiente automáticamente:
# 1. Intenta llamada real con ElevenLabs (si plan lo permite)
# 2. Si falla, genera audio TTS
# 3. Guarda audio en /uploads/call-audio/
# 4. Prepara la llamada para Zadarma
# 5. Retorna el conversation_id y la ruta del audio
```

---

## ✅ LO QUE YA ESTÁ FUNCIONANDO

- ✅ Generación de audio TTS en español (voz ultra-realista)
- ✅ Normalización de números telefónicos
- ✅ Almacenamiento en base de datos
- ✅ API REST completa
- ✅ Fallback automático cuando plan no permite llamadas
- ✅ Guardado de audio en formato MP3

---

## ⏳ LO QUE FALTA PARA LLAMADAS AUTOMÁTICAS

1. Credenciales API de Zadarma válidas
2. Número virtual o SIP configurado
3. Escenario de Zadarma para automatización
4. Webhook para recibir estados de llamadas (opcional)

---

**Creado:** 26 de Octubre, 2025  
**Sistema:** Biosanarcall - ElevenLabs + Zadarma Integration  
**Estado:** Audio listo, configuración Zadarma pendiente
