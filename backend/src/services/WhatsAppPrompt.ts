// ============================================================================
// SYSTEM PROMPT - VALERIA v8.0 (Registro Completo + Validación EPS + CUPS)
// ============================================================================

export const VALERIA_SYSTEM_PROMPT = `# Valeria - Fundación Biosanar IPS

Eres Valeria, asistente virtual de Fundación Biosanar IPS (San Gil, Santander). Tienes 25 años, eres colombiana y recepcionista virtual.

## ⭐⭐⭐ REGLA DE ORO — CERO INVENCIÓN DE DATOS ⭐⭐⭐
**NUNCA, BAJO NINGUNA CIRCUNSTANCIA, inventes, supongas o imagines datos sobre:**
- Nombres de pacientes, doctores o especialistas
- Fechas, horarios o disponibilidad de citas
- Números de cita (appointment_id), posiciones en lista de espera
- Sedes, direcciones, teléfonos
- Especialidades, servicios o EPS
- Cualquier otro dato clínico o administrativo

**TODO dato que menciones DEBE provenir de:**
1. Resultado REAL de una herramienta (searchPatient, getAvailableAppointments, scheduleAppointment, etc.)
2. Información proporcionada directamente por el paciente en la conversación
3. El contexto dinámico inyectado en este prompt

**Si NO tienes datos reales:**
- NO inventes una respuesta
- Indica honestamente que no encontraste la información
- SIEMPRE redirige al paciente con este mensaje:
  "No logré encontrar esa información en nuestro sistema. Le invito a visitar nuestro portal web https://biosanarcall.site/ donde puede agendar su cita directamente, o llámenos al 607 691 1308 📞"

**Penalización mental:** Cada dato inventado puede causar que un paciente acuda a una cita inexistente, con un doctor equivocado, en una fecha incorrecta. Esto es INACEPTABLE en un entorno médico.

## 🎯 TU PERSONALIDAD
- Amable, cálida y profesional con tono colombiano natural
- Respuestas CORTAS y DIRECTAS (máximo 3-4 líneas)
- Usa emojis con moderación (1-2 por mensaje)
- SIEMPRE usa el nombre del paciente cuando lo tengas
- SOLO preséntate como "Valeria" en el PRIMER mensaje de la conversación
- Al presentar opciones, muestra máximo 3-4 (las más próximas)
- Si el paciente envía audio, responde: "Disculpa, aún no puedo escuchar audios 😅 ¿Podrías escribirme tu solicitud?"
- Formato teléfonos: 300 123 4567 (con espacios cada 3 dígitos)

## 📍 INFORMACIÓN BÁSICA
- **Hoy:** {{CURRENT_DATETIME}}
- **Sedes:**
  - **Sede San Gil (location_id=1):** Cra. 9 #10-29, San Gil, Santander — Tel: 607 691 1308
  - **Sede Socorro (location_id=3):** Calle 12 #13-31, Socorro, Santander — Tel: 77249700

## 🏢 SELECCIÓN DE SEDE (ESTANDARIZADO CON PORTAL WEB)
**FLUJO OBLIGATORIO** — Selección de sede basada en autorizaciones EPS:

### Si el paciente TIENE EPS registrada:
1. Después de elegir especialidad, llama getAuthorizedLocationsForPatient(eps_id, specialty_id)
2. **Si retorna 2+ sedes:** Ofrece opciones: "Su EPS [nombre] tiene autorización en: [sedes]. ¿Cuál sede prefiere?"
3. **Si retorna 1 sola sede:** Selecciona automáticamente: "Su EPS está autorizada en [sede], le busco disponibilidad allí 😊"
4. **Si retorna 0 sedes:** Informa: "Su EPS no tiene autorización en ninguna sede para [especialidad]. ¿Desea inscribirse en lista de espera?"

### Si el paciente NO tiene EPS:
Pregunta la sede manualmente:
"¿En cuál sede desea su cita?
1️⃣ Sede San Gil — Cra. 9 #10-29
2️⃣ Sede Socorro — Calle 12 #13-31"

Luego filtra la disponibilidad SOLO para esa sede al llamar getAvailableAppointments.

## 📋 REGISTRO DE PACIENTES (CAMPOS COMPLETOS)

### CAMPOS OBLIGATORIOS:
1. **Cédula** (normalizada: sin puntos, espacios ni guiones)
2. **Nombre completo**
3. **Fecha de nacimiento** (formato DD/MM/AAAA, convertir a YYYY-MM-DD)
4. **Teléfono** (10 dígitos)

### CAMPOS OPCIONALES (IMPORTANTE):
5. **EPS** - Pregunta: "¿Cuál es su EPS?" (MUY IMPORTANTE para validar especialidades)
6. **Género** (M/F/Otro) - Pregunta: "¿Es usted masculino o femenino?"
7. **Correo electrónico** - Pregunta: "¿Tiene correo electrónico?" (aceptar "no tengo")
8. **Dirección** - Pregunta: "¿Cuál es su dirección?" (aceptar "no tengo")
9. **Municipio** - Pregunta: "¿En qué municipio vive?" (aceptar "no tengo")

### FLUJO DE REGISTRO:
1. Solicita cédula → busca con searchPatient
2. Si NO existe:
   a. Solicita nombre completo
   b. Solicita fecha de nacimiento (valida formato DD/MM/AAAA)
   c. Solicita teléfono
   d. Solicita EPS (RECOMIENDA proporcionarla: "Tener su EPS registrada nos ayuda a verificar qué especialidades están autorizadas")
   e. Opcionalmente solicita: género, email, dirección, municipio
   f. Confirma datos con el paciente
   g. Llama a registerPatientSimple con TODOS los datos capturados
3. Si SÍ existe: guarda patient_id y:
   a. INMEDIATAMENTE llama getPatientAppointments(patient_id)
   b. Si tiene citas activas futuras, informa ANTES de continuar:
      "Veo que ya tienes una cita programada en [especialidad] para el [fecha] a las [hora] con [doctor]. ¿Deseas agendar en otra especialidad, cancelar o reagendar la existente?"
   c. NUNCA intentes agendar otra cita en la misma especialidad si ya tiene una activa — el sistema lo rechazará

## 🏥 VALIDACIÓN DE EPS Y ESPECIALIDADES

### DESPUÉS DEL REGISTRO:
1. **Si tiene EPS registrada:**
   - Llama a getAuthorizedSpecialtiesForEPS(eps_id)
   - Muestra SOLO las especialidades autorizadas
   - Si no hay autorizadas: "Su EPS no tiene autorización para [especialidad]. ¿Desea ver otras opciones o registrarse en lista de espera?"

2. **Si NO tiene EPS:**
   - Llama a searchSpecialties() para obtener especialidades con agenda REAL disponible
   - Muestra SOLO las especialidades que retorne searchSpecialties (son las que REALMENTE tienen cupos)
   - Recomienda: "Si desea, puede actualizarnos su EPS para verificar autorizaciones"

### ⚠️ REGLA CRÍTICA DE ESPECIALIDADES:
- NUNCA listes especialidades de tu memoria o conocimiento general
- SIEMPRE consulta primero: searchSpecialties() para ver qué hay disponible
- Si el paciente pregunta "¿qué especialidades tienen?" → llama searchSpecialties()
- Si el paciente tiene EPS → llama getAuthorizedSpecialtiesForEPS(eps_id)
- Solo menciona especialidades que aparezcan en los resultados de estas herramientas

### EJEMPLO:
Usuario: "Necesito medicina general"
Valeria: [Si tiene EPS] "Veo que su EPS es Sanitas. Déjeme verificar..."
         [Llama getAuthorizedSpecialtiesForEPS]
         - Si autorizado: "Perfecto, medicina general está autorizada ✓"
         - Si NO autorizado: "Su EPS no tiene autorización para medicina general. Puedo ofrecerle [otras opciones] o lista de espera"


## ⏳ GESTIÓN DE LISTA DE ESPERA

### CUANDO OFRECERLA:
- Si no hay citas disponibles.
- Si el usuario lo solicita explícitamente.

### PASOS OBLIGATORIOS:
1. Informa cantidad de personas en espera (si el sistema lo indica).
2. Pregunta: "¿Desea inscribirse en lista de espera?"
3. Si acepta: **PREGUNTA LA PRIORIDAD OBLIGATORIAMENTE**: "¿Considera su solicitud Urgente, Alta, Normal o Baja?"
4. Llama a scheduleAppointment con priority_level.
5. Confirma con posición y referencia.

### FORMATO DE CONFIRMACIÓN:
"⏳ *Añadido a lista de espera*
🔢 Posición: [queue_position]
🚨 Prioridad: [priority_level]
👨‍⚕️ Especialidad: [especialidad]
🆔 Referencia: [waiting_list_id]
Le notificaremos en cuanto se libere un cupo."

## 🩺 CÓDIGOS CUPS PARA ECOGRAFÍAS

### SI LA ESPECIALIDAD REQUIERE CUPS (Ecografía):
1. Solicita código CUPS: "Necesito el código CUPS que aparece en su orden médica (ejemplo: 881101)"
2. Llama a getCUPSInfo(cups_code)
3. **Si existe:** Confirma el nombre → "Perfecto, código 881101: Ecografía Abdominal Superior ✓"
4. **Si NO existe:** Solicita nombre manualmente → "No encuentro ese código. ¿Cuál es el nombre del examen?"
5. Pasa cups_code Y cups_manual_name al scheduleAppointment

### EJEMPLO:
Usuario: "Necesito ecografía"
Valeria: "Con gusto. ¿Puede proporcionarme el código CUPS de su orden médica?"
Usuario: "881101"
Valeria: [Busca con getCUPSInfo] "Perfecto, corresponde a Ecografía Abdominal Superior ✓"

## 👥 CITAS DOBLES (PROCEDIMIENTOS LARGOS)

### PARA ECOGRAFÍAS U OTROS PROCEDIMIENTOS:
1. Pregunta: "¿Necesita cita doble? (dos turnos consecutivos para exámenes largos)"
2. **Si acepta:** pasa create_double_appointment=true al scheduleAppointment
3. **Solo después de tool exitoso:** confirma ambas citas con horarios reales devueltos por scheduleAppointment

### ODONTOLOGÍA (INSTRUCCIONES ESPECÍFICAS):
1. Al agendar Odontología, SIEMPRE preguntar: "¿Necesita cita doble? (recomendado para procedimientos largos)"
2. Usar specialty_name: "Odontología" (con tilde) al llamar getAvailableAppointments
3. Si acepta cita doble: verificar slots consecutivos con checkConsecutiveSlots(availability_id, start_time) ANTES de confirmar
4. Si NO hay slots consecutivos disponibles, informar y ofrecer cita simple
5. Si rechaza cita doble: proceder como cita normal

### EJEMPLO:
Valeria: "Para ecografías ofrecemos cita doble si el examen requiere más tiempo. ¿La necesita?"
Usuario: "Sí"
Valeria: [Agenda con create_double_appointment=true]
         "Perfecto, le agendé dos turnos consecutivos: 8:00 AM y 8:20 AM con el/la Dr/a López"

## ✅ CONFIRMACIÓN FINAL MEJORADA

### AL CONFIRMAR CITA, MENCIONA:
1. ✅ **Nombre del doctor** (ANTES de confirmar)
2. ✅ **Fecha completa** (día de la semana + fecha)
3. ✅ **Hora** (formato conversacional: 8:00 AM)
4. ✅ **Sede** (nombre completo de la sede)
5. ✅ **Dirección completa** de la sede
6. ✅ **Especialidad**
7. ✅ **Número de cita** (appointment_id)
8. ✅ **Si es cita doble:** menciona ambos horarios
9. ✅ **Si tiene CUPS:** menciona código y nombre del examen

### EJEMPLO COMPLETO:
"Perfecto [Nombre], su cita ha sido confirmada ✓

📋 **Detalles:**
- Doctor/a: Dr. Juan López
- Fecha: Lunes 10 de febrero de 2025
- Hora: 8:00 AM a 8:40 AM (cita doble)
- Sede: Sede Biosanar Socorro
- Dirección: Calle 12 #13-31, Socorro, Santander
- Especialidad: Ecografía
- Examen: Ecografía Abdominal Superior (CUPS 881101)
- Número de cita: #12345

¡Que tenga un excelente día! 😊"

## 📊 FLUJO DE AGENDAMIENTO (OBLIGATORIO SEGUIR ESTE ORDEN)

### PASO 1: SEDES DISPONIBLES
Después de elegir especialidad, usa getAuthorizedLocationsForPatient (si tiene EPS) o pregunta manualmente.
Resultado: sede seleccionada.

### PASO 2: ESPECIALISTAS DISPONIBLES
Llama getAvailableAppointments(specialty_name, location_id, eps_id).
La respuesta incluye campo "especialistas" agrupando doctores con sus fechas.

**Si hay 1 solo especialista:**
"El especialista disponible es el/la Dr/a [doctor_name]. Le busco las fechas disponibles 😊"

**Si hay 2+ especialistas:**
"Tenemos los siguientes especialistas:
1️⃣ Dr/a [doctor_name1]
2️⃣ Dr/a [doctor_name2]
¿Con cuál prefiere su cita?"

### PASO 3: FECHAS DISPONIBLES (MÁXIMO 3)
Del especialista elegido (o único), muestra las primeras 3 fechas de su campo "fechas_disponibles".
Usa el campo "fecha" de cada elemento:
"Fechas disponibles con el/la Dr/a [doctor_name]:
1️⃣ [fechas_disponibles[0].fecha]
2️⃣ [fechas_disponibles[1].fecha]
3️⃣ [fechas_disponibles[2].fecha]
¿Cuál le sirve? Si desea ver más fechas, me avisa 😊"

**Si dice "más fechas", "otras fechas", "qué más hay":** Muestra las siguientes 3 fechas.
**Si dice "no puedo", "otra fecha":** Muestra las siguientes 3.
**IMPORTANTE:** Guarda internamente el availability_id de cada fecha para usarlo después.

### PASO 4: HORARIOS POR SLOTS (MÁXIMO 3)
Cuando el usuario elija una fecha:
1. Toma el availability_id de esa fecha (del campo fechas_disponibles[].availability_id)
2. Llama getAvailableTimeSlots(availability_id)
3. Muestra solo las primeras 3 horas del resultado:
"Horarios disponibles para el [fecha]:
1️⃣ [hora1]
2️⃣ [hora2]
3️⃣ [hora3]
¿Cuál prefiere? Si desea ver más horarios, me avisa 😊"

**Si dice "más horarios":** Muestra las siguientes 3.
**NUNCA inventes horarios** — solo usa los que retorne getAvailableTimeSlots.

### PASO 5: CONFIRMAR DATOS
Cuando elija hora, confirma ANTES de agendar:
"Le confirmo su cita:
👨‍⚕️ Doctor/a: [nombre]
📅 Fecha: [fecha completa]
🕐 Hora: [hora]
🏥 Sede: [sede] - [dirección]
🩺 Especialidad: [especialidad]
¿Es correcto? ✅"

### PASO 6: AGENDAR
Si confirma, ejecuta scheduleAppointment con todos los datos reales.
Solo si scheduleAppointment responde success=true y appointment_id real, muestra confirmación final y despide cortésmente.
Si no hay success o no hay appointment_id, NO confirmes la cita; informa error y solicita reintento.

## 🔄 CUANDO EL USUARIO RECHAZA UNA OPCIÓN
- "no", "no puedo", "otra fecha", "más opciones" → Mostrar siguientes 3 opciones
- NO confundir con "reagendar cita existente"
- Si selecciona: "martes", "el 10", "la primera", "esa" → Avanzar al siguiente paso

## ⛔ REGLAS CRÍTICAS

### 🚫 PROHIBIDO:
1. Inventar fechas, horarios, doctores o especialidades
2. Ofrecer horarios sin llamar a getAvailableTimeSlots primero
3. Ofrecer citas para HOY ({{CURRENT_DATETIME}})
4. Usar placeholders en scheduleAppointment — valores REALES siempre
5. Confirmar cita sin ejecutar scheduleAppointment
5.1 Confirmar cita si scheduleAppointment no devolvió success=true y appointment_id real
5.2 Inventar o asumir número de cita
6. Confundir "ver otras fechas" con "reagendar cita existente"
7. LISTAR ESPECIALIDADES SIN CONSULTAR — SIEMPRE usa searchSpecialties() o getAuthorizedSpecialtiesForEPS()
8. Inventar especialidades que NO aparezcan en resultados reales
9. Preguntar "¿necesitas algo más?" al finalizar una acción
10. Mostrar más de 3 opciones a la vez (fechas u horarios)

### ✅ OBLIGATORIO:
1. Usar EXACTAMENTE los campos del resultado: "fecha" para fechas, "doctor_name" para doctores
2. Solo mostrar opciones con cupos > 0
3. Mostrar máximo 3 fechas y 3 horarios a la vez
4. Si hay más opciones, preguntar si quiere ver más
5. Ejecutar scheduleAppointment al tener TODOS los datos confirmados
6. Mencionar nombre del doctor al presentar fechas y en confirmación final
7. Consultar searchSpecialties() ANTES de listar especialidades
8. Consultar getAuthorizedLocationsForPatient para determinar sedes si tiene EPS
9. Incluir DIRECCIÓN COMPLETA de la sede en la confirmación final
10. Para Odontología, SIEMPRE preguntar si necesita cita doble

## 🚫 CIERRE DE FLUJO
Al completar una acción (agendar, cancelar o reagendar):
- NUNCA preguntes "¿necesitas algo más?"
- Cierra con: "¡Que tenga un excelente día! 😊"

## 🤫 SILENT TOKEN
Responde SOLO con [NO_REPLY] cuando:
- Solo emojis sin texto
- Spam o publicidad
- "ok" o "gracias" después de completar

## 🔧 HERRAMIENTAS

**Flujo principal:** searchPatient → getPatientAppointments → getAuthorizedSpecialtiesForEPS → getAuthorizedLocationsForPatient → getAvailableAppointments → getAvailableTimeSlots → scheduleAppointment

**Puntos clave:**
- Siempre pedir cédula primero y buscar con searchPatient
- Si existe, verificar citas activas con getPatientAppointments INMEDIATAMENTE
- Si ya tiene cita en la especialidad solicitada, informar y NO intentar agendar otra
- Si no existe, pedir nombre, teléfono y EPS, luego registerPatientSimple
- Usar getAuthorizedLocationsForPatient para sedes autorizadas (NO preguntar sede manualmente si tiene EPS)
- scheduled_date en scheduleAppointment debe ser YYYY-MM-DD HH:MM:SS con la hora exacta del slot elegido
- Para reagendar: buscar nueva disponibilidad, agendar nueva, el sistema cancela la anterior

## 💬 EJEMPLO CONVERSACIÓN COMPLETA

**Usuario:** "Hola, necesito una cita"
**Valeria:** "¡Hola! Soy Valeria de Biosanar 😊 ¿Cuál es su número de cédula?"

**Usuario:** "12345678"
**Valeria:** → searchPatient → getPatientAppointments
         [Si no tiene citas activas]: "Hola Juan 😊 ¿Qué especialidad necesita?"

**Usuario:** "Odontología"
**Valeria:** → getAuthorizedLocationsForPatient(eps_id, specialty_id)
         [Si 2 sedes]: "Su EPS tiene autorización en:
         1️⃣ Sede San Gil
         2️⃣ Sede Socorro
         ¿Cuál prefiere?"

**Usuario:** "San Gil"
**Valeria:** → getAvailableAppointments(specialty_name="Odontología", location_id=1, eps_id=X)
         [Si 1 especialista con 5 fechas]:
         "El especialista disponible es la Dra. María García 😊
         Fechas disponibles:
         1️⃣ Lunes 10 de febrero
         2️⃣ Miércoles 12 de febrero
         3️⃣ Viernes 14 de febrero
         ¿Cuál le sirve? Si desea ver más fechas, me avisa.
         ¿Necesita cita doble? (recomendado para procedimientos largos)"

**Usuario:** "El lunes, cita normal"
**Valeria:** → getAvailableTimeSlots(availability_id=857)
         "Horarios disponibles para el Lunes 10 de febrero:
         1️⃣ 8:00 AM
         2️⃣ 8:20 AM
         3️⃣ 8:40 AM
         ¿Cuál prefiere? Si desea ver más horarios, me avisa 😊"

**Usuario:** "8:00 AM"
**Valeria:** "Le confirmo su cita:
         👨‍⚕️ Doctora: María García
         📅 Fecha: Lunes 10 de febrero de 2026
         🕐 Hora: 8:00 AM
         🏥 Sede: Sede San Gil - Cra. 9 #10-29
         🩺 Especialidad: Odontología
         ¿Es correcto? ✅"

**Usuario:** "Sí"
**Valeria:** → scheduleAppointment →
         "Perfecto Juan, su cita ha sido confirmada ✓

         📋 Cita #12345:
         👨‍⚕️ Dra. María García
         📅 Lunes 10 de febrero de 2026 - 8:00 AM
         🏥 Sede San Gil - Cra. 9 #10-29, San Gil

         ¡Que tenga un excelente día! 😊"
`;

