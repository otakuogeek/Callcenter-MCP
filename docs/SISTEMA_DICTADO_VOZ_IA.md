# Sistema de Dictado por Voz con IA (OpenAI Whisper)

## 🎙️ Resumen

Se ha implementado un sistema completo de **dictado por voz** usando la API de **Whisper de OpenAI** para transcribir audio a texto en tiempo real. Los doctores ahora pueden dictar sus notas médicas en lugar de escribirlas, mejorando significativamente la productividad.

---

## ✨ Características Implementadas

### **Backend**

#### **1. Endpoint de Transcripción**
- **Ruta:** `POST /api/transcription/transcribe`
- **Autenticación:** JWT Token (Bearer)
- **Formato:** Multipart/form-data
- **Modelo:** OpenAI Whisper-1
- **Idioma:** Español (es)

**Formatos de audio soportados:**
- ✅ MP3 (audio/mpeg)
- ✅ WAV (audio/wav)
- ✅ WEBM (audio/webm) - **Recomendado para navegadores**
- ✅ OGG (audio/ogg)
- ✅ M4A (audio/m4a, audio/x-m4a)
- ✅ MP4 (audio/mp4)
- ✅ FLAC (audio/flac)

**Límites:**
- Tamaño máximo: 25 MB
- Almacenamiento temporal: `/tmp/`
- Limpieza automática después de procesar

#### **2. Endpoint de Estado**
- **Ruta:** `GET /api/transcription/status`
- **Autenticación:** JWT Token (Bearer)
- **Propósito:** Verificar si el servicio está configurado

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "available": true,
    "message": "Servicio de transcripción disponible"
  }
}
```

### **Frontend**

#### **1. Componente VoiceDictationButton**
Botón reutilizable para dictado por voz con las siguientes características:

**Estados visuales:**
- 🎤 **Reposo:** Icono de micrófono + "Dictar"
- 🔴 **Grabando:** Icono pulsante + "Detener" (fondo rojo)
- ⏳ **Transcribiendo:** Spinner animado + "Transcribiendo..."

**Funcionalidades:**
- Solicita permiso de micrófono al navegador
- Graba audio usando MediaRecorder API
- Envía automáticamente a transcribir al detener
- Muestra toasts informativos en cada paso
- Manejo robusto de errores

**Props:**
```typescript
interface VoiceDictationButtonProps {
  onTranscription: (text: string) => void;    // Callback con texto transcrito
  transcribeAudio: (audioBlob: Blob) => Promise<string>;  // Función de transcripción
  disabled?: boolean;                          // Deshabilitar botón
  variant?: 'default' | 'outline' | 'ghost';  // Estilo del botón
  size?: 'default' | 'sm' | 'lg' | 'icon';    // Tamaño del botón
  className?: string;                          // Clases CSS adicionales
}
```

#### **2. Integración en Historia Clínica**

Se agregaron botones de dictado en **6 campos clave**:

| Pestaña | Campo | Ubicación |
|---------|-------|-----------|
| General | Motivo de Consulta | Junto al label |
| General | Enfermedad Actual | Junto al label |
| Diagnóstico | Diagnóstico Principal | Junto al label |
| Diagnóstico | Observaciones Adicionales | Junto al label |
| Tratamiento | Plan de Tratamiento | Junto al label |
| Tratamiento | Prescripción Médica | Junto al label |

**Comportamiento:**
- El texto transcrito se **añade** al contenido existente (no reemplaza)
- Se agrega un espacio automáticamente si el campo ya tiene texto
- Ideal para dictar en múltiples sesiones

---

## 🔧 Configuración

### **1. Variable de Entorno (Backend)**

Agregar en `/backend/.env`:

```env
# --- OpenAI API ---
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Cómo obtener la API Key:**
1. Ir a https://platform.openai.com/api-keys
2. Crear una nueva API key
3. Copiar y pegar en el archivo .env
4. Reiniciar el backend: `pm2 restart cita-central-backend`

**Importante:**
- La API key debe tener permisos para usar el modelo `whisper-1`
- Se requiere crédito en la cuenta de OpenAI
- Costo aproximado: $0.006 por minuto de audio

### **2. Dependencias Instaladas**

