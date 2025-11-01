# Sistema de Historias Clínicas - Biosanarcall
## Fecha de Implementación: 27 de Octubre, 2025

---

## 📋 RESUMEN DEL SISTEMA

Se ha implementado un sistema completo de gestión de historias clínicas para el portal de doctores, permitiendo registrar y consultar visitas médicas, antecedentes, alergias, medicamentos y más.

---

## 🗄️ BASE DE DATOS

### Tablas Creadas:

#### 1. **medical_records** (Historias Clínicas Principales)
- `id`: BIGINT UNSIGNED (PK)
- `patient_id`: BIGINT UNSIGNED (FK → patients)
- `doctor_id`: BIGINT UNSIGNED (FK → doctors)
- `appointment_id`: BIGINT UNSIGNED (FK → appointments)
- `visit_date`: DATETIME
- `visit_type`: ENUM('Consulta General', 'Control', 'Urgencia', 'Primera Vez', 'Seguimiento')
- `chief_complaint`: TEXT (Motivo de consulta)
- `current_illness`: TEXT (Enfermedad actual)
- `vital_signs`: JSON (Signos vitales)
- `physical_examination`: JSON (Examen físico)
- `diagnosis`: TEXT (Diagnóstico)
- `treatment_plan`: TEXT (Plan de tratamiento)
- `prescriptions`: TEXT (Prescripciones)
- `observations`: TEXT
- `follow_up_date`: DATE
- `status`: ENUM('Borrador', 'Completa', 'Archivada')
- `created_at`, `updated_at`: TIMESTAMP

#### 2. **patient_allergies** (Alergias del Paciente)
- `id`: BIGINT UNSIGNED (PK)
- `patient_id`: BIGINT UNSIGNED (FK)
- `allergen`: VARCHAR(200)
- `allergy_type`: ENUM('Medicamento', 'Alimento', 'Ambiental', 'Otro')
- `severity`: ENUM('Leve', 'Moderada', 'Severa', 'Mortal')
- `reaction`: TEXT
- `notes`: TEXT
- `recorded_by`: BIGINT UNSIGNED (FK → doctors)
- `active`: BOOLEAN

#### 3. **patient_medical_history** (Antecedentes Médicos)
- `id`: BIGINT UNSIGNED (PK)
- `patient_id`: BIGINT UNSIGNED (FK)
- `history_type`: ENUM('Personal', 'Familiar', 'Quirúrgico', 'Traumático', 'Ginecológico', 'Obstétrico')
- `condition_name`: VARCHAR(200)
- `diagnosis_date`: DATE
- `description`: TEXT
- `treatment`: TEXT
- `current_status`: ENUM('Activo', 'Controlado', 'Curado', 'Inactivo')
- `recorded_by`: BIGINT UNSIGNED (FK → doctors)
- `active`: BOOLEAN

#### 4. **patient_medications** (Medicamentos Actuales)
- `id`: BIGINT UNSIGNED (PK)
- `patient_id`: BIGINT UNSIGNED (FK)
- `medication_name`: VARCHAR(200)
- `dosage`: VARCHAR(100)
- `frequency`: VARCHAR(100)
- `route`: VARCHAR(50)
- `start_date`, `end_date`: DATE
- `reason`: TEXT
- `prescribed_by`: BIGINT UNSIGNED (FK → doctors)
- `status`: ENUM('Activo', 'Suspendido', 'Completado')
- `notes`: TEXT

#### 5. **medical_record_attachments** (Archivos Adjuntos)
- `id`: BIGINT UNSIGNED (PK)
- `medical_record_id`: BIGINT UNSIGNED (FK)
- `file_name`, `file_path`: VARCHAR
- `file_type`, `file_size`: VARCHAR/INT
- `category`: ENUM('Laboratorio', 'Imagen', 'Documento', 'Receta', 'Otro')
- `description`: TEXT

#### 6. **patient_summary** (Vista SQL)
Información consolidada del paciente con totales de visitas, alergias activas, medicamentos actuales.

---

## 🔌 API ENDPOINTS

### Base URL: `https://biosanarcall.site/api/medical-records`

**Autenticación:** Todas las rutas requieren token JWT de doctor en header:
```
Authorization: Bearer <token>
```

### 1. Listar Historias Clínicas del Doctor
```http
GET /api/medical-records
```

