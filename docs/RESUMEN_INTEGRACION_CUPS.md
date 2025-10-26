# ✅ RESUMEN: Integración CUPS en Sistema de Citas

## 🎯 Objetivo Completado

Se agregó exitosamente el campo `cups_id` a las tablas `appointments` y `appointments_waiting_list` para relacionar cada cita/solicitud con un código CUPS (servicio médico).

---

## 📊 Cambios Aplicados

### 1. Base de Datos

#### Tabla: `appointments`
```sql
✅ Campo agregado: cups_id (INT UNSIGNED, NULL)
✅ Índice creado: idx_cups_id
✅ Foreign Key: fk_appointments_cups → cups(id)
   - ON DELETE SET NULL
   - ON UPDATE CASCADE
```

#### Tabla: `appointments_waiting_list`
```sql
✅ Campo agregado: cups_id (INT UNSIGNED, NULL)
✅ Índice creado: idx_cups_id
✅ Foreign Key: fk_waiting_list_cups → cups(id)
   - ON DELETE SET NULL
   - ON UPDATE CASCADE
```

---

## 🧪 Prueba de Funcionamiento

### Actualización de Datos
```sql
UPDATE appointments 
SET cups_id = (SELECT id FROM cups WHERE code = '881201')
WHERE id = 135;
```

### Consulta con JOIN
```sql
SELECT 
    a.id AS cita_id,
    DATE(a.scheduled_at) AS fecha,
    a.status,
    c.code AS cups_code,
    c.name AS cups_name,
    c.price AS precio
FROM appointments a
LEFT JOIN cups c ON a.cups_id = c.id
WHERE a.id = 135;
```

### Resultado Exitoso ✅
```
+---------+------------+------------+-----------+--------------------------------------------------+----------+
| cita_id | fecha      | status     | cups_code | cups_name                                        | precio   |
+---------+------------+------------+-----------+--------------------------------------------------+----------+
|     135 | 2025-10-20 | Confirmada | 881201    | ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS | $128,030 |
+---------+------------+------------+-----------+--------------------------------------------------+----------+
```

---

## 📁 Archivos Creados

### Migraciones SQL
1. **`/backend/migrations/20251016_add_cups_id_to_waiting_list.sql`**
   - Agrega campo `cups_id` a `appointments_waiting_list`
   - Crea índice y Foreign Key

2. **`/backend/migrations/20251016_add_cups_id_to_appointments.sql`**
   - Agrega campo `cups_id` a `appointments`
   - Crea índice y Foreign Key

3. **`/backend/migrations/ejemplos_consultas_cups.sql`**
   - 8 consultas de ejemplo para usar las relaciones CUPS
   - Incluye:
     - Lista de espera con servicios
     - Citas con servicios
     - Estadísticas de demanda
     - Ingresos proyectados
     - Verificación de integridad

### Documentación
4. **`/docs/INTEGRACION_CUPS_CITAS.md`**
   - Guía completa de uso
   - Casos de uso con ejemplos
   - Consideraciones técnicas para Backend/Frontend
   - Próximos pasos de implementación

---

## 🔍 Verificación de Integridad

### Estado Actual de Datos
```
+---------------------------+-----------------+-------------+-------------+
| tabla                     | total_registros | con_cups_id | sin_cups_id |
+---------------------------+-----------------+-------------+-------------+
| appointments_waiting_list |              97 |           0 |          97 |
| appointments              |              26 |           1 |          25 |
+---------------------------+-----------------+-------------+-------------+
```

### Relaciones Activas
```sql
SELECT * FROM information_schema.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'biosanar' AND COLUMN_NAME = 'cups_id';
```

**Resultado:**
- ✅ `fk_appointments_cups` → appointments.cups_id → cups.id
- ✅ `fk_waiting_list_cups` → appointments_waiting_list.cups_id → cups.id
- ℹ️ También existe: `fk_cups_services_cups` (tabla pre-existente)

---

## 📋 Próximos Pasos Recomendados

### Backend (API)