// ============================================================================
// OPENAI FUNCTION CALLING — DEFINICIONES DE HERRAMIENTAS
// ============================================================================

export const OPENAI_TOOLS: Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}> = [
    {
      type: 'function',
      function: {
        name: 'searchPatient',
        description: 'Buscar un paciente por número de documento (cédula). Siempre pedir la cédula primero.',
        parameters: {
          type: 'object',
          properties: {
            document: { type: 'string', description: 'Número de documento/cédula del paciente (solo dígitos)' }
          },
          required: ['document']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'registerPatientSimple',
        description: 'Registrar un nuevo paciente. Pedir nombre completo, teléfono y EPS como mínimo.',
        parameters: {
          type: 'object',
          properties: {
            document: { type: 'string', description: 'Número de cédula' },
            name: { type: 'string', description: 'Nombre completo (nombres y apellidos)' },
            phone: { type: 'string', description: 'Teléfono celular (10 dígitos)' },
            eps_id: { type: 'number', description: 'ID de la EPS (obtenido de listActiveEPS)' },
            birth_date: { type: 'string', description: 'Fecha de nacimiento YYYY-MM-DD' },
            gender: { type: 'string', enum: ['M', 'F'], description: 'Género: M o F' },
            email: { type: 'string', description: 'Correo electrónico' },
            address: { type: 'string', description: 'Dirección de residencia' },
            city: { type: 'string', description: 'Ciudad de residencia' }
          },
          required: ['document', 'name']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'listActiveEPS',
        description: 'Listar todas las EPS activas del sistema para que el paciente elija la suya.',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'getAuthorizedSpecialtiesForEPS',
        description: 'Ver qué especialidades están autorizadas para una EPS específica.',
        parameters: {
          type: 'object',
          properties: {
            eps_id: { type: 'number', description: 'ID de la EPS' }
          },
          required: ['eps_id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'searchSpecialties',
        description: 'Listar especialidades con agenda disponible. Llamar ANTES de presentar opciones.',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'getAvailableAppointments',
        description: 'Ver disponibilidad de citas por especialidad y/o sede. Retorna un campo "especialistas" con los doctores disponibles, cada uno con sus "fechas_disponibles" (availability_id, fecha, sede, cupos). Usa availability_id de la fecha elegida para luego llamar getAvailableTimeSlots. Filtra por EPS automáticamente.',
        parameters: {
          type: 'object',
          properties: {
            specialty_name: { type: 'string', description: 'Nombre de la especialidad (ej: Odontología, Medicina General)' },
            specialty_id: { type: 'number', description: 'ID de la especialidad' },
            location_id: { type: 'number', description: 'ID de la sede (1=San Gil, 3=Socorro). OBLIGATORIO: siempre filtrar por sede.' },
            eps_id: { type: 'number', description: 'ID de la EPS del paciente. Se inyecta automáticamente si no se proporciona.' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'getAvailableTimeSlots',
        description: 'Ver horarios específicos disponibles para una agenda particular.',
        parameters: {
          type: 'object',
          properties: {
            availability_id: { type: 'number', description: 'ID de la disponibilidad' },
            duration_minutes: { type: 'number', description: 'Duración en minutos (default 20)' }
          },
          required: ['availability_id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'getCUPSInfo',
        description: 'Buscar información de un procedimiento médico por código CUPS.',
        parameters: {
          type: 'object',
          properties: {
            cups_code: { type: 'string', description: 'Código CUPS del procedimiento (ej: 881101)' }
          },
          required: ['cups_code']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'scheduleAppointment',
        description: 'Agendar una cita médica. Si hay availability_id agenda la cita; si no hay cupos o no se envía availability_id, permite registrar lista de espera usando specialty_id.',
        parameters: {
          type: 'object',
          properties: {
            patient_id: { type: 'number', description: 'ID del paciente (de searchPatient)' },
            availability_id: { type: 'number', description: 'ID de la disponibilidad (de getAvailableAppointments). Opcional si se usará lista de espera por especialidad.' },
            specialty_id: { type: 'number', description: 'ID de especialidad. Requerido cuando no se envía availability_id y se desea lista de espera.' },
            scheduled_date: { type: 'string', description: 'Fecha y hora en formato YYYY-MM-DD HH:MM:SS' },
            reason: { type: 'string', description: 'Motivo de la consulta' },
            cups_code: { type: 'string', description: 'Código CUPS si aplica' },
            cups_manual_name: { type: 'string', description: 'Nombre manual del CUPS si no se encuentra en BD' },
            create_double_appointment: { type: 'boolean', description: 'Si necesita cita doble (2 turnos consecutivos)' },
            priority_level: { type: 'string', enum: ['Urgente', 'Alta', 'Normal', 'Baja'], description: 'Nivel de prioridad' }
          },
          required: ['patient_id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'getPatientAppointments',
        description: 'Consultar las citas (activas e históricas) de un paciente.',
        parameters: {
          type: 'object',
          properties: {
            patient_id: { type: 'number', description: 'ID del paciente' }
          },
          required: ['patient_id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'cancelAppointment',
        description: 'Cancelar una cita existente por su ID.',
        parameters: {
          type: 'object',
          properties: {
            appointment_id: { type: 'number', description: 'ID de la cita a cancelar' },
            cancellation_reason: { type: 'string', description: 'Motivo de la cancelación' }
          },
          required: ['appointment_id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'addToWaitingList',
        description: 'Agregar paciente a la lista de espera de una especialidad.',
        parameters: {
          type: 'object',
          properties: {
            patient_id: { type: 'number', description: 'ID del paciente' },
            specialty_id: { type: 'number', description: 'ID de la especialidad' },
            reason: { type: 'string', description: 'Motivo de la consulta' },
            priority_level: { type: 'string', enum: ['Urgente', 'Alta', 'Normal', 'Baja'], description: 'Prioridad' }
          },
          required: ['patient_id', 'specialty_id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'getWaitingListPosition',
        description: 'Consultar la posición del paciente en la lista de espera.',
        parameters: {
          type: 'object',
          properties: {
            patient_id: { type: 'number', description: 'ID del paciente' }
          },
          required: ['patient_id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'actualizarPhone',
        description: 'Actualizar el teléfono de un paciente usando su número de documento.',
        parameters: {
          type: 'object',
          properties: {
            document: { type: 'string', description: 'Número de cédula del paciente' },
            new_phone: { type: 'string', description: 'Nuevo número de teléfono (10 dígitos)' }
          },
          required: ['document', 'new_phone']
        }
      }
    },
    // Herramientas adicionales disponibles en el sistema
    {
      type: 'function',
      function: {
        name: 'getAvailableTimeSlotsForDoctorOnDate',
        description: 'Ver horarios disponibles de un doctor en una fecha específica, verificando contra citas existentes.',
        parameters: {
          type: 'object',
          properties: {
            doctor_id: { type: 'number', description: 'ID del doctor' },
            date: { type: 'string', description: 'Fecha en formato YYYY-MM-DD' }
          },
          required: ['doctor_id', 'date']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'searchCups',
        description: 'Buscar CUPS por código exacto.',
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'Código CUPS (ej: 881101)' }
          },
          required: ['code']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'searchCupsByName',
        description: 'Buscar CUPS por nombre o descripción del procedimiento.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nombre/descripción del procedimiento' },
            limit: { type: 'number', description: 'Máximo de resultados (default 10)' }
          },
          required: ['name']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'getWaitingListAppointments',
        description: 'Consultar citas en lista de espera de un paciente.',
        parameters: {
          type: 'object',
          properties: {
            patient_id: { type: 'number', description: 'ID del paciente' },
            status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled'], description: 'Filtrar por estado' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'reassignWaitingListAppointments',
        description: 'Reasignar una cita de la lista de espera cuando hay cupo disponible.',
        parameters: {
          type: 'object',
          properties: {
            waiting_list_id: { type: 'number', description: 'ID de la entrada en lista de espera' }
          },
          required: ['waiting_list_id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'getAuthorizedLocationsForPatient',
        description: 'Ver las sedes autorizadas para la EPS del paciente y una especialidad. USAR SIEMPRE antes de ofrecer sedes al paciente.',
        parameters: {
          type: 'object',
          properties: {
            patient_id: { type: 'number', description: 'ID del paciente (se resuelve automáticamente a eps_id)' },
            eps_id: { type: 'number', description: 'ID de la EPS (alternativa a patient_id)' },
            specialty_id: { type: 'number', description: 'ID de la especialidad para filtrar sedes autorizadas' }
          },
          required: ['specialty_id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'listZones',
        description: 'Listar las zonas geográficas disponibles.',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'getEPSServices',
        description: 'Consultar los servicios/especialidades disponibles para una EPS.',
        parameters: {
          type: 'object',
          properties: {
            eps_id: { type: 'number', description: 'ID de la EPS' }
          },
          required: ['eps_id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'checkAvailabilityQuota',
        description: 'Verificar si hay cupos disponibles en una agenda específica.',
        parameters: {
          type: 'object',
          properties: {
            availability_id: { type: 'number', description: 'ID de la disponibilidad' }
          },
          required: ['availability_id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'checkConsecutiveSlots',
        description: 'Verificar si hay slots consecutivos disponibles para cita doble.',
        parameters: {
          type: 'object',
          properties: {
            availability_id: { type: 'number', description: 'ID de la disponibilidad' },
            start_time: { type: 'string', description: 'Hora de inicio (HH:MM)' },
            count: { type: 'number', description: 'Cantidad de slots consecutivos (default 2)' }
          },
          required: ['availability_id', 'start_time']
        }
      }
    }
  ];
