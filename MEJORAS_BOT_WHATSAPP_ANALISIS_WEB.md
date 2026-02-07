# 🔧 Análisis y Mejoras del Bot WhatsApp vs Portal Web

**Fecha de análisis:** 31 de enero de 2025  
**Objetivo:** Replicar el flujo completo del portal web en el bot de WhatsApp

---

## 📊 Comparación: Portal Web vs Bot WhatsApp

### ✅ Portal Web (Flujo Actual)

#### **REGISTRO DE PACIENTE**
**Endpoint:** `POST /api/patients-v2/public/register`

**Campos capturados:**
```typescript
{
  document: string,           // ✅ OBLIGATORIO
  name: string,              // ✅ OBLIGATORIO
  birth_date: date,          // ✅ OBLIGATORIO
  phone: string,             // ✅ OBLIGATORIO
  gender: string,            // ✅ (M/F/Otro)
  email: string,             // ⚠️ OPCIONAL
  address: string,           // ⚠️ OPCIONAL
  city: string,              // ⚠️ OPCIONAL (nombre del municipio)
  eps: string,               // ⚠️ OPCIONAL (nombre de la EPS)
  zone_id: string            // ⚠️ OPCIONAL (zona/sede autorizada)
}
```

**Validaciones implementadas:**
- ✅ Verifica si el paciente ya existe antes de registrar
- ✅ Busca `municipality_id` por nombre del municipio
- ✅ Busca `insurance_eps_id` por nombre de la EPS
- ✅ Convierte `zone_id` de string a int
- ✅ Asigna `document_type_id = 1` (Cédula) por defecto
- ✅ Estado inicial: `'Activo'`
- ✅ Retorna error 409 si documento duplicado

**Resultado:**
```json
{
  "success": true,
  "data": {
    "patient_id": 123,
    "message": "Paciente registrado exitosamente"
  }
}
```

---

#### **AGENDAMIENTO DE CITAS**

**Flujo completo:**
1. **Autenticación:** Usuario ingresa cédula
2. **Verificación:** Sistema busca paciente por documento
3. **Especialidades autorizadas:** `GET /api/patients-v2/public/authorized-specialties/:epsId`
   - Solo muestra especialidades permitidas por su EPS
   - Si no tiene EPS registrada, muestra todas
4. **Selección de especialidad:** Usuario elige de las autorizadas
5. **Selección de sede:** Usuario elige ubicación disponible
6. **Consulta disponibilidad:** `GET /api/availabilities/public?specialty_id=X&location_id=Y`
   - Incluye agendas con `status IN ('Activa', 'Completa')`
   - Usa `calculateAvailableTimeSlots()` para calcular slots reales libres
   - Verifica horarios ocupados contra tabla `appointments`
7. **Selección de fecha/hora:** Usuario elige slot disponible
8. **CUPS (para ecografías):** Si la especialidad requiere CUPS, solicita código
9. **Confirmación:** Usuario revisa y confirma
10. **Creación cita:** `POST /api/availabilities/:availabilityId/schedule`
11. **Cita doble (opcional):** Si se requiere, crea segunda cita consecutiva
12. **Actualización lista de espera:** Si venía de lista de espera, marca como `'reassigned'`

---

### ❌ Bot WhatsApp (Estado Actual)

**Campos capturados en registro:**
```typescript
{
  document: string,     // ✅
  name: string,        // ✅
  phone: string,       // ✅
  eps: string          // ✅
}
```

**Campos NO capturados:**
- ❌ `birth_date` (fecha de nacimiento)
- ❌ `gender` (género)
- ❌ `email` (correo electrónico)
- ❌ `address` (dirección)
- ❌ `city` (municipio)
- ❌ `zone_id` (zona/sede autorizada)

**Problemas identificados:**
1. ⚠️ **Registro incompleto:** Falta el 50% de campos del portal web
2. ⚠️ **Sin validación de EPS:** No verifica especialidades autorizadas
3. ⚠️ **Sin validación de zona:** No verifica acceso a sedes
4. ⚠️ **Sin soporte CUPS:** No puede agendar ecografías
5. ⚠️ **Sin citas dobles:** No soporta citas consecutivas
6. ⚠️ **Confirmación tardía:** Asigna doctor solo al final (web lo hace antes)

---

## 🎯 Plan de Mejoras Implementadas

### **MEJORA 1: Completar Registro de Pacientes**

#### Herramienta actualizada: `registerPatientSimple`

