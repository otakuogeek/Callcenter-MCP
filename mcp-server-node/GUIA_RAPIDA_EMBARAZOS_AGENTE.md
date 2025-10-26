# 🤰 Guía Rápida de Gestión de Embarazos para Agente Valeria

## Cuándo usar estas herramientas

### ✅ Usar si:
- Paciente menciona "estoy embarazada"
- Paciente solicita "control prenatal"
- Paciente pregunta "cuándo es mi fecha de parto"
- Paciente es mujer y menciona "última menstruación"

### ❌ NO usar si:
- Paciente es de sexo masculino
- No hay mención de embarazo o gestación

---

## 🔄 Flujo Simple en 3 Pasos

### PASO 1: Confirmar que es paciente femenina
```
Agente: "Para ayudarle con su embarazo, necesito confirmar algunos datos."
```

### PASO 2: Preguntar FUM (Fecha de Última Menstruación)
```
Agente: "¿Cuál fue la fecha de su última menstruación?"
Paciente: "Fue el 1 de febrero"
```

### PASO 3: Registrar embarazo automáticamente
```javascript
registerPregnancy({
  patient_id: [ID obtenido],
  last_menstrual_date: "01/02/2025"
})
```

**El sistema calcula automáticamente:**
- ✅ Fecha Probable de Parto (FPP)
- ✅ Semanas y días de gestación
- ✅ Días hasta el parto

---

## 💬 Frases Clave del Agente

### Al registrar embarazo:
```
"Perfecto, su embarazo ha sido registrado. 
Está en la semana [X] y [Y] días de gestación. 
Su fecha probable de parto es el [fecha formateada].
¿Desea agendar su control prenatal?"
```

### Si ya tiene embarazo activo:
```
"Veo que ya tiene un embarazo registrado con nosotros.
Está en la semana [X] de gestación.
Su fecha probable de parto es el [fecha].
¿En qué puedo ayudarle hoy?"
```

### Si pregunta por alto riesgo:
```
"Su embarazo está marcado como [normal/alto riesgo].
[Si alto riesgo]: Recomendamos controles más frecuentes.
¿Desea agendar su próximo control?"
```

---

## 🎯 Casos de Uso Comunes

### Caso 1: Primera visita prenatal
```
1. Registrar paciente (si es nueva)
2. Preguntar FUM
3. Registrar embarazo → registerPregnancy
4. Ofrecer agendar control prenatal
5. Usar scheduleAppointment (especialidad: Ginecología/Obstetricia)
```

### Caso 2: Control prenatal de seguimiento
```
1. Consultar embarazo → getActivePregnancies(patient_id)
2. Informar semanas de gestación actual
3. Ofrecer agendar próximo control
4. Usar scheduleAppointment
```

### Caso 3: Consulta de información
```
1. Consultar embarazo → getActivePregnancies(patient_id)
2. Informar:
   - Semanas de gestación
   - Fecha probable de parto
   - Días hasta el parto
   - Cantidad de controles realizados
```

---

## 📞 Ejemplo de Conversación Completa

**🔵 Paciente:** "Hola, estoy embarazada y necesito una cita"

**🟢 Agente:** "¡Felicitaciones! Con gusto la ayudo. ¿Ya está registrada en nuestro sistema? Por favor, indíqueme su cédula."

**🔵 Paciente:** "1234567890"

**🟢 Agente:** *[Busca paciente con document=1234567890]*  
"Perfecto, la encontré. Para registrar su embarazo, necesito que me indique la fecha de su última menstruación."

**🔵 Paciente:** "Fue el primero de febrero"

**🟢 Agente:** *[Llama a registerPregnancy con FUM: 01/02/2025]*  
"Excelente. Su embarazo ha sido registrado. Está en la semana 36 y 2 días de gestación. Su fecha probable de parto es el 6 de noviembre de 2025, es decir, en aproximadamente 24 días. ¿Desea agendar un control prenatal?"

**🔵 Paciente:** "Sí, por favor"

