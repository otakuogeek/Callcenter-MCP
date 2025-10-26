# Integración CUPS en Sistema de Citas

## 📋 Resumen de Cambios

Se agregó el campo `cups_id` a las tablas de citas para relacionar cada cita/solicitud con un código CUPS (servicio médico específico).

## 🗄️ Cambios en Base de Datos

### Tablas Modificadas

#### 1. **appointments_waiting_list**
- **Campo agregado**: `cups_id` (INT UNSIGNED, NULL)
- **Posición**: Después de `availability_id`
- **Relación**: Foreign Key → `cups.id`
- **Índice**: `idx_cups_id` para optimizar JOINs
- **Comportamiento**:
  - `ON DELETE SET NULL`: Si se elimina un CUPS, el campo se pone NULL
  - `ON UPDATE CASCADE`: Si cambia el ID del CUPS, se actualiza automáticamente

#### 2. **appointments**
- **Campo agregado**: `cups_id` (INT UNSIGNED, NULL)
- **Posición**: Después de `availability_id`
- **Relación**: Foreign Key → `cups.id`
- **Índice**: `idx_cups_id` para optimizar JOINs
- **Comportamiento**: Igual que en `appointments_waiting_list`

### Archivos de Migración Creados

```
backend/migrations/
├── 20251016_add_cups_id_to_waiting_list.sql
├── 20251016_add_cups_id_to_appointments.sql
└── ejemplos_consultas_cups.sql
```

## 🔗 Relaciones de Base de Datos

```
┌─────────────────────────────────┐
│         cups                    │
├─────────────────────────────────┤
│ id (PK)                         │
│ code (UNIQUE)                   │
│ name                            │
│ category                        │
│ price                           │
│ ...                             │
└─────────────────────────────────┘
         ↑               ↑
         │               │
         │               └──────────────────────┐
         │                                      │
┌────────┴──────────────┐        ┌─────────────┴──────────────┐
│   appointments        │        │ appointments_waiting_list  │
├───────────────────────┤        ├────────────────────────────┤
│ id (PK)               │        │ id (PK)                    │
│ cups_id (FK) ────────►│        │ cups_id (FK) ──────────────►
│ patient_id            │        │ patient_id                 │
│ scheduled_date        │        │ priority_level             │
│ ...                   │        │ status                     │
└───────────────────────┘        └────────────────────────────┘
```

## 💡 Casos de Uso

### 1. Registrar una cita con servicio CUPS específico

```sql
INSERT INTO appointments (
    patient_id, 
    cups_id, 
    scheduled_date, 
    scheduled_time, 
    status
) VALUES (
    123,  -- ID del paciente
    (SELECT id FROM cups WHERE code = '881201'),  -- Ecografía abdominal
    '2025-10-20',
    '10:00:00',
    'scheduled'
);
```

### 2. Agregar solicitud a lista de espera con servicio CUPS

```sql
INSERT INTO appointments_waiting_list (
    patient_id,
    cups_id,
    priority_level,
    reason,
    status
) VALUES (
    456,  -- ID del paciente
    (SELECT id FROM cups WHERE code = '890803'),  -- Odontología
    'Alta',
    'Dolor agudo',
    'pending'
);
```

### 3. Consultar citas con información del servicio

```sql
SELECT 
    a.id,
    a.scheduled_date,
    c.code AS servicio_codigo,
    c.name AS servicio_nombre,
    c.price AS precio
FROM appointments a
LEFT JOIN cups c ON a.cups_id = c.id
WHERE a.patient_id = 123;
```

### 4. Ver lista de espera con servicios solicitados

```sql
SELECT 
    awl.id,
    awl.priority_level,
    c.code AS servicio_codigo,
    c.name AS servicio_nombre,
    c.category AS categoria
FROM appointments_waiting_list awl
LEFT JOIN cups c ON awl.cups_id = c.id
WHERE awl.status = 'pending'
ORDER BY awl.priority_level DESC;
```

## 📊 Consultas Analíticas

### Servicios más solicitados