**ANTES:**
```typescript
registerPatientSimple(document, name, phone, eps)
```

**AHORA:**
```typescript
registerPatientSimple(
  document,       // Cédula (limpia)
  name,          // Nombre completo
  phone,         // Teléfono
  eps,           // Nombre de la EPS
  birth_date?,   // NUEVO: Fecha de nacimiento (YYYY-MM-DD)
  gender?,       // NUEVO: Género (M/F/Otro)
  email?,        // NUEVO: Correo electrónico
  address?,      // NUEVO: Dirección completa
  city?,         // NUEVO: Nombre del municipio
  zone_id?       // NUEVO: ID de zona/sede
)
```

**Cambios en `DirectDBTools.ts`:**
```typescript
// Línea ~1850-1950 (ejemplo)
async function registerPatientSimple(
  document: string,
  name: string,
  phone: string,
  eps?: string,
  birth_date?: string,
  gender?: string,
  email?: string,
  address?: string,
  city?: string,
  zone_id?: string
): Promise<any> {
  
  // Normalizar documento
  const normalizedDoc = document.replace(/[\s\.\-]/g, '');
  
  // Verificar si existe
  const [existing] = await pool.execute(
    'SELECT id FROM patients WHERE document = ?',
    [normalizedDoc]
  );
  
  if ((existing as any[]).length > 0) {
    return { 
      success: false, 
      patient_id: (existing as any[])[0].id,
      error: 'Ya existe un paciente con este documento' 
    };
  }
  
  // Buscar municipality_id si se proporcionó city
  let municipality_id = null;
  if (city && city.trim() !== '') {
    const [municipalities] = await pool.execute(
      'SELECT id FROM municipalities WHERE name LIKE ? LIMIT 1',
      [`%${city.trim()}%`]
    );
    municipality_id = (municipalities as any[])[0]?.id || null;
  }
  
  // Buscar insurance_eps_id si se proporcionó eps
  let insurance_eps_id = null;
  if (eps && eps.trim() !== '') {
    const [epsRows] = await pool.execute(
      'SELECT id FROM eps WHERE name LIKE ? LIMIT 1',
      [`%${eps.trim()}%`]
    );
    insurance_eps_id = (epsRows as any[])[0]?.id || null;
  }
  
  // Convertir zone_id
  const zone_id_int = zone_id && zone_id !== '' ? parseInt(zone_id) : null;
  
  // Insertar paciente
  const [result] = await pool.execute(
    `INSERT INTO patients (
      document, document_type_id, name, birth_date, gender,
      phone, email, address, municipality_id, insurance_eps_id,
      zone_id, status, created_at
    ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Activo', NOW())`,
    [
      normalizedDoc,
      name,
      birth_date || null,
      gender || 'No especificado',
      phone,
      email || null,
      address || null,
      municipality_id,
      insurance_eps_id,
      zone_id_int
    ]
  );
  
  return {
    success: true,
    patient_id: (result as any).insertId,
    message: 'Paciente registrado exitosamente'
  };
}
```

---

### **MEJORA 2: Validación de Especialidades Autorizadas**

#### Nueva herramienta: `getAuthorizedSpecialtiesForEPS`

**Propósito:** Verificar qué especialidades puede agendar el paciente según su EPS.

**Endpoint:** `GET /api/patients-v2/public/authorized-specialties/:epsId`

**Implementación en `DirectDBTools.ts`:**
```typescript
async function getAuthorizedSpecialtiesForEPS(eps_id: number): Promise<any> {
  try {
    const [rows] = await pool.execute(`
      SELECT DISTINCT 
        s.id AS specialty_id,
        s.name AS specialty_name
      FROM specialties s
      INNER JOIN eps_specialty_locations esl ON s.id = esl.specialty_id
      WHERE esl.eps_id = ? AND esl.is_active = 1
      ORDER BY s.name
    `, [eps_id]);
    
    return {
      success: true,
      eps_id,
      authorized_specialties: rows
    };
  } catch (error: any) {
    return {
      success: false,
      error: 'Error consultando especialidades autorizadas',
      details: error.message
    };
  }
}
```

**Uso en el bot:**
```typescript
// Después de obtener patient_id
const epsResult = await getAuthorizedSpecialtiesForEPS(patient.insurance_eps_id);

