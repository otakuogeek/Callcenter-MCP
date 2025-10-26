# 🔧 Corrección Error 500 al Crear Agendas

**Fecha:** 14 de octubre de 2025  
**Problema:** Error 500 al intentar crear agendas desde el frontend
**Estado:** ✅ RESUELTO

---

## 🐛 Errores Encontrados y Corregidos

### Error 1: Sintaxis SQL con texto extraño "pudes"
**Ubicación:** `/backend/src/routes/appointments.ts` línea 849  
**Causa:** Texto accidental "pudes" insertado en query SQL  
**Síntoma:** Error de sintaxis SQL en endpoint daily-queue

**Antes:**
```typescript
wl.patient_id,pudes 
wl.scheduled_date AS scheduled_at,
```

**Después:**
```typescript
wl.patient_id,
wl.scheduled_date AS scheduled_at,
```

**Estado:** ✅ Corregido

---

### Error 2: Mapeo incorrecto de valores de status (Inglés vs Español)
**Ubicación:** `/backend/src/routes/availabilities.ts` línea 94-124  
**Causa:** Frontend envía status en inglés (`'active'`), pero BD espera valores en español (`'Activa'`)  
**Síntoma:** Error SQL "Data truncated for column 'status' at row 1"

**Estructura de BD:**
```sql
status ENUM('Activa','Cancelada','Completa') NOT NULL DEFAULT 'Activa'
```

**Schema de Validación (Zod):**
```typescript
status: z.enum(['active','cancelled','completed']).default('active')
```

**Solución Implementada:**
```typescript
// Mapear status de inglés a español para compatibilidad con BD
const statusMap: Record<string, string> = {
  'active': 'Activa',
  'cancelled': 'Cancelada',
  'completed': 'Completa'
};
const dbStatus = statusMap[d.status] || 'Activa';

// Usar dbStatus en la inserción
await pool.query(
  `INSERT INTO availabilities (..., status, ...)
   VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  [..., dbStatus, ...]
);
```

**Estado:** ✅ Corregido

---

### Mejora Adicional: Logging de Errores
**Ubicación:** `/backend/src/routes/availabilities.ts` línea 181-188  
**Mejora:** Agregado logging detallado de errores para facilitar debugging

**Antes:**
```typescript
} catch (e: any) {
  return res.status(500).json({ message: 'Server error' });
}
```

**Después:**
```typescript
} catch (e: any) {
  console.error('[CREATE-AVAILABILITY] Error:', e);
  return res.status(500).json({ 
    message: 'Server error', 
    error: e?.message || 'Unknown error',
    details: e?.sqlMessage || e?.toString()
  });
}
```

**Estado:** ✅ Implementado

---

## 🧪 Pruebas Realizadas

### Prueba 1: Crear Agenda con Status Correcto ✅
```bash
curl -X POST https://biosanarcall.site/api/availabilities \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [TOKEN]" \
  -d '{
    "location_id": 1,
    "specialty_id": 1,
    "doctor_id": 4,
    "date": "2025-10-16",
    "start_time": "08:00:00",
    "end_time": "12:00:00",
    "capacity": 10,
    "status": "active"
  }'
```

**Resultado:**
```json
{
  "success": true,
  "id": 161,
  "location_id": 1,
  "specialty_id": 1,
  "doctor_id": 4,
  "date": "2025-10-16",
  "start_time": "08:00:00",
  "end_time": "12:00:00",
  "capacity": 10,
  "status": "active",
  "exclude_weekends": true,
  "preallocation": null,
  "distribution": {
    "availability_id": 161,
    "start_date": "2025-10-16",
    "end_date": "2025-10-16",
    "working_days": 1,
    "distribution": [{"date": "2025-10-16", "quota": 10}],
    "stats": {
      "total_quota": 10,
      "average_per_day": 10,
      "max_quota": 10,
      "min_quota": 10
    },
    "persisted": true,
    "persisted_rows": 1
  }
}
```

**Estado:** ✅ EXITOSO

---

## 📋 Validaciones de Negocio

El endpoint de creación de agendas incluye las siguientes validaciones:

### 1. Validación de Fines de Semana ⛔
```typescript
const appointmentDate = new Date(d.date + 'T12:00:00');
const dayOfWeek = appointmentDate.getDay();

