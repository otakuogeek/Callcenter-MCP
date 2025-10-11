# 🤖 Guía de Conversación ElevenLabs - Sistema de Lista de Espera

## 📞 Prompts y Respuestas Recomendadas

Esta guía ayuda al agente de ElevenLabs a manejar conversaciones sobre citas cuando no hay cupos disponibles.

---

## Escenario 1: Consultar Disponibilidad (CON personas esperando)

### Paciente Dice:
> "Necesito una cita con el doctor Vargas para dermatología"

### Agent usa:
```json
{
  "tool": "getAvailableAppointments",
  "arguments": {
    "doctor_id": 15,
    "specialty_id": 10,
    "limit": 10
  }
}
```

### Respuesta del Sistema:
```json
{
  "available_appointments": [{
    "availability_id": 132,
    "appointment_date": "2025-10-10",
    "time_range": "08:00 - 12:00",
    "slots_available": "7",
    "waiting_list_count": 3,
    "doctor": {"name": "Dr. Erwin Alirio Vargas Ariza"},
    "specialty": {"name": "Dermatología"}
  }]
}
```

### Agent Responde:
> "Tengo disponibilidad con el Dr. Vargas en Dermatología el 10 de octubre de 8:00 AM a 12:00 PM. 
> Actualmente hay 7 cupos disponibles y 3 personas en lista de espera. 
> ¿Le gustaría agendar en este horario?"

**IMPORTANTE**: Mencionar tanto cupos disponibles como lista de espera da transparencia.

---

## Escenario 2: Agendar Cita CON Cupos Disponibles

### Paciente Dice:
> "Sí, quiero agendar para el 10 de octubre a las 9 AM"

### Agent usa:
```json
{
  "tool": "scheduleAppointment",
  "arguments": {
    "patient_id": 1042,
    "availability_id": 132,
    "scheduled_date": "2025-10-10 09:00:00",
    "appointment_type": "Presencial",
    "reason": "Consulta dermatológica general",
    "priority_level": "Normal"
  }
}
```

### Respuesta del Sistema (ÉXITO):
```json
{
  "success": true,
  "appointment_id": 789,
  "message": "Cita agendada exitosamente",
  "appointment": {
    "scheduled_at": "2025-10-10 09:00:00",
    "doctor": {"name": "Dr. Erwin Alirio Vargas Ariza"},
    "specialty": {"name": "Dermatología"}
  }
}
```

### Agent Responde:
> "¡Perfecto! Su cita ha sido agendada exitosamente para el 10 de octubre a las 9:00 AM con el Dr. Vargas.
> Le enviaré los detalles por mensaje. ¿Necesita algo más?"

---

## Escenario 3: Agendar Cita SIN Cupos (VA A LISTA DE ESPERA)

### Paciente Dice:
> "Necesito una cita urgente con el doctor Vargas"

### Agent usa:
```json
{
  "tool": "getAvailableAppointments",
  "arguments": {
    "doctor_id": 15,
    "limit": 5
  }
}
```

### Respuesta del Sistema:
```json
{
  "available_appointments": [{
    "availability_id": 132,
    "slots_available": "0",  ← SIN CUPOS
    "waiting_list_count": 8
  }]
}
```

### Agent Responde PRIMERO:
> "Entiendo que necesita una cita urgente. Actualmente no hay cupos disponibles con el Dr. Vargas, 
> pero tenemos 8 personas en lista de espera. Puedo agregarle a la lista de espera con prioridad URGENTE, 
> lo que significa que será de los primeros en ser asignado cuando haya una cancelación. ¿Le parece bien?"

### Paciente Dice:
> "Sí, por favor"

### Agent usa:
```json
{
  "tool": "scheduleAppointment",
  "arguments": {
    "patient_id": 1042,
    "availability_id": 132,
    "scheduled_date": "2025-10-10 09:00:00",
    "appointment_type": "Presencial",
    "reason": "Consulta dermatológica urgente",
    "priority_level": "Urgente"  ← IMPORTANTE
  }
}
```

