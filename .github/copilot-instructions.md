# GitHub Copilot Instructions for Biosanarcall Medical System

## Architecture Overview

This is a **modular medical management system** with three main components:
- **Frontend**: React 18 + TypeScript + Vite with shadcn/ui design system
- **Backend**: Node.js + Express + TypeScript with MySQL2 database  
- **MCP Integration**: Python and Node.js MCP (Model Context Protocol) servers for AI agent integration

## Project Structure & Key Patterns

### Frontend (`/frontend/`)
- Uses **shadcn/ui + Radix UI** components exclusively - never write custom UI from scratch
- **React Router 6** with protected routes via `ProtectedRoute` wrapper
- **TanStack Query** for server state management
- **React Hook Form + Zod** validation pattern for all forms
- **Modular patient management** system with 6 specialized components (4-6 fields each)

```tsx
// Standard form pattern used throughout
const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
  resolver: zodResolver(schema)
});
```

### Backend (`/backend/`)
- **Express + TypeScript** with security-first approach (helmet, CORS, rate limiting)
- **MySQL2** with connection pooling - database operations in `/src/db/`
- **JWT authentication** with protected routes middleware pattern
- **File uploads** handled via multer to `/uploads` directory
- **PM2 ecosystem** configuration for production deployment

```typescript
// Standard API route pattern
app.use('/api/patients', authenticateToken, patientRoutes);
```

### MCP Servers Integration
- **Python MCP Server** (`/mcp-server-python/`) - 24 medical tools for AI agents
- **Node.js MCP Server** (`/mcp-server-node/`) - Alternative implementation
- **JSON-RPC 2.0** protocol for AI agent communication
- Production endpoints: `https://biosanarcall.site/mcp-py*`

## Development Workflows

### Frontend Development
```bash
cd frontend && npm run dev    # Vite dev server on port 5173
npm run build                 # Production build with type checking
```

### Backend Development  
```bash
cd backend && npm run dev     # ts-node-dev with auto-reload
npm run db:init              # Initialize database with schema
npm run db:seed              # Create admin user (SEED_ADMIN_* env vars)
npm run db:check             # Test MySQL connection
```

### Critical Environment Variables
```env
# Backend
DB_HOST=127.0.0.1
DB_USER=biosanar_user  
DB_NAME=biosanar
JWT_SECRET=your_secret
CORS_ORIGINS=https://biosanarcall.site

# MCP Servers
BACKEND_BASE=http://127.0.0.1:4000/api
BACKEND_TOKEN=jwt_token_here
```

## Component Patterns & Conventions

### Patient Management System
The system uses a **6-tool modular approach** instead of monolithic forms:
- `PatientBasicInfo` (4 fields) - Name, document, birth date, gender
- `PatientContactInfo` (6 fields) - Phone, email, address, municipality  
- `PatientMedicalInfo` (5 fields) - Blood type, allergies, conditions
- `PatientInsuranceInfo` (3 fields) - EPS, affiliation type
- `PatientDemographicInfo` (5 fields) - Education, marital status, occupation
- `PatientsList` - Search and management interface

### Layout Pattern
All pages use consistent layout with sidebar:
```tsx
<SidebarProvider>
  <AppSidebar />
  <main className="w-full">
    <SidebarTrigger />
    {/* Page content */}
  </main>
</SidebarProvider>
```

### API Client Pattern
Use centralized error handling for 401/404 responses:
```typescript
// Handle expired JWT gracefully
.catch(error => {
  if (error.response?.status === 401) {
    // Redirect to login or refresh token
  }
  console.error('API Error:', error);
});
```

## Database & API Conventions

### Route Structure
- `/api/auth/*` - Authentication endpoints
- `/api/patients/*` - Patient CRUD operations
- `/api/appointments/*` - Scheduling system
- `/api/lookups/*` - Reference data (municipalities, EPS, etc.)

### Standard Response Format
```typescript
// Success response
{ success: true, data: T, message?: string }

// Error response  
{ success: false, error: string, details?: any }
```

## MCP Integration Points

### Tool Categories (24 total)
- **Patient Management**: Search, create, update patients
- **Appointment System**: Schedule, modify, cancel appointments  
- **Analytics**: Daily summaries, statistics, reports
- **Notifications**: Send confirmations, reminders
- **File Operations**: Upload documents, export data

### MCP Client Configuration
```yaml
# For ElevenLabs or other AI agents
server_url: "https://biosanarcall.site/mcp-py-simple"
description: "Medical management with voice optimization (9 core tools)"
```

## Deployment & Production

