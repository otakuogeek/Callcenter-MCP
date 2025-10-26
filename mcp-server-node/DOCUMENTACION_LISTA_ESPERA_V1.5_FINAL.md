# Documentación Final: Sistema de Lista de Espera v1.5

## Fecha: 2025-10-13 23:35 UTC

## RESUMEN EJECUTIVO

Se realizó una actualización completa del sistema `addToWaitingList` para permitir agregar pacientes a lista de espera proporcionando **specialty_id** en lugar de requerir `availability_id`, ya que lista de espera implica que NO hay disponibilidad.

---

## CAMBIOS REALIZADOS

### 1. Schema de la Herramienta

#### ANTES (v1.4):
```typescript
required: ['patient_id', 'availability_id', 'reason']
```
- Se requería `availability_id` lo cual no tiene sentido para lista de espera
- El usuario debía buscar una disponibilidad específica antes de agregar a espera

#### DESPUÉS (v1.5):
```typescript
required: ['patient_id', 'specialty_id', 'reason']
properties: {
  specialty_id: {
    type: 'number',
    description: 'ID de la especialidad solicitada. Ejemplos: 1=Medicina General, 3=Cardiología, 5=Odontología, 7=Psicología'
  },
  availability_id: {
    type: 'number',
    description: 'ID de disponibilidad específica (OPCIONAL)'
  }
}
```
- Ahora se requiere `specialty_id` (lógico para lista de espera)
- `availability_id` es OPCIONAL
- El sistema busca automáticamente una disponibilidad o crea una genérica

### 2. Lógica de la Función

#### Flujo de Trabajo:

```
1. Validar patient_id, specialty_id, reason (obligatorios)
2. Validar que el paciente existe y está activo
3. Validar que la especialidad existe y está activa
4. Determinar availability_id:
   a) Si se proporcionó availability_id: validarlo y usarlo
   b) Si NO se proporcionó:
      - Buscar una availability existente de la especialidad
      - Si no hay ninguna: crear availability genérica automáticamente
5. Verificar que el paciente no esté ya en lista de espera para esa especialidad
6. Insertar en appointments_waiting_list
7. Calcular posición en cola
8. Retornar respuesta con available_specialties
```

### 3. Creación Automática de Availability Genérica

Cuando no existe ninguna disponibilidad para una especialidad, el sistema:

1. Obtiene un doctor activo (cualquiera)
2. Obtiene una location activa (cualquiera)
3. Crea una availability genérica:
   - Fecha: 30 días en el futuro
   - Hora: 08:00 - 08:30
   - Estado: 'Cerrado'
   - Nota: 'Availability genérica para lista de espera'
   - max_patients: 0
   - booked_patients: 0

---

## ESTRUCTURA DE LA BASE DE DATOS

### Tabla: `appointments_waiting_list`

```sql
CREATE TABLE appointments_waiting_list (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  availability_id BIGINT UNSIGNED NULL,  -- ✅ Puede ser NULL
  scheduled_date DATETIME NULL,          -- ✅ Puede ser NULL
  appointment_type ENUM('Presencial','Telemedicina') DEFAULT 'Presencial',
  reason TEXT NOT NULL,
  notes TEXT NULL,
  priority_level ENUM('Baja','Normal','Alta','Urgente') DEFAULT 'Normal',
  status ENUM('pending','reassigned','cancelled','expired') DEFAULT 'pending',
  requested_by VARCHAR(100) NULL,
  call_type ENUM('normal','reagendar') DEFAULT 'normal',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**NOTA CRÍTICA**: La tabla NO tiene columna `specialty_id` directamente. La especialidad se obtiene a través de `availabilities.specialty_id`.

---

## EJEMPLO DE USO

### Solicitud MCP:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "addToWaitingList",
    "arguments": {
      "patient_id": 1057,
      "specialty_id": 3,
      "reason": "Solicitud de cita de Cardiología"
    }
  }
}
```

### Respuesta Exitosa:

```json
{
  "success": true,
  "message": "Paciente agregado exitosamente a la lista de espera",
  "waiting_list_id": 123,
  "status": "pending",
  "queue_info": {
    "position": 5,
    "total_waiting_specialty": 12,
    "priority_level": "Normal"
  },
  "patient": {
    "id": 1057,
    "name": "Juan Pérez",
    "document": "12345678",
    "phone": "3001234567",
    "eps": {
      "id": 1,
      "name": "Nueva EPS",
      "code": "NEPS001"
    }
  },
  "requested_for": {
    "specialty": {
      "id": 3,
      "name": "Cardiología"
    },
    "availability_reference": {
      "id": 456,
      "location": "Sede Principal",
      "doctor": "Dr. García"
    }
  },
  "available_specialties": [
    {"id": 1, "name": "Medicina General", "description": "Atención primaria", "duration_minutes": 15},
    {"id": 3, "name": "Cardiología", "description": "Corazón", "duration_minutes": 15},
    {"id": 5, "name": "Odontología", "description": "Odontología", "duration_minutes": 20},
    ...
  ],
  "info": "Ha sido agregado a la lista de espera para Cardiología con prioridad Normal. Está en la posición 5 de 12 personas esperando."
}
```

