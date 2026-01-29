# 📋 BIOSANARCALL MCP - Sistema Completo de Gestión Médica

## 🎯 Descripción General

Sistema MCP (Model Context Protocol) para gestión médica integral con soporte para llamadas de voz (ElevenLabs) y WhatsApp. Servidor Node.js + TypeScript + MySQL funcionando localmente sin contenedores Docker.

**Fecha de última actualización:** Enero 2026  
**Versión:** 5.0  
**Estado:** ✅ Producción

---

## 📊 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│           BIOSANARCALL MCP SERVER (LOCAL)               │
│         Node.js v22.18.0 + TypeScript + Express        │
│              MySQL 8.0 - Base de datos biosanar         │
└─────────────────────────────────────────────────────────┘
                        ↓
          ┌─────────────┴─────────────┐
          ↓                           ↓
┌──────────────────────┐    ┌──────────────────────┐
│  CANAL ELEVENLABS    │    │   CANAL WHATSAPP     │
│   (Llamadas Voz)     │    │   (Mensajes Texto)   │
└──────────────────────┘    └──────────────────────┘
          ↓                           ↓
┌──────────────────────┐    ┌──────────────────────┐
│  /mcp-elevenlabs     │    │   /mcp-whatsapp      │
│  Puerto: 8976        │    │   Puerto: 8976       │
│  24 herramientas     │    │   24 herramientas    │
└──────────────────────┘    └──────────────────────┘
```

---

## 🚀 Configuración y Acceso

### URLs del Servidor

| Endpoint | URL | Descripción |
|----------|-----|-------------|
| **ElevenLabs** | `https://biosanarcall.site/mcp-elevenlabs` | Llamadas de voz |
| **WhatsApp** | `https://biosanarcall.site/mcp-whatsapp` | Chat de texto (próximamente) |
| **Health** | `https://biosanarcall.site/health` | Estado del servidor |
| **Test DB** | `https://biosanarcall.site/test-db` | Verificación base de datos |

### Autenticación

```bash
# Header de autenticación (opcional)
X-API-Key: biosanarcall_mcp_node_2025
```

