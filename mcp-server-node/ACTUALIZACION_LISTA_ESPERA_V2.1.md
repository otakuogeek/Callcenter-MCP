# 🔄 Actualización: Lista de Espera con Enfoque en Especialidad

**Fecha:** 2 de octubre de 2025  
**Versión:** 2.1  
**Estado:** ✅ IMPLEMENTADO Y DESPLEGADO

---

## 📋 Resumen de Cambios

Se ha actualizado el sistema de lista de espera para que se enfoque principalmente en la **especialidad** y los **datos del paciente**, en lugar de requerir un doctor o fecha específicos. Esto permite una gestión más flexible donde las operadoras pueden asignar la cita con cualquier doctor de la especialidad solicitada cuando haya disponibilidad.

---

## 🎯 Objetivos Logrados

1. ✅ **Enfoque en Especialidad:** La lista de espera ahora prioriza la especialidad solicitada sobre el doctor específico
2. ✅ **Posición en Cola por Especialidad:** El cálculo de `queue_position` se basa en todas las solicitudes para esa especialidad, no solo para un doctor
3. ✅ **Mensaje Mejorado:** Las respuestas indican claramente que "una operadora contactará al paciente"
4. ✅ **Datos Simplificados:** La respuesta se enfoca en especialidad y ubicación, sin prometer un doctor específico

---

## 🔧 Cambios Técnicos Implementados

### 1. Modificación en `scheduleAppointment` (server-unified.ts)

**Ubicación:** Líneas 820-895

**Cambio Principal:**
```typescript
// ANTES: Contaba solo para el availability_id específico
SELECT COUNT(*) as total_waiting
FROM appointments_waiting_list
WHERE availability_id = ? AND status = 'pending'

// AHORA: Cuenta para toda la especialidad
SELECT COUNT(*) as total_waiting
FROM appointments_waiting_list wl
INNER JOIN availabilities a ON wl.availability_id = a.id
WHERE a.specialty_id = ? AND wl.status = 'pending'
```

**Nuevos Campos en la Respuesta:**
- `queue_position`: Posición en la cola según prioridad y antigüedad (por especialidad)
- `total_waiting_specialty`: Total de personas esperando para esa especialidad
- `requested_for`: Información simplificada (sin prometer doctor específico)
- `next_steps`: Mensaje claro sobre el proceso de contacto

**Ejemplo de Respuesta Mejorada:**
```json
{
  "success": true,
  "waiting_list": true,
  "message": "No hay cupos disponibles. Ha sido agregado a la lista de espera prioritaria",
  "waiting_list_id": 123,
  "queue_position": 3,
  "total_waiting_specialty": 8,
  "patient": {
    "id": 1042,
    "name": "Dey Alberto Bastidas",
    "document": "1098765432"
  },
  "requested_for": {
    "appointment_type": "Presencial",
    "priority_level": "Alta",
    "reason": "Consulta dermatológica urgente",
    "specialty": {
      "id": 10,
      "name": "Dermatología"
    },
    "location": {
      "id": 1,
      "name": "Sede biosanar san gil"
    }
  },
  "info": "Ha sido agregado a la lista de espera para Dermatología con prioridad Alta. Una operadora se comunicará con usted cuando haya disponibilidad.",
  "next_steps": "Una de nuestras operadoras se comunicará con usted tan pronto tengamos una cita disponible para confirmarle la fecha y hora."
}
```

---

### 2. Modificación en `getWaitingListAppointments` (server-unified.ts)

**Ubicación:** Líneas 1260-1275

**Cambio Principal:**
```sql
-- ANTES: Calculaba posición por availability_id
SELECT COUNT(*) + 1
FROM appointments_waiting_list wl2
WHERE wl2.availability_id = wl.availability_id
  AND wl2.status = 'pending'
  ...

-- AHORA: Calcula posición por specialty_id
SELECT COUNT(*) + 1
FROM appointments_waiting_list wl2
INNER JOIN availabilities a2 ON wl2.availability_id = a2.id
WHERE a2.specialty_id = s.id
  AND wl2.status = 'pending'
  ...
```

**Beneficio:** Los pacientes ven su posición real en la cola de toda la especialidad, no solo de un médico específico.

---

## 📞 Flujo de Conversación Actualizado (Valeria)

### Cuando NO hay cupos disponibles:

**Valeria dice:**
> "En este momento no tenemos citas disponibles para [especialidad], pero puedo agregarle a nuestra lista de espera prioritaria. Así, en cuanto se libere un cupo, una de nuestras operadoras lo contactará para asignarle la cita. ¿Le gustaría que lo inscriba?"