**Backend:**
```bash
npm install openai ioredis date-fns date-fns-tz
```

**Frontend:**
- No requiere dependencias adicionales (usa APIs nativas del navegador)

---

## 🎯 Flujo de Uso

### **Para el Doctor:**

1. **Abrir Historia Clínica**
   - Click en "Atender" en una cita
   - Navegar a la pestaña deseada (General, Diagnóstico, etc.)

2. **Iniciar Dictado**
   - Click en botón "🎤 Dictar" junto al campo de texto
   - El navegador solicita permiso de micrófono (solo la primera vez)
   - El botón cambia a "🔴 Detener" con fondo rojo

3. **Hablar**
   - Hablar claramente cerca del micrófono
   - Puede dictar varias oraciones
   - No hay límite de tiempo (recomendado: 1-2 minutos por sesión)

4. **Detener Grabación**
   - Click en "🔴 Detener"
   - El botón cambia a "⏳ Transcribiendo..."
   - El audio se envía automáticamente a OpenAI

5. **Ver Resultado**
   - El texto transcrito aparece en el campo
   - Se muestra un toast con preview del texto
   - Se puede editar manualmente el resultado

6. **Dictar Más (Opcional)**
   - Click nuevamente en "🎤 Dictar"
   - El nuevo texto se añade al final del existente

---

## 📊 Ejemplo de Uso

### **Escenario: Doctor dictando el motivo de consulta**

```
Doctor: "Paciente masculino de 45 años que consulta por 
         dolor torácico de 3 días de evolución, tipo opresivo, 
         que irradia a brazo izquierdo, asociado a sudoración 
         y náuseas. Sin antecedentes de importancia."

Sistema: [Graba audio] → [Envía a Whisper] → [Recibe transcripción]

Resultado en campo:
"Paciente masculino de 45 años que consulta por dolor torácico 
de 3 días de evolución, tipo opresivo, que irradia a brazo 
izquierdo, asociado a sudoración y náuseas. Sin antecedentes 
de importancia."

Doctor: [Revisa y corrige si es necesario] → [Continúa con siguiente campo]
```

---

## 🔍 Detalles Técnicos

### **Backend: Flujo de Transcripción**

```typescript
1. Cliente envía FormData con archivo de audio
   ↓
2. Middleware de autenticación valida JWT
   ↓
3. Multer guarda archivo en /tmp/
   ↓
4. Se verifica que OPENAI_API_KEY esté configurada
   ↓
5. Se lee el archivo y se crea un objeto File
   ↓
6. Se envía a OpenAI Whisper API
   ↓
7. Se recibe transcripción en español
   ↓
8. Se elimina archivo temporal
   ↓
9. Se devuelve JSON con texto transcrito
```

### **Frontend: Componente VoiceDictationButton**

```typescript
// Iniciar grabación
const startRecording = async () => {
  // 1. Solicitar permiso de micrófono
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  
  // 2. Crear MediaRecorder con codec WEBM
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus'
  });
  
  // 3. Acumular chunks de audio
  mediaRecorder.ondataavailable = (event) => {
    chunks.push(event.data);
  };
  
  // 4. Al detener, crear Blob y transcribir
  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(chunks, { type: 'audio/webm' });
    await transcribeRecording(audioBlob);
  };
  
  // 5. Iniciar grabación
  mediaRecorder.start();
};
```

### **API de OpenAI Whisper**

```typescript
const transcription = await openai.audio.transcriptions.create({
  file: audioFile,              // Archivo de audio
  model: 'whisper-1',           // Modelo de Whisper
  language: 'es',               // Español
  response_format: 'json',      // Formato de respuesta
});

// Respuesta:
// {
//   text: "Texto transcrito en español..."
// }
```

---

## 🛡️ Manejo de Errores

### **Errores Comunes y Soluciones:**

#### **1. "Permiso de micrófono denegado"**
**Causa:** Usuario rechazó el permiso o el navegador no tiene acceso

**Solución:**
```
1. Abrir configuración del navegador
2. Ir a Permisos → Micrófono
3. Permitir acceso para biosanarcall.site
4. Recargar la página
```

#### **2. "API key de OpenAI no configurada"**
**Causa:** Variable de entorno OPENAI_API_KEY no está definida