**🟢 Agente:** "Perfecto. Tenemos disponible Ginecología en nuestra sede de San Gil. ¿Le queda bien esa sede?"

*[Continúa con flujo normal de agendamiento]*

---

## 🔑 Herramientas Disponibles

### 1. registerPregnancy
**Cuándo:** Primera vez que menciona embarazo  
**Requiere:** patient_id + last_menstrual_date (FUM)  
**Retorna:** pregnancy_id, FPP, edad gestacional, días hasta parto

### 2. getActivePregnancies
**Cuándo:** Paciente pregunta sobre su embarazo  
**Requiere:** patient_id (opcional)  
**Retorna:** Lista de embarazos activos con toda la información

### 3. updatePregnancyStatus
**Cuándo:** Paciente informa que tuvo el bebé o interrupción  
**Requiere:** pregnancy_id + status + detalles  
**Retorna:** Confirmación de actualización

### 4. registerPrenatalControl
**Cuándo:** Médico/enfermera registra control (NO para agente telefónico)  
**Requiere:** pregnancy_id + datos del control  
**Retorna:** Confirmación de registro

---

## ⚠️ Validaciones Importantes

### ✅ SIEMPRE validar:
1. Paciente es de sexo **femenino**
2. No tiene otro embarazo **activo**
3. FUM es una fecha **válida** (no futura)

### ❌ NUNCA:
1. Registrar embarazo si es paciente masculino
2. Registrar embarazo si ya tiene uno activo
3. Inventar fechas o información

---

## 🎓 Preguntas Frecuentes

### P: ¿Qué pregunto primero?
**R:** Solo la Fecha de Última Menstruación (FUM). El sistema calcula todo lo demás.

### P: ¿Y si no sabe la fecha exacta?
**R:** "Entiendo. Es importante tener la fecha exacta de su última menstruación para calcular su fecha de parto. ¿Puede consultarlo y llamarnos de nuevo?"

### P: ¿Registro embarazos de alto riesgo diferente?
**R:** No. El sistema permite marcar high_risk=true, pero esto lo decide el médico, no el agente.

### P: ¿Qué hago si ya tiene embarazo activo?
**R:** Consultar el embarazo existente con getActivePregnancies y ofrecer agendar control.

---

## 📊 Información que Debes Comunicar

### Después de registrar embarazo:
- ✅ Semanas y días de gestación actual
- ✅ Fecha probable de parto (formateada en español)
- ✅ Días aproximados hasta el parto
- ✅ Ofrecer agendar control prenatal

### Al consultar embarazo existente:
- ✅ Semanas de gestación actual
- ✅ Fecha probable de parto
- ✅ Cantidad de controles realizados
- ✅ Fecha del último control (si existe)

---

## 🚫 Errores Comunes a Evitar

1. ❌ NO preguntar fecha probable de parto (el sistema la calcula)
2. ❌ NO preguntar semanas de gestación (el sistema las calcula)
3. ❌ NO registrar embarazo sin confirmar sexo femenino
4. ❌ NO inventar información médica
5. ❌ NO marcar como alto riesgo sin indicación médica

---

## ✅ Checklist de Uso

### Antes de registrar embarazo:
- [ ] Paciente está registrado en el sistema
- [ ] Paciente es de sexo femenino
- [ ] Obtuve la FUM
- [ ] FUM es fecha válida (no futura)

### Después de registrar embarazo:
- [ ] Informé semanas de gestación
- [ ] Informé fecha probable de parto
- [ ] Ofrecí agendar control prenatal
- [ ] Guardé pregnancy_id para futuras referencias

---

## 🎯 Resumen Ultra-Rápido

```
1. ¿Paciente embarazada? → Preguntar FUM
2. Registrar → registerPregnancy(patient_id, FUM)
3. Informar → Semanas de gestación + FPP
4. Agendar → scheduleAppointment (Ginecología/Obstetricia)
5. FIN ✅
```

---

**Versión:** v3.6  
**Fecha:** Octubre 13, 2025  
**Uso:** Solo para Agente Valeria - Recepción Telefónica