**Después de inscribir:**
> "Perfecto. Ha sido agregado a nuestra lista de espera para [especialidad] con prioridad [Alta/Normal/Baja/Urgente]. Su número de referencia es el [123]. Una de nuestras operadoras se comunicará con usted tan pronto tengamos una cita disponible para confirmarle la fecha y hora. Por favor, esté atento a su teléfono."

### Cuando el paciente consulta su estado:

**Valeria dice:**
> "Señor/a [nombre], veo su solicitud en la lista de espera para [especialidad]. Su posición actual es la número [3]. Aún estamos esperando que se libere un cupo, pero le notificaremos tan pronto ocurra."

**Si hay un cupo disponible:**
> "¡Buenas noticias! Veo que se ha liberado un cupo para [especialidad]. Una de nuestras operadoras estará contactándolo muy pronto para confirmar los detalles de la cita con usted. Por favor esté atento a su teléfono."

---

## 🔑 Ventajas del Nuevo Flujo

1. **Mayor Flexibilidad:** Las operadoras pueden asignar con cualquier doctor de la especialidad
2. **Más Transparente:** El paciente sabe que está en lista para la especialidad, no para un doctor específico que quizá nunca tenga cupo
3. **Mejor Experiencia:** El mensaje es claro sobre el proceso de contacto humano
4. **Escalable:** Funciona mejor cuando hay múltiples doctores de la misma especialidad
5. **Realista:** No promete fechas ni doctores que no se pueden cumplir

---

## 📊 Datos Almacenados en `appointments_waiting_list`

La tabla sigue almacenando:
- `availability_id`: Para referencia interna (puede ser cualquier agenda de la especialidad)
- `patient_id`: El paciente solicitante
- `scheduled_date`: Fecha solicitada (referencia, no es definitiva)
- `appointment_type`: Presencial o Telemedicina
- `reason`: Motivo de la consulta
- `priority_level`: Urgente, Alta, Normal, Baja
- `status`: pending, reassigned, cancelled, expired

**Clave:** El `availability_id` guardado es solo una referencia. Cuando una operadora asigne la cita, puede usar **cualquier** availability de la misma especialidad.

---

## 🧪 Pruebas Realizadas

Se creó el script `test-waiting-list-specialty-focus.sh` que verifica:

1. ✅ Campo `waiting_list_count` presente en `getAvailableAppointments`
2. ✅ Registro en lista de espera cuando no hay cupos
3. ✅ Respuesta con enfoque en especialidad (sin mencionar doctor específico)
4. ✅ Consulta de lista de espera con `queue_position` por especialidad
5. ✅ Mensaje de "operadora contactará" en la respuesta

**Comando:**
```bash
./test-waiting-list-specialty-focus.sh
```

---

## 📂 Archivos Modificados

1. `/home/ubuntu/app/mcp-server-node/src/server-unified.ts` (líneas 820-895, 1260-1275)
2. `/home/ubuntu/app/mcp-server-node/newprompt.md` (flujo de conversación actualizado)
3. `/home/ubuntu/app/mcp-server-node/test-waiting-list-specialty-focus.sh` (nuevo script de prueba)

---

## 🚀 Despliegue

```bash
cd /home/ubuntu/app/mcp-server-node
npm run build
pm2 restart mcp-unified
```

**Estado:** ✅ Desplegado en producción  
**Endpoint:** https://biosanarcall.site/mcp/  
**PM2 Process:** mcp-unified (ID: 0, PID: 676090, restarts: 13)

---

## 📖 Documentación Relacionada

- `DOCUMENTACION_LISTA_ESPERA.md` - Documentación técnica completa
- `RESUMEN_LISTA_ESPERA.md` - Resumen ejecutivo
- `GUIA_ELEVENLABS_LISTA_ESPERA.md` - Guía de conversación para ElevenLabs
- `newprompt.md` - Prompt actualizado para Valeria

---

## 🎯 Próximos Pasos Sugeridos

1. **Notificaciones Automáticas:** Implementar sistema de SMS/Email cuando se libere un cupo
2. **Dashboard para Operadoras:** Panel web para ver lista de espera y asignar citas
3. **Reportes:** Estadísticas de tiempos de espera promedio por especialidad
4. **Expiración Automática:** Limpiar solicitudes antiguas (30+ días)

---

**Versión del Sistema:** 2.1  
**Última Actualización:** 2 de octubre de 2025  
**Autor:** GitHub Copilot + Usuario  
**Estado:** ✅ Producción
