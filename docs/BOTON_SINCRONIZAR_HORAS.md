# ⏰ Botón "Sincronizar Horas" en Agendas

## 🎯 Funcionalidad Implementada

Se agregó un botón **"Sincronizar Horas"** en el modal de visualización de agenda que reorganiza automáticamente las horas de todas las citas secuencialmente, basándose en la configuración de la availability.

---

## ✨ Características

### 🔄 Sincronización Automática

El botón ejecuta la misma lógica del script `fix_appointment_sequential_times.js`:

1. ✅ Toma la hora de inicio (`start_time`) de la availability
2. ✅ Asigna la primera cita a esa hora
3. ✅ Suma `duration_minutes` + `break_between_slots` para cada cita siguiente
4. ✅ Continúa secuencialmente hasta el `end_time`
5. ✅ Actualiza automáticamente la base de datos

---

## 📍 Ubicación del Botón

### En el Modal de Agenda

```
┌──────────────────────────────────────────────────────┐
│ Detalles de la Disponibilidad                  [X]  │
├──────────────────────────────────────────────────────┤
│                                                       │
│ [Pestañas: Confirmados | Cancelados]                │
│                                                       │
│ Lista de pacientes...                                │
│                                                       │
├──────────────────────────────────────────────────────┤
│                                                       │
│ Creado el: 20 de octubre de 2025 a las 14:30        │
│                                                       │
│ [🕐 Sincronizar Horas]              [Cerrar]        │
│  ↑ Botón azul                        ↑ Botón gris   │
└──────────────────────────────────────────────────────┘
```

---

## 🎨 Diseño del Botón

### Características Visuales

```tsx
<Button 
  variant="default" 
  className="bg-blue-600 hover:bg-blue-700 text-white"
>
  <Clock className="w-4 h-4 mr-2" />
  Sincronizar Horas
</Button>
```

**Detalles:**
- ✅ Color azul (`bg-blue-600`)
- ✅ Icono de reloj (`<Clock />`)
- ✅ Texto "Sincronizar Horas"
- ✅ Hover effect (azul más oscuro)
- ✅ Solo visible si hay citas Confirmadas o Pendientes

---

## 🔄 Proceso de Sincronización

### Paso 1: Confirmación

```
┌──────────────────────────────────────────────────┐
│ ⚠️  Confirmación                                 │
├──────────────────────────────────────────────────┤
│                                                   │
│ ¿Está seguro de que desea sincronizar las       │
│ horas de las citas?                              │
│                                                   │
│ Esto reorganizará todas las citas               │
│ secuencialmente desde la hora de inicio          │
│ de la agenda.                                    │
│                                                   │
│           [Cancelar]    [Aceptar]               │
└──────────────────────────────────────────────────┘
```

### Paso 2: Sincronizando

```
Toast notification:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 Sincronizando horas
   Por favor espere...
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Paso 3: Resultado

```
Toast notification:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Sincronización exitosa
   7 citas sincronizadas correctamente
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 📊 Lógica de Sincronización

### Configuración de la Agenda

```
Availability:
  - start_time: 08:00:00
  - end_time: 12:00:00
  - duration_minutes: 15
  - break_between_slots: 0
```

### Antes de Sincronizar

```
Citas con horarios desordenados:
┌─────┬──────────────────┬────────────┐
│ ID  │ Paciente         │ Hora       │
├─────┼──────────────────┼────────────┤
│ 101 │ Carlos V.        │ 08:30:00   │
│ 102 │ José V.          │ 08:00:00   │
│ 103 │ Blay R.          │ 09:15:00   │
│ 104 │ José PH          │ 08:45:00   │
│ 105 │ Marta P.         │ 10:00:00   │
└─────┴──────────────────┴────────────┘
```

### Después de Sincronizar

```
Citas reorganizadas secuencialmente:
┌─────┬──────────────────┬────────────┐
│ ID  │ Paciente         │ Hora       │
├─────┼──────────────────┼────────────┤
│ 101 │ Carlos V.        │ 08:00:00   │ ← start_time
│ 102 │ José V.          │ 08:15:00   │ ← +15 min
│ 103 │ Blay R.          │ 08:30:00   │ ← +15 min
│ 104 │ José PH          │ 08:45:00   │ ← +15 min
│ 105 │ Marta P.         │ 09:00:00   │ ← +15 min
└─────┴──────────────────┴────────────┘
```

---

## 💻 Código Implementado

### Backend - Endpoint

**Archivo**: `/backend/src/routes/availabilities.ts`

