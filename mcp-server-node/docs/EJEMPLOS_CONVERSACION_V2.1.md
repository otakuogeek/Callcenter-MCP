# Ejemplos de Conversación v2.1 - Valeria con checkAvailabilityQuota

## 🎭 Diálogos Completos de Ejemplo

---

## Ejemplo 1: Cita Directa (Con Cupos Disponibles) ✅

**Contexto:** Paciente nuevo solicita Dermatología. Hay 6 cupos disponibles.

```
┌─────────────────────────────────────────────────────────────────┐
│ PASO 1: SALUDO                                                  │
└─────────────────────────────────────────────────────────────────┘

VALERIA: Hola, bienvenido a Fundación Biosanar IPS. Le atiende Valeria, 
         ¿cómo puedo colaborarle?

PACIENTE: Hola, necesito una cita médica.

VALERIA: Con gusto, permítame un momento mientras verifico las agendas 
         disponibles en el sistema.

┌─────────────────────────────────────────────────────────────────┐
│ PASO 2: CONSULTA DE DISPONIBILIDAD                             │
│ [Sistema llama: getAvailableAppointments()]                    │
└─────────────────────────────────────────────────────────────────┘

VALERIA: Claro que sí. En este momento podemos procesar su solicitud 
         para Medicina General, Dermatología, Cardiología, Pediatría 
         y Odontología. ¿Para cuál de ellas necesita la cita?

PACIENTE: Dermatología, por favor.

┌─────────────────────────────────────────────────────────────────┐
│ PASO 3: SELECCIÓN DE SEDE                                      │
└─────────────────────────────────────────────────────────────────┘

VALERIA: Perfecto. Para Dermatología, podemos procesar su solicitud en 
         Sede biosanar san gil. ¿Cuál le queda mejor?

PACIENTE: Está bien la de San Gil.

VALERIA: Perfecto. ¿Desea que le agendemos la cita con Dermatología 
         en Sede biosanar san gil?

PACIENTE: Sí, por favor.

┌─────────────────────────────────────────────────────────────────┐
│ PASO 3.5: VERIFICACIÓN INTERNA (NO SE MUESTRA AL PACIENTE)    │
│ [Sistema selecciona: availability_id = 132]                    │
│ [Sistema llama: checkAvailabilityQuota(132)]                   │
│ [Resultado: can_schedule_direct = true]                        │
│ [Flag interno: AGENDA_DIRECTA]                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PASO 4: VERIFICACIÓN DE DATOS                                  │
└─────────────────────────────────────────────────────────────────┘

VALERIA: Muy bien. Para procesar su solicitud, por favor, indíqueme 
         su número de cédula.

PACIENTE: Uno, cero, tres, seis, cinco, cuatro, tres, dos, uno.

VALERIA: [Normaliza: 1036543210]
         Perfecto, necesito validar unos datos en el sistema para 
         continuar. ¿Me regala su nombre completo, por favor?

┌─────────────────────────────────────────────────────────────────┐
│ PASO 5: REGISTRO DE PACIENTE                                   │
└─────────────────────────────────────────────────────────────────┘

PACIENTE: Carlos Andrés Gómez Pérez.

VALERIA: Gracias, Carlos. ¿Cuál es su número de teléfono?

PACIENTE: Tres, uno, cinco, ocho, nueve, cuatro, dos, tres, cinco, seis.

VALERIA: [Normaliza: 3158942356]
         Perfecto. ¿Con qué EPS está afiliado?

VALERIA: [Llama: listActiveEPS()]
         Tenemos disponibles: NUEVA EPS, SANITAS, SURA, SALUD TOTAL, 
         COMPENSAR... [lista completa]

PACIENTE: NUEVA EPS.

VALERIA: Perfecto. Confirmo sus datos: Carlos Andrés Gómez Pérez, 
         cédula 1036543210, teléfono 3158942356, NUEVA EPS. ¿Es correcto?

PACIENTE: Sí, correcto.

VALERIA: [Llama: registerPatientSimple()]
         [Guarda: patient_id = 1050]

┌─────────────────────────────────────────────────────────────────┐
│ PASO 6: AGENDAMIENTO (Flag = AGENDA_DIRECTA)                   │
└─────────────────────────────────────────────────────────────────┘

VALERIA: Para finalizar, ¿cuál es el motivo de la consulta?

PACIENTE: Tengo una erupción en la piel que no se me quita.

VALERIA: [NO pregunta prioridad porque hay cupos]
         [Llama: scheduleAppointment(
           availability_id: 132,
           patient_id: 1050,
           reason: "Erupción en la piel",
           scheduled_date: "2025-10-10 08:00:00"
         )]
         [Resultado: waiting_list: false, appointment_id: 501]

VALERIA: ¡Perfecto! Su cita ha sido confirmada. Le confirmo los detalles: 
         es con la doctora Erwin Vargas el día 10 de octubre a las 8 de 
         la mañana, en la sede biosanar san gil. El número de su cita 
         es el 501.

┌─────────────────────────────────────────────────────────────────┐
│ PASO 7: CIERRE                                                  │
└─────────────────────────────────────────────────────────────────┘

VALERIA: ¿Hay algo más en lo que pueda colaborarle?

PACIENTE: No, muchas gracias.

VALERIA: Gracias por comunicarse con Fundación Biosanar IPS. 
         Que tenga un excelente día.
```