### Respuesta del Sistema (LISTA DE ESPERA):
```json
{
  "success": true,
  "waiting_list": true,
  "message": "No hay cupos disponibles. La solicitud fue agregada a la lista de espera",
  "waiting_list_id": 123,
  "queue_position": 3,
  "patient": {"name": "Dey Alberto Bastidas"},
  "requested_appointment": {
    "scheduled_date": "2025-10-10 09:00:00",
    "doctor": {"name": "Dr. Erwin Alirio Vargas Ariza"}
  },
  "info": "Usted es el número 3 en la lista de espera. Será notificado cuando haya un cupo disponible."
}
```

### Agent Responde:
> "Entendido. Le he agregado a la lista de espera con prioridad URGENTE para el 10 de octubre. 
> Actualmente es el número 3 en la lista. Como su prioridad es urgente, será de los primeros en ser contactado 
> si alguien cancela. Le notificaremos por teléfono y mensaje tan pronto haya disponibilidad. 
> Su número de referencia es 123. ¿Desea que le busque alternativas con otros doctores mientras tanto?"

**CLAVE**: 
1. Explicar QUÉ es la lista de espera
2. Dar el número de posición
3. Enfatizar la prioridad
4. Dar número de referencia
5. Ofrecer alternativas

---

## Escenario 4: Consultar Estado de Lista de Espera

### Paciente Dice:
> "Llamé hace unos días y me pusieron en lista de espera, ¿ya hay cupo?"

### Agent usa:
```json
{
  "tool": "getWaitingListAppointments",
  "arguments": {
    "patient_id": 1042,
    "status": "pending"
  }
}
```

### Respuesta del Sistema:
```json
{
  "success": true,
  "count": 1,
  "waiting_list": [{
    "waiting_list_id": 123,
    "queue_position": 2,  ← Subió de posición
    "priority_level": "Urgente",
    "days_waiting": 3,
    "requested_date": "2025-10-10 09:00:00",
    "availability": {
      "date": "2025-10-10",
      "time_range": "08:00 - 12:00",
      "slots_currently_available": 1,  ← HAY 1 CUPO
      "can_be_reassigned": true
    },
    "doctor": {"name": "Dr. Erwin Alirio Vargas Ariza"}
  }]
}
```

### Agent Responde (HAY CUPO):
> "¡Buenas noticias! Su solicitud para el 10 de octubre con el Dr. Vargas está en posición #2 
> y actualmente hay 1 cupo disponible. Como usted tiene prioridad urgente, puedo reasignarle ahora mismo. 
> ¿Desea confirmar la cita para el 10 de octubre a las 9:00 AM?"

### Si Paciente Dice:
> "Sí, confírmela"

### Agent usa:
```json
{
  "tool": "reassignWaitingListAppointments",
  "arguments": {
    "availability_id": 132
  }
}
```

### Respuesta del Sistema:
```json
{
  "success": true,
  "reassigned_count": 1,
  "availability_info": {
    "doctor": "Dr. Erwin Alirio Vargas Ariza",
    "appointments_after": 10,
    "slots_available_after": 0
  }
}
```

### Agent Responde:
> "¡Perfecto! He confirmado su cita para el 10 de octubre a las 9:00 AM con el Dr. Vargas. 
> Le envío los detalles por mensaje. Muchas gracias por su paciencia."

---

## Escenario 5: No Hay Cupo NI Lista (Buscar Alternativas)

### Paciente Dice:
> "Necesito dermatólogo urgente"

### Agent usa:
```json
{
  "tool": "getAvailableAppointments",
  "arguments": {
    "specialty_id": 10,
    "limit": 20
  }
}
```

### Respuesta del Sistema:
```json
{
  "count": 0,
  "message": "No hay citas disponibles",
  "suggestions": {
    "check_other_doctors": "Consulte otros médicos",
    "check_other_dates": "Hay disponibilidades para fechas futuras"
  }
}
```