1. **Modificar endpoint**: `POST /api/appointments`
   ```typescript
   // Agregar cups_id al body
   interface CreateAppointmentRequest {
     patient_id: number;
     cups_id?: number;  // NUEVO
     availability_id: number;
     scheduled_at: string;
     // ...
   }
   ```

2. **Modificar endpoint**: `POST /api/appointments/waiting-list`
   ```typescript
   // Agregar cups_id al body
   interface CreateWaitingListRequest {
     patient_id: number;
     cups_id?: number;  // NUEVO
     priority_level: string;
     reason: string;
     // ...
   }
   ```

3. **Modificar endpoint**: `GET /api/appointments` y `GET /api/appointments/:id`
   ```sql
   -- Incluir JOIN en las consultas
   SELECT 
     a.*,
     c.code AS cups_code,
     c.name AS cups_name,
     c.price AS cups_price,
     c.category AS cups_category
   FROM appointments a
   LEFT JOIN cups c ON a.cups_id = c.id
   ```

4. **Modificar endpoint**: `GET /api/appointments/waiting-list`
   ```sql
   -- Incluir JOIN en las consultas
   SELECT 
     awl.*,
     c.code AS cups_code,
     c.name AS cups_name,
     c.price AS cups_price
   FROM appointments_waiting_list awl
   LEFT JOIN cups c ON awl.cups_id = c.id
   ```

### Frontend (UI)

1. **Formulario de Agendar Cita** (`AppointmentForm.tsx`)
   - Agregar campo selector de servicio CUPS
   - Implementar autocomplete por código o nombre
   - Mostrar precio al seleccionar servicio

2. **Lista de Espera** (`WaitingListManagement.tsx`)
   - Mostrar columna "Servicio Solicitado"
   - Agregar filtro por categoría de servicio
   - Mostrar precio estimado

3. **Vista de Cita** (`AppointmentDetails.tsx`)
   - Mostrar badge con código CUPS
   - Mostrar nombre completo del servicio
   - Mostrar precio del servicio

4. **Reportes y Analytics**
   - Dashboard de servicios más solicitados
   - Gráficos de demanda por categoría CUPS
   - Proyección de ingresos por servicio

---

## 🎓 Consultas Útiles

### 1. Listar servicios CUPS disponibles
```sql
SELECT id, code, name, category, price 
FROM cups 
WHERE status = 'Activo'
ORDER BY category, name;
```

### 2. Servicios más solicitados en lista de espera
```sql
SELECT 
    c.name,
    COUNT(awl.id) AS solicitudes
FROM cups c
INNER JOIN appointments_waiting_list awl ON c.id = awl.cups_id
WHERE awl.status = 'pending'
GROUP BY c.id, c.name
ORDER BY solicitudes DESC
LIMIT 10;
```

### 3. Ingresos confirmados por servicio
```sql
SELECT 
    c.name,
    COUNT(a.id) AS citas,
    c.price,
    (c.price * COUNT(a.id)) AS ingreso_total
FROM cups c
INNER JOIN appointments a ON c.id = a.cups_id
WHERE a.status = 'Confirmada'
GROUP BY c.id, c.name, c.price
ORDER BY ingreso_total DESC;
```

---

## ✨ Beneficios de la Integración

1. **📊 Trazabilidad**: Cada cita tiene asociado el servicio médico específico
2. **💰 Gestión Financiera**: Cálculo automático de ingresos por servicio
3. **📈 Analytics**: Estadísticas de demanda por tipo de servicio
4. **🎯 Priorización**: Identificar servicios con mayor demanda en lista de espera
5. **🔍 Reportes**: Generar reportes detallados por código CUPS
6. **⚕️ Cumplimiento**: Alineación con estándares de clasificación de servicios médicos

---

## 📞 Contacto y Soporte

Para dudas o consultas sobre esta implementación:
- **Archivo**: `/docs/INTEGRACION_CUPS_CITAS.md` (documentación completa)
- **Consultas SQL**: `/backend/migrations/ejemplos_consultas_cups.sql`
- **Credenciales DB**: `/backend/.env`

---

**Fecha de implementación**: 16 de Octubre, 2025  
**Estado**: ✅ COMPLETADO Y VERIFICADO