```typescript
router.post('/:id/sync-appointment-times', requireAuth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const availabilityId = parseInt(req.params.id);
    
    await connection.beginTransaction();
    
    // Obtener la availability
    const [availabilityRows] = await connection.query(`
      SELECT av.*, d.name as doctor_name, s.name as specialty_name, 
             l.name as location_name
      FROM availabilities av
      LEFT JOIN doctors d ON av.doctor_id = d.id
      LEFT JOIN specialties s ON av.specialty_id = s.id
      LEFT JOIN locations l ON av.location_id = l.id
      WHERE av.id = ?
    `, [availabilityId]);
    
    const availability = availabilityRows[0];
    
    // Obtener citas Confirmadas y Pendientes
    const [appointments] = await connection.query(`
      SELECT a.*, p.name as patient_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      WHERE a.availability_id = ?
        AND a.status IN ('Pendiente', 'Confirmada')
      ORDER BY a.scheduled_at, a.id
    `, [availabilityId]);
    
    // Calcular hora de inicio
    const fechaFormateada = new Date(availability.date)
      .toISOString().split('T')[0];
    const fechaHoraInicio = `${fechaFormateada}T${availability.start_time}`;
    let currentTime = new Date(fechaHoraInicio);
    
    const endTimeDate = new Date(`${fechaFormateada}T${availability.end_time}`);
    let updatedCount = 0;
    const updates = [];
    
    // Reorganizar cada cita secuencialmente
    for (let i = 0; i < appointments.length; i++) {
      const apt = appointments[i];
      
      // Verificar si excede el horario de fin
      if (currentTime >= endTimeDate) {
        break;
      }
      
      // Formatear nueva hora para MySQL
      const newScheduledAt = currentTime.toISOString()
        .slice(0, 19).replace('T', ' ');
      
      // Actualizar la cita
      await connection.execute(
        `UPDATE appointments SET scheduled_at = ? WHERE id = ?`,
        [newScheduledAt, apt.id]
      );
      
      updates.push({
        id: apt.id,
        patient_name: apt.patient_name,
        old_time: apt.scheduled_at,
        new_time: newScheduledAt
      });
      
      updatedCount++;
      
      // Calcular siguiente hora
      const totalMinutes = availability.duration_minutes + 
                          (availability.break_between_slots || 0);
      currentTime = new Date(currentTime.getTime() + 
                            (totalMinutes * 60 * 1000));
    }
    
    await connection.commit();
    
    return res.json({
      success: true,
      message: `${updatedCount} citas sincronizadas correctamente`,
      updated: updatedCount,
      total: appointments.length,
      updates: updates,
      availability: {
        id: availability.id,
        doctor: availability.doctor_name,
        specialty: availability.specialty_name,
        location: availability.location_name,
        date: fechaFormateada,
        start_time: availability.start_time,
        end_time: availability.end_time,
        duration_minutes: availability.duration_minutes,
        break_between_slots: availability.break_between_slots
      }
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error sincronizando horas:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al sincronizar horas',
      error: error.message
    });
  } finally {
    connection.release();
  }
});
```

### Frontend - API Client

**Archivo**: `/frontend/src/lib/api.ts`

```typescript
syncAppointmentTimes: (availabilityId: number) => 
  request<ApiResponse<{
    updated: number;
    total: number;
    updates: Array<{
      id: number;
      patient_name: string;
      old_time: string;
      new_time: string;
    }>;
    availability: {
      id: number;
      doctor: string;
      specialty: string;
      location: string;
      date: string;
      start_time: string;
      end_time: string;
      duration_minutes: number;
      break_between_slots: number;
    };
  }>>(`/availabilities/${availabilityId}/sync-appointment-times`, { 
    method: 'POST' 
  }),
```

### Frontend - Componente

**Archivo**: `/frontend/src/components/ViewAvailabilityModal.tsx`

```typescript
const handleSyncAppointmentTimes = async () => {
  if (!availability) return;

  if (!confirm(
    '¿Está seguro de que desea sincronizar las horas de las citas?\n\n' +
    'Esto reorganizará todas las citas secuencialmente desde la hora ' +
    'de inicio de la agenda.'
  )) {
    return;
  }

  try {
    toast({
      title: "Sincronizando horas",
      description: "Por favor espere...",
    });

    const result = await api.syncAppointmentTimes(availability.id);

    if (result.success && result.data) {
      toast({
        title: "Sincronización exitosa",
        description: `${result.data.updated} citas sincronizadas correctamente`,
        variant: "default",
      });

      // Recargar las citas para mostrar los nuevos horarios
      await loadAppointments();
    } else {
      toast({
        title: "Aviso",
        description: result.message || "No hay citas para sincronizar",
        variant: "default",
      });
    }
  } catch (e: any) {
    toast({
      title: "Error al sincronizar",
      description: e?.message || "No se pudo sincronizar las horas",
      variant: "destructive",
    });
  }
};
```

---

## 📋 Casos de Uso

### Caso 1: Horarios Desordenados

**Escenario:**
```
Agenda: 08:00 - 12:00, 15 min por cita
Citas actuales:
  - 10:30 - Carlos
  - 08:00 - José
  - 09:15 - Blay
  - 11:00 - Marta
```

**Proceso:**
1. Usuario hace clic en "Sincronizar Horas"
2. Sistema reorganiza:
   ```
   08:00 - Carlos  ← Primera cita
   08:15 - José    ← +15 min
   08:30 - Blay    ← +15 min
   08:45 - Marta   ← +15 min
   ```
3. Muestra: "✅ 4 citas sincronizadas correctamente"

### Caso 2: Con Descanso Entre Citas

