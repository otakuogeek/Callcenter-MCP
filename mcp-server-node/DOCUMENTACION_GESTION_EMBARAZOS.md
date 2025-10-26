# 🤰 Sistema de Gestión de Embarazos - MCP Biosanarcall

## 📋 Resumen Ejecutivo

Se han integrado **4 nuevas herramientas MCP** para la gestión completa de embarazos en el sistema Biosanarcall IPS. El sistema permite registrar embarazos con solo la Fecha de Última Menstruación (FUM), calcular automáticamente toda la información gestacional, y llevar un control completo de los embarazos y controles prenatales.

**Fecha de implementación:** Octubre 13, 2025  
**Versión del sistema:** v3.6  
**Total de herramientas MCP:** 12 (8 originales + 4 nuevas)  
**Estado:** ✅ Completamente funcional y probado

---

## 🎯 Herramientas Nuevas Implementadas

### 1️⃣ **registerPregnancy**

Registra un nuevo embarazo para una paciente de sexo femenino.

**Características:**
- ✅ Solo requiere la **Fecha de Última Menstruación (FUM)**
- ✅ Calcula automáticamente la **Fecha Probable de Parto (FPP)** (FUM + 280 días)
- ✅ Calcula **edad gestacional actual** (semanas y días)
- ✅ Calcula **días hasta el parto**
- ✅ Permite marcar como **embarazo de alto riesgo**
- ✅ Valida que la paciente sea de sexo femenino
- ✅ Valida que no tenga ya un embarazo activo

**Entrada:**
```json
{
  "patient_id": 1037,
  "last_menstrual_date": "01/02/2025",  // Acepta DD/MM/YYYY o YYYY-MM-DD
  "high_risk": false,                    // Opcional
  "risk_factors": "Diabetes gestacional", // Opcional
  "notes": "Primera gestación"           // Opcional
}
```

**Salida exitosa:**
```json
{
  "success": true,
  "message": "Embarazo registrado exitosamente",
  "pregnancy_id": 45,
  "patient": {
    "id": 1037,
    "name": "María González",
    "document": "1234567890"
  },
  "pregnancy_details": {
    "fum": {
      "date": "2025-02-01",
      "formatted": "1 de febrero de 2025"
    },
    "fpp": {
      "date": "2025-11-06",
      "formatted": "6 de noviembre de 2025"
    },
    "gestational_age": {
      "weeks": 36,
      "days": 2,
      "text": "36 semanas y 2 días"
    },
    "days_until_due": 24,
    "high_risk": false,
    "status": "Activa"
  },
  "recommendations": {
    "prenatal_controls": "Se recomienda realizar controles prenatales periódicos",
    "next_steps": "Use registerPrenatalControl para registrar cada control prenatal"
  }
}
```

**Validaciones:**
- ❌ Paciente debe existir y estar activo
- ❌ Paciente debe ser de sexo femenino
- ❌ No puede tener otro embarazo activo
- ✅ Fecha FUM válida

---

### 2️⃣ **getActivePregnancies**

Consulta los embarazos activos en el sistema.

**Características:**
- ✅ Filtrar por paciente específico
- ✅ Filtrar solo embarazos de alto riesgo
- ✅ Información actualizada en tiempo real (edad gestacional calculada dinámicamente)
- ✅ Muestra cantidad de controles prenatales realizados
- ✅ Fechas formateadas en español

**Entrada:**
```json
{
  "patient_id": 1037,      // Opcional: filtrar por paciente
  "high_risk_only": false, // Opcional: solo alto riesgo
  "limit": 50              // Opcional: límite de resultados
}
```

