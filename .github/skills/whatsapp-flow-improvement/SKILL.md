---
name: whatsapp-flow-improvement
description: "USE WHEN: mejorando el flujo de WhatsApp del bot Valeria; corrigiendo bucles de conversación, validaciones de reglas de negocio (edad/género), lista de espera, mensajes de error amigables, o persistencia de contexto en el sistema Biosanarcall."
---

# Skill: Mejora del Flujo WhatsApp — Valeria (Biosanarcall)

Este skill documenta el patrón de mejora aplicado al sistema de agendamiento por WhatsApp. Sirve como guía reutilizable para diagnosticar y corregir problemas similares.

## Arquitectura del Pipeline (7 pasos)

```
01-Identify → 02-IntentAnalysis → 03-QuickIntents → 04-AutoAvailability
           → 05-StateHandlers → 06-AIGeneration → 07-Validation
```

Cada paso verifica `ctx.earlyResponse`; si ya tiene valor, los pasos siguientes no procesan.

---

## Metodología de Diagnóstico

### Paso 1 — Identificar el tipo de problema

| Síntoma | Causa raíz | Archivo a revisar |
|---------|-----------|------------------|
| Bot repite preguntas ya respondidas | Estado no persiste la variable | `05-StateHandlers.ts`, `system.md` |
| Respuesta "Sí" a lista de espera no hace nada | Estado `WAITING_LIST` sin handler | `05-StateHandlers.ts` |
| Adulto puede pedir Pediatría | Falta validación de edad | `04-AutoAvailability.ts` |
| Hombre puede pedir Ginecología | Falta validación de género | `04-AutoAvailability.ts` |
| Error técnico genérico sin alternativas | Manejo de errores pobre | `05-StateHandlers.ts`, `handleAutoSchedule` |
| Datos de perfil (género/edad) no disponibles | `01-Identify.ts` no los extrae | `01-Identify.ts` |

### Paso 2 — Verificar los datos en StateContext

Campos de perfil del paciente disponibles en `StateContext`:
- `patientGender` — 'Masculino' / 'Femenino' / otro
- `patientAge` — calculado de `birth_date`
- `patientBirthDate` — fecha ISO
- `patientEpsId` / `patientEpsName`
- `modalityPreference` — 'presencial' / 'virtual'
- `waitingListIntent` — booleano para flujo de lista de espera

---

## Patrones de Implementación

### Patrón 1: Validación de Elegibilidad por Especialidad (04-AutoAvailability.ts)

```typescript
function checkSpecialtyEligibility(
  specialtyName: string,
  patientGender?: string,
  patientAge?: number,
): string | null {
  // Ginecología → solo femenino
  if (/ginecolog|control\s*prenatal|obstetr/i.test(specialtyName)) {
    if (patientGender && !/femen|mujer|f$/i.test(patientGender)) {
      return `La especialidad ${specialtyName} está disponible únicamente para pacientes de sexo femenino.`;
    }
  }
  // Pediatría → menores de 18
  if (/pediatr/i.test(specialtyName)) {
    if (patientAge !== undefined && patientAge >= 18) {
      return `La especialidad ${specialtyName} es para pacientes menores de 18 años.`;
    }
  }
  return null;
}
```

**Cuándo aplicarlo:** Antes de llamar a `getAvailableAppointments`, en el bloque 4A.  
**Efecto:** Limpia el `specialtyName` del estado y redirige al usuario a elegir otra especialidad.

---

### Patrón 2: Flujo de Lista de Espera Sin Bucle (05-StateHandlers.ts)

**Problema:** Cuando no hay cupos, se pregunta "¿Te agrego a lista de espera?" pero nunca se procesa la respuesta afirmativa.

**Solución en 04-AutoAvailability:**
```typescript
// Al detectar falta de cupos, establecer estado WAITING_LIST
updateState(phone, ConversationState.WAITING_LIST, {
  specialtyId: ...,
  waitingListIntent: undefined,  // se activa cuando el usuario dice 'Sí'
});
ctx.earlyResponse = `No hay cupos. ¿Te agrego a la lista de espera? Responde *sí* o *no*.`;
```

