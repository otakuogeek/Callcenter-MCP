# 📱 Sistema de SMS Integrado - Biosanar IPS

## ✅ Sistema Completamente Funcional

### 🗄️ Base de Datos

**Tabla: `sms_logs`**
- Almacena todo el historial de SMS enviados
- Incluye: destinatario, mensaje, estado, costo, fecha, IDs de paciente/cita
- Respuesta completa de Zadarma guardada en JSON

### 🔧 Arquitectura

**Servicio PHP (`zadarma-sms-php.service.ts`)**
- Usa el SDK oficial de Zadarma (PHP) que funciona perfectamente
- Node.js ejecuta el script PHP mediante `child_process`
- Guarda cada SMS en la base de datos automáticamente

**Script PHP (`/zadarma-oficial/send_sms_wrapper.php`)**
- Wrapper que recibe parámetros por CLI
- Utiliza credenciales API correctas
- Retorna respuesta en formato JSON

### 📡 Endpoints Disponibles

#### 1. **POST `/api/sms/send-public`** (Público - Sin autenticación)
Envía un SMS sin requerir login.

**Ejemplo:**
```bash
curl -X POST "http://127.0.0.1:4000/api/sms/send-public" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "+584129578254",
    "message": "Tu cita ha sido confirmada",
    "recipient_name": "Juan Pérez",
    "patient_id": 1,
    "appointment_id": 100
  }'
```

#### 2. **GET `/api/sms/history`** (Requiere autenticación)
Obtiene el historial de SMS enviados.

**Parámetros:**
- `recipient_number` - Filtrar por número
- `status` - Filtrar por estado (success/failed)
- `patient_id` - Filtrar por paciente
- `appointment_id` - Filtrar por cita
- `limit` - Límite de resultados (default: 50)
- `offset` - Paginación

**Ejemplo:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://127.0.0.1:4000/api/sms/history?limit=10"
```

#### 3. **GET `/api/sms/stats`** (Requiere autenticación)
Obtiene estadísticas de SMS enviados.

**Parámetros:**
- `year` - Filtrar por año
- `month` - Filtrar por mes

**Ejemplo:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://127.0.0.1:4000/api/sms/stats"
```

### 💰 Costos

- **Mensaje simple (< 160 caracteres)**: $0.12 USD
- **Mensaje largo (161-320 caracteres)**: $0.24 USD (2 partes)
- **Remitente por defecto**: "Teamsale"

### 📊 Estadísticas Actuales

```
Total enviados: 2 SMS
Total exitosos: 2
Total fallidos: 0
Costo total: $0.36 USD
```

### 🔑 Credenciales Configuradas

```env
ZADARMA_SMS_API_KEY=d37e278f185cf3a2a8d4
ZADARMA_SMS_API_SECRET=bba31aff4c3a03fb1605
```

### 📝 Plantillas de Mensaje

**Recordatorio de Cita:**
```
IPS Biosanar le recuerda: Cita para {nombre} el {fecha} a las {hora} con {doctor} de {especialidad} en la {sede}.
```

### 🎯 Próximos Pasos Sugeridos

1. **Integrar con sistema de citas**
   - Enviar SMS automático al crear/modificar cita
   - Recordatorios 24h antes de la cita

2. **Panel de administración**
   - Visualizar historial de SMS en el frontend
   - Gráficos de estadísticas de envío

3. **Plantillas personalizadas**
   - Usar plantillas de Zadarma (ID 9574 para citas)
   - Variables dinámicas: {$var}

4. **Optimizaciones**
   - Cola de envío para múltiples SMS
   - Retry automático en caso de fallo
   - Límites diarios/mensuales

### 📞 Contacto

- **Sistema**: Biosanar IPS
- **Remitente SMS**: Teamsale
- **Número virtual**: +576076916019

---
**Creado**: 30 de Octubre 2025
**Estado**: ✅ Producción