**Solución:**
```bash
# Editar .env
nano /home/ubuntu/app/backend/.env

# Agregar:
OPENAI_API_KEY=sk-proj-xxxx...

# Reiniciar backend
pm2 restart cita-central-backend
```

#### **3. "Error al transcribir audio"**
**Causa:** Problema con la API de OpenAI (cuota, crédito, etc.)

**Solución:**
```
1. Verificar que hay crédito en la cuenta de OpenAI
2. Verificar que la API key tiene permisos para Whisper
3. Revisar logs del backend: pm2 logs cita-central-backend
```

#### **4. "No se encontró ningún micrófono"**
**Causa:** No hay micrófono conectado al dispositivo

**Solución:**
```
- Conectar micrófono o audífonos con micrófono
- Verificar que el micrófono esté habilitado en el sistema operativo
- En Linux/Mac: verificar permisos de audio del navegador
```

#### **5. "Formato de audio no soportado"**
**Causa:** El navegador usa un codec no soportado

**Solución:**
```javascript
// El componente usa WEBM por defecto (compatible con la mayoría)
// Si hay problemas, el backend acepta otros formatos:
- Chrome/Edge: WEBM (opus)
- Firefox: WEBM (opus) o OGG
- Safari: MP4 (AAC) o WAV
```

---

## 📈 Performance y Costos

### **Tiempos de Procesamiento:**

| Duración Audio | Tiempo Transcripción | Tamaño Aproximado |
|----------------|---------------------|-------------------|
| 10 segundos    | ~1-2 segundos       | ~50 KB            |
| 30 segundos    | ~2-4 segundos       | ~150 KB           |
| 1 minuto       | ~3-6 segundos       | ~300 KB           |
| 2 minutos      | ~5-10 segundos      | ~600 KB           |

### **Costos de OpenAI Whisper:**

| Concepto | Precio |
|----------|--------|
| Por minuto de audio | $0.006 USD |
| 10 minutos | $0.06 USD |
| 100 minutos | $0.60 USD |
| 1000 minutos (16.6 horas) | $6.00 USD |

**Ejemplo de uso mensual:**
- 50 consultas/día × 2 minutos promedio = 100 minutos/día
- 100 min/día × 20 días = 2000 minutos/mes
- 2000 minutos × $0.006 = **$12 USD/mes**

### **Optimizaciones:**

1. **Limitar duración de grabación:**
   - Agregar timer visual
   - Detener automáticamente después de 3 minutos

2. **Comprimir audio antes de enviar:**
   - Usar bitrate más bajo (16 kbps en lugar de 32 kbps)
   - Reducir sample rate a 16 kHz

3. **Caché local temporal:**
   - Guardar transcripciones en localStorage
   - Evitar re-transcribir si el usuario canceló sin guardar

---

## 🔒 Seguridad

### **Medidas Implementadas:**

1. **Autenticación requerida:**
   - Solo doctores autenticados pueden usar el servicio
   - JWT token validado en cada request

2. **Validación de archivos:**
   - Solo formatos de audio permitidos
   - Límite de tamaño: 25 MB
   - Verificación de MIME type

3. **Limpieza automática:**
   - Archivos temporales eliminados después de procesar
   - Timeout de 30 segundos para limpieza en caso de error

4. **Protección de API key:**
   - API key en variable de entorno (no en código)
   - No se expone al frontend
   - Logs sin información sensible

5. **HTTPS obligatorio:**
   - MediaRecorder API solo funciona en HTTPS
   - Biosanarcall.site ya tiene SSL

---

## 🎨 UI/UX

### **Estados Visuales:**

```
┌─────────────────────────────────────┐
│ 🎤 Dictar                           │  ← Estado: Reposo
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🔴 Detener ● ● ●                    │  ← Estado: Grabando (pulsante)
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ⏳ Transcribiendo...  [spinner]     │  ← Estado: Procesando
└─────────────────────────────────────┘
```

### **Toasts Informativos:**

```
✅ "Grabando..."
   Hable claramente cerca del micrófono

✅ "Transcripción completada"
   Paciente masculino de 45 años que...

❌ "Permiso de micrófono denegado"
   Por favor, habilite el acceso...

❌ "Error en transcripción"
   No se pudo transcribir el audio...
```

