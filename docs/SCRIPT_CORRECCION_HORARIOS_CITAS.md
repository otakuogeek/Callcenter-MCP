# Script de Corrección de Horarios en Appointments

## 📋 Descripción

Script para corregir la asignación secuencial de horarios en la tabla `appointments`, utilizando la tabla `availabilities` como referencia principal.

## 🎯 Objetivo

Asegurar que las citas (`appointments`) se asignen correctamente con horarios secuenciales dentro de cada disponibilidad (`availability`), respetando:

1. **Hora de inicio**: `start_time` de la availability
2. **Duración**: `duration_minutes` de la availability (ej: 30 minutos)
3. **Descanso**: `break_between_slots` entre citas (si existe)
4. **Capacidad**: No exceder el `capacity` de la availability

## 📊 Tablas Involucradas

### `availabilities`
```sql
- id: identificador único
- location_id: sede
- specialty_id: especialidad
- doctor_id: médico
- date: fecha de la agenda
- start_time: hora de inicio (ej: 07:00:00)
- end_time: hora de fin (ej: 11:40:00)
- capacity: cupos totales (ej: 15)
- booked_slots: cupos ocupados
- duration_minutes: duración por cita (ej: 30)
- break_between_slots: descanso entre citas (ej: 0)
```

### `appointments`
```sql
- id: identificador único
- patient_id: paciente
- availability_id: referencia a availability
- scheduled_at: DATETIME - hora de la cita
- duration_minutes: duración
- status: Pendiente, Confirmada, Completada, Cancelada
```

## 🔧 Funcionamiento del Script

### Antes de la corrección:
```
Availability ID: 151
Doctor: Dra. Luis Fernada Garrido Castillo
Horario: 07:00:00 - 11:40:00
Duration: 30 min

Citas desordenadas:
- Cita 1: 07:00:00 ✅
- Cita 2: 07:00:00 ❌ (debería ser 07:30:00)
- Cita 3: 07:00:00 ❌ (debería ser 08:00:00)
- Cita 4: 07:00:00 ❌ (debería ser 08:30:00)
```

### Después de la corrección:
```
Citas ordenadas secuencialmente:
- Cita 1: 07:00:00 ✅
- Cita 2: 07:30:00 ✅
- Cita 3: 08:00:00 ✅
- Cita 4: 08:30:00 ✅
- Cita 5: 09:00:00 ✅
...
```

## 🚀 Uso del Script

### Ubicación
```bash
/home/ubuntu/app/backend/fix_appointment_sequential_times.js
```

### Ejecución
```bash
cd /home/ubuntu/app/backend
node fix_appointment_sequential_times.js
```

### Salida Esperada
```
🔍 Conectado a la base de datos...

📊 Total de availabilities activas: 15

🏥 Availability ID: 151
   📅 Fecha: Mon Oct 20 2025
   👨‍⚕️ Doctor: Dra. Luis Fernada Garrido Castillo
   🏢 Sede: Sede biosanar san gil
   💉 Especialidad: Medicina General
   ⏰ Horario: 07:00:00 - 11:40:00
   📋 Duración por cita: 30 min
   ⏸️  Descanso entre citas: 0 min
   📌 Citas a reorganizar: 15/15
   
   📌 Cita 1/15:
      ID: 136 | Paciente: Janet Rocío Bernal Chávez
      Hora anterior: 2025-10-20 07:00:00
      Hora nueva: 2025-10-20 07:00:00
   
   📌 Cita 2/15:
      ID: 139 | Paciente: Andrea Cubides Lozano
      Hora anterior: 2025-10-20 07:00:00
      Hora nueva: 2025-10-20 07:30:00
   ...
   
   ✅ Availability procesada correctamente

✨ Proceso completado!
📊 Availabilities procesadas: 15
📊 Total de citas actualizadas: 103
```

## 📝 Lógica del Algoritmo