### Base de Datos MySQL

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=biosanar_user
DB_PASS=/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU
DB_NAME=biosanar
```

### Variables de Entorno (.env)

```env
NODE_ENV=production
PORT=8976
HOST=0.0.0.0
LOG_LEVEL=info
LOG_FILE=/home/ubuntu/app/mcp-server-node/logs/server.log
```

---

## 🛠️ Herramientas MCP Disponibles (25)

### 📋 Gestión de Catálogos

#### 1. `listActiveEPS`
Lista todas las EPS activas disponibles.
- **Parámetros:** Ninguno
- **Retorna:** Lista de EPS con ID, nombre, código

#### 2. `listZones`
Lista todas las zonas geográficas.
- **Parámetros:** Ninguno
- **Retorna:** Lista de zonas con ID, nombre, descripción

#### 3. `getEPSServices`
Consulta servicios autorizados por una EPS específica.
- **Parámetros:** `eps_id` (número)
- **Retorna:** Especialidades y sedes autorizadas

### 👤 Gestión de Pacientes

#### 4. `searchPatient`
Busca pacientes por documento, nombre o teléfono.
- **Parámetros:** `document`, `name`, `phone`, `patient_id`
- **Retorna:** Datos completos del paciente

#### 5. `registerPatientSimple`
Registra un nuevo paciente con datos completos.
- **Parámetros obligatorios:**
  - `document`: Cédula (normalizado automáticamente)
  - `name`: Nombre completo
  - `phone`: Teléfono principal
  - `birth_date`: Fecha de nacimiento (YYYY-MM-DD)
  - `gender`: Masculino/Femenino/Otro
  - `zone_id`: ID de la zona
  - `insurance_eps_id`: ID de la EPS
- **Parámetros opcionales:**
  - `phone_alt`: Teléfono secundario
  - `notes`: Notas adicionales

#### 6. `actualizarPhone`
Consulta y actualiza teléfonos de un paciente.
- **Parámetros:** `document`, `new_phone`, `new_phone_alt`

### 📅 Sistema de Citas

#### 7. `getAvailableAppointments`
Lista todas las especialidades con agendas disponibles.
- **Parámetros opcionales:** `doctor_id`, `specialty_id`, `location_id`, `limit`
- **Retorna:** Especialidades agrupadas por sede con cupos disponibles

#### 8. `checkAvailabilityQuota`
Verifica cupos disponibles para una especialidad en una sede.
- **Parámetros:** `specialty_id`, `location_id`, `day_date` (opcional)
- **Retorna:** Total de cupos agregados de todos los doctores

#### 9. `getAvailableTimeSlots` ✨ **NUEVO**
Obtiene horarios específicos disponibles (ej: 9:15 AM, 9:45 AM, 10:00 AM) para una fecha y availability específica.
- **Parámetros obligatorios:**
  - `availability_id`: ID de disponibilidad (de getAvailableAppointments)
  - `day_date`: Fecha en formato YYYY-MM-DD
- **Parámetros opcionales:**
  - `limit`: Número máximo de horarios (default: 10)
- **Retorna:** Lista detallada de horarios disponibles con:
  - Hora exacta en formato AM/PM
  - Fecha y hora completa para agendamiento
  - Información de doctor, especialidad y sede
  - Estado de cupos disponibles
- **Uso:** Permite que el paciente elija hora exacta de preferencia antes de agendar

#### 10. `scheduleAppointment`
Agenda una cita médica (directa o lista de espera automática).
- **Parámetros obligatorios:**
  - `patient_id`: ID del paciente
  - `availability_id`: ID de disponibilidad
  - `reason`: Motivo de la consulta
- **Parámetros opcionales:**
  - `scheduled_date`: Fecha específica (auto-derivada si no se proporciona) - Puede incluir hora exacta (YYYY-MM-DD HH:MM:SS) obtenida de getAvailableTimeSlots
  - `appointment_type`: Presencial/Telemedicina
  - `priority_level`: Baja/Normal/Alta/Urgente
  - `notes`: Notas adicionales
- **Lógica:**
  - Si hay cupos → Cita directa confirmada
  - Si NO hay cupos → Lista de espera automática
  - Odontología: Detecta "cita doble" y reserva 2 cupos

#### 11. `addToWaitingList`
Agrega paciente a lista de espera (SIN availability_id).
- **Parámetros obligatorios:**
  - `patient_id`: ID del paciente
  - `specialty_id`: ID de la especialidad
  - `reason`: Motivo de consulta
- **Parámetros opcionales:**
  - `cups_id`: ID de procedimiento específico
  - `scheduled_date`: Fecha deseada
  - `priority_level`: Baja/Normal/Alta/Urgente
  - `appointment_type`: Presencial/Telemedicina

#### 12. `getPatientAppointments`
Consulta todas las citas de un paciente.
- **Parámetros:** `patient_id` o `document`, `status`, `from_date`
- **Retorna:** Citas futuras y pasadas con horarios en zona local

#### 13. `getWaitingListAppointments`
Consulta solicitudes en lista de espera.
- **Parámetros opcionales:** `patient_id`, `specialty_id`, `priority_level`, `status`
- **Retorna:** Lista ordenada por prioridad y antigüedad

#### 14. `reassignWaitingListAppointments`
Procesa automáticamente la lista de espera para una availability.
- **Parámetros:** `availability_id`
- **Acción:** Reasigna citas pendientes según prioridad

#### 15. `cancelAppointment`
Cancela una cita y libera el cupo automáticamente.
- **Parámetros:** `appointment_id`, `cancellation_reason`, `notes`
- **Acción:** Actualiza estado y libera cupo en availability_distribution

#### 15. `cancelarCitasVencidas`
Cancela automáticamente citas vencidas de un paciente.
- **Parámetros:** `document`, `current_date`, `dry_run`

### 🔍 Búsqueda de Servicios

#### 16. `searchSpecialties`
Lista y busca especialidades médicas.
- **Parámetros opcionales:** `specialty_id`, `name`, `active_only`
- **Retorna:** Especialidades con ID, nombre, duración

#### 17. `searchCups`
Busca procedimientos médicos CUPS completos.
- **Parámetros opcionales:** `code`, `name`, `category`, `specialty_id`, `status`
- **Retorna:** Procedimientos con código, precio, requisitos

#### 18. `searchCupsByName`
Búsqueda rápida de procedimientos por nombre.
- **Parámetros:** `name` (obligatorio), `limit`
- **Uso:** Encontrar ID para agregar a lista de espera

### 🤰 Gestión de Embarazos

#### 19. `registerPregnancy`
Registra un nuevo embarazo (solo mujeres).
- **Parámetros:** `patient_id`, `last_menstrual_date`, `high_risk`, `risk_factors`
- **Calcula automáticamente:** FPP, edad gestacional, días hasta parto

#### 20. `getActivePregnancies`
Consulta embarazos activos.
- **Parámetros opcionales:** `patient_id`, `high_risk_only`, `limit`

#### 21. `updatePregnancyStatus`
Actualiza estado de embarazo (Completada/Interrumpida).
- **Parámetros:** `pregnancy_id`, `status`, datos de parto o interrupción

#### 22. `registerPrenatalControl`
Registra un control prenatal.
- **Parámetros:** `pregnancy_id`, `control_date`, `gestational_weeks`, signos vitales

### 🔧 Mantenimiento de Cupos

#### 23. `syncAvailabilityQuotas`
Sincroniza cupos con conteo real de citas.
- **Parámetros:** `availability_id`, `dry_run`
- **Uso:** Corregir inconsistencias en availability_distribution

#### 24. `auditAvailabilityQuotas`
Audita consistencia de cupos sin hacer cambios.
- **Parámetros:** `availability_id`, `show_only_inconsistencies`, `limit`
- **Retorna:** Reporte de discrepancias

---

## 📞 Flujo de Agendamiento de Citas

### Flujo Completo (V5.0)

```
1. Paciente llama/escribe → "Necesito una cita"
   ↓