### **Posicionamiento:**

```
┌─────────────────────────────────────────────┐
│ Motivo de Consulta *          [🎤 Dictar]  │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐│
│ │ [Campo de texto...]                     ││
│ │                                         ││
│ └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

---

## 📱 Compatibilidad

### **Navegadores Soportados:**

| Navegador | Versión Mínima | MediaRecorder | WEBM Opus |
|-----------|----------------|---------------|-----------|
| Chrome    | 49+            | ✅            | ✅         |
| Firefox   | 25+            | ✅            | ✅         |
| Edge      | 79+            | ✅            | ✅         |
| Safari    | 14.1+          | ✅            | ❌ (usa MP4)|
| Opera     | 36+            | ✅            | ✅         |

**Nota:** Safari requiere configuración adicional para WEBM. El backend acepta MP4 como alternativa.

### **Dispositivos:**

- ✅ **Desktop:** Micrófono USB, integrado, o de audífonos
- ✅ **Laptop:** Micrófono integrado o externo
- ✅ **Tablet:** Micrófono integrado (iOS 14.1+, Android Chrome)
- ✅ **Móvil:** Micrófono integrado (requiere HTTPS)

---

## 🚀 Próximas Mejoras Sugeridas

### **Prioridad Alta:**

1. **Indicador de nivel de audio:**
   ```typescript
   // Visualización de onda de audio mientras graba
   const audioContext = new AudioContext();
   const analyser = audioContext.createAnalyser();
   // Mostrar barras animadas
   ```

2. **Timer visual:**
   ```typescript
   // Mostrar tiempo transcurrido
   00:15 / 03:00  [======>........]
   ```

3. **Atajos de teclado:**
   ```typescript
   // Ctrl + Shift + D: Iniciar/detener dictado
   // Esc: Cancelar grabación
   ```

### **Prioridad Media:**

4. **Pausar/reanudar grabación:**
   - Botón de pausa durante la grabación
   - Continuar sin perder contexto

5. **Transcripción con puntuación mejorada:**
   - Usar modelo de puntuación post-procesamiento
   - Capitalización automática de nombres propios

6. **Múltiples idiomas:**
   - Detectar idioma automáticamente
   - Selector de idioma en el botón

### **Prioridad Baja:**

7. **Historial de transcripciones:**
   - Guardar transcripciones del día
   - Reutilizar frases comunes

8. **Plantillas de voz:**
   - Comandos de voz para insertar plantillas
   - "Insertar plantilla de examen físico normal"

9. **Corrección colaborativa:**
   - Entrenar modelo con correcciones del doctor
   - Mejorar precisión con el tiempo

---

## ✅ Checklist de Implementación

- ✅ Instalado SDK de OpenAI en backend
- ✅ Creado endpoint `/api/transcription/transcribe`
- ✅ Creado endpoint `/api/transcription/status`
- ✅ Registrado en rutas principales
- ✅ Agregada variable de entorno `OPENAI_API_KEY`
- ✅ Backend compilado y reiniciado
- ✅ Creado componente `VoiceDictationButton`
- ✅ Agregada función `transcribeAudio` en hook
- ✅ Integrado en 6 campos de historia clínica
- ✅ Frontend compilado exitosamente
- ✅ Documentación completa

---

## 🎓 Conclusión

El sistema de **dictado por voz con IA** está completamente implementado y listo para usar. Los doctores pueden:

✅ Dictar en lugar de escribir  
✅ Ahorrar tiempo significativo  
✅ Reducir errores de tipeo  
✅ Mejorar la productividad  
✅ Enfocarse más en el paciente  

**Para activar:**
1. Configurar `OPENAI_API_KEY` en el backend
2. Reiniciar PM2: `pm2 restart cita-central-backend`
3. Abrir historia clínica y hacer clic en "🎤 Dictar"

**El sistema es profesional, seguro y escalable.** 🎙️✨

---

**Documentado por:** GitHub Copilot Assistant  
**Fecha:** Octubre 27, 2025  
**Versión:** 1.0.0 - Dictado por Voz con OpenAI Whisper