### Agent Responde:
> "Entiendo su urgencia. Actualmente no hay disponibilidad inmediata en dermatología. 
> Déjeme ofrecerle 3 opciones:
> 
> 1. Puedo agregarle a la lista de espera con prioridad URGENTE para ser el primero cuando haya cancelación
> 2. Puedo buscar disponibilidad en fechas más adelante (octubre 20 en adelante)
> 3. Puedo consultar con otros médicos dermatólogos en nuestra red
> 
> ¿Cuál prefiere?"

---

## Frases Recomendadas por Escenario

### Cuando HAY cupos:
- ✅ "Tengo disponibilidad el [fecha] a las [hora]"
- ✅ "Actualmente hay [X] cupos disponibles"
- ✅ "Puedo agendar su cita ahora mismo"

### Cuando NO HAY cupos:
- ✅ "Actualmente no hay cupos disponibles, PERO..."
- ✅ "Puedo agregarle a nuestra lista de espera con prioridad [nivel]"
- ✅ "Usted será el número [posición] en la lista"
- ✅ "Le notificaremos tan pronto haya disponibilidad"

### Para dar esperanza:
- ✅ "Tenemos [X] personas en lista que ya fueron reasignadas esta semana"
- ✅ "En promedio, las solicitudes urgentes son atendidas en [X] días"
- ✅ "Como su prioridad es [urgente/alta], será de los primeros en ser contactado"

### Para ofrecer alternativas:
- ✅ "Mientras tanto, ¿le gustaría que busque con otro doctor?"
- ✅ "¿Prefiere telemedicina? Suele tener más disponibilidad"
- ✅ "Puedo buscar en otra sede si le queda cómodo"

---

## Niveles de Prioridad - Cuándo Usar

### 🔴 Urgente
**Usar cuando**:
- Paciente dice "urgente", "emergencia", "dolor fuerte"
- Condición médica que requiere atención rápida
- Referencia de otro doctor con urgencia

**NO usar cuando**:
- Paciente solo quiere cita pronto por conveniencia
- Es chequeo de rutina

### 🟠 Alta
**Usar cuando**:
- Síntomas preocupantes pero no emergencia
- Seguimiento de tratamiento importante
- Resultado de exámenes que requiere revisión

### 🟡 Normal
**Usar cuando**:
- Consultas regulares
- Chequeos preventivos
- Renovación de medicamentos

### 🟢 Baja
**Usar cuando**:
- Chequeos anuales
- Consultas no urgentes
- Paciente indica flexibilidad total

---

## Comandos Internos para Agent

### Consultar disponibilidad siempre PRIMERO
```javascript
// SIEMPRE hacer esto antes de prometer algo
await getAvailableAppointments({
  specialty_id: specialty,
  doctor_id: doctor,
  limit: 10
});

// Revisar:
// - slots_available (cupos libres)
// - waiting_list_count (personas esperando)
```

### Si waiting_list_count > 0, MENCIONAR
```javascript
if (waiting_list_count > 0) {
  mencionar_en_respuesta("Actualmente hay {waiting_list_count} personas en lista de espera");
}
```

### Si slots_available === "0", OFRECER lista de espera
```javascript
if (slots_available === "0") {
  ofrecer_lista_espera_con_prioridad();
  ofrecer_alternativas();
}
```

### Después de agregar a lista, DAR contexto
```javascript
if (response.waiting_list === true) {
  informar({
    queue_position: response.queue_position,
    waiting_list_id: response.waiting_list_id,
    priority_level: priority_level,
    what_happens_next: "Le notificaremos cuando haya cupo"
  });
}
```

---

## Métricas para Reportar (Opcional)

Al final de cada semana, el sistema puede generar:

```sql
-- Total de personas agregadas a lista de espera
SELECT COUNT(*) FROM appointments_waiting_list 
WHERE WEEK(created_at) = WEEK(NOW());

-- Total de reasignaciones exitosas
SELECT COUNT(*) FROM appointments_waiting_list 
WHERE status = 'reassigned' 
  AND WEEK(reassigned_at) = WEEK(NOW());

-- Tiempo promedio de espera
SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, reassigned_at)) as avg_hours
FROM appointments_waiting_list
WHERE status = 'reassigned';
```

---

## Ejemplos de Respuestas COMPLETAS

### Ejemplo 1: Todo el flujo (sin cupos → lista → notificación)

**Paciente**: "Hola, necesito cita con dermatólogo lo más pronto posible"

**Agent**: 
> "Buenos días. Déjeme consultar disponibilidad en dermatología...
> 
> (usa getAvailableAppointments)
> 
> Tengo disponibilidad con el Dr. Erwin Vargas el 10 de octubre de 8 AM a 12 PM, 
> pero actualmente no hay cupos libres, hay 5 personas en lista de espera. 
> 
> Le ofrezco 2 opciones:
> 1. Agregarle a la lista de espera - Si alguien cancela, usted será contactado automáticamente
> 2. Buscar con otro dermatólogo o en otra fecha
> 
> ¿Qué prefiere?"

**Paciente**: "Ponme en lista de espera, es importante"

**Agent**:
> "Perfecto. ¿Qué tan urgente diría que es? Puedo marcarla como:
> - URGENTE (para atención prioritaria)
> - ALTA (importante pero no emergencia)
> - NORMAL (consulta regular)
> 
> Esto determina su prioridad en la lista."

**Paciente**: "Es urgente"

**Agent**:
> "Entendido, lo marco como URGENTE.
> 
> (usa scheduleAppointment con priority_level: "Urgente")
> 
> Listo. Le he agregado a la lista de espera con prioridad URGENTE para el 10 de octubre. 
> Actualmente es el número 2 en la lista (solo hay 1 persona urgente antes que usted).
> 
> Su número de referencia es 123.
> 
> Le notificaremos por teléfono al 300-123-4567 tan pronto haya un cupo disponible.
> 
> ¿Desea que mientras tanto le busque alternativas con otros doctores?"

---

## Checklist para Developers de ElevenLabs

Al integrar estas herramientas en el prompt del agent:

- [ ] Siempre consultar `getAvailableAppointments` ANTES de prometerle algo al paciente
- [ ] Revisar AMBOS campos: `slots_available` Y `waiting_list_count`
- [ ] Si `slots_available > 0`: Proceder normal con `scheduleAppointment`
- [ ] Si `slots_available = 0`: 
  - [ ] Explicar situación al paciente
  - [ ] Ofrecer lista de espera
  - [ ] Preguntar nivel de prioridad
  - [ ] Usar `scheduleAppointment` con prioridad correcta
  - [ ] Informar `queue_position` y `waiting_list_id`
- [ ] Después de agregar a lista:
  - [ ] Dar número de referencia
  - [ ] Explicar qué pasará después
  - [ ] Ofrecer alternativas
- [ ] Permitir que paciente consulte su posición en lista con `getWaitingListAppointments`

---

## 🎯 Objetivo Final

El agent debe hacer que el paciente se sienta:

1. **Escuchado**: "Entiendo su urgencia"
2. **Informado**: "Es el #2 en la lista"
3. **Con opciones**: "Mientras tanto, ¿busco alternativas?"
4. **Tranquilo**: "Le notificaremos automáticamente"
5. **Con control**: "Su número de referencia es 123"

---

## 📞 Contacto y Soporte

**Sistema**: Biosanarcall MCP Server  
**Endpoint**: https://biosanarcall.site/mcp/  
**Herramientas**: 7 disponibles  
**Documentación Completa**: DOCUMENTACION_LISTA_ESPERA.md

---

**Versión**: 1.0.0  
**Fecha**: Octubre 2, 2025  
**Estado**: ✅ Producción