if (dayOfWeek === 0 || dayOfWeek === 6) {
  return res.status(400).json({ 
    message: 'No se pueden crear disponibilidades en fines de semana',
    error: 'weekend_not_allowed'
  });
}
```

### 2. Validación de Datos con Zod
```typescript
const schema = z.object({
  location_id: z.number().int(),
  specialty_id: z.number().int(),
  doctor_id: z.number().int(),
  date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  capacity: z.number().int().min(1).default(1),
  status: z.enum(['active','cancelled','completed']).default('active'),
  notes: z.string().optional().nullable(),
  auto_preallocate: z.boolean().optional(),
  preallocation_publish_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).optional(),
  auto_distribute: z.boolean().optional(),
  distribution_start_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).optional(),
  distribution_end_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).optional(),
  exclude_weekends: z.boolean().optional().default(true)
});
```

### 3. Validación de Foreign Keys (BD)
- `location_id` debe existir en tabla `locations`
- `specialty_id` debe existir en tabla `specialties`
- `doctor_id` debe existir en tabla `doctors`

---

## 🗄️ Estructura de Datos

### Tabla: `availabilities`
```sql
CREATE TABLE availabilities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  location_id BIGINT UNSIGNED NOT NULL,
  specialty_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INT NOT NULL DEFAULT 1,
  booked_slots INT NOT NULL DEFAULT 0,
  status ENUM('Activa','Cancelada','Completa') NOT NULL DEFAULT 'Activa',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (location_id) REFERENCES locations(id),
  FOREIGN KEY (specialty_id) REFERENCES specialties(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);
```

### Mapeo de Valores Status
| Frontend (Inglés) | Backend (Español) | Significado |
|------------------|-------------------|-------------|
| `active`         | `Activa`          | Agenda activa y disponible |
| `cancelled`      | `Cancelada`       | Agenda cancelada |
| `completed`      | `Completa`        | Agenda completada |

---

## 🔄 Flujo de Distribución Automática

Cuando se crea una agenda, el sistema automáticamente:

1. **Sin `auto_distribute`:** Asigna toda la capacidad al día de la cita
   - `distribution_start_date` = fecha de la cita
   - `distribution_end_date` = fecha de la cita
   - `total_quota` = capacidad completa

2. **Con `auto_distribute`:** Distribuye cupos en rango de fechas
   - Distribuye entre `distribution_start_date` y `distribution_end_date`
   - Excluye fines de semana si `exclude_weekends = true`
   - Genera distribución aleatoria equilibrada

---

## 📝 Archivos Modificados

1. **`/backend/src/routes/appointments.ts`**
   - Corregido error de sintaxis "pudes" en línea 849
   
2. **`/backend/src/routes/availabilities.ts`**
   - Agregado mapeo de status inglés → español
   - Mejorado logging de errores en catch block

---

## ✅ Checklist de Verificación

- [x] Error de sintaxis SQL corregido
- [x] Mapeo de status implementado
- [x] Logging de errores mejorado
- [x] Backend compilado sin errores
- [x] PM2 reiniciado exitosamente
- [x] Prueba manual de creación de agenda exitosa
- [x] Distribución automática funcionando
- [x] Validaciones de negocio activas

---

## 🚀 Próximos Pasos

### Para el Frontend:
1. **Verificar Datos de Formulario:**
   - Asegurar que `doctor_id` sea válido (verificar contra `/api/doctors`)
   - Asegurar que `location_id` sea válido (verificar contra `/api/locations`)
   - Asegurar que `specialty_id` sea válido (verificar contra `/api/specialties`)

2. **Manejo de Errores:**
   - Mostrar mensaje amigable si doctor/location/specialty no existe
   - Validar fines de semana antes de enviar al backend

3. **Validar Fecha:**
   - No permitir seleccionar sábados ni domingos
   - Usar un date picker que deshabilite fines de semana

### Ejemplo de Código Frontend:
```typescript
const handleCreateAvailability = async (data: FormData) => {
  try {
    const response = await fetch('/api/availabilities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...data,
        status: 'active' // Enviar en inglés, backend lo mapea
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      
      // Manejar errores específicos
      if (error.error?.includes('weekend_not_allowed')) {
        toast.error('No se pueden crear agendas en fines de semana');
      } else if (error.error?.includes('foreign key constraint')) {
        toast.error('Doctor, sede o especialidad no válidos');
      } else {
        toast.error(error.message || 'Error al crear agenda');
      }
      
      return;
    }
    
    const result = await response.json();
    toast.success(`Agenda creada exitosamente (ID: ${result.id})`);
    
  } catch (err) {
    toast.error('Error de conexión');
  }
};
```

---

## 📊 IDs Válidos en BD (Octubre 2025)

### Doctores Activos:
```
ID  | Nombre
----|------------------------------------
4   | Oscar Calderon
5   | Dra. Yesika Andrea fiallo
6   | Ana Teresa Escobar
7   | Dra. Valentina Abaunza Ballesteros
8   | Dr. Carlos Rafael Almira
```

### Locations (Consultar con GET /api/locations)
### Specialties (Consultar con GET /api/specialties)

---

**Autor:** GitHub Copilot  
**Fecha:** 14 de octubre de 2025  
**Versión:** 1.0.0  
**Estado:** ✅ Completado