**Query Parameters:**
- `patient_id` (opcional): Filtrar por paciente
- `status` (opcional): 'Borrador', 'Completa', 'Archivada'
- `limit` (opcional, default: 50)
- `offset` (opcional, default: 0)

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "patient_id": 123,
      "doctor_id": 21,
      "appointment_id": 456,
      "visit_date": "2025-10-27T10:30:00",
      "visit_type": "Consulta General",
      "chief_complaint": "Dolor abdominal",
      "diagnosis": "Gastritis aguda",
      "status": "Completa",
      "patient_name": "Juan Pérez",
      "patient_document": "123456789",
      "doctor_name": "Dr. García"
    }
  ],
  "total": 1
}
```

### 2. Obtener Historia Clínica Específica
```http
GET /api/medical-records/:id
```

**Respuesta:** Objeto completo con toda la información de la visita.

### 3. Crear Nueva Historia Clínica
```http
POST /api/medical-records
```

**Body:**
```json
{
  "patient_id": 123,
  "appointment_id": 456,
  "visit_type": "Consulta General",
  "chief_complaint": "Dolor de cabeza persistente",
  "current_illness": "Paciente refiere cefalea desde hace 3 días...",
  "vital_signs": {
    "temperatura": "36.5°C",
    "presion_arterial": "120/80",
    "frecuencia_cardiaca": "72",
    "frecuencia_respiratoria": "16",
    "saturacion_oxigeno": "98%",
    "peso": "70kg",
    "altura": "170cm"
  },
  "physical_examination": {
    "cabeza": "Normal",
    "cuello": "Sin adenopatías",
    "torax": "Murmullo vesicular conservado",
    "abdomen": "Blando, depresible, no doloroso",
    "extremidades": "Sin edema"
  },
  "diagnosis": "Cefalea tensional",
  "treatment_plan": "Analgésicos, reposo, reducir estrés",
  "prescriptions": "Paracetamol 500mg cada 8 horas por 3 días",
  "observations": "Control en 7 días si persisten síntomas",
  "follow_up_date": "2025-11-03",
  "status": "Completa"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": 15,
    "message": "Historia clínica creada exitosamente"
  }
}
```

### 4. Actualizar Historia Clínica
```http
PUT /api/medical-records/:id
```

**Body:** Campos a actualizar (todos opcionales)

### 5. Buscar Pacientes
```http
GET /api/medical-records/patients/search?q=<término>
```

Busca por nombre, documento o teléfono (mínimo 2 caracteres).

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "name": "Juan Pérez",
      "document": "123456789",
      "phone": "3001234567",
      "age": 35,
      "eps_name": "Salud Total",
      "total_visits": 5,
      "last_visit": "2025-10-20"
    }
  ]
}
```

### 6. Obtener Historial Completo del Paciente
```http
GET /api/medical-records/patients/:id/history
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "patient": { /* Información del paciente */ },
    "medicalRecords": [ /* Todas las historias clínicas */ ],
    "allergies": [ /* Alergias activas */ ],
    "medications": [ /* Medicamentos actuales */ ],
    "medicalHistory": [ /* Antecedentes médicos */ ]
  }
}
```

---

## 📊 EJEMPLO DE SIGNOS VITALES (JSON)

```json
{
  "temperatura": "36.5°C",
  "presion_arterial": "120/80 mmHg",
  "frecuencia_cardiaca": "72 bpm",
  "frecuencia_respiratoria": "16 rpm",
  "saturacion_oxigeno": "98%",
  "peso": "70 kg",
  "altura": "170 cm",
  "imc": "24.2",
  "perimetro_abdominal": "85 cm"
}
```

## 📊 EJEMPLO DE EXAMEN FÍSICO (JSON)

```json
{
  "cabeza": "Normocéfalo, sin lesiones",
  "ojos": "Pupilas isocóricas reactivas",
  "oidos": "Conductos auditivos permeables",
  "nariz": "Sin secreciones",
  "boca": "Mucosa oral hidratada",
  "cuello": "Sin adenopatías, tiroides no palpable",
  "torax": "Simétrico, expansibilidad conservada",
  "pulmones": "Murmullo vesicular conservado, sin ruidos agregados",
  "corazon": "Ruidos cardíacos rítmicos, sin soplos",
  "abdomen": "Blando, depresible, no doloroso, ruidos hidroaéreos presentes",
  "extremidades": "Sin edema, pulsos periféricos presentes",
  "neurologico": "Consciente, orientado en tiempo y espacio, Glasgow 15/15",
  "piel": "Sin lesiones"
}
```

---

## ✅ SIGUIENTE PASO: FRONTEND

Para completar el sistema, necesitas crear la interfaz en el dashboard de doctores que permita:

1. **Ver lista de citas del día** con botón "Atender Paciente"
2. **Modal/Página de Historia Clínica** con formulario para:
   - Motivo de consulta
   - Enfermedad actual
   - Signos vitales (campos individuales)
   - Examen físico por sistemas
   - Diagnóstico
   - Plan de tratamiento
   - Prescripciones médicas
   - Observaciones
   - Fecha de control
3. **Búsqueda de pacientes** para crear historias sin cita previa
4. **Historial del paciente** mostrando todas las visitas anteriores

---

## 🔐 SEGURIDAD

- ✅ Autenticación por JWT de doctor
- ✅ Cada doctor solo puede ver/editar sus propias historias
- ✅ Foreign keys con restricciones CASCADE/RESTRICT
- ✅ Índices en campos de búsqueda frecuente
- ✅ JSON para datos estructurados flexibles

---

## 📝 NOTAS IMPORTANTES

1. Los campos `vital_signs` y `physical_examination` son JSON para máxima flexibilidad
2. El estado 'Borrador' permite guardar progreso parcial
3. La vista `patient_summary` acelera consultas de resumen
4. Las tablas de alergias, medicamentos y antecedentes son independientes y reutilizables

---

## 🚀 ESTADO ACTUAL

✅ Base de datos creada
✅ API endpoints implementados
✅ Backend compilado y desplegado
⏳ Frontend pendiente de implementación

---

¿Deseas que continúe con la implementación del frontend para el dashboard de doctores?