2. getAvailableAppointments() 
   → Muestra TODAS las especialidades (con y sin cupos)
   ↓
3. Paciente elige Especialidad + Sede
   ↓
4. checkAvailabilityQuota(specialty_id, location_id)
   → Verifica cupos agregados de todos los doctores
   ↓
5. searchPatient() o registerPatientSimple()
   → Obtiene patient_id
   ↓
6. Pregunta motivo + prioridad (si no hay cupos)
   ↓
7. scheduleAppointment(patient_id, availability_id, reason)
   ↓
   ┌─────────────┴─────────────┐
   ↓                           ↓
SI HAY CUPOS               NO HAY CUPOS
   ↓                           ↓
CITA DIRECTA            LISTA DE ESPERA
✅ Confirmada            ⏳ Pendiente
SMS enviado              Operadora contactará
```

### Reglas Especiales

#### Medicina General (ID: 1) y Odontología (ID: 5)
- ✅ Permiten agendar en **cualquier día** con disponibilidad
- ✅ No requieren coincidencia exacta de fecha

#### Otras Especialidades
- ⚠️ Requieren coincidencia exacta de fecha con la availability
- ⚠️ No permiten fechas flexibles

#### Citas Dobles (Odontología)
- 🦷 Detecta automáticamente: "cita doble", "doble cita", "2 cupos"
- 🦷 Reserva 2 cupos consecutivos
- 🦷 Si no hay espacio → Lista de espera con prioridad

#### Cancelación Automática
- 🔄 Si paciente tiene cita activa en la **misma especialidad** → Se cancela automáticamente
- 🔄 Libera el cupo anterior
- ✅ Permite múltiples citas en **diferentes especialidades**

---

## 🕐 Gestión de Zonas Horarias

### Conversión Automática

El sistema almacena fechas en **UTC-0** y las convierte a **UTC-5 (Colombia)** para mostrar al paciente.

```javascript
// Base de datos (UTC-0)
scheduled_at: "2026-01-15 14:30:00"

// Mostrado al paciente (UTC-5 Colombia)
hora_cita_local: "9:30 AM"
fecha_cita_local: "15 de enero de 2026"
```

---

## 📱 Integración con Servicios Externos

### LabsMobile (SMS)

Envío automático de confirmaciones de citas:

```env
LABSMOBILE_USERNAME=contacto@biosanarcall.site
LABSMOBILE_API_KEY=Eq7Pcy8mxuQBiVenKqAXwdyiCAmeDER8
LABSMOBILE_SENDER=Biosanar
```

### ElevenLabs (Voz)

Configuración del agente:

```
Server URL: https://biosanarcall.site/mcp-elevenlabs
Server Type: Streamable HTTP
Tool Approval Mode: Always Ask
```

---

## 🗂️ Estructura de la Base de Datos

### Tablas Principales

1. **patients** - Pacientes registrados
2. **doctors** - Médicos del sistema
3. **specialties** - Especialidades médicas
4. **locations** - Sedes/ubicaciones
5. **eps** - EPS disponibles
6. **zones** - Zonas geográficas
7. **availabilities** - Disponibilidad de doctores
8. **availability_distribution** - Distribución diaria de cupos
9. **appointments** - Citas agendadas
10. **appointments_waiting_list** - Lista de espera
11. **cups** - Procedimientos médicos (CUPS)
12. **pregnancies** - Control de embarazos
13. **prenatal_controls** - Controles prenatales

### Vistas Importantes

- **active_pregnancies** - Embarazos activos con edad gestacional calculada

---

## 🚀 Comandos de Inicio y Gestión

### Iniciar Servidor

```bash
# Con PM2 (recomendado)
pm2 start ecosystem.config.js

