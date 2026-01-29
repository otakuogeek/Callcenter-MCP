# Prueba de WhatsApp Bot - Sistema Real

## ✅ Cambios Realizados

### 1. Filtrado por Sesión Actual
- Los endpoints `/api/whatsapp/conversations` y `/api/whatsapp/conversations/:phone` ahora filtran SOLO por la sesión conectada actual
- Se eliminaron 31 mensajes de prueba antiguos (session_id='default')
- Solo se mostrarán conversaciones REALES del número conectado: **+58 424-745-6535**

### 2. Auto-Reply Activado
- `WHATSAPP_AUTO_REPLY=true` - El bot responderá automáticamente
- Horario: 07:00 - 18:00 (configurable)
- Modelo: DeepSeek Chat con acceso a 24 herramientas MCP

### 3. Sistema de Mensajería Real
- Los mensajes entrantes se guardan con el `session_id` correcto
- Los mensajes salientes se envían vía Baileys al WhatsApp real
- Todo se sincroniza en la base de datos con la sesión actual

## 🧪 Cómo Probar

### Paso 1: Verificar Conexión
1. Ve a: https://biosanarcall.site/admin/whatsapp
2. Deberías ver en el header: **Biosanar IPS • 584247456535**
3. Estado: **Conectado** (punto verde)

### Paso 2: Enviar Mensaje desde Otro Número
Desde tu WhatsApp personal, envía un mensaje a: **+58 424-745-6535**

Ejemplo:
```
Hola, necesito una cita
```

### Paso 3: Verificar en Dashboard
1. Refresca el dashboard (F5)
2. En el panel izquierdo deberías ver aparecer tu número
3. Haz clic en tu número para abrir el chat
4. Verás tu mensaje y la respuesta automática del bot (Valeria)

### Paso 4: Responder desde Dashboard
1. En el chat abierto, escribe una respuesta
2. Presiona Enter o clic en el botón de enviar
3. El mensaje debería llegar a tu WhatsApp personal

### Paso 5: Verificar Bot IA
El bot debería:
- Saludar al primer mensaje
- Ofrecer servicios de agendamiento
- Usar las 24 herramientas MCP disponibles:
  - `getAvailableAppointments` - Ver agendas disponibles
  - `searchPatientByDocument` - Buscar paciente por cédula
  - `registerPatientSimple` - Registrar nuevo paciente
  - `scheduleAppointment` - Agendar cita
  - Y más...

## 🔍 Verificación Técnica

### Consultar Mensajes Recibidos
```bash
mysql -u biosanar_user -p'/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU' biosanar -e "
SELECT 
  from_number, 
  body, 
  direction, 
  ai_response, 
  created_at 
FROM wa_messages 
WHERE session_id = 'session_1765455626434' 
ORDER BY created_at DESC 
LIMIT 10;
"
```

### Consultar Conversaciones Activas
```bash
mysql -u biosanar_user -p'/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU' biosanar -e "
SELECT 
  phone_number, 
  last_message, 
  last_activity 
FROM wa_conversations 
WHERE session_id = 'session_1765455626434';
"
```

### Verificar Estado de Conexión
```bash
curl -X GET https://biosanarcall.site/api/whatsapp/status \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6ImFkbWluIiwibmFtZSI6IkRlbW8iLCJlbWFpbCI6ImRlbW9AZGVtby5jb20iLCJpYXQiOjE3NjU0NTIwNDEsImV4cCI6MTc2NTQ4MDg0MX0.vIVFEL9LFTa_tPR5fvVHK60WcJg3lyCAZOKn3P8oN1g"
```

## 🐛 Troubleshooting

### Problema: "No se ven los mensajes que envío"
**Solución**: Verifica que el número esté formateado correctamente:
- Debe incluir código de país SIN el +
- Ejemplo: `584247456535` (correcto)
- No: `+58 424-745-6535` (incorrecto para envío)

### Problema: "El bot no responde"
**Verificar**:
1. `WHATSAPP_AUTO_REPLY=true` en `/home/ubuntu/app/backend/.env`
2. Horario de atención: 07:00 - 18:00 (America/Bogota)
3. Servidor MCP corriendo: `pm2 list | grep mcp-unified`

### Problema: "Los mensajes no llegan a mi WhatsApp"
**Verificar**:
1. Conexión activa: Estado "connected" en dashboard
2. Sesión no expirada (si se cerró sesión en el teléfono, regenerar QR)
3. Logs del backend: `pm2 logs cita-central-backend --lines 50`

## 📊 Monitoreo en Tiempo Real

### Ver logs del backend
```bash
pm2 logs cita-central-backend --lines 100
```

### Ver logs del servidor MCP
```bash
pm2 logs mcp-unified --lines 50
```

### Reiniciar servicios si es necesario
```bash
# Reiniciar backend
pm2 restart cita-central-backend

# Reiniciar MCP
pm2 restart mcp-unified

# Ver estado
pm2 status
```

## ✨ Funcionalidades del Bot (Valeria)

1. **Agendamiento de Citas**
   - Buscar disponibilidad por especialidad
   - Seleccionar fecha y hora
   - Registrar paciente si no existe
   - Confirmar cita con número de referencia

2. **Información de Servicios**
   - Especialidades disponibles
   - Sedes y ubicaciones
   - Horarios de atención

3. **Consultas**
   - Estado de citas
   - Lista de espera
   - Información del paciente

4. **Inteligente**
   - Comprende lenguaje natural
   - Mantiene contexto de conversación
   - Maneja errores con mensajes amables

## 🔐 Seguridad

- La sesión de WhatsApp se guarda en: `/home/ubuntu/app/backend/.whatsapp-auth/`
- Credenciales encriptadas por Baileys
- Auto-reconexión si se pierde la conexión
- Máximo 5 intentos de reconexión automática

## 📝 Notas Importantes

1. **Solo se muestran mensajes nuevos**: El sistema NO descarga el historial antiguo del teléfono, solo los mensajes recibidos después de la conexión.

2. **Sincronización bidireccional**: 
   - Mensajes entrantes → Se guardan y procesan con IA
   - Mensajes salientes desde dashboard → Se envían al WhatsApp real

3. **Persistencia de sesión**: Una vez escaneado el QR, la sesión persiste hasta que se cierre manualmente desde el teléfono o desde el dashboard.

---

**Última actualización**: 11 de diciembre de 2025
**Versión**: 1.0.0
**Número conectado**: +58 424-745-6535
**Session ID**: session_1765455626434