---

## LISTADO COMPLETO DE ESPECIALIDADES

El sistema retorna **available_specialties** en cada respuesta con el listado COMPLETO de especialidades disponibles:

1. Medicina General (ID: 1)
2. Cardiología (ID: 3)
3. Odontología (ID: 5)
4. Ecografías (ID: 6)
5. Psicología (ID: 7)
6. Pediatría (ID: 8)
7. Medicina interna (ID: 9)
8. Dermatología (ID: 10)
9. Nutrición (ID: 11)
10. Ginecología (ID: 12)
11. Medicina familiar (ID: 13)
12. Ecografías2 (ID: 14)

**IMPORTANTE**: Se puede agregar a lista de espera en **cualquier especialidad**, incluso si no está autorizada por la EPS del paciente.

---

## CASOS DE PRUEBA

### Caso 1: Especialidad sin availabilities

```bash
Solicitud: patient_id=1057, specialty_id=3 (Cardiología), reason="Control cardiaco"
Sistema: 
  - No hay availabilities para Cardiología
  - Crea availability genérica automáticamente
  - Agrega paciente a lista de espera
  - Retorna éxito con available_specialties
```

### Caso 2: Especialidad con availabilities existentes

```bash
Solicitud: patient_id=1057, specialty_id=1 (Medicina General), reason="Consulta general"
Sistema:
  - Encuentra availabilities existentes
  - Usa la más reciente
  - Agrega paciente a lista de espera
  - Retorna éxito con available_specialties
```

### Caso 3: Con availability_id específico

```bash
Solicitud: patient_id=1057, specialty_id=1, availability_id=123, reason="Consulta"
Sistema:
  - Valida que availability_id corresponda a specialty_id
  - Si no corresponde: error
  - Si corresponde: usa ese availability_id
  - Agrega paciente a lista de espera
```

---

## PROBLEMAS ENCONTRADOS Y SOLUCIONADOS

### 1. Campo `status` vs `active` en `doctors`
**Error**: `Unknown column 'status' in 'WHERE'`
**Solución**: La tabla `doctors` usa `active` (tinyint) no `status`
**Fix**: `WHERE active = 1`

### 2. Campo `active` vs `status` en `locations`
**Error**: `Unknown column 'active' in 'WHERE'`
**Solución**: La tabla `locations` usa `status` (enum) no `active`
**Fix**: `WHERE status = 'Activa'`

### 3. Tabla `appointments_waiting_list` no tiene `specialty_id`
**Problema**: Intentamos insertar specialty_id directamente
**Solución**: La especialidad se obtiene a través de availabilities.specialty_id
**Fix**: Solo insertar availability_id (que puede ser NULL)

---

## DEPLOYMENT STATUS

✅ **Código Modificado**: `/home/ubuntu/app/mcp-server-node/src/server-unified.ts`
✅ **Compilado**: `npm run build` exitoso
✅ **Servidor Reiniciado**: PM2 restart #17
✅ **Puerto**: 8977
✅ **Endpoint**: `/mcp-unified`
✅ **Health Check**: ✅ 16 tools disponibles

---

## PRÓXIMOS PASOS

1. **Pruebas Funcionales**: Ejecutar tests completos con specialty_id
2. **Validación de Casos Edge**: Paciente duplicado, especialidad inválida, etc.
3. **Documentación de Operadoras**: Guía para manejar lista de espera
4. **Monitoreo**: Tracking de especialidades más solicitadas
5. **Optimización**: Considerar agregar specialty_id directo a appointments_waiting_list

---

## VERSIÓN

- **v1.4**: scheduled_date opcional
- **v1.5**: specialty_id obligatorio, availability_id opcional, listado de especialidades incluido
- **Fecha**: 2025-10-13
- **Autor**: GitHub Copilot Agent

---

## CONCLUSIÓN

El sistema ahora permite agregar pacientes a lista de espera de forma más lógica e intuitiva:

- ✅ Solo necesitas: **paciente, especialidad, motivo**
- ✅ NO necesitas buscar availability_id manualmente
- ✅ El sistema encuentra o crea la availability automáticamente
- ✅ Siempre retorna el listado completo de especialidades disponibles
- ✅ Permite agendar en cualquier especialidad (incluso no autorizadas por EPS)

**Lista de espera ahora significa verdaderamente: "NO hay cupo, solo necesito la especialidad"**