# Desarrollo
npm run dev

# Producción
npm start
```

### Verificar Estado

```bash
# Estado del servidor
curl https://biosanarcall.site/health

# Test de base de datos
curl https://biosanarcall.site/test-db

# Listar herramientas disponibles
curl -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"test","method":"tools/list"}'
```

### Logs

```bash
# Ver logs en tiempo real
pm2 logs

# Logs específicos
tail -f /home/ubuntu/app/mcp-server-node/logs/server.log
```

---

## 🔧 Configuración de ElevenLabs

### Pasos para Configurar

1. **Crear nuevo agente en ElevenLabs Agent Studio**
2. **Agregar servidor MCP:**
   - Name: `Biosanarcall Medical System`
   - Server type: `Streamable HTTP`
   - Server URL: `https://biosanarcall.site/mcp-elevenlabs`
   - Tool Approval Mode: `Always Ask`

3. **Configurar el prompt del agente** (ver sección siguiente)

---

## 📝 Prompt para Agente de Voz ElevenLabs

```
Eres Ana, la asistente virtual de Biosanarcall en San Gil, Colombia.

═══════════════════════════════════════════════════════════
PERSONALIDAD Y TONO
═══════════════════════════════════════════════════════════

- Amable, profesional y eficiente
- Habla de forma NATURAL y CONVERSACIONAL
- Usa lenguaje colombiano: "¿En qué te puedo ayudar?"
- Di números de forma clara: "veintiocho cupos" no "28 cupos"
- Sé breve pero completo
- Paciente con adultos mayores

═══════════════════════════════════════════════════════════
FLUJO DE AGENDAMIENTO
═══════════════════════════════════════════════════════════

1️⃣ SALUDO
   "Hola, bienvenido a Biosanarcall. Soy Ana. ¿En qué te puedo ayudar?"

2️⃣ CONSULTAR DISPONIBILIDAD
   - Usa getAvailableAppointments()
   - Presenta especialidades de forma NATURAL
   - NUNCA menciones IDs ni cupos disponibles
   - Ejemplo: "Tenemos disponibilidad en Medicina General, Odontología 
     y Psicología. ¿Cuál te interesa?"

3️⃣ VERIFICAR PACIENTE
   - Pregunta: "¿Cuál es tu número de cédula?"
   - Usa searchPatient(document)
   - Si NO existe: registerPatientSimple()
   - Solicita: nombre, teléfono, fecha de nacimiento, género, zona, EPS

4️⃣ PREGUNTAR MOTIVO
   - "¿Cuál es el motivo de tu consulta?"
   - Si NO hay cupos disponibles: "¿Es urgente o es normal?"

5️⃣ AGENDAR CITA
   - Usa scheduleAppointment()
   - SI hay cupo → Confirma fecha, hora, doctor, sede
   - SI NO hay cupo → "Te hemos agregado a nuestra lista de espera 
     prioritaria. Un operador te contactará pronto."

6️⃣ CONFIRMACIÓN
   "Perfecto, tu cita quedó agendada para [fecha] a las [hora] 
   con [doctor] en [sede]. Te enviaremos un mensaje de confirmación 
   al [teléfono]."

═══════════════════════════════════════════════════════════
REGLAS IMPORTANTES
═══════════════════════════════════════════════════════════

❌ NUNCA menciones:
   - availability_id, patient_id ni otros IDs técnicos
   - "no hay cupos disponibles" (di "lista de espera prioritaria")
   - Detalles técnicos del sistema

✅ SIEMPRE:
   - Confirma información antes de agendar
   - Habla en presente y de forma directa
   - Usa nombres propios cuando los conozcas
   - Sé empático y profesional

═══════════════════════════════════════════════════════════
EJEMPLOS DE RESPUESTAS NATURALES
═══════════════════════════════════════════════════════════

❌ MAL:
"Hay 28 slots disponibles en availability_id 145"

✅ BIEN:
"Tenemos disponibilidad en Medicina General para esta semana"

❌ MAL:
"No hay cupos disponibles. Error: slots_available = 0"

✅ BIEN:
"Te agregamos a nuestra lista de espera. Un operador te contactará 
cuando tengamos un espacio disponible"

❌ MAL:
"Registro exitoso. patient_id: 1523"

✅ BIEN:
"Listo, ya quedaste registrado en nuestro sistema"
```