```sql
SELECT 
    c.name,
    COUNT(*) AS total_solicitudes
FROM cups c
INNER JOIN appointments_waiting_list awl ON c.id = awl.cups_id
WHERE awl.status = 'pending'
GROUP BY c.id, c.name
ORDER BY total_solicitudes DESC
LIMIT 10;
```

### Ingresos proyectados por servicio

```sql
SELECT 
    c.name,
    c.price,
    COUNT(a.id) AS citas_confirmadas,
    (c.price * COUNT(a.id)) AS ingreso_total
FROM cups c
INNER JOIN appointments a ON c.id = a.cups_id
WHERE a.status IN ('confirmed', 'completed')
GROUP BY c.id, c.name, c.price
ORDER BY ingreso_total DESC;
```

## 🔧 Consideraciones Técnicas

### Backend (API)

#### Modificar endpoints de citas para incluir `cups_id`:

**POST /api/appointments** - Crear cita
```typescript
{
  patient_id: number,
  cups_id?: number,  // NUEVO: Opcional
  scheduled_date: string,
  scheduled_time: string,
  // ...
}
```

**POST /api/appointments/waiting-list** - Agregar a lista de espera
```typescript
{
  patient_id: number,
  cups_id?: number,  // NUEVO: Opcional
  priority_level: string,
  reason: string,
  // ...
}
```

**GET /api/appointments/:id** - Incluir información CUPS en respuesta
```typescript
{
  id: number,
  patient_id: number,
  cups_id: number,
  cups: {  // NUEVO: Información del servicio
    code: string,
    name: string,
    price: number,
    category: string
  },
  // ...
}
```

### Frontend (UI)

#### Componentes a modificar:

1. **Formulario de agendar cita**:
   - Agregar selector de servicio CUPS (dropdown/autocomplete)
   - Mostrar precio del servicio seleccionado

2. **Lista de espera**:
   - Mostrar servicio solicitado
   - Filtrar por tipo de servicio/categoría

3. **Vista de cita**:
   - Mostrar código y nombre del servicio
   - Mostrar precio del servicio

## ✅ Verificación Post-Migración

Ejecutar estas consultas para verificar que todo está correcto:

```sql
-- 1. Verificar campo en appointments_waiting_list
SHOW COLUMNS FROM appointments_waiting_list LIKE 'cups_id';

-- 2. Verificar campo en appointments
SHOW COLUMNS FROM appointments LIKE 'cups_id';

-- 3. Verificar Foreign Keys
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'biosanar'
    AND COLUMN_NAME = 'cups_id';

-- 4. Verificar índices
SHOW INDEX FROM appointments_waiting_list WHERE Column_name = 'cups_id';
SHOW INDEX FROM appointments WHERE Column_name = 'cups_id';
```

## 📝 Próximos Pasos

1. ✅ **Migración de Base de Datos** - COMPLETADO
2. ⏳ **Actualizar API Backend**:
   - Modificar `POST /api/appointments`
   - Modificar `POST /api/appointments/waiting-list`
   - Modificar `GET /api/appointments/:id` para incluir JOIN con `cups`
   - Modificar `GET /api/appointments/waiting-list` para incluir JOIN con `cups`

3. ⏳ **Actualizar Frontend**:
   - Agregar selector de CUPS en formularios
   - Mostrar información del servicio en vistas de cita
   - Agregar filtros por servicio/categoría

4. ⏳ **Testing**:
   - Probar creación de citas con `cups_id`
   - Verificar integridad referencial
   - Probar consultas con JOINs

## 🔒 Seguridad y Validaciones

- ✅ El campo es **nullable** (NULL) para mantener compatibilidad con datos existentes
- ✅ **Foreign Key** garantiza que solo se puedan asignar IDs válidos de la tabla `cups`
- ✅ **ON DELETE SET NULL** evita errores si se elimina un código CUPS
- ✅ **Índice** en `cups_id` mejora performance de consultas con JOIN

## 📚 Archivos de Referencia

- `/backend/migrations/20251016_add_cups_id_to_waiting_list.sql`
- `/backend/migrations/20251016_add_cups_id_to_appointments.sql`
- `/backend/migrations/ejemplos_consultas_cups.sql`
- Este documento: `/docs/INTEGRACION_CUPS_CITAS.md`