---

## Ejemplo 2: Lista de Espera (Sin Cupos Disponibles) 📋

**Contexto:** Paciente existente solicita Medicina General. NO hay cupos disponibles.

```
┌─────────────────────────────────────────────────────────────────┐
│ PASO 1: SALUDO                                                  │
└─────────────────────────────────────────────────────────────────┘

VALERIA: Hola, bienvenido a Fundación Biosanar IPS. Le atiende Valeria, 
         ¿cómo puedo colaborarle?

PACIENTE: Buenos días, necesito sacar una cita con Medicina General.

VALERIA: Con gusto, permítame un momento mientras verifico las agendas 
         disponibles en el sistema.

┌─────────────────────────────────────────────────────────────────┐
│ PASO 2: CONSULTA DE DISPONIBILIDAD                             │
│ [Sistema llama: getAvailableAppointments()]                    │
└─────────────────────────────────────────────────────────────────┘

VALERIA: Claro que sí. En este momento podemos procesar su solicitud 
         para Medicina General, Dermatología, Cardiología, Pediatría 
         y Odontología. ¿Para cuál de ellas necesita la cita?

PACIENTE: Medicina General.

┌─────────────────────────────────────────────────────────────────┐
│ PASO 3: SELECCIÓN DE SEDE                                      │
└─────────────────────────────────────────────────────────────────┘

VALERIA: Perfecto. Para Medicina General, podemos procesar su solicitud 
         en Sede biosanar san gil. ¿Cuál le queda mejor?

PACIENTE: La de San Gil está bien.

VALERIA: Perfecto. ¿Desea que le agendemos la cita con Medicina General 
         en Sede biosanar san gil?

PACIENTE: Sí, adelante.

┌─────────────────────────────────────────────────────────────────┐
│ PASO 3.5: VERIFICACIÓN INTERNA (NO SE MUESTRA AL PACIENTE)    │
│ [Sistema selecciona: availability_id = 135]                    │
│ [Sistema llama: checkAvailabilityQuota(135)]                   │
│ [Resultado: can_schedule_direct = false]                       │
│ [Flag interno: LISTA_ESPERA]                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PASO 4: VERIFICACIÓN DE DATOS                                  │
└─────────────────────────────────────────────────────────────────┘

VALERIA: Muy bien. Para procesar su solicitud, por favor, indíqueme 
         su número de cédula.

PACIENTE: Ochenta y ocho millones trescientos veinticinco mil 
          cuatrocientos cuarenta y uno.

VALERIA: [Normaliza: 88325441]
         [Llama: searchPatient(88325441)]
         [Resultado: patient_id = 1042, nombre: María López]

┌─────────────────────────────────────────────────────────────────┐
│ PASO 6: AGENDAMIENTO (Flag = LISTA_ESPERA)                     │
└─────────────────────────────────────────────────────────────────┘

VALERIA: Para procesar su solicitud correctamente, ¿su consulta es de 
         carácter 'Urgente', 'Alta', 'Normal' o 'Baja'?

PACIENTE: Pues es normal, no es nada urgente.

VALERIA: Perfecto. ¿Cuál es el motivo de la consulta?

PACIENTE: Es un control de tensión arterial.

VALERIA: [Llama: scheduleAppointment(
           availability_id: 135,
           patient_id: 1042,
           reason: "Control de tensión arterial",
           scheduled_date: "2025-10-15 08:00:00",
           priority_level: "Normal"
         )]
         [Resultado: waiting_list: true, waiting_list_id: 156, 
                     queue_position: 4]

VALERIA: Su solicitud ha sido registrada exitosamente en nuestra lista 
         de espera para Medicina General. Su número de referencia es 
         el 156 y su posición en la cola es la número 4 con prioridad 
         Normal. Una de nuestras operadoras se comunicará con usted 
         muy pronto para confirmarle el día y la hora de su cita. 
         Por favor, esté atento a su teléfono.

┌─────────────────────────────────────────────────────────────────┐
│ PASO 7: CIERRE                                                  │
└─────────────────────────────────────────────────────────────────┘

VALERIA: ¿Hay algo más en lo que pueda colaborarle?

PACIENTE: No, gracias. ¿Aproximadamente cuánto tiempo tarda?

VALERIA: Nuestra operadora se comunicará con usted dentro de las 
         próximas horas para confirmarle los detalles. Por la prioridad 
         Normal, usualmente son 24 a 48 horas.

PACIENTE: Perfecto, gracias.

VALERIA: Gracias por comunicarse con Fundación Biosanar IPS. 
         Que tenga un excelente día.
```

