# Mejoras en getAvailableAppointments - Agrupación Inteligente por Médico

## 📋 Resumen de Cambios

Se ha mejorado la herramienta `getAvailableAppointments` para implementar una **agrupación inteligente** que respeta las reglas de asignación de citas por médico y especialidad.

## ✅ Reglas de Agrupación Implementadas

### 1. **NO Mezclar Médicos Diferentes**
- ❌ **ANTES**: Las citas de diferentes médicos podían aparecer mezcladas
- ✅ **AHORA**: Cada médico tiene su grupo independiente
- 🔑 **Clave de agrupación**: `fecha + doctor_id + specialty_id`

### 2. **Agrupar Solo Mismo Médico con Múltiples Turnos**
- ✅ Si Dr. Juan tiene citas de 08:00-12:00 (mañana) Y 14:00-18:00 (tarde) → Se agrupan
- ✅ Cada availability mantiene su `availability_id` único
- ✅ Se identifican con flags: `has_morning_slots`, `has_afternoon_slots`, `has_multiple_shifts`

### 3. **Mantener Especialidades Separadas**
- ❌ **NO se agrupan**: Dr. Juan (Cardiología) con Dr. Juan (Medicina General)
- ✅ Cada especialidad tiene su grupo independiente
- ✅ Ordenamiento: Fecha → Especialidad → Médico → Hora

### 4. **Preservar Identidad de Availabilities**
- ✅ Cada `availability_id` se mantiene único e identificable
- ✅ Los cupos disponibles son específicos de cada availability
- ✅ No se suman ni redistribuyen cupos entre médicos

## 📊 Estructura de Respuesta Nueva

### Formato Agrupado: `grouped_by_doctor_and_specialty`

```json
{
  "success": true,
  "message": "Se encontraron 15 disponibilidades de 3 médicos",
  "count": 15,
  "doctors_with_availability": 3,
  "grouped_by_doctor_and_specialty": [
    {
      "date": "2025-10-15",
      "doctor": {
        "id": 1,
        "name": "Dr. Juan Pérez",
        "email": "juan.perez@hospital.com",
        "phone": "123456789"
      },
      "specialty": {
        "id": 1,
        "name": "Cardiología"
      },
      "location": {
        "id": 1,
        "name": "Hospital Principal",
        "address": "Calle 123",
        "phone": "987654321"
      },
      "availabilities": [
        {
          "availability_id": 101,
          "appointment_date": "2025-10-15T00:00:00.000Z",
          "time_range": "08:00 - 12:00",
          "start_time": "08:00",
          "end_time": "12:00",
          "duration_minutes": 30,
          "total_capacity": 10,
          "slots_available": 8,
          "total_quota_distributed": 10,
          "total_assigned": 2,
          "distribution_count": 3
        },
        {
          "availability_id": 102,
          "appointment_date": "2025-10-15T00:00:00.000Z",
          "time_range": "14:00 - 18:00",
          "start_time": "14:00",
          "end_time": "18:00",
          "duration_minutes": 30,
          "total_capacity": 8,
          "slots_available": 6,
          "total_quota_distributed": 8,
          "total_assigned": 2,
          "distribution_count": 2
        }
      ],
      "total_slots_available": 14,
      "time_slots": ["08:00", "14:00"],
      "has_morning_slots": true,
      "has_afternoon_slots": true,
      "has_multiple_shifts": true
    },
    {
      "date": "2025-10-15",
      "doctor": {
        "id": 2,
        "name": "Dra. María González",
        "email": "maria.gonzalez@hospital.com",
        "phone": "123456780"
      },
      "specialty": {
        "id": 1,
        "name": "Cardiología"
      },
      "availabilities": [
        {
          "availability_id": 103,
          "time_range": "09:00 - 13:00",
          "slots_available": 5
        }
      ],
      "total_slots_available": 5,
      "has_morning_slots": true,
      "has_afternoon_slots": false,
      "has_multiple_shifts": false
    }
  ],
  "info": {
    "grouping_rules": "Las citas se agrupan SOLO si son del mismo médico y especialidad",
    "no_mixing": "Las citas de diferentes médicos NUNCA se mezclan",
    "same_doctor_multiple_shifts": "Si un médico tiene mañana Y tarde, se muestran agrupadas pero identificables",
    "usage": "Use availability_id específico para agendar con scheduleAppointment"
  }
}
```

## 🔍 Casos de Uso Explicados