**Salida:**
```json
{
  "success": true,
  "count": 2,
  "filters": {
    "patient_id": "Todos",
    "high_risk_only": false
  },
  "pregnancies": [
    {
      "pregnancy_id": 1,
      "patient": {
        "id": 1037,
        "name": "María González",
        "document": "1234567890"
      },
      "status": "Activa",
      "dates": {
        "fum": {
          "date": "2025-02-01",
          "formatted": "1 de febrero de 2025"
        },
        "fpp": {
          "date": "2025-11-06",
          "formatted": "6 de noviembre de 2025"
        }
      },
      "gestational_age": {
        "weeks": 36,
        "days": 2,
        "text": "36 semanas y 2 días"
      },
      "days_until_due": 24,
      "high_risk": false,
      "prenatal_controls": {
        "count": 8,
        "last_date": "10 de octubre de 2025"
      },
      "registered_at": "2025-02-15T10:30:00.000Z"
    }
  ],
  "info": {
    "total_active": 2,
    "high_risk_count": 0,
    "normal_risk_count": 2
  }
}
```

---

### 3️⃣ **updatePregnancyStatus**

Actualiza el estado de un embarazo (Completada o Interrumpida).

**Características:**
- ✅ Marcar como **Completada** (parto exitoso)
- ✅ Marcar como **Interrumpida** (aborto, muerte fetal, etc.)
- ✅ Registrar detalles del parto: fecha, tipo, género y peso del bebé
- ✅ Registrar detalles de interrupción: fecha, razón, notas
- ✅ Registrar complicaciones

**Entrada para completar embarazo:**
```json
{
  "pregnancy_id": 1,
  "status": "Completada",
  "delivery_date": "2025-11-06",
  "delivery_type": "Parto natural",
  "baby_gender": "Femenino",
  "baby_weight_grams": 3200,
  "complications": "Ninguna"
}
```

**Entrada para interrumpir embarazo:**
```json
{
  "pregnancy_id": 2,
  "status": "Interrumpida",
  "interruption_date": "2025-05-15",
  "interruption_reason": "Aborto espontáneo",
  "interruption_notes": "Semana 12 de gestación",
  "complications": "Ninguna"
}
```

**Salida (completada):**
```json
{
  "success": true,
  "message": "Embarazo marcado como completado exitosamente",
  "pregnancy_id": 1,
  "patient": {
    "id": 1037,
    "name": "María González"
  },
  "outcome": {
    "status": "Completada",
    "delivery_date": "2025-11-06",
    "delivery_type": "Parto natural",
    "baby_gender": "Femenino",
    "baby_weight_grams": 3200,
    "complications": "Ninguna"
  }
}
```

**Tipos de parto disponibles:**
- Parto natural
- Cesárea
- Fórceps
- Vacuum
- Otro

**Razones de interrupción disponibles:**
- Aborto espontáneo
- Aborto terapéutico
- Muerte fetal
- Embarazo ectópico
- Otra causa

---

### 4️⃣ **registerPrenatalControl**

Registra un control prenatal para un embarazo activo.

**Características:**
- ✅ Registro completo de signos vitales
- ✅ Mediciones obstétricas (altura uterina, FCF)
- ✅ Observaciones y recomendaciones
- ✅ Fecha sugerida para próximo control
- ✅ Exámenes de laboratorio solicitados
- ✅ Registro de ecografías realizadas
- ✅ Actualiza automáticamente el contador de controles del embarazo

**Entrada:**
```json
{
  "pregnancy_id": 1,
  "control_date": "2025-10-13",
  "gestational_weeks": 36,
  "gestational_days": 2,
  "weight_kg": 72.5,
  "blood_pressure_systolic": 120,
  "blood_pressure_diastolic": 80,
  "fundal_height_cm": 34.0,
  "fetal_heart_rate": 140,
  "observations": "Embarazo evolucionando favorablemente",
  "recommendations": "Continuar con controles semanales",
  "next_control_date": "2025-10-20",
  "lab_tests_ordered": "Hemograma, glucosa",
  "ultrasound_performed": true,
  "ultrasound_notes": "Feto en presentación cefálica"
}
```

**Salida:**
```json
{
  "success": true,
  "message": "Control prenatal registrado exitosamente",
  "control_id": 145,
  "pregnancy_id": 1,
  "patient": {
    "id": 1037,
    "name": "María González"
  },
  "control_details": {
    "date": "2025-10-13",
    "gestational_age": {
      "weeks": 36,
      "days": 2,
      "text": "36 semanas y 2 días"
    },
    "vital_signs": {
      "weight_kg": 72.5,
      "blood_pressure": "120/80"
    },
    "measurements": {
      "fundal_height_cm": 34.0,
      "fetal_heart_rate": 140
    },
    "ultrasound": "Sí realizada",
    "next_control_date": "2025-10-20"
  },
  "recommendations": "Continuar con controles semanales"
}
```