**Handler en 05-StateHandlers (state: WAITING_LIST):**
```typescript
async function handleWaitingListConfirmation(ctx, state, msg) {
  // Negativo → volver a AWAITING_SPECIALTY
  if (isNegative(ctx.message)) {
    updateState(phone, ConversationState.AWAITING_SPECIALTY, { specialtyName: undefined });
    ctx.earlyResponse = `Entendido. ¿Te busco otra especialidad?`;
    return ctx;
  }
  // Afirmativo sin prioridad → preguntar prioridad
  if (isAffirmative(ctx.message) && !state.waitingListIntent) {
    updateState(phone, ConversationState.WAITING_LIST, { waitingListIntent: true });
    ctx.earlyResponse = `¿Tu consulta es: 1. Urgente, 2. Alta, 3. Normal, 4. Baja?`;
    return ctx;
  }
  // Con waitingListIntent activo → procesar prioridad y llamar addToWaitingList
  if (state.waitingListIntent) {
    const priority = /* parsear de msg */ 'Normal';
    const result = await DirectDBTools.addToWaitingList({ patient_id, specialty_id, priority_level: priority });
    if (result.success) {
      updateState(phone, ConversationState.COMPLETED, { waitingListIntent: undefined });
      ctx.earlyResponse = `✅ Añadido a lista de espera posición #${result.data.queue_position}`;
    }
    return ctx;
  }
}
```

---

### Patrón 3: Mensajes de Error Amigables (05-StateHandlers.ts)

```typescript
// En handleAutoSchedule, reemplazar error genérico:
const isAuthError = /autoriza|no autoriza|sin autoriza|permiso/i.test(result.error || '');
const errorMsg = isAuthError
  ? `Parece que tu EPS aún no ha autorizado esta especialidad. 😔\n\n¿Te agrego a la lista de espera?`
  : `Disculpa, tuve un inconveniente. ¿Te agrego a la lista de espera o prefieres llamarnos al 6076911308?`;

// Siempre ofrecer lista de espera como alternativa
if (state.specialtyId) {
  updateState(ctx.phone, ConversationState.WAITING_LIST, { waitingListIntent: undefined });
}
ctx.earlyResponse = errorMsg;
```

---

### Patrón 4: Extracción de Perfil al Identificar (01-Identify.ts)

En el bloque `searchPatient`, al encontrar el paciente:
```typescript
// Calcular edad
let patientAge: number | undefined;
if (patient?.birth_date) {
  const birth = new Date(patient.birth_date);
  const today = new Date();
  patientAge = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) patientAge--;
}

// Guardar en estado
updateState(phone, ..., {
  patientBirthDate: patient.birth_date,
  patientGender: patient.gender,
  patientAge,
  patientEpsId: patient.insurance_eps_id,
  patientEpsName: patient.eps_name,
});
```

---

### Patrón 5: Reglas Anti-Bucle en el Prompt (system.md)

Agregar en la sección **PROHIBIDO ABSOLUTAMENTE**:
```
9. NUNCA preguntes por modalidad — TODAS las citas son PRESENCIALES
10. NUNCA vuelvas a preguntar algo que el usuario ya respondió en esta conversación
11. NUNCA ofrezcas Ginecología/Control Prenatal a pacientes de género masculino
12. NUNCA ofrezcas Pediatría a pacientes mayores de 17 años
```

Agregar sección nueva **MEMORIA DE CONVERSACIÓN - ANTI-BUCLE**:
```
- Si el usuario ya proporcionó un dato NO vuelvas a pedirlo
- Verifica el contexto ANTES de hacer una pregunta
- Si el usuario respondió que la cita es presencial, NO preguntes la modalidad de nuevo
```

---

## Checklist de Calidad

Antes de hacer deploy de mejoras al flujo de WhatsApp:

- [ ] `npx tsc --noEmit` en `/backend` pasa sin errores
- [ ] Probar flujo: usuario dice "sí" a lista de espera → se inscribe correctamente
- [ ] Probar flujo: hombre pide Ginecología → recibe mensaje de restricción
- [ ] Probar flujo: adulto pide Pediatría → recibe mensaje de restricción
- [ ] Probar flujo: error de agendamiento → ofrece lista de espera con mensaje amigable
- [ ] Probar flujo: usuario menciona "presencial" → bot NO vuelve a preguntar modalidad

## Archivos Clave

| Archivo | Responsabilidad |
|---------|----------------|
| [types/state.ts](backend/src/whatsapp/types/state.ts) | Define `StateContext` con todos los campos de perfil |
| [01-Identify.ts](backend/src/whatsapp/pipeline/steps/01-Identify.ts) | Extrae perfil del paciente al identificarlo |
| [04-AutoAvailability.ts](backend/src/whatsapp/pipeline/steps/04-AutoAvailability.ts) | Valida elegibilidad por especialidad; establece estado WAITING_LIST |
| [05-StateHandlers.ts](backend/src/whatsapp/pipeline/steps/05-StateHandlers.ts) | Maneja estado WAITING_LIST + errores amigables |
| [system.md](backend/src/whatsapp/prompts/templates/system.md) | Reglas del LLM — anti-bucle, restricciones de especialidad |