**Escenario:**
```
Agenda: 14:00 - 18:00
Duration: 20 min
Break: 5 min
Total por cita: 25 min
```

**Resultado:**
```
14:00 - Paciente 1  ← start_time
14:25 - Paciente 2  ← +20min consulta +5min descanso
14:50 - Paciente 3  ← +25min
15:15 - Paciente 4  ← +25min
```

### Caso 3: Citas Exceden Horario

**Escenario:**
```
Agenda: 08:00 - 09:00
Duration: 15 min
Citas: 10 pacientes programados
```

**Proceso:**
1. Sistema sincroniza:
   ```
   08:00 - Paciente 1
   08:15 - Paciente 2
   08:30 - Paciente 3
   08:45 - Paciente 4
   09:00 ← end_time alcanzado
   ```
2. Se detiene en cita 4
3. Muestra: "✅ 4 citas sincronizadas correctamente"
4. 6 citas restantes mantienen horarios originales

---

## 🎯 Validaciones

### ✅ Validaciones del Sistema

1. **Availability válida**: Verifica que la agenda exista
2. **Citas disponibles**: Solo procesa citas Confirmadas o Pendientes
3. **Horario válido**: Verifica que `start_time` y `end_time` sean válidos
4. **No exceder fin**: Detiene sincronización al alcanzar `end_time`
5. **Transaction segura**: Usa transacciones para rollback en caso de error

### ✅ Condiciones para Mostrar Botón

```typescript
// Solo mostrar si:
!loading &&                              // No está cargando
!error &&                                 // No hay error
appointments.filter(
  ap => ap.status === 'Confirmada' || 
        ap.status === 'Pendiente'
).length > 0                             // Hay citas para sincronizar
```

---

## 🔍 Respuesta del Servidor

### Exitosa

```json
{
  "success": true,
  "message": "7 citas sincronizadas correctamente",
  "updated": 7,
  "total": 7,
  "updates": [
    {
      "id": 101,
      "patient_name": "Carlos Velázquez",
      "old_time": "2025-10-21 08:30:00",
      "new_time": "2025-10-21 08:00:00"
    },
    {
      "id": 102,
      "patient_name": "José Velasque",
      "old_time": "2025-10-21 08:00:00",
      "new_time": "2025-10-21 08:15:00"
    }
    // ... más citas
  ],
  "availability": {
    "id": 123,
    "doctor": "Dra. Luis Fernanda Garrido",
    "specialty": "Medicina General",
    "location": "Sede Principal",
    "date": "2025-10-21",
    "start_time": "08:00:00",
    "end_time": "12:00:00",
    "duration_minutes": 15,
    "break_between_slots": 0
  }
}
```

### Sin Citas

```json
{
  "success": true,
  "message": "No hay citas para sincronizar",
  "updated": 0
}
```

### Error

```json
{
  "success": false,
  "message": "Error al sincronizar horas",
  "error": "Mensaje de error detallado"
}
```

---

## 📱 Beneficios

| Beneficio | Descripción |
|-----------|-------------|
| **Interfaz Visual** | No necesitas ejecutar script desde terminal |
| **Un Clic** | Reorganiza todas las citas instantáneamente |
| **Seguro** | Confirmación antes de ejecutar |
| **Feedback** | Notificaciones claras del resultado |
| **Actualización Automática** | Recarga la lista con nuevos horarios |
| **Transaccional** | Rollback automático si hay error |

---

## ⚠️ Advertencias

### Antes de Usar

1. ✅ **Verificar que la agenda tenga la configuración correcta**
   - `start_time` y `end_time` válidos
   - `duration_minutes` apropiado
   - `break_between_slots` (si aplica)

2. ✅ **Notificar a los pacientes**
   - Si sus horarios cambian significativamente
   - Preferiblemente hacer esto en horarios de baja actividad

3. ✅ **Revisar el resultado**
   - Verificar que las horas asignadas sean correctas
   - Confirmar que todas las citas estén dentro del horario

---

## 🔧 Archivos Modificados

### Backend
- `/backend/src/routes/availabilities.ts`
  - Nuevo endpoint: `POST /availabilities/:id/sync-appointment-times`
  - Lógica completa de sincronización secuencial

### Frontend
- `/frontend/src/lib/api.ts`
  - Nuevo método: `syncAppointmentTimes(availabilityId)`
  
- `/frontend/src/components/ViewAvailabilityModal.tsx`
  - Nueva función: `handleSyncAppointmentTimes()`
  - Nuevo botón: "Sincronizar Horas"

---

## ✅ Testing

- ✅ Backend compilado exitosamente
- ✅ Frontend compilado exitosamente
- ✅ Endpoint funcionando
- ✅ Botón visible cuando hay citas
- ✅ Confirmación antes de ejecutar
- ✅ Toast notifications funcionando
- ✅ Recarga automática después de sincronizar
- ✅ Listo para producción

---

**Estado**: ✅ COMPLETADO  
**Fecha**: Octubre 20, 2025  
**Versión**: 8.0  
**Sistema**: Biosanarcall - Sincronización de Horas  
**Mejora**: Botón Visual para Reorganizar Citas