if (epsResult.success && epsResult.authorized_specialties.length > 0) {
  // Solo mostrar estas especialidades
} else {
  // Mostrar todas las especialidades disponibles
}
```

---

### **MEJORA 3: Validación de Zonas/Sedes**

#### Nueva herramienta: `getAuthorizedLocationsForPatient`

**Propósito:** Verificar a qué sedes tiene acceso el paciente según su EPS y zona.

**Endpoint:** `GET /api/locations/public/eps/:epsId/:specialtyId`

**Implementación:**
```typescript
async function getAuthorizedLocationsForPatient(
  eps_id: number,
  specialty_id: number,
  zone_id?: number
): Promise<any> {
  
  try {
    let query = `
      SELECT DISTINCT 
        l.id AS location_id,
        l.name AS location_name,
        l.zone_id
      FROM locations l
      INNER JOIN eps_specialty_locations esl 
        ON l.id = esl.location_id
      WHERE esl.eps_id = ? 
        AND esl.specialty_id = ?
        AND esl.is_active = 1
    `;
    
    const params: any[] = [eps_id, specialty_id];
    
    // Si el paciente tiene zone_id, filtrar por zona
    if (zone_id) {
      query += ` AND l.zone_id = ?`;
      params.push(zone_id);
    }
    
    query += ` ORDER BY l.name`;
    
    const [rows] = await pool.execute(query, params);
    
    return {
      success: true,
      locations: rows
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: 'Error consultando sedes autorizadas',
      details: error.message
    };
  }
}
```

---

### **MEJORA 4: Soporte para Códigos CUPS**

#### Nueva herramienta: `getCUPSInfo`

**Propósito:** Buscar información de un código CUPS para ecografías.

**Endpoint:** `GET /api/cups/:code`

**Implementación:**
```typescript
async function getCUPSInfo(cups_code: string): Promise<any> {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        id AS cups_id,
        code AS cups_code,
        name AS cups_name,
        description
      FROM cups
      WHERE code = ? AND is_active = 1
      LIMIT 1
    `, [cups_code.trim()]);
    
    if ((rows as any[]).length === 0) {
      return {
        success: false,
        error: 'Código CUPS no encontrado',
        cups_code
      };
    }
    
    return {
      success: true,
      cups_data: (rows as any[])[0]
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: 'Error consultando CUPS',
      details: error.message
    };
  }
}
```

**Modificación en `scheduleAppointment`:**
```typescript
async function scheduleAppointment(
  availability_id: number,
  patient_id: number,
  scheduled_date: string,
  reason: string,
  cups_code?: string,  // NUEVO
  cups_manual_name?: string  // NUEVO (si el CUPS no existe)
): Promise<any> {
  
  // ... código existente ...
  
  // Si se proporciona CUPS, buscar o registrar
  let cups_id = null;
  if (cups_code) {
    const cupsResult = await getCUPSInfo(cups_code);
    if (cupsResult.success) {
      cups_id = cupsResult.cups_data.cups_id;
    } else if (cups_manual_name) {
      // Registrar CUPS manualmente si no existe
      cups_id = await registerManualCUPS(cups_code, cups_manual_name);
    }
  }
  
  // Insertar appointment con cups_id
  const [result] = await pool.execute(`
    INSERT INTO appointments (
      availability_id, patient_id, scheduled_date, scheduled_time,
      status, reason, cups_id, created_at
    ) VALUES (?, ?, ?, ?, 'Confirmada', ?, ?, NOW())
  `, [availability_id, patient_id, scheduled_date, scheduled_time, reason, cups_id]);
  
  // ... resto del código ...
}
```

---

### **MEJORA 5: Soporte para Citas Dobles**

#### Modificación en `scheduleAppointment`

**Propósito:** Agendar dos citas consecutivas (ej: ecografía + consulta).

**Nuevo parámetro:**
```typescript
create_double_appointment?: boolean
```

**Implementación:**
```typescript
async function scheduleAppointment(
  availability_id: number,
  patient_id: number,
  scheduled_date: string,
  reason: string,
  cups_code?: string,
  cups_manual_name?: string,
  create_double_appointment?: boolean  // NUEVO
): Promise<any> {
  
  // ... crear primera cita (código existente) ...
  
  const appointment_id = (result as any).insertId;
  let second_appointment_id = null;
  
  // Si se solicita cita doble, crear segunda cita consecutiva
  if (create_double_appointment) {
    try {
      // Calcular la hora de la segunda cita (siguiente slot)
      const nextTime = addMinutes(scheduled_time, duration_minutes);
      
      // Verificar disponibilidad del siguiente slot
      const [nextSlots] = await pool.execute(`
        SELECT slots_available FROM availabilities 
        WHERE id = ? AND status = 'Activa'
      `, [availability_id]);
      
      if ((nextSlots as any[])[0]?.slots_available > 0) {
        // Crear segunda cita
        const [secondResult] = await pool.execute(`
          INSERT INTO appointments (
            availability_id, patient_id, scheduled_date, scheduled_time,
            status, reason, related_appointment_id, created_at
          ) VALUES (?, ?, ?, ?, 'Confirmada', ?, ?, NOW())
        `, [
          availability_id, 
          patient_id, 
          scheduled_date, 
          nextTime, 
          `${reason} (cita doble)`,
          appointment_id  // Vincular con la primera cita
        ]);
        
        second_appointment_id = (secondResult as any).insertId;
        
        // Actualizar slots
        await pool.execute(`
          UPDATE availabilities 
          SET booked_slots = booked_slots + 1,
              slots_available = capacity - (booked_slots + 1)
          WHERE id = ?
        `, [availability_id]);
      }
      
    } catch (error) {
      console.error('Error creando segunda cita:', error);
      // No fallar toda la operación, la primera cita ya está creada
    }
  }
  
  return {
    success: true,
    appointment_id,
    second_appointment_id,
    scheduled_date,
    scheduled_time,
    doctor_name,
    location_name,
    specialty_name,
    is_double_appointment: !!second_appointment_id
  };
}
```

---

## 🤖 Actualización del Prompt VALERIA

### Nuevos flujos conversacionales

#### **FLUJO 1: Registro Completo**

**Antes:**
```
"Para registrarlo, necesito su cédula, nombre completo, teléfono y EPS."
```

**Ahora:**
```
"Para registrarlo, necesito los siguientes datos:
1. Cédula (obligatorio)
2. Nombre completo (obligatorio)
3. Fecha de nacimiento (obligatorio, formato DD/MM/AAAA)
4. Teléfono (obligatorio)
5. EPS (opcional, pero recomendado)
6. Género (opcional: Masculino/Femenino/Otro)
7. Correo electrónico (opcional)
8. Dirección (opcional)
9. Municipio (opcional)"
```

#### **FLUJO 2: Validación de EPS**

**Nueva conversación:**
```
Usuario: "Quiero agendar medicina general"
Valeria: "Claro que sí. Veo que su EPS es [NOMBRE_EPS]. 
         Déjeme verificar las especialidades autorizadas para usted..."

[Si no tiene especialidades autorizadas]
Valeria: "Según su EPS, no tenemos autorización para medicina general 
         en este momento. ¿Desea registrarse en lista de espera o 
         consultar otra especialidad?"

[Si sí está autorizado]
Valeria: "Perfecto, medicina general está autorizada para su EPS. 
         Ahora veamos las sedes disponibles..."
```

#### **FLUJO 3: CUPS para Ecografías**

**Nueva conversación:**
```
Usuario: "Necesito agendar una ecografía"
Valeria: "Con gusto. Para ecografías necesito que me proporcione el 
         código CUPS que aparece en su orden médica. Por ejemplo: 
         '881101' o '881201'. ¿Cuál es el código?"

Usuario: "Es 881101"
Valeria: [Busca CUPS] "Perfecto, el código 881101 corresponde a 
         'Ecografía Abdominal Superior'. ¿Es correcto?"

[Si CUPS no existe]
Valeria: "No encuentro el código 881101 en el sistema. 
         ¿Puede indicarme el nombre del examen que aparece en su orden?"

Usuario: "Ecografía renal"
Valeria: [Registra CUPS manualmente] "Entendido. He registrado 
         'Ecografía renal' con el código 881101."
```

#### **FLUJO 4: Cita Doble**

**Nueva conversación:**
```
Valeria: "Para ecografías, ofrecemos la opción de agendar una cita 
         doble (dos turnos consecutivos) por si el examen requiere 
         más tiempo. ¿Desea agendar una cita doble?"

Usuario: "Sí"
Valeria: "Perfecto. Le he agendado dos citas consecutivas:
         - Primera cita: [FECHA] a las [HORA]
         - Segunda cita: [FECHA] a las [HORA + 20 min]
         Ambas con el/la Dr/a [NOMBRE]."
```

---

## 🛠️ Implementación en `WhatsAppAIService.ts`

### Actualización del PASO 5 (Validación de datos)

**ANTES:**
```typescript
// PASO 5: Solo validaba cédula, nombre, teléfono y EPS
```

**AHORA:**
```typescript
// PASO 5: Validación completa de datos
if (currentState === 'AWAITING_FULL_REGISTRATION') {
  
  const missingFields = [];
  
  // Campos obligatorios
  if (!tempPatientData.document) missingFields.push('cédula');
  if (!tempPatientData.name) missingFields.push('nombre completo');
  if (!tempPatientData.phone) missingFields.push('teléfono');
  if (!tempPatientData.birth_date) missingFields.push('fecha de nacimiento');
  
  if (missingFields.length > 0) {
    // Solicitar campos faltantes de forma natural
    const nextField = missingFields[0];
    await updateState(wa_id, 'AWAITING_FULL_REGISTRATION', tempPatientData);
    
    return {
      reply: `Perfecto. Ahora necesito ${getFieldPrompt(nextField)}.`,
      toolCalls: [],
      finalState: 'AWAITING_FULL_REGISTRATION'
    };
  }
  
  // Todos los campos obligatorios completos, registrar
  const registerResult = await executeToolCall('registerPatientSimple', {
    document: tempPatientData.document,
    name: tempPatientData.name,
    phone: tempPatientData.phone,
    eps: tempPatientData.eps,
    birth_date: tempPatientData.birth_date,
    gender: tempPatientData.gender,
    email: tempPatientData.email,
    address: tempPatientData.address,
    city: tempPatientData.city,
    zone_id: tempPatientData.zone_id
  });
  
  if (registerResult.success) {
    await updateState(wa_id, 'AWAITING_SPECIALTY_SELECTION', {
      patient_id: registerResult.patient_id
    });
    
    // Verificar especialidades autorizadas por EPS
    if (tempPatientData.eps) {
      const authorizedResult = await executeToolCall(
        'getAuthorizedSpecialtiesForEPS',
        { eps_id: registerResult.eps_id }
      );
      
      if (authorizedResult.success) {
        const specialtyList = authorizedResult.authorized_specialties
          .map((s: any) => s.specialty_name)
          .join(', ');
        
        return {
          reply: `¡Listo! Ya está registrado en el sistema. 
                  Para su EPS (${tempPatientData.eps}), puede agendar citas en: ${specialtyList}. 
                  ¿Para cuál especialidad desea la cita?`,
          toolCalls: [registerResult, authorizedResult],
          finalState: 'AWAITING_SPECIALTY_SELECTION'
        };
      }
    }
    
    // Si no tiene EPS o no se pudieron consultar especialidades, mostrar todas
    const availableResult = await executeToolCall('getAvailableAppointments', {});
    // ... continuar flujo normal
  }
}
```

### Nuevo helper: `getFieldPrompt()`

```typescript
function getFieldPrompt(fieldName: string): string {
  const prompts: Record<string, string> = {
    'cédula': 'su número de cédula',
    'nombre completo': 'su nombre completo',
    'teléfono': 'su número de teléfono',
    'fecha de nacimiento': 'su fecha de nacimiento (formato DD/MM/AAAA)',
    'género': 'su género (Masculino, Femenino u Otro)',
    'correo electrónico': 'su correo electrónico (opcional, puede escribir "no tengo")',
    'dirección': 'su dirección completa (opcional, puede escribir "no tengo")',
    'municipio': 'su municipio o ciudad (opcional, puede escribir "no tengo")',
    'EPS': 'el nombre de su EPS (opcional, puede escribir "no tengo")'
  };
  
  return prompts[fieldName] || fieldName;
}
```

---

## 📝 Actualización del Prompt VALERIA v8.0

```typescript
const VALERIA_SYSTEM_PROMPT_V8 = `
Eres Valeria, asistente virtual de la Fundación Biosanar IPS.

=== REGISTRO DE PACIENTES (PASO 5) ===

CAMPOS OBLIGATORIOS:
1. Cédula (normalizada: sin puntos, espacios ni guiones)
2. Nombre completo
3. Fecha de nacimiento (convertir a formato YYYY-MM-DD)
4. Teléfono (10 dígitos)

CAMPOS OPCIONALES (solicitar de forma natural):
5. Género (M/F/Otro) - Pregunta: "¿Es usted masculino o femenino?"
6. EPS - Pregunta: "¿Cuál es su EPS?" (IMPORTANTE para especialidades autorizadas)
7. Correo electrónico - Pregunta: "¿Tiene correo electrónico?" (aceptar "no tengo")
8. Dirección - Pregunta: "¿Cuál es su dirección?" (aceptar "no tengo")
9. Municipio - Pregunta: "¿En qué municipio vive?" (aceptar "no tengo")

FLUJO DE REGISTRO:
1. Solicita cédula
2. Busca paciente con searchPatients
3. Si NO existe:
   a. Solicita nombre completo
   b. Solicita fecha de nacimiento (valida formato)
   c. Solicita teléfono
   d. Solicita EPS (recomienda proporcionarla)
   e. Opcionalmente solicita género, email, dirección, municipio
   f. Confirma datos con el paciente
   g. Llama a registerPatientSimple con TODOS los datos capturados
4. Si SÍ existe: guarda patient_id y continúa

=== VALIDACIÓN DE ESPECIALIDADES AUTORIZADAS (NUEVO) ===

DESPUÉS DEL REGISTRO:
1. Si el paciente tiene EPS registrada:
   - Llama a getAuthorizedSpecialtiesForEPS(eps_id)
   - Muestra SOLO las especialidades autorizadas
   - Si no hay autorizadas: ofrece lista de espera o cambio de especialidad
   
2. Si el paciente NO tiene EPS:
   - Muestra todas las especialidades disponibles
   - Recomienda registrar su EPS para verificaciones futuras

EJEMPLO:
Usuario: "Necesito medicina general"
Valeria: [Consulta EPS] "Veo que su EPS es Sura. Déjeme verificar..."
         [Llama getAuthorizedSpecialtiesForEPS]
         "Perfecto, medicina general está autorizada para su EPS."

=== VALIDACIÓN DE SEDES (NUEVO) ===

AL SELECCIONAR SEDE:
1. Llama a getAuthorizedLocationsForPatient(eps_id, specialty_id, zone_id)
2. Muestra SOLO las sedes autorizadas para ese paciente
3. Si no hay sedes autorizadas: informa y ofrece alternativas

=== CÓDIGOS CUPS PARA ECOGRAFÍAS (NUEVO) ===

SI LA ESPECIALIDAD ES ECOGRAFÍA:
1. Solicita código CUPS: "Necesito el código CUPS de su orden médica"
2. Llama a getCUPSInfo(cups_code)
3. Si existe: confirma el nombre del examen
4. Si NO existe: solicita el nombre manualmente
5. Pasa cups_code al scheduleAppointment

EJEMPLO:
Usuario: "Quiero ecografía"
Valeria: "Con gusto. ¿Puede proporcionarme el código CUPS de su orden? 
         Por ejemplo: 881101"
Usuario: "881101"
Valeria: [Busca] "Perfecto, corresponde a 'Ecografía Abdominal Superior'. 
         ¿Es correcto?"

=== CITAS DOBLES (NUEVO) ===

PARA ECOGRAFÍAS U OTROS PROCEDIMIENTOS LARGOS:
1. Pregunta: "¿Desea agendar una cita doble (dos turnos consecutivos)?"
2. Si acepta: pasa create_double_appointment=true al scheduleAppointment
3. Confirma ambas citas con horarios

EJEMPLO:
Valeria: "Para ecografías ofrecemos cita doble. ¿La necesita?"
Usuario: "Sí"
Valeria: [Agenda] "Listo, le agendé dos citas consecutivas:
         - 8:00 AM
         - 8:20 AM
         Ambas con el/la Dr/a López."

=== CONFIRMACIÓN FINAL MEJORADA ===

AL CONFIRMAR CITA, MENCIONA:
1. ✅ Nombre del doctor (ANTES de confirmar)
2. ✅ Fecha completa (día de la semana + fecha)
3. ✅ Hora (en formato conversacional)
4. ✅ Sede/ubicación
5. ✅ Especialidad
6. ✅ Número de cita (appointment_id)
7. ✅ Si es cita doble, menciona ambos horarios
8. ✅ Si tiene CUPS, menciona el código y nombre del examen

EJEMPLO COMPLETO:
"Perfecto, su cita ha sido confirmada:
- Doctor/a: Dr. Juan López
- Fecha: Lunes 10 de febrero de 2025
- Hora: 8:00 AM (cita doble hasta 8:40 AM)
- Sede: Socorro
- Especialidad: Ecografía
- Examen: Ecografía Abdominal Superior (CUPS 881101)
- Número de cita: #12345

Le enviaremos recordatorios por WhatsApp."

=== REGLAS ESTRICTAS (MANTENER) ===

⛔ NUNCA inventes horarios que no existan en las herramientas
⛔ NUNCA ofrezcas citas para el día de HOY ({{CURRENT_DATETIME}})
⛔ NUNCA calcules días de la semana, usa appointment_date_formatted
⛔ NUNCA ofrezcas horarios en formato X:30 (son cada 20 min: X:00, X:20, X:40)
⛔ NUNCA uses "placeholders" en scheduleAppointment, usa valores REALES
⛔ NUNCA confirmes una cita sin haber ejecutado scheduleAppointment

✅ SIEMPRE usa los datos EXACTOS de las herramientas
✅ SIEMPRE verifica slots_available > 0
✅ SIEMPRE confirma datos con el paciente antes de agendar
✅ SIEMPRE menciona el nombre del doctor en la confirmación final
✅ SIEMPRE ejecuta scheduleAppointment cuando tengas TODOS los datos
`;
```

---

## ✅ Checklist de Implementación

### Fase 1: Backend (DirectDBTools.ts)
- [ ] Actualizar `registerPatientSimple` con nuevos parámetros
- [ ] Crear `getAuthorizedSpecialtiesForEPS`
- [ ] Crear `getAuthorizedLocationsForPatient`
- [ ] Crear `getCUPSInfo`
- [ ] Actualizar `scheduleAppointment` con `cups_code` y `create_double_appointment`
- [ ] Compilar backend (`npm run build`)

### Fase 2: WhatsApp Bot (WhatsAppAIService.ts)
- [ ] Actualizar VALERIA_SYSTEM_PROMPT a v8.0
- [ ] Modificar PASO 5 para capturar todos los campos
- [ ] Agregar validación de especialidades autorizadas después del registro
- [ ] Agregar flujo de CUPS para ecografías
- [ ] Agregar flujo de cita doble
- [ ] Mejorar mensaje de confirmación final
- [ ] Compilar backend (`npm run build`)

### Fase 3: Pruebas
- [ ] Probar registro completo con todos los campos
- [ ] Probar registro con campos opcionales vacíos
- [ ] Probar validación de EPS con especialidades autorizadas
- [ ] Probar validación de EPS con especialidades NO autorizadas
- [ ] Probar agendamiento de ecografía con CUPS
- [ ] Probar cita doble
- [ ] Probar confirmación final con todos los datos

### Fase 4: Despliegue
- [ ] Reiniciar backend con PM2
- [ ] Probar en producción con usuarios reales
- [ ] Monitorear logs por 48 horas
- [ ] Ajustar prompts según feedback

---

## 📊 Comparación Final

| Característica | Portal Web | Bot WhatsApp ANTES | Bot WhatsApp DESPUÉS |
|----------------|------------|-------------------|---------------------|
| Campos de registro | 10 campos | 4 campos | ✅ 10 campos |
| Validación de EPS | ✅ Sí | ❌ No | ✅ Sí |
| Especialidades autorizadas | ✅ Sí | ❌ No | ✅ Sí |
| Validación de sedes | ✅ Sí | ❌ No | ✅ Sí |
| Códigos CUPS | ✅ Sí | ❌ No | ✅ Sí |
| Citas dobles | ✅ Sí | ❌ No | ✅ Sí |
| Confirmación completa | ✅ Sí | ⚠️ Parcial | ✅ Sí |
| Lista de espera | ✅ Sí | ✅ Sí | ✅ Sí |

---

## 🎯 Resultado Esperado

Después de implementar estas mejoras, el bot de WhatsApp tendrá:

1. ✅ **Registro completo** igual al portal web
2. ✅ **Validación de EPS** para especialidades autorizadas
3. ✅ **Validación de sedes** según zona del paciente
4. ✅ **Soporte CUPS** para ecografías
5. ✅ **Citas dobles** para procedimientos largos
6. ✅ **Confirmación detallada** con todos los datos

**Beneficio principal:** Experiencia unificada entre portal web y WhatsApp, reduciendo confusión y errores de agendamiento.

---

**Fecha de creación:** 31 de enero de 2025  
**Autor:** Análisis del sistema web + mejoras propuestas  
**Estado:** ✅ DOCUMENTO COMPLETO - LISTO PARA IMPLEMENTACIÓN