### PM2 Configuration
Both backend and MCP servers use PM2 with ecosystem files:
```javascript
// Standard PM2 app config
{
  name: 'app-name',
  script: 'dist/server.js',
  env: { NODE_ENV: 'production', PORT: 4000 },
  max_memory_restart: '300M'
}
```

### Nginx Integration
- Frontend served as static files
- Backend proxied to port 4000
- MCP servers on separate endpoints
- SSL/HTTPS required for production

## Common Troubleshooting

- **401 Errors**: Check JWT token expiration and refresh mechanism
- **404 API Endpoints**: Some statistics endpoints may not be implemented - use graceful fallbacks
- **CORS Issues**: Verify `CORS_ORIGINS` environment variable includes your domain
- **Database Connection**: Use `npm run db:check` to verify MySQL connectivity

## Testing Patterns

```bash
# Backend feature testing
npm run test:features

# MCP server testing  
curl -X POST https://biosanarcall.site/mcp-py-simple \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

Remember: This system prioritizes **modular architecture**, **security-first design**, and **AI agent integration** through MCP protocol.

Flujo de Trabajo Detallado
PASO 1: Saludo e Inicio Inmediato del Agendamiento

Saludo Inicial: Comienza la llamada directamente con: "Hola, bienvenido a Fundación Biosanar IPS. Le atiende Valeria, ¿cómo puedo colaborarle?"

Ir al Grano: Tan pronto el usuario mencione que necesita una cita o un servicio, responde: "Con gusto, permítame un momento mientras verifico las agendas disponibles en el sistema." e inicia INMEDIATAMENTE el PASO 2.

PASO 2: Consulta y Presentación de Disponibilidad

Consultar Disponibilidad General: Llama a la herramienta getAvailableAppointments SIN ningún parámetro.

Evaluar Respuesta:

Si la herramienta falla o retorna vacío: Ve directamente al Flujo de Error A.

Si retorna datos exitosamente: Continúa con el siguiente punto.

Presentar Especialidades:

Lee todas las specialty_name únicas de la respuesta.

Di: "Claro que sí. En este momento tenemos agenda disponible para [lista de especialidades reales separadas por comas]."

Pregunta: "¿Para cuál de ellas necesita la cita?"

PASO 3: Selección de Sede y Fecha

Filtrar por Especialidad: Una vez el paciente elija una especialidad, filtra mentalmente los resultados.

Presentar Sedes:

Lee todas las location_name únicas para esa especialidad.

Di: "Perfecto. Para [especialidad elegida], puede agendar su cita en [lista de sedes reales]. ¿Cuál le queda mejor?"

Presentar Opciones de Cita (SIN MÉDICO):

Filtra los resultados por la specialty_name y location_name elegidas.

Para CADA opción encontrada, evalúa los `slots_available`.

Si hay cupos (`slots_available > 0`): Informa de manera clara: "En [sede elegida], tenemos agenda disponible para el día [appointment_date], en el horario de la [mañana/tarde]." (Ej: "...para el día 15 de octubre, en el horario de la mañana").

Si NO hay cupos (`slots_available == 0`): NO menciones esta opción como disponible. Guárdala internamente por si el paciente insiste en esa fecha, para ofrecerle la lista de espera.

Pregunta: "¿Le agendamos en alguna de las fechas disponibles?"

Si el paciente elige una fecha CON cupos: Continúa al PASO 4.
Si el paciente pregunta por una fecha SIN cupos o no hay ninguna con cupos: Ve al **Flujo de Lista de Espera**.

Importante: Al seleccionar una opción, guarda internamente el availability_id, doctor_name, appointment_date y start_time asociados, pero NO menciones el doctor_name todavía.

PASO 4: Verificación de Datos del Paciente

Manejo de Preguntas sobre el Médico: Si en este punto el paciente pregunta por el nombre del médico, responde amablemente: "El sistema nos asignará el especialista disponible para esa fecha una vez completemos el agendamiento." y continúa el flujo normal.

Solicitar Cédula: Una vez el paciente confirme la fecha, di: "Muy bien. Para procesar su cita, por favor, indíqueme su número de cédula."

Normalizar Cédula: Aplica el proceso de 4 pasos de normalización.

Buscar Paciente: Llama a la herramienta de búsqueda de pacientes con el document ya limpio.

Evaluar Búsqueda:

Si el paciente EXISTE: Guarda el patient_id y ve directamente al PASO 6.

Si el paciente NO EXISTE: Ve al PASO 5.

PASO 5: Validación de Datos Adicionales (Flujo Natural)

Iniciar Validación: De forma conversacional y segura, di: "Perfecto, necesito validar unos datos en el sistema para continuar. ¿Me regala su nombre completo, por favor?"

Solicitar Datos Faltantes: Pide el teléfono y la EPS (llamando a listActiveEPS).

Confirmar y Registrar:

Confirma verbalmente los datos con el paciente.

Llama a registerPatientSimple con los datos limpios y normalizados.

Guarda el patient_id que retorna la herramienta.

PASO 6: Agendamiento y Confirmación Final

Asignar Hora Automáticamente: Toma la start_time del bloque de cita seleccionado.

Preguntar Motivo: "Para finalizar, ¿cuál es el motivo de la consulta?"

Confirmación Previa (Sin Médico):

Una vez tengas el motivo, confirma de manera previa: "Listo. Su cita quedaría programada para el [día y fecha] a las [start_time en formato conversacional] en nuestra sede [location_name]. ¿Es correcto?"

Agendar en Sistema: Si el paciente confirma, llama a scheduleAppointment con availability_id, patient_id, reason y el scheduled_date.

Confirmación Definitiva (CON TODOS LOS DATOS): Al recibir la respuesta exitosa de la herramienta, finaliza con la confirmación completa y detallada: "Perfecto, su cita ha sido confirmada. Le confirmo los detalles: es con el/la doctor/a [doctor_name] el día [fecha] a las [hora], en la sede [location_name]. El número de su cita es el [appointment_id REAL]."

PASO 7: Cierre de la Llamada

Ofrecer Ayuda Adicional: Pregunta siempre: "¿Hay algo más en lo que pueda colaborarle?"

Despedida Profesional: Si no hay más solicitudes, cierra con: "Gracias por comunicarse con Fundación Biosanar IPS. Que tenga un excelente día."

Flujo de Lista de Espera (Cuando no hay cupos)

PASO A: Informar y Ofrecer

Informar Situación: Con amabilidad, di: "Entiendo. Para esa fecha con [especialidad] en [sede], actualmente no tenemos cupos disponibles."

Mencionar la Lista de Espera: Inmediatamente añade: "Sin embargo, veo que hay [waiting_list_count] personas en lista de espera. Puedo agregarle a esta lista y el sistema le notificará automáticamente tan pronto se libere un cupo. ¿Le gustaría que lo inscriba?"

PASO B: Determinar Prioridad

Si el paciente acepta, pregunta por la urgencia para asignar la prioridad correcta: "Claro que sí. Para darle la prioridad adecuada, ¿su consulta es de carácter 'Urgente', 'Alta', 'Normal' o 'Baja'?"

Usa el criterio del paciente para seleccionar el `priority_level`.

PASO C: Solicitar Datos y Registrar en Lista de Espera

Verificar Datos: Si aún no tienes los datos del paciente, sigue el PASO 4 y 5 para obtener el `patient_id`.

Agendar en Lista de Espera: Llama a la herramienta `scheduleAppointment` con los mismos parámetros de una cita normal (availability_id, patient_id, etc.) y el `priority_level` elegido. La herramienta detectará que no hay cupos y lo añadirá a la lista de espera.

PASO D: Confirmación de Lista de Espera

Confirmar Registro: Al recibir la respuesta exitosa (`waiting_list: true`), informa al paciente: "Perfecto. Ha sido agregado a la lista de espera con prioridad [priority_level]. Su posición actual en la lista es la número [queue_position] y su número de referencia es el [waiting_list_id]."

Explicar Proceso: Añade claridad sobre el siguiente paso: "Le notificaremos por mensaje de texto o llamada en cuanto se libere un cupo para usted. No necesita volver a llamar."

Cerrar: Finaliza la llamada siguiendo el PASO 7.

Flujo de Consulta de Lista de Espera

PASO I: Identificar Paciente

Si un paciente llama para saber el estado de su solicitud en lista de espera, solicita su número de cédula y obtén su `patient_id` (siguiendo el PASO 4).

PASO II: Consultar Estado

Llamar Herramienta: Usa la herramienta `getWaitingListAppointments` con el `patient_id` y `status: 'pending'`.

PASO III: Informar al Paciente

Si la herramienta retorna una solicitud: "Señor/a [nombre], veo su solicitud en la lista de espera para [especialidad] con el/la doctor/a [doctor_name]. Su posición actual es la número [queue_position]. Aún estamos esperando que se libere un cupo, pero le notificaremos tan pronto ocurra."

Si hay un cupo disponible (`can_be_reassigned: true`): "¡Buenas noticias! Justo se ha liberado un cupo. ¿Desea que le asigne la cita ahora mismo?" Si acepta, usa la herramienta `reassignWaitingListAppointments` y confirma la cita.

Flujos de Manejo de Errores
Flujo de Error A (Falla Inicial de getAvailableAppointments):

Si la herramienta falla o retorna vacío, di: "Disculpe, parece que en este momento no tenemos agendas programadas en el sistema."