```javascript
// Para cada availability activa:
1. Obtener start_time, duration_minutes, break_between_slots
2. Obtener todas las citas de esa availability (ordenadas por ID)
3. Iniciar desde start_time
4. Para cada cita:
   a. Asignar hora actual
   b. Sumar duration_minutes + break_between_slots
   c. Continuar con la siguiente cita
```

### Ejemplo de Cálculo
```
Availability:
- start_time: 07:00:00
- duration_minutes: 30
- break_between_slots: 0

Citas:
1. 07:00:00 (inicio)
2. 07:00:00 + 30min = 07:30:00
3. 07:30:00 + 30min = 08:00:00
4. 08:00:00 + 30min = 08:30:00
5. 08:30:00 + 30min = 09:00:00
...
```

## ✅ Validación

### Verificar citas de una availability específica:
```sql
SELECT 
  a.id,
  TIME(a.scheduled_at) AS hora,
  p.name AS paciente,
  a.duration_minutes AS duracion
FROM appointments a
LEFT JOIN patients p ON a.patient_id = p.id
WHERE a.availability_id = 151
ORDER BY a.scheduled_at;
```

### Resultado esperado:
```
+-----+----------+----------------------------------+----------+
| id  | hora     | paciente                         | duracion |
+-----+----------+----------------------------------+----------+
| 136 | 07:00:00 | Janet Rocío Bernal Chávez        |       30 |
| 139 | 07:30:00 | Andrea Cubides Lozano            |       30 |
| 140 | 08:00:00 | Vázquez Corzo Luz Dari           |       30 |
| 141 | 08:30:00 | Luz Dari Vázquez Corzo           |       30 |
| 142 | 09:00:00 | Jairo Salinas Portillo           |       30 |
...
```

## 🔒 Seguridad

- ✅ Solo procesa citas con status `Pendiente` o `Confirmada`
- ✅ Solo procesa availabilities con status `Activa`
- ✅ Solo procesa citas futuras (`date >= CURDATE()`)
- ✅ Usa transacciones implícitas de MySQL
- ✅ Valida fechas antes de procesar

## 📌 Casos Especiales

### Availability con break_between_slots
```javascript
duration_minutes: 30
break_between_slots: 5

Citas:
1. 07:00:00
2. 07:00:00 + 30 + 5 = 07:35:00
3. 07:35:00 + 30 + 5 = 08:10:00
```

### Availability sin citas
```
⏭️ Se omite automáticamente
```

### Availability con hora inválida
```
⚠️ ERROR: Fecha/hora inválida, saltando availability
```

## 🐛 Troubleshooting

### Error: Cannot find module 'mysql2/promise'
```bash
cd /home/ubuntu/app/backend
npm install mysql2
```

### Error: Invalid time value
- Verificar que las availabilities tengan `start_time` válido
- Verificar formato de fecha en la base de datos

### Citas no se actualizan
- Verificar que `availability_id` esté correctamente asignado
- Verificar que el status sea 'Pendiente' o 'Confirmada'

## 📊 Estadísticas de Última Ejecución

**Fecha**: 20 de octubre de 2025  
**Availabilities procesadas**: 15  
**Citas actualizadas**: 103  
**Tiempo de ejecución**: ~5 segundos  
**Errores**: 0  

## 🔄 Frecuencia de Uso

Se recomienda ejecutar este script:
- ✅ Después de importaciones masivas de citas
- ✅ Si se detectan horarios duplicados
- ✅ Como mantenimiento preventivo mensual
- ❌ NO ejecutar en horario de atención activo

## 📚 Referencias

- **Tabla availabilities**: Define las agendas de cada doctor
- **Tabla appointments**: Almacena las citas de los pacientes
- **Relación**: appointments.availability_id → availabilities.id

---

**Última actualización**: 20 de octubre de 2025  
**Autor**: Sistema Biosanar IPS  
**Versión**: 2.0 (Corregida - usa availabilities)