---

## Ejemplo 3: Paciente Pregunta por Fecha/Médico Antes de Tiempo ❓

**Contexto:** Paciente pregunta detalles antes de que el sistema los tenga.

```
┌─────────────────────────────────────────────────────────────────┐
│ PASO 3: SELECCIÓN DE SEDE                                      │
└─────────────────────────────────────────────────────────────────┘

VALERIA: Perfecto. Para Cardiología, podemos procesar su solicitud en 
         Sede biosanar san gil. ¿Cuál le queda mejor?

PACIENTE: La de San Gil. Pero, ¿para qué día sería la cita?

VALERIA: El sistema asignará automáticamente la fecha más próxima 
         disponible y el especialista una vez completemos el proceso.

PACIENTE: Ah, ok. ¿Y con qué doctor sería?

VALERIA: El sistema asignará automáticamente la fecha más próxima 
         disponible y el especialista una vez completemos el proceso.

PACIENTE: Entiendo, sigamos entonces.

VALERIA: ¿Desea que le agendemos la cita con Cardiología en 
         Sede biosanar san gil?

PACIENTE: Sí.

[Continúa flujo normal...]
```

---

## Ejemplo 4: Consulta de Estado en Lista de Espera 🔍

**Contexto:** Paciente llama para consultar su posición en lista de espera.

```
┌─────────────────────────────────────────────────────────────────┐
│ FLUJO DE CONSULTA DE LISTA DE ESPERA                           │
└─────────────────────────────────────────────────────────────────┘

VALERIA: Hola, bienvenido a Fundación Biosanar IPS. Le atiende Valeria, 
         ¿cómo puedo colaborarle?

PACIENTE: Hola, llamé ayer para una cita de Dermatología y me dijeron 
          que me pondrían en lista de espera. Quiero saber en qué va.

VALERIA: Claro que sí. Para consultar su solicitud, por favor, indíqueme 
         su número de cédula.

PACIENTE: Ochenta y ocho millones trescientos veintiséis mil 
          doscientos treinta y cinco.

VALERIA: [Normaliza: 88326235]
         [Llama: searchPatient(88326235)]
         [Guarda: patient_id = 1043]
         
         [Llama: getWaitingListAppointments(
           patient_id: 1043,
           status: "pending"
         )]
         [Resultado: waiting_list_id: 154, specialty: "Dermatología",
                     queue_position: 2, priority_level: "Alta"]

VALERIA: Señor Pedro, veo su solicitud en la lista de espera para 
         Dermatología. Su posición actual es la número 2 con prioridad 
         Alta. Una de nuestras operadoras estará contactándolo muy 
         pronto para confirmar los detalles de su cita.

PACIENTE: Perfecto, muchas gracias.

VALERIA: Con gusto. ¿Hay algo más en lo que pueda colaborarle?

PACIENTE: No, eso es todo.

VALERIA: Gracias por comunicarse con Fundación Biosanar IPS. 
         Que tenga un excelente día.
```