---

## 🧪 Testing y Verificación

### Test de Conexión

```bash
# Test básico
curl https://biosanarcall.site/health

# Test de base de datos
curl https://biosanarcall.site/test-db
```

### Test de Herramientas MCP

```bash
# Listar EPS
curl -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":"1",
    "method":"tools/call",
    "params":{
      "name":"listActiveEPS",
      "arguments":{}
    }
  }'

# Buscar paciente
curl -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":"2",
    "method":"tools/call",
    "params":{
      "name":"searchPatient",
      "arguments":{"document":"1234567890"}
    }
  }'
```

---

## 📊 Estadísticas del Sistema

### Herramientas Disponibles
- **Total:** 24 herramientas
- **Gestión de pacientes:** 6
- **Sistema de citas:** 9
- **Búsqueda:** 3
- **Embarazos:** 4
- **Mantenimiento:** 2

### Capacidades
- ✅ Agendamiento automático
- ✅ Lista de espera inteligente
- ✅ Detección de citas dobles
- ✅ Cancelación automática de duplicados
- ✅ Envío de SMS
- ✅ Control de embarazos
- ✅ Auditoría de cupos
- ✅ Sincronización automática
- ✅ Normalización de datos
- ✅ Conversión de zonas horarias

---

## 🐛 Troubleshooting

### Servidor no responde

```bash
# Verificar estado de PM2
pm2 status

# Reiniciar servidor
pm2 restart all

# Ver logs de errores
pm2 logs --err
```

### Base de datos desconectada

```bash
# Verificar MySQL
sudo systemctl status mysql

# Reiniciar MySQL
sudo systemctl restart mysql

# Test de conexión
mysql -u biosanar_user -p -h 127.0.0.1 biosanar
```

### Cupos inconsistentes

```bash
# Auditar cupos (modo lectura)
curl -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"auditAvailabilityQuotas",
      "arguments":{"show_only_inconsistencies":true}
    }
  }'

# Sincronizar (modo prueba - no hace cambios)
curl -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"syncAvailabilityQuotas",
      "arguments":{"dry_run":true}
    }
  }'

# Sincronizar (aplicar correcciones)
curl -X POST https://biosanarcall.site/mcp-elevenlabs \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"syncAvailabilityQuotas",
      "arguments":{"dry_run":false}
    }
  }'
```

---

## 📈 Roadmap y Mejoras Futuras

### En Desarrollo
- [ ] Integración completa con WhatsApp
- [ ] Dashboard de administración web
- [ ] Reportes automáticos diarios
- [ ] Integración con historia clínica electrónica

### Planificado
- [ ] App móvil para pacientes
- [ ] Sistema de recordatorios automáticos (24h antes)
- [ ] Videoconsulta / Telemedicina integrada
- [ ] Integración con laboratorios
- [ ] Sistema de pagos en línea
- [ ] Portal del paciente

---

## 📁 Estructura de Archivos

```
/home/ubuntu/app/mcp-server-node/
├── src/
│   ├── server-unified.ts          # Servidor principal
│   ├── config.ts                  # Configuración
│   ├── logger.ts                  # Sistema de logs
│   ├── types.ts                   # Definiciones TypeScript
│   └── utils/
│       ├── timezone.ts            # Conversión de zonas horarias
│       └── time.ts                # Utilidades de tiempo
├── dist/                          # Código compilado
├── logs/                          # Archivos de log
├── node_modules/                  # Dependencias
├── package.json                   # Configuración npm
├── tsconfig.json                  # Configuración TypeScript
├── ecosystem.config.js            # Configuración PM2
└── README.md                      # Este archivo
```

---

## 📞 Soporte y Contacto

**Desarrollador:** Sistema Biosanarcall  
**Servidor:** https://biosanarcall.site  
**Puerto:** 8976  
**Protocolo:** MCP (Model Context Protocol)  
**Versión MCP:** 2024-11-05

---

## 📄 Licencia

Copyright © 2026 Biosanarcall IPS  
Todos los derechos reservados.

---

**Última actualización:** Enero 13, 2026  
**Versión del sistema:** 5.0