### Caso 1: Mismo Médico, Misma Especialidad, Diferentes Horarios
```
Dr. Juan Pérez (Cardiología)
  ├─ 08:00-12:00 (availability_id: 101) - 8 cupos
  └─ 14:00-18:00 (availability_id: 102) - 6 cupos
  
✅ SE AGRUPAN en un solo grupo
✅ Total: 14 cupos (8 + 6)
✅ has_multiple_shifts: true
```

### Caso 2: Diferentes Médicos, Misma Especialidad
```
Dr. Juan Pérez (Cardiología)
  └─ 08:00-12:00 (availability_id: 101) - 8 cupos

Dra. María González (Cardiología)
  └─ 09:00-13:00 (availability_id: 103) - 5 cupos
  
✅ SE MANTIENEN SEPARADOS en grupos diferentes
❌ NO se mezclan los cupos
```

### Caso 3: Mismo Médico, Diferentes Especialidades
```
Dr. Juan Pérez (Cardiología)
  └─ 08:00-12:00 (availability_id: 101) - 8 cupos

Dr. Juan Pérez (Medicina General)
  └─ 14:00-18:00 (availability_id: 104) - 5 cupos
  
✅ SE MANTIENEN SEPARADOS en grupos diferentes
❌ NO se agrupan porque son especialidades diferentes
```

## 🎯 Beneficios de la Implementación

1. **Claridad para el Paciente**
   - Sabe exactamente qué médico lo atenderá
   - Ve todos los horarios disponibles del mismo médico
   - No hay confusión con otros profesionales

2. **Integridad de Datos**
   - Cada `availability_id` mantiene su identidad
   - Los cupos no se redistribuyen incorrectamente
   - Las citas se asignan al médico correcto

3. **Mejor UX para Agentes de IA**
   - Respuestas más estructuradas y comprensibles
   - Fácil identificar si un médico tiene múltiples turnos
   - Navegación clara entre opciones

4. **Compatibilidad Retroactiva**
   - Se mantiene el formato plano `available_appointments` para código legacy
   - Se agrega el nuevo formato `grouped_by_doctor_and_specialty`
   - No rompe integraciones existentes

## 📝 Ejemplos de Uso

### Ejemplo 1: Buscar todas las disponibilidades
```bash
curl -X POST "https://biosanarcall.site/mcp-unified" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "getAvailableAppointments",
      "arguments": {
        "limit": 100
      }
    }
  }'
```

### Ejemplo 2: Buscar por médico específico
```bash
curl -X POST "https://biosanarcall.site/mcp-unified" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "getAvailableAppointments",
      "arguments": {
        "doctor_id": 1,
        "limit": 50
      }
    }
  }'
```

### Ejemplo 3: Buscar por especialidad
```bash
curl -X POST "https://biosanarcall.site/mcp-unified" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "getAvailableAppointments",
      "arguments": {
        "specialty_id": 1,
        "limit": 50
      }
    }
  }'
```

## 🧪 Testing

Ejecutar el script de prueba:
```bash
cd /home/ubuntu/app/mcp-server-node
./test-getAvailableAppointments-mejorado.sh
```

Este script verifica:
- ✅ Que las citas se agrupan correctamente por médico
- ✅ Que no se mezclan médicos diferentes
- ✅ Que se identifican correctamente turnos de mañana/tarde
- ✅ Que los filtros funcionan correctamente
- ✅ Que cada availability_id mantiene su identidad

## 📌 Notas Importantes

1. **Para Agendar Citas**: Siempre usar el `availability_id` específico, NO el grupo
2. **Ordenamiento**: Fecha → Especialidad → Médico → Hora de inicio
3. **Límite por Defecto**: 50 resultados (configurable con `limit`)
4. **Fecha de Corte**: Solo muestra citas desde hoy en adelante (`>= CURDATE()`)

## 🔄 Migración desde Versión Anterior

Si tu código usa la versión anterior:
- ✅ El formato `available_appointments` sigue disponible (sin cambios)
- ✅ Agrega soporte para `grouped_by_doctor_and_specialty` para mejor UX
- ✅ Los `availability_id` siguen siendo los mismos
- ✅ No se requieren cambios en `scheduleAppointment`

## 📞 Soporte

Para reportar problemas o sugerir mejoras:
- 📧 Email: soporte@biosanarcall.site
- 📝 Issues: GitHub repository
- 📖 Documentación: `/home/ubuntu/app/mcp-server-node/docs/`

---

**Versión**: 3.2.0  
**Fecha**: Octubre 2025  
**Autor**: Sistema MCP Biosanarcall