---

## Comparación de Diálogos: v2.0 vs v2.1

### Escenario: Medicina General SIN cupos disponibles

#### v2.0 (Anterior) ❌
```
VALERIA: ¿Cuál es el motivo de la consulta?
PACIENTE: Control de tensión.

[Sistema llama scheduleAppointment]
[Descubre que no hay cupos]

VALERIA: Para darle la mejor atención, ¿su consulta es urgente, 
         alta, normal o baja?
PACIENTE: Normal.

[Vuelve a llamar scheduleAppointment con prioridad]

VALERIA: Su solicitud ha sido registrada en lista de espera...
```

**Problema:** Pregunta prioridad DESPUÉS de intentar agendar.

---

#### v2.1 (Actual) ✅
```
[Sistema llama checkAvailabilityQuota PRIMERO]
[Detecta que no hay cupos]
[Flag: LISTA_ESPERA]

VALERIA: Para procesar su solicitud correctamente, ¿su consulta es 
         de carácter urgente, alta, normal o baja?
PACIENTE: Normal.

VALERIA: Perfecto. ¿Cuál es el motivo de la consulta?
PACIENTE: Control de tensión.

[Sistema llama scheduleAppointment UNA SOLA VEZ con prioridad]

VALERIA: Su solicitud ha sido registrada en lista de espera...
```

**Ventaja:** Pregunta prioridad ANTES, flujo más eficiente.

---

## 🎯 Puntos Clave Observados

### ✅ Mejoras en v2.1:

1. **Confirmación de intención:** "¿Desea que le agendemos la cita?"
   - Da al paciente control sobre el proceso

2. **Verificación interna silenciosa:** checkAvailabilityQuota
   - No confunde al paciente con información técnica

3. **Pregunta prioridad solo cuando es necesario:**
   - Si hay cupos: NO pregunta
   - Si NO hay cupos: Pregunta PRIMERO

4. **Confirmación específica según resultado:**
   - Cita directa: Todos los detalles (doctor, fecha, hora)
   - Lista de espera: Referencia y posición en cola

5. **Manejo de preguntas anticipadas:**
   - Respuesta estándar y profesional
   - Redirige al flujo sin dar información prematura

---

## 📝 Frases Clave de Valeria v2.1

### Inicio
```
"Hola, bienvenido a Fundación Biosanar IPS. Le atiende Valeria, 
 ¿cómo puedo colaborarle?"
```

### Consulta de disponibilidad
```
"Con gusto, permítame un momento mientras verifico las agendas 
 disponibles en el sistema."
```

### Presentación de especialidades
```
"En este momento podemos procesar su solicitud para [especialidades]."
```

### Confirmación de intención 🆕
```
"¿Desea que le agendemos la cita con [especialidad] en [sede]?"
```

### Solicitud de prioridad (solo si no hay cupos)
```
"Para procesar su solicitud correctamente, ¿su consulta es de carácter 
 'Urgente', 'Alta', 'Normal' o 'Baja'?"
```

### Confirmación cita directa
```
"¡Perfecto! Su cita ha sido confirmada. Le confirmo los detalles: 
 es con el/la doctor/a [nombre] el día [fecha] a las [hora], 
 en la sede [ubicación]. El número de su cita es el [id]."
```

### Confirmación lista de espera
```
"Su solicitud ha sido registrada exitosamente en nuestra lista de espera 
 para [especialidad]. Su número de referencia es el [id] y su posición 
 en la cola es la número [posición] con prioridad [nivel]. Una de nuestras 
 operadoras se comunicará con usted muy pronto para confirmarle el día 
 y la hora de su cita."
```

---

**Última actualización:** 2 de octubre de 2025  
**Versión:** 2.1  
**Autor:** Sistema Biosanarcall  
**Propósito:** Documentación de ejemplos conversacionales