---

## 📊 Estructura de Base de Datos

### Tabla: `pregnancies`
```sql
- id (PK)
- patient_id (FK → patients)
- status (enum: 'Activa', 'Completada', 'Interrumpida')
- start_date (FUM)
- expected_due_date (FPP)
- actual_end_date
- gestational_weeks_at_registration
- current_gestational_weeks
- delivery_date
- delivery_type
- baby_gender
- baby_weight_grams
- interruption_date
- interruption_reason
- interruption_notes
- complications
- prenatal_controls_count
- last_prenatal_control_date
- high_risk (boolean)
- risk_factors (text)
- notes (text)
- created_at
- updated_at
```

### Vista: `active_pregnancies`
Vista materializada que calcula automáticamente:
- Edad gestacional actual (semanas y días)
- Días hasta el parto
- Información del paciente
- Contador de controles prenatales

### Tabla: `prenatal_controls`
```sql
- id (PK)
- pregnancy_id (FK → pregnancies)
- control_date
- gestational_weeks
- gestational_days
- weight_kg
- blood_pressure_systolic
- blood_pressure_diastolic
- fundal_height_cm
- fetal_heart_rate
- observations
- recommendations
- next_control_date
- lab_tests_ordered
- ultrasound_performed
- ultrasound_notes
- created_at
- updated_at
```

---

## 🔄 Flujo de Trabajo Completo

### 1. Registro de Embarazo
```
Paciente Femenina → registerPregnancy (solo FUM) 
  → Sistema calcula FPP, edad gestacional, días hasta parto
  → Embarazo registrado como "Activa"
```

### 2. Controles Prenatales
```
Embarazo Activo → registerPrenatalControl (cada visita)
  → Registra signos vitales, mediciones, observaciones
  → Actualiza contador de controles
  → Programa próximo control
```

### 3. Seguimiento
```
Consultar → getActivePregnancies
  → Ver todos los embarazos activos
  → Filtrar por paciente o alto riesgo
  → Información actualizada en tiempo real
```

### 4. Finalización
```
Embarazo Activo → updatePregnancyStatus
  → Si parto exitoso: status="Completada" + detalles del parto
  → Si interrupción: status="Interrumpida" + razón
```

---

## 🧪 Pruebas del Sistema

### Script de Pruebas Automatizado
```bash
./test-pregnancy-management.sh
```

### Pruebas Manuales con curl

**1. Listar herramientas (verificar nuevas):**
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }' | jq '.result.tools[] | select(.name | contains("Pregn") or contains("Prenatal"))'
```

**2. Registrar embarazo:**
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "registerPregnancy",
      "arguments": {
        "patient_id": 1037,
        "last_menstrual_date": "01/02/2025",
        "high_risk": false
      }
    }
  }' | jq '.'
```

**3. Consultar embarazos activos:**
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "getActivePregnancies",
      "arguments": {
        "limit": 10
      }
    }
  }' | jq '.'
```

**4. Registrar control prenatal:**
```bash
curl -X POST http://localhost:8977/mcp-unified \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "registerPrenatalControl",
      "arguments": {
        "pregnancy_id": 1,
        "control_date": "2025-10-13",
        "gestational_weeks": 36,
        "gestational_days": 2,
        "weight_kg": 72.5,
        "blood_pressure_systolic": 120,
        "blood_pressure_diastolic": 80,
        "fetal_heart_rate": 140
      }
    }
  }' | jq '.'
```

---

## 🎓 Casos de Uso

### Caso 1: Primera consulta prenatal
```
1. Paciente llega a primera consulta prenatal
2. Recepcionista registra a la paciente (si es nueva): registerPatientSimple
3. Recepcionista pregunta FUM: "¿Cuál fue la fecha de su última menstruación?"
4. Sistema registra embarazo: registerPregnancy (solo con FUM)
5. Sistema calcula automáticamente:
   - FPP (fecha probable de parto)
   - Edad gestacional actual
   - Días hasta el parto
6. Médico realiza control prenatal
7. Sistema registra control: registerPrenatalControl
```

### Caso 2: Control prenatal de seguimiento
```
1. Paciente llega a control programado
2. Sistema consulta embarazo activo: getActivePregnancies
3. Médico realiza examen (peso, presión, FCF, etc.)
4. Sistema registra control: registerPrenatalControl
5. Sistema actualiza contador de controles
6. Sistema programa próximo control
```

### Caso 3: Finalización de embarazo (parto)
```
1. Paciente da a luz exitosamente
2. Sistema actualiza embarazo: updatePregnancyStatus
3. Se registra:
   - Fecha de parto
   - Tipo de parto
   - Género del bebé
   - Peso del bebé
4. Estado cambia a "Completada"
```

### Caso 4: Embarazo de alto riesgo
```
1. Médico identifica factores de riesgo
2. Registrar embarazo con high_risk=true
3. Especificar risk_factors (diabetes, hipertensión, etc.)
4. Sistema permite filtrar: getActivePregnancies(high_risk_only=true)
5. Seguimiento especial con controles más frecuentes
```

---

## ✅ Validaciones Implementadas

### registerPregnancy
- ✅ Paciente debe existir
- ✅ Paciente debe estar activo
- ✅ Paciente debe ser de sexo femenino
- ✅ No puede tener otro embarazo activo
- ✅ FUM debe ser una fecha válida
- ✅ Soporta formatos: DD/MM/YYYY y YYYY-MM-DD

### registerPrenatalControl
- ✅ Embarazo debe existir
- ✅ Embarazo debe estar activo
- ✅ Semanas gestacionales válidas (0-42)
- ✅ Días gestacionales válidos (0-6)
- ✅ Valores numéricos en rangos normales

### updatePregnancyStatus
- ✅ Embarazo debe existir
- ✅ Si status="Completada", delivery_date es requerido
- ✅ Si status="Interrumpida", interruption_date es requerido
- ✅ Solo permite estados válidos

---

## 📈 Métricas y Estadísticas

### Información calculada automáticamente:
- ✅ Edad gestacional actual (semanas + días)
- ✅ Días hasta fecha probable de parto
- ✅ Fecha probable de parto (FUM + 280 días)
- ✅ Contador de controles prenatales realizados
- ✅ Fecha del último control prenatal
- ✅ Clasificación de riesgo (normal/alto)

---

## 🚀 Integración con Sistema Existente

### Herramientas relacionadas:
1. **listActiveEPS** → Registrar EPS de la paciente
2. **registerPatientSimple** → Registrar paciente femenina
3. **registerPregnancy** → Registrar embarazo (nueva)
4. **getAvailableAppointments** → Buscar citas para controles
5. **scheduleAppointment** → Agendar controles prenatales
6. **registerPrenatalControl** → Registrar control (nueva)
7. **getActivePregnancies** → Consultar embarazos (nueva)
8. **updatePregnancyStatus** → Finalizar embarazo (nueva)

---

## 📝 Próximos Pasos

### Sugerencias de mejora:
1. ✨ Agregar notificaciones automáticas para controles próximos
2. ✨ Generar alertas para embarazos de alto riesgo sin controles recientes
3. ✨ Integrar con sistema de recordatorios (SMS/WhatsApp)
4. ✨ Reportes estadísticos de embarazos (dashboard)
5. ✨ Exportar historial prenatal completo (PDF)

---

## 🎯 Conclusión

El sistema de gestión de embarazos está completamente integrado y funcional. Permite un seguimiento completo desde el registro inicial (solo con FUM) hasta la finalización del embarazo, con registro detallado de todos los controles prenatales.

**Estado del sistema:**
- ✅ 12 herramientas MCP activas
- ✅ 4 nuevas herramientas de embarazos
- ✅ Base de datos actualizada
- ✅ Validaciones completas
- ✅ Cálculos automáticos
- ✅ Documentación completa
- ✅ Scripts de prueba

**Versión:** v3.6  
**Fecha:** Octubre 13, 2025  
**Estado:** Producción ✅
