// ===================================================================
// HERRAMIENTAS MCP MEJORADAS PARA SISTEMA MÉDICO BIOSANARCALL
// Sistema completo de gestión médica con herramientas avanzadas
// ===================================================================

import mysql from 'mysql2/promise';

// Herramientas MCP mejoradas y ampliadas
export const ENHANCED_MEDICAL_TOOLS = [
  
  // ===============================================
  // 1. GESTIÓN AVANZADA DE PACIENTES
  // ===============================================
  
  {
    name: 'searchPatientsAdvanced',
    description: 'Búsqueda avanzada de pacientes con múltiples filtros y criterios',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Término de búsqueda general (nombre, documento, teléfono, email)' },
        document: { type: 'string', description: 'Búsqueda exacta por documento' },
        name: { type: 'string', description: 'Búsqueda por nombre (parcial)' },
        phone: { type: 'string', description: 'Búsqueda por teléfono' },
        email: { type: 'string', description: 'Búsqueda por email' },
        municipality_id: { type: 'number', description: 'Filtrar por municipio' },
        eps_id: { type: 'number', description: 'Filtrar por EPS' },
        age_min: { type: 'number', description: 'Edad mínima' },
        age_max: { type: 'number', description: 'Edad máxima' },
        gender: { type: 'string', enum: ['Masculino','Femenino','Otro','No especificado'], description: 'Filtrar por género' },
        status: { type: 'string', enum: ['Activo','Inactivo'], description: 'Estado del paciente' },
        has_recent_appointments: { type: 'boolean', description: 'Pacientes con citas recientes (últimos 30 días)' },
        has_pending_appointments: { type: 'boolean', description: 'Pacientes con citas pendientes' },
        created_after: { type: 'string', description: 'Registrados después de fecha YYYY-MM-DD' },
        created_before: { type: 'string', description: 'Registrados antes de fecha YYYY-MM-DD' },
        limit: { type: 'number', description: 'Máximo resultados', minimum: 1, maximum: 200, default: 50 },
        offset: { type: 'number', description: 'Desplazamiento para paginación', default: 0 },
        sort_by: { type: 'string', enum: ['name','document','created_at','last_appointment'], description: 'Ordenar por', default: 'name' },
        sort_direction: { type: 'string', enum: ['ASC','DESC'], description: 'Dirección ordenamiento', default: 'ASC' }
      }
    }
  },

  {
    name: 'getPatientProfile',
    description: 'Obtener perfil completo del paciente con estadísticas y resumen médico',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        include_appointments: { type: 'boolean', description: 'Incluir historial de citas', default: true },
        include_medical_records: { type: 'boolean', description: 'Incluir registros médicos', default: false },
        include_allergies: { type: 'boolean', description: 'Incluir alergias', default: true },
        include_prescriptions: { type: 'boolean', description: 'Incluir prescripciones activas', default: true },
        include_lab_results: { type: 'boolean', description: 'Incluir resultados de laboratorio recientes', default: false },
        days_back: { type: 'number', description: 'Días hacia atrás para historial', default: 90 }
      },
      required: ['patient_id']
    }
  },

  {
    name: 'updatePatientExtended',
    description: 'Actualización completa del paciente con validaciones y logs de cambios',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        personal_info: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            phone: { type: 'string' },
            phone_alt: { type: 'string' },
            email: { type: 'string' },
            address: { type: 'string' },
            municipality_id: { type: 'number' },
            zone_id: { type: 'number' }
          }
        },
        medical_info: {
          type: 'object',
          properties: {
            blood_group_id: { type: 'number' },
            has_disability: { type: 'boolean' },
            disability_type_id: { type: 'number' }
          }
        },
        insurance_info: {
          type: 'object',
          properties: {
            insurance_eps_id: { type: 'number' },
            insurance_affiliation_type: { type: 'string', enum: ['Contributivo','Subsidiado','Vinculado','Particular','Otro'] }
          }
        },
        social_info: {
          type: 'object',
          properties: {
            marital_status_id: { type: 'number' },
            education_level_id: { type: 'number' },
            population_group_id: { type: 'number' },
            estrato: { type: 'number', minimum: 0, maximum: 6 }
          }
        },
        notes: { type: 'string', description: 'Notas adicionales' },
        status: { type: 'string', enum: ['Activo', 'Inactivo'] },
        updated_by: { type: 'string', description: 'Usuario que realiza la actualización' },
        update_reason: { type: 'string', description: 'Razón de la actualización' }
      },
      required: ['patient_id']
    }
  },

  {
    name: 'mergePatients',
    description: 'Fusionar dos registros de paciente duplicados',
    inputSchema: {
      type: 'object',
      properties: {
        primary_patient_id: { type: 'number', description: 'ID del paciente principal (se mantiene)' },
        duplicate_patient_id: { type: 'number', description: 'ID del paciente duplicado (se fusiona y elimina)' },
        merge_appointments: { type: 'boolean', description: 'Fusionar citas', default: true },
        merge_medical_records: { type: 'boolean', description: 'Fusionar registros médicos', default: true },
        merge_prescriptions: { type: 'boolean', description: 'Fusionar prescripciones', default: true },
        notes: { type: 'string', description: 'Notas sobre la fusión' },
        performed_by: { type: 'string', description: 'Usuario que realiza la fusión' }
      },
      required: ['primary_patient_id', 'duplicate_patient_id', 'performed_by']
    }
  },

  // ===============================================
  // 2. HISTORIALES MÉDICOS DETALLADOS
  // ===============================================

  {
    name: 'createMedicalRecord',
    description: 'Crear registro médico completo de consulta',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        appointment_id: { type: 'number', description: 'ID de la cita (opcional)' },
        doctor_id: { type: 'number', description: 'ID del médico' },
        record_type: { type: 'string', enum: ['consulta','procedimiento','diagnostico','seguimiento','emergencia'], description: 'Tipo de registro' },
        chief_complaint: { type: 'string', description: 'Motivo de consulta principal' },
        history_present_illness: { type: 'string', description: 'Historia de la enfermedad actual' },
        physical_examination: { type: 'string', description: 'Examen físico' },
        diagnosis_primary: { type: 'string', description: 'Diagnóstico principal' },
        diagnosis_secondary: { type: 'string', description: 'Diagnósticos secundarios' },
        treatment_plan: { type: 'string', description: 'Plan de tratamiento' },
        vital_signs: {
          type: 'object',
          properties: {
            blood_pressure_systolic: { type: 'number' },
            blood_pressure_diastolic: { type: 'number' },
            heart_rate: { type: 'number' },
            temperature: { type: 'number' },
            respiratory_rate: { type: 'number' },
            oxygen_saturation: { type: 'number' },
            weight: { type: 'number' },
            height: { type: 'number' },
            bmi: { type: 'number' }
          }
        },
        medications_prescribed: { 
          type: 'array',
          items: {
            type: 'object',
            properties: {
              medication: { type: 'string' },
              dosage: { type: 'string' },
              frequency: { type: 'string' },
              duration: { type: 'string' },
              instructions: { type: 'string' }
            }
          }
        },
        follow_up_instructions: { type: 'string', description: 'Instrucciones de seguimiento' },
        next_appointment_recommended: { type: 'string', description: 'Próxima cita recomendada YYYY-MM-DD' },
        is_confidential: { type: 'boolean', description: 'Registro confidencial', default: false }
      },
      required: ['patient_id', 'doctor_id', 'record_type', 'chief_complaint']
    }
  },

  {
    name: 'getMedicalRecords',
    description: 'Obtener registros médicos del paciente con filtros avanzados',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        doctor_id: { type: 'number', description: 'Filtrar por médico' },
        record_type: { type: 'string', enum: ['consulta','procedimiento','diagnostico','seguimiento','emergencia'], description: 'Tipo de registro' },
        date_from: { type: 'string', description: 'Fecha desde YYYY-MM-DD' },
        date_to: { type: 'string', description: 'Fecha hasta YYYY-MM-DD' },
        search_text: { type: 'string', description: 'Buscar en diagnósticos y motivos de consulta' },
        include_confidential: { type: 'boolean', description: 'Incluir registros confidenciales', default: false },
        limit: { type: 'number', description: 'Máximo registros', default: 50 },
        offset: { type: 'number', description: 'Desplazamiento', default: 0 }
      },
      required: ['patient_id']
    }
  },

  {
    name: 'updateMedicalRecord',
    description: 'Actualizar registro médico existente',
    inputSchema: {
      type: 'object',
      properties: {
        record_id: { type: 'number', description: 'ID del registro médico' },
        diagnosis_primary: { type: 'string' },
        diagnosis_secondary: { type: 'string' },
        treatment_plan: { type: 'string' },
        follow_up_instructions: { type: 'string' },
        status: { type: 'string', enum: ['draft','completed','reviewed','archived'] },
        doctor_notes: { type: 'string', description: 'Notas adicionales del médico' }
      },
      required: ['record_id']
    }
  },

  // ===============================================
  // 3. SISTEMA DE ALERGIAS Y ANTECEDENTES
  // ===============================================

  {
    name: 'addPatientAllergy',
    description: 'Registrar nueva alergia del paciente',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        allergen: { type: 'string', description: 'Alérgeno (medicamento, alimento, etc.)' },
        allergen_type: { type: 'string', enum: ['medication','food','environmental','chemical','other'], description: 'Tipo de alérgeno' },
        reaction: { type: 'string', description: 'Tipo de reacción observada' },
        severity: { type: 'string', enum: ['mild','moderate','severe','life_threatening'], description: 'Severidad de la reacción' },
        onset_date: { type: 'string', description: 'Fecha de primera reacción YYYY-MM-DD' },
        last_reaction_date: { type: 'string', description: 'Fecha de última reacción YYYY-MM-DD' },
        confirmed_by_doctor: { type: 'boolean', description: 'Confirmado por médico', default: false },
        doctor_id: { type: 'number', description: 'ID del médico que confirma' },
        notes: { type: 'string', description: 'Notas adicionales' }
      },
      required: ['patient_id', 'allergen', 'allergen_type', 'severity']
    }
  },

  {
    name: 'getPatientAllergies',
    description: 'Obtener todas las alergias del paciente',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        allergen_type: { type: 'string', enum: ['medication','food','environmental','chemical','other'], description: 'Filtrar por tipo' },
        severity: { type: 'string', enum: ['mild','moderate','severe','life_threatening'], description: 'Filtrar por severidad' },
        status: { type: 'string', enum: ['active','resolved','suspected'], description: 'Estado de la alergia' },
        active_only: { type: 'boolean', description: 'Solo alergias activas', default: true }
      },
      required: ['patient_id']
    }
  },

  {
    name: 'addMedicalHistory',
    description: 'Agregar antecedente médico al paciente',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        history_type: { type: 'string', enum: ['personal','family','surgical','social','occupational'], description: 'Tipo de antecedente' },
        condition: { type: 'string', description: 'Condición o antecedente' },
        relation: { type: 'string', description: 'Relación familiar (si aplica): padre, madre, hermano, etc.' },
        onset_age: { type: 'number', description: 'Edad de inicio' },
        onset_date: { type: 'string', description: 'Fecha de inicio YYYY-MM-DD' },
        severity: { type: 'string', enum: ['mild','moderate','severe'], description: 'Severidad' },
        status: { type: 'string', enum: ['active','resolved','chronic','managed'], description: 'Estado actual' },
        treatment_received: { type: 'string', description: 'Tratamiento recibido' },
        notes: { type: 'string', description: 'Notas adicionales' },
        confirmed_by_doctor: { type: 'boolean', description: 'Confirmado por médico', default: false },
        doctor_id: { type: 'number', description: 'ID del médico que confirma' }
      },
      required: ['patient_id', 'history_type', 'condition']
    }
  },

  // ===============================================
  // 4. PRESCRIPCIONES Y MEDICAMENTOS
  // ===============================================

  {
    name: 'createPrescription',
    description: 'Crear nueva prescripción médica completa',
    inputSchema: {
      type: 'object',
      properties: {
        medical_record_id: { type: 'number', description: 'ID del registro médico' },
        patient_id: { type: 'number', description: 'ID del paciente' },
        doctor_id: { type: 'number', description: 'ID del médico' },
        medications: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              medication_name: { type: 'string', description: 'Nombre del medicamento' },
              dosage: { type: 'string', description: 'Dosis (ej: 1 tableta, 5ml)' },
              frequency: { type: 'string', description: 'Frecuencia (ej: cada 8 horas, 3 veces al día)' },
              duration_days: { type: 'number', description: 'Duración en días' },
              route: { type: 'string', description: 'Vía de administración', default: 'oral' },
              instructions: { type: 'string', description: 'Instrucciones específicas' },
              quantity_prescribed: { type: 'number', description: 'Cantidad prescrita' },
              refills_allowed: { type: 'number', description: 'Refills permitidos', default: 0 }
            },
            required: ['medication_name', 'dosage', 'frequency']
          }
        },
        instructions: { type: 'string', description: 'Instrucciones generales' },
        valid_until: { type: 'string', description: 'Válida hasta YYYY-MM-DD' },
        notes: { type: 'string', description: 'Notas adicionales' }
      },
      required: ['patient_id', 'doctor_id', 'medications']
    }
  },

  {
    name: 'getActivePrescriptions',
    description: 'Obtener prescripciones activas del paciente',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        doctor_id: { type: 'number', description: 'Filtrar por médico' },
        medication_name: { type: 'string', description: 'Buscar medicamento específico' },
        include_expired: { type: 'boolean', description: 'Incluir prescripciones vencidas', default: false }
      },
      required: ['patient_id']
    }
  },

  {
    name: 'searchMedications',
    description: 'Buscar medicamentos en el catálogo',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Término de búsqueda (nombre o principio activo)' },
        therapeutic_class: { type: 'string', description: 'Clase terapéutica' },
        dosage_form: { type: 'string', description: 'Forma farmacéutica' },
        requires_prescription: { type: 'boolean', description: 'Requiere prescripción médica' },
        is_controlled: { type: 'boolean', description: 'Es medicamento controlado' },
        limit: { type: 'number', description: 'Máximo resultados', default: 20 }
      },
      required: ['query']
    }
  },

  // ===============================================
  // 5. ÓRDENES Y RESULTADOS DE LABORATORIO
  // ===============================================

  {
    name: 'createLabOrder',
    description: 'Crear orden de laboratorio para el paciente',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        doctor_id: { type: 'number', description: 'ID del médico' },
        medical_record_id: { type: 'number', description: 'ID del registro médico (opcional)' },
        lab_tests: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              test_code: { type: 'string', description: 'Código del examen' },
              test_name: { type: 'string', description: 'Nombre del examen' },
              special_handling: { type: 'string', description: 'Manejo especial requerido' }
            },
            required: ['test_code']
          }
        },
        priority: { type: 'string', enum: ['routine','urgent','stat'], description: 'Prioridad', default: 'routine' },
        clinical_indication: { type: 'string', description: 'Indicación clínica' },
        fasting_required: { type: 'boolean', description: 'Requiere ayuno', default: false },
        special_instructions: { type: 'string', description: 'Instrucciones especiales' },
        external_lab: { type: 'string', description: 'Laboratorio externo (si aplica)' },
        notes: { type: 'string', description: 'Notas adicionales' }
      },
      required: ['patient_id', 'doctor_id', 'lab_tests']
    }
  },

  {
    name: 'getLabOrders',
    description: 'Obtener órdenes de laboratorio del paciente',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        doctor_id: { type: 'number', description: 'Filtrar por médico' },
        status: { type: 'string', enum: ['ordered','collected','processing','completed','cancelled'], description: 'Estado de la orden' },
        date_from: { type: 'string', description: 'Fecha desde YYYY-MM-DD' },
        date_to: { type: 'string', description: 'Fecha hasta YYYY-MM-DD' },
        test_category: { type: 'string', description: 'Categoría de exámenes' },
        pending_only: { type: 'boolean', description: 'Solo órdenes pendientes', default: false },
        limit: { type: 'number', description: 'Máximo resultados', default: 50 }
      },
      required: ['patient_id']
    }
  },

  {
    name: 'addLabResults',
    description: 'Registrar resultados de laboratorio',
    inputSchema: {
      type: 'object',
      properties: {
        lab_order_id: { type: 'number', description: 'ID de la orden de laboratorio' },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              test_code: { type: 'string', description: 'Código del examen' },
              result_value: { type: 'string', description: 'Valor del resultado' },
              result_numeric: { type: 'number', description: 'Valor numérico (si aplica)' },
              reference_range: { type: 'string', description: 'Rango de referencia' },
              unit: { type: 'string', description: 'Unidad de medida' },
              abnormal_flag: { type: 'string', enum: ['normal','high','low','critical_high','critical_low','abnormal'], description: 'Bandera de anormalidad' },
              lab_comments: { type: 'string', description: 'Comentarios del laboratorio' },
              critical_result: { type: 'boolean', description: 'Resultado crítico', default: false }
            },
            required: ['test_code', 'result_value']
          }
        },
        result_date: { type: 'string', description: 'Fecha del resultado YYYY-MM-DD HH:MM:SS' },
        lab_technician: { type: 'string', description: 'Técnico de laboratorio' },
        quality_control: { type: 'boolean', description: 'Control de calidad aprobado', default: true }
      },
      required: ['lab_order_id', 'results']
    }
  },

  {
    name: 'getLabResults',
    description: 'Obtener resultados de laboratorio del paciente',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        test_code: { type: 'string', description: 'Código específico de examen' },
        test_category: { type: 'string', description: 'Categoría de exámenes' },
        date_from: { type: 'string', description: 'Fecha desde YYYY-MM-DD' },
        date_to: { type: 'string', description: 'Fecha hasta YYYY-MM-DD' },
        abnormal_only: { type: 'boolean', description: 'Solo resultados anormales', default: false },
        critical_only: { type: 'boolean', description: 'Solo resultados críticos', default: false },
        reviewed_only: { type: 'boolean', description: 'Solo resultados revisados por médico', default: false },
        limit: { type: 'number', description: 'Máximo resultados', default: 100 }
      },
      required: ['patient_id']
    }
  },

  // ===============================================
  // 6. PLANES DE TRATAMIENTO Y SEGUIMIENTO
  // ===============================================

  {
    name: 'createTreatmentPlan',
    description: 'Crear plan de tratamiento para el paciente',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        doctor_id: { type: 'number', description: 'ID del médico' },
        medical_record_id: { type: 'number', description: 'ID del registro médico (opcional)' },
        plan_name: { type: 'string', description: 'Nombre del plan de tratamiento' },
        description: { type: 'string', description: 'Descripción detallada' },
        start_date: { type: 'string', description: 'Fecha de inicio YYYY-MM-DD' },
        end_date: { type: 'string', description: 'Fecha estimada de finalización YYYY-MM-DD' },
        priority: { type: 'string', enum: ['low','normal','high','urgent'], description: 'Prioridad', default: 'normal' },
        goals: { type: 'string', description: 'Objetivos del tratamiento' },
        success_criteria: { type: 'string', description: 'Criterios de éxito' },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              task_name: { type: 'string', description: 'Nombre de la tarea' },
              description: { type: 'string', description: 'Descripción de la tarea' },
              task_type: { type: 'string', enum: ['medication','exercise','therapy','test','appointment','lifestyle','monitoring'], description: 'Tipo de tarea' },
              frequency: { type: 'string', description: 'Frecuencia (diario, semanal, etc.)' },
              duration: { type: 'string', description: 'Duración (por 2 semanas, etc.)' },
              instructions: { type: 'string', description: 'Instrucciones específicas' },
              due_date: { type: 'string', description: 'Fecha límite YYYY-MM-DD' },
              priority: { type: 'string', enum: ['low','normal','high'], description: 'Prioridad de la tarea' },
              reminder_enabled: { type: 'boolean', description: 'Habilitar recordatorios', default: false }
            },
            required: ['task_name', 'task_type']
          }
        },
        notes: { type: 'string', description: 'Notas adicionales' }
      },
      required: ['patient_id', 'doctor_id', 'plan_name', 'start_date']
    }
  },

  {
    name: 'getTreatmentPlans',
    description: 'Obtener planes de tratamiento del paciente',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        doctor_id: { type: 'number', description: 'Filtrar por médico' },
        status: { type: 'string', enum: ['planned','active','completed','suspended','cancelled'], description: 'Estado del plan' },
        priority: { type: 'string', enum: ['low','normal','high','urgent'], description: 'Prioridad' },
        active_only: { type: 'boolean', description: 'Solo planes activos', default: false },
        include_tasks: { type: 'boolean', description: 'Incluir tareas del plan', default: true }
      },
      required: ['patient_id']
    }
  },

  {
    name: 'updateTreatmentTask',
    description: 'Actualizar tarea de un plan de tratamiento',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'ID de la tarea' },
        status: { type: 'string', enum: ['pending','in_progress','completed','skipped','cancelled'], description: 'Nuevo estado' },
        completion_notes: { type: 'string', description: 'Notas de finalización' },
        completion_date: { type: 'string', description: 'Fecha de finalización YYYY-MM-DD' },
        next_due_date: { type: 'string', description: 'Próxima fecha límite YYYY-MM-DD (para tareas recurrentes)' }
      },
      required: ['task_id', 'status']
    }
  },

  // ===============================================
  // 7. GESTIÓN AVANZADA DE CITAS
  // ===============================================

  {
    name: 'getAppointmentsAdvanced',
    description: 'Búsqueda avanzada de citas con múltiples filtros',
    inputSchema: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Fecha desde YYYY-MM-DD' },
        date_to: { type: 'string', description: 'Fecha hasta YYYY-MM-DD' },
        patient_id: { type: 'number', description: 'ID del paciente' },
        doctor_id: { type: 'number', description: 'ID del médico' },
        specialty_id: { type: 'number', description: 'ID de la especialidad' },
        location_id: { type: 'number', description: 'ID de la ubicación' },
        status: { type: 'string', enum: ['Pendiente','Confirmada','Completada','Cancelada'], description: 'Estado de la cita' },
        appointment_type: { type: 'string', enum: ['Presencial','Telemedicina'], description: 'Tipo de cita' },
        patient_name: { type: 'string', description: 'Buscar por nombre de paciente' },
        patient_document: { type: 'string', description: 'Buscar por documento de paciente' },
        reason_contains: { type: 'string', description: 'Buscar en motivo de la cita' },
        created_after: { type: 'string', description: 'Creadas después de fecha YYYY-MM-DD' },
        duration_min: { type: 'number', description: 'Duración mínima en minutos' },
        duration_max: { type: 'number', description: 'Duración máxima en minutos' },
        has_medical_record: { type: 'boolean', description: 'Citas con registro médico' },
        sort_by: { type: 'string', enum: ['scheduled_at','created_at','patient_name','doctor_name'], description: 'Ordenar por', default: 'scheduled_at' },
        sort_direction: { type: 'string', enum: ['ASC','DESC'], description: 'Dirección', default: 'ASC' },
        limit: { type: 'number', description: 'Máximo resultados', default: 100 },
        offset: { type: 'number', description: 'Desplazamiento', default: 0 }
      }
    }
  },

  {
    name: 'scheduleAppointmentAdvanced',
    description: 'Programar cita con validaciones avanzadas y verificación de disponibilidad',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        doctor_id: { type: 'number', description: 'ID del médico' },
        specialty_id: { type: 'number', description: 'ID de la especialidad' },
        location_id: { type: 'number', description: 'ID de la ubicación' },
        scheduled_at: { type: 'string', description: 'Fecha y hora YYYY-MM-DD HH:MM:SS' },
        duration_minutes: { type: 'number', description: 'Duración en minutos', default: 30 },
        appointment_type: { type: 'string', enum: ['Presencial','Telemedicina'], description: 'Tipo de cita', default: 'Presencial' },
        reason: { type: 'string', description: 'Motivo de la cita' },
        notes: { type: 'string', description: 'Notas adicionales' },
        priority: { type: 'string', enum: ['normal','high','urgent'], description: 'Prioridad', default: 'normal' },
        insurance_type: { type: 'string', description: 'Tipo de seguro para la cita' },
        check_availability: { type: 'boolean', description: 'Verificar disponibilidad antes de crear', default: true },
        check_conflicts: { type: 'boolean', description: 'Verificar conflictos con otras citas del paciente', default: true },
        send_confirmation: { type: 'boolean', description: 'Enviar confirmación al paciente', default: false },
        created_by: { type: 'string', description: 'Usuario que crea la cita' }
      },
      required: ['patient_id', 'doctor_id', 'specialty_id', 'location_id', 'scheduled_at']
    }
  },

  {
    name: 'rescheduleAppointment',
    description: 'Reprogramar cita existente con verificaciones',
    inputSchema: {
      type: 'object',
      properties: {
        appointment_id: { type: 'number', description: 'ID de la cita' },
        new_datetime: { type: 'string', description: 'Nueva fecha y hora YYYY-MM-DD HH:MM:SS' },
        new_doctor_id: { type: 'number', description: 'Nuevo médico (opcional)' },
        new_location_id: { type: 'number', description: 'Nueva ubicación (opcional)' },
        reason_for_change: { type: 'string', description: 'Razón del cambio' },
        check_availability: { type: 'boolean', description: 'Verificar disponibilidad', default: true },
        notify_patient: { type: 'boolean', description: 'Notificar al paciente', default: false },
        updated_by: { type: 'string', description: 'Usuario que reprograma' }
      },
      required: ['appointment_id', 'new_datetime', 'reason_for_change']
    }
  },

  {
    name: 'getAppointmentConflicts',
    description: 'Verificar conflictos de citas para un médico o paciente',
    inputSchema: {
      type: 'object',
      properties: {
        doctor_id: { type: 'number', description: 'ID del médico' },
        patient_id: { type: 'number', description: 'ID del paciente' },
        proposed_datetime: { type: 'string', description: 'Fecha y hora propuesta YYYY-MM-DD HH:MM:SS' },
        duration_minutes: { type: 'number', description: 'Duración propuesta en minutos', default: 30 },
        exclude_appointment_id: { type: 'number', description: 'Excluir cita específica (para reprogramación)' },
        check_availability: { type: 'boolean', description: 'Verificar disponibilidad del médico', default: true }
      },
      required: ['proposed_datetime']
    }
  },

  // ===============================================
  // 8. REPORTES Y ESTADÍSTICAS AVANZADAS
  // ===============================================

  {
    name: 'generatePatientReport',
    description: 'Generar reporte completo del paciente',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        report_type: { 
          type: 'string', 
          enum: ['complete','summary','medical_only','appointments_only','prescriptions_only','lab_results_only'], 
          description: 'Tipo de reporte',
          default: 'complete'
        },
        date_from: { type: 'string', description: 'Fecha desde YYYY-MM-DD' },
        date_to: { type: 'string', description: 'Fecha hasta YYYY-MM-DD' },
        include_confidential: { type: 'boolean', description: 'Incluir información confidencial', default: false },
        format: { type: 'string', enum: ['json','summary','detailed'], description: 'Formato del reporte', default: 'json' },
        requested_by: { type: 'string', description: 'Usuario que solicita el reporte' }
      },
      required: ['patient_id']
    }
  },

  {
    name: 'getDashboardStats',
    description: 'Obtener estadísticas para dashboard administrativo',
    inputSchema: {
      type: 'object',
      properties: {
        date_range: { type: 'string', enum: ['today','week','month','quarter','year','custom'], description: 'Rango de fechas', default: 'today' },
        date_from: { type: 'string', description: 'Fecha desde (para custom) YYYY-MM-DD' },
        date_to: { type: 'string', description: 'Fecha hasta (para custom) YYYY-MM-DD' },
        location_id: { type: 'number', description: 'Filtrar por ubicación' },
        specialty_id: { type: 'number', description: 'Filtrar por especialidad' },
        doctor_id: { type: 'number', description: 'Filtrar por médico' },
        include_comparisons: { type: 'boolean', description: 'Incluir comparaciones con período anterior', default: true }
      }
    }
  },

  {
    name: 'getAppointmentAnalytics',
    description: 'Análisis detallado de citas y patrones de atención',
    inputSchema: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Fecha desde YYYY-MM-DD' },
        date_to: { type: 'string', description: 'Fecha hasta YYYY-MM-DD' },
        analysis_type: { 
          type: 'string', 
          enum: ['trends','patterns','performance','utilization','no_shows','popular_times'], 
          description: 'Tipo de análisis',
          default: 'trends'
        },
        group_by: { 
          type: 'string', 
          enum: ['day','week','month','specialty','doctor','location','hour_of_day','day_of_week'], 
          description: 'Agrupar por',
          default: 'day'
        },
        doctor_id: { type: 'number', description: 'Filtrar por médico' },
        specialty_id: { type: 'number', description: 'Filtrar por especialidad' },
        location_id: { type: 'number', description: 'Filtrar por ubicación' }
      },
      required: ['date_from', 'date_to']
    }
  },

  {
    name: 'getPatientAnalytics',
    description: 'Análisis de pacientes y demografías',
    inputSchema: {
      type: 'object',
      properties: {
        analysis_type: { 
          type: 'string', 
          enum: ['demographics','new_patients','returning_patients','by_age_group','by_eps','by_municipality','health_trends'], 
          description: 'Tipo de análisis',
          default: 'demographics'
        },
        date_from: { type: 'string', description: 'Fecha desde YYYY-MM-DD' },
        date_to: { type: 'string', description: 'Fecha hasta YYYY-MM-DD' },
        location_id: { type: 'number', description: 'Filtrar por ubicación' },
        age_ranges: { 
          type: 'array',
          items: { type: 'string' },
          description: 'Rangos de edad personalizados',
          default: ['0-17','18-30','31-50','51-70','70+']
        }
      }
    }
  },

  // ===============================================
  // 9. SISTEMA DE BÚSQUEDA INTELIGENTE
  // ===============================================

  {
    name: 'intelligentSearch',
    description: 'Búsqueda inteligente multi-entidad en todo el sistema',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Término de búsqueda general' },
        search_in: {
          type: 'array',
          items: { type: 'string', enum: ['patients','appointments','doctors','medical_records','prescriptions','lab_results','diagnoses'] },
          description: 'Entidades donde buscar',
          default: ['patients','appointments','medical_records']
        },
        filters: {
          type: 'object',
          properties: {
            date_from: { type: 'string' },
            date_to: { type: 'string' },
            location_id: { type: 'number' },
            specialty_id: { type: 'number' },
            doctor_id: { type: 'number' },
            patient_age_min: { type: 'number' },
            patient_age_max: { type: 'number' },
            status_filter: { type: 'string' }
          }
        },
        include_similar: { type: 'boolean', description: 'Incluir resultados similares', default: true },
        fuzzy_search: { type: 'boolean', description: 'Búsqueda difusa para errores tipográficos', default: true },
        limit_per_entity: { type: 'number', description: 'Máximo resultados por entidad', default: 10 },
        relevance_threshold: { type: 'number', description: 'Umbral de relevancia (0-1)', default: 0.3 }
      },
      required: ['query']
    }
  },

  // ===============================================
  // 10. HERRAMIENTAS DE ADMINISTRACIÓN
  // ===============================================

  {
    name: 'getSystemHealth',
    description: 'Verificar estado de salud del sistema y base de datos',
    inputSchema: {
      type: 'object',
      properties: {
        include_performance: { type: 'boolean', description: 'Incluir métricas de rendimiento', default: true },
        include_storage: { type: 'boolean', description: 'Incluir información de almacenamiento', default: true },
        check_connections: { type: 'boolean', description: 'Verificar conexiones de BD', default: true }
      }
    }
  },

  {
    name: 'optimizeDatabase',
    description: 'Ejecutar optimizaciones de base de datos',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { 
          type: 'string', 
          enum: ['analyze','optimize','repair','cleanup_old_data'], 
          description: 'Tipo de operación',
          default: 'analyze'
        },
        tables: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tablas específicas (vacío = todas)'
        },
        days_to_keep: { type: 'number', description: 'Días de datos a mantener (para cleanup)', default: 365 },
        dry_run: { type: 'boolean', description: 'Solo simular sin ejecutar cambios', default: true }
      }
    }
  }
];

// ===================================================================
// FUNCIONES DE EJECUCIÓN DE HERRAMIENTAS MEJORADAS
// ===================================================================

export async function executeEnhancedMedicalTool(
  toolName: string, 
  args: any, 
  pool: mysql.Pool
): Promise<any> {
  
  try {
    switch (toolName) {
      
      // ===============================================
      // GESTIÓN AVANZADA DE PACIENTES
      // ===============================================
      
      case 'searchPatientsAdvanced':
        return await searchPatientsAdvanced(args, pool);
      
      case 'getPatientProfile':
        return await getPatientProfile(args, pool);
      
      case 'updatePatientExtended':
        return await updatePatientExtended(args, pool);
      
      case 'mergePatients':
        return await mergePatients(args, pool);
      
      // ===============================================
      // HISTORIALES MÉDICOS
      // ===============================================
      
      case 'createMedicalRecord':
        return await createMedicalRecord(args, pool);
      
      case 'getMedicalRecords':
        return await getMedicalRecords(args, pool);
      
      case 'updateMedicalRecord':
        return await updateMedicalRecord(args, pool);
      
      // ===============================================
      // ALERGIAS Y ANTECEDENTES
      // ===============================================
      
      case 'addPatientAllergy':
        return await addPatientAllergy(args, pool);
      
      case 'getPatientAllergies':
        return await getPatientAllergies(args, pool);
      
      case 'addMedicalHistory':
        return await addMedicalHistory(args, pool);
      
      // ===============================================
      // PRESCRIPCIONES
      // ===============================================
      
      case 'createPrescription':
        return await createPrescription(args, pool);
      
      case 'getActivePrescriptions':
        return await getActivePrescriptions(args, pool);
      
      case 'searchMedications':
        return await searchMedications(args, pool);
      
      // ===============================================
      // LABORATORIOS
      // ===============================================
      
      case 'createLabOrder':
        return await createLabOrder(args, pool);
      
      case 'getLabOrders':
        return await getLabOrders(args, pool);
      
      case 'addLabResults':
        return await addLabResults(args, pool);
      
      case 'getLabResults':
        return await getLabResults(args, pool);
      
      // ===============================================
      // PLANES DE TRATAMIENTO
      // ===============================================
      
      case 'createTreatmentPlan':
        return await createTreatmentPlan(args, pool);
      
      case 'getTreatmentPlans':
        return await getTreatmentPlans(args, pool);
      
      case 'updateTreatmentTask':
        return await updateTreatmentTask(args, pool);
      
      // ===============================================
      // CITAS AVANZADAS
      // ===============================================
      
      case 'getAppointmentsAdvanced':
        return await getAppointmentsAdvanced(args, pool);
      
      case 'scheduleAppointmentAdvanced':
        return await scheduleAppointmentAdvanced(args, pool);
      
      case 'rescheduleAppointment':
        return await rescheduleAppointment(args, pool);
      
      case 'getAppointmentConflicts':
        return await getAppointmentConflicts(args, pool);
      
      // ===============================================
      // REPORTES Y ESTADÍSTICAS
      // ===============================================
      
      case 'generatePatientReport':
        return await generatePatientReport(args, pool);
      
      case 'getDashboardStats':
        return await getDashboardStats(args, pool);
      
      case 'getAppointmentAnalytics':
        return await getAppointmentAnalytics(args, pool);
      
      case 'getPatientAnalytics':
        return await getPatientAnalytics(args, pool);
      
      // ===============================================
      // BÚSQUEDA INTELIGENTE
      // ===============================================
      
      case 'intelligentSearch':
        return await intelligentSearch(args, pool);
      
      // ===============================================
      // ADMINISTRACIÓN
      // ===============================================
      
      case 'getSystemHealth':
        return await getSystemHealth(args, pool);
      
      case 'optimizeDatabase':
        return await optimizeDatabase(args, pool);
      
      default:
        throw new Error(`Herramienta ${toolName} no implementada en el módulo mejorado`);
    }
    
  } catch (error: any) {
    console.error(`Error ejecutando herramienta ${toolName}:`, error);
    throw new Error(`Error en ${toolName}: ${error.message}`);
  }
}

// ===================================================================
// IMPLEMENTACIONES DE FUNCIONES COMPLETAS
// ===================================================================

async function searchPatientsAdvanced(args: any, pool: mysql.Pool): Promise<any> {
  let query = `
    SELECT DISTINCT p.*, 
           m.name as municipality_name,
           e.name as eps_name,
           TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age,
           COUNT(DISTINCT a.id) as total_appointments,
           MAX(a.scheduled_at) as last_appointment_date,
           COUNT(DISTINCT CASE WHEN a.status = 'Pendiente' THEN a.id END) as pending_appointments
    FROM patients p
    LEFT JOIN municipalities m ON p.municipality_id = m.id
    LEFT JOIN eps e ON p.insurance_eps_id = e.id
    LEFT JOIN appointments a ON p.id = a.patient_id
    WHERE p.status = 'Activo'
  `;
  
  const conditions: string[] = [];
  const values: any[] = [];
  
  if (args.query) {
    conditions.push('(p.name LIKE ? OR p.document LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)');
    values.push(`%${args.query}%`, `%${args.query}%`, `%${args.query}%`, `%${args.query}%`);
  }
  
  if (args.document) {
    conditions.push('p.document = ?');
    values.push(args.document);
  }
  
  if (args.name) {
    conditions.push('p.name LIKE ?');
    values.push(`%${args.name}%`);
  }
  
  if (args.phone) {
    conditions.push('(p.phone LIKE ? OR p.phone_alt LIKE ?)');
    values.push(`%${args.phone}%`, `%${args.phone}%`);
  }
  
  if (args.email) {
    conditions.push('p.email LIKE ?');
    values.push(`%${args.email}%`);
  }
  
  if (args.municipality_id) {
    conditions.push('p.municipality_id = ?');
    values.push(args.municipality_id);
  }
  
  if (args.eps_id) {
    conditions.push('p.insurance_eps_id = ?');
    values.push(args.eps_id);
  }
  
  if (args.gender) {
    conditions.push('p.gender = ?');
    values.push(args.gender);
  }
  
  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ');
  }
  
  query += ' GROUP BY p.id';
  
  if (args.age_min || args.age_max) {
    query += ' HAVING 1=1';
    if (args.age_min) {
      query += ' AND age >= ?';
      values.push(args.age_min);
    }
    if (args.age_max) {
      query += ' AND age <= ?';
      values.push(args.age_max);
    }
  }
  
  if (args.has_recent_appointments) {
    query += ' AND last_appointment_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
  }
  
  if (args.has_pending_appointments) {
    query += ' AND pending_appointments > 0';
  }
  
  const sortBy = args.sort_by || 'name';
  const sortDirection = args.sort_direction || 'ASC';
  query += ` ORDER BY ${sortBy} ${sortDirection}`;
  
  const limit = Math.min(args.limit || 50, 200);
  const offset = args.offset || 0;
  query += ` LIMIT ${limit} OFFSET ${offset}`;
  
  const [rows] = await pool.execute(query, values);
  return { 
    patients: rows, 
    total_returned: (rows as any[]).length,
    search_criteria: args 
  };
}

async function getPatientProfile(args: any, pool: mysql.Pool): Promise<any> {
  // Obtener información básica del paciente
  const [patientRows] = await pool.execute(`
    SELECT p.*, m.name as municipality_name, e.name as eps_name,
           TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age
    FROM patients p
    LEFT JOIN municipalities m ON p.municipality_id = m.id
    LEFT JOIN eps e ON p.insurance_eps_id = e.id
    WHERE p.id = ?
  `, [args.patient_id]);
  
  if ((patientRows as any[]).length === 0) {
    throw new Error('Paciente no encontrado');
  }
  
  const patient = (patientRows as any[])[0];
  const result: any = { patient };
  
  if (args.include_appointments !== false) {
    const daysBack = args.days_back || 90;
    const [appointments] = await pool.execute(`
      SELECT a.*, d.name as doctor_name, s.name as specialty_name, l.name as location_name
      FROM appointments a
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.patient_id = ? AND a.scheduled_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY a.scheduled_at DESC
    `, [args.patient_id, daysBack]);
    result.appointments = appointments;
  }
  
  if (args.include_allergies !== false) {
    const [allergies] = await pool.execute(`
      SELECT * FROM patient_allergies 
      WHERE patient_id = ? AND status = 'active'
      ORDER BY severity DESC, created_at DESC
    `, [args.patient_id]);
    result.allergies = allergies;
  }
  
  if (args.include_prescriptions !== false) {
    const [prescriptions] = await pool.execute(`
      SELECT p.*, pm.medication_name, pm.dosage, pm.frequency
      FROM prescriptions p
      LEFT JOIN prescription_medications pm ON p.id = pm.prescription_id
      WHERE p.patient_id = ? AND p.status = 'active'
      ORDER BY p.created_at DESC
    `, [args.patient_id]);
    result.prescriptions = prescriptions;
  }
  
  return result;
}

async function updatePatientExtended(args: any, pool: mysql.Pool): Promise<any> {
  const updates: string[] = [];
  const values: any[] = [];
  
  if (args.personal_info) {
    const info = args.personal_info;
    if (info.name) { updates.push('name = ?'); values.push(info.name); }
    if (info.phone) { updates.push('phone = ?'); values.push(info.phone); }
    if (info.email) { updates.push('email = ?'); values.push(info.email); }
    if (info.address) { updates.push('address = ?'); values.push(info.address); }
  }
  
  if (updates.length === 0) {
    throw new Error('No hay campos para actualizar');
  }
  
  updates.push('updated_at = NOW()');
  values.push(args.patient_id);
  
  const query = `UPDATE patients SET ${updates.join(', ')} WHERE id = ?`;
  await pool.execute(query, values);
  
  return { success: true, message: 'Paciente actualizado correctamente' };
}

async function mergePatients(args: any, pool: mysql.Pool): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Transferir citas
    if (args.merge_appointments) {
      await connection.execute(
        'UPDATE appointments SET patient_id = ? WHERE patient_id = ?',
        [args.primary_patient_id, args.duplicate_patient_id]
      );
    }
    
    // Transferir registros médicos
    if (args.merge_medical_records) {
      await connection.execute(
        'UPDATE medical_records SET patient_id = ? WHERE patient_id = ?',
        [args.primary_patient_id, args.duplicate_patient_id]
      );
    }
    
    // Transferir prescripciones
    if (args.merge_prescriptions) {
      await connection.execute(
        'UPDATE prescriptions SET patient_id = ? WHERE patient_id = ?',
        [args.primary_patient_id, args.duplicate_patient_id]
      );
    }
    
    // Marcar paciente duplicado como inactivo en lugar de eliminarlo
    await connection.execute(
      'UPDATE patients SET status = "Inactivo", notes = CONCAT(COALESCE(notes, ""), " - FUSIONADO CON PACIENTE ID: ", ?) WHERE id = ?',
      [args.primary_patient_id, args.duplicate_patient_id]
    );
    
    await connection.commit();
    return { success: true, message: 'Pacientes fusionados correctamente' };
    
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createMedicalRecord(args: any, pool: mysql.Pool): Promise<any> {
  const [result] = await pool.execute(`
    INSERT INTO medical_records (
      patient_id, doctor_id, appointment_id, record_type, chief_complaint,
      history_present_illness, physical_examination, diagnosis_primary, diagnosis_secondary,
      treatment_plan, follow_up_instructions, is_confidential, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `, [
    args.patient_id, args.doctor_id, args.appointment_id, args.record_type,
    args.chief_complaint, args.history_present_illness, args.physical_examination,
    args.diagnosis_primary, args.diagnosis_secondary, args.treatment_plan,
    args.follow_up_instructions, args.is_confidential || false
  ]);
  
  const recordId = (result as any).insertId;
  
  // Insertar signos vitales si se proporcionaron
  if (args.vital_signs) {
    await pool.execute(`
      INSERT INTO vital_signs (
        medical_record_id, blood_pressure_systolic, blood_pressure_diastolic,
        heart_rate, temperature, respiratory_rate, oxygen_saturation, weight, height, bmi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      recordId, args.vital_signs.blood_pressure_systolic, args.vital_signs.blood_pressure_diastolic,
      args.vital_signs.heart_rate, args.vital_signs.temperature, args.vital_signs.respiratory_rate,
      args.vital_signs.oxygen_saturation, args.vital_signs.weight, args.vital_signs.height, args.vital_signs.bmi
    ]);
  }
  
  return { success: true, record_id: recordId, message: 'Registro médico creado correctamente' };
}

async function getMedicalRecords(args: any, pool: mysql.Pool): Promise<any> {
  let query = `
    SELECT mr.*, d.name as doctor_name, vs.blood_pressure_systolic, vs.heart_rate, vs.temperature
    FROM medical_records mr
    LEFT JOIN doctors d ON mr.doctor_id = d.id
    LEFT JOIN vital_signs vs ON mr.id = vs.medical_record_id
    WHERE mr.patient_id = ?
  `;
  
  const values = [args.patient_id];
  
  if (args.record_type) {
    query += ' AND mr.record_type = ?';
    values.push(args.record_type);
  }
  
  if (args.date_from) {
    query += ' AND DATE(mr.created_at) >= ?';
    values.push(args.date_from);
  }
  
  if (args.date_to) {
    query += ' AND DATE(mr.created_at) <= ?';
    values.push(args.date_to);
  }
  
  if (!args.include_confidential) {
    query += ' AND mr.is_confidential = false';
  }
  
  query += ' ORDER BY mr.created_at DESC';
  
  const limit = args.limit || 50;
  query += ` LIMIT ${limit}`;
  
  const [rows] = await pool.execute(query, values);
  return { medical_records: rows };
}

async function updateMedicalRecord(args: any, pool: mysql.Pool): Promise<any> {
  const updates: string[] = [];
  const values: any[] = [];
  
  if (args.diagnosis_primary) { updates.push('diagnosis_primary = ?'); values.push(args.diagnosis_primary); }
  if (args.diagnosis_secondary) { updates.push('diagnosis_secondary = ?'); values.push(args.diagnosis_secondary); }
  if (args.treatment_plan) { updates.push('treatment_plan = ?'); values.push(args.treatment_plan); }
  if (args.follow_up_instructions) { updates.push('follow_up_instructions = ?'); values.push(args.follow_up_instructions); }
  if (args.status) { updates.push('status = ?'); values.push(args.status); }
  
  if (updates.length === 0) {
    throw new Error('No hay campos para actualizar');
  }
  
  updates.push('updated_at = NOW()');
  values.push(args.record_id);
  
  const query = `UPDATE medical_records SET ${updates.join(', ')} WHERE id = ?`;
  await pool.execute(query, values);
  
  return { success: true, message: 'Registro médico actualizado correctamente' };
}

async function addPatientAllergy(args: any, pool: mysql.Pool): Promise<any> {
  const [result] = await pool.execute(`
    INSERT INTO patient_allergies (
      patient_id, allergen, allergen_type, reaction, severity, onset_date,
      last_reaction_date, confirmed_by_doctor, doctor_id, notes, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())
  `, [
    args.patient_id, args.allergen, args.allergen_type, args.reaction, args.severity,
    args.onset_date, args.last_reaction_date, args.confirmed_by_doctor || false,
    args.doctor_id, args.notes
  ]);
  
  return { success: true, allergy_id: (result as any).insertId, message: 'Alergia registrada correctamente' };
}

async function getPatientAllergies(args: any, pool: mysql.Pool): Promise<any> {
  let query = `
    SELECT pa.*, d.name as doctor_name
    FROM patient_allergies pa
    LEFT JOIN doctors d ON pa.doctor_id = d.id
    WHERE pa.patient_id = ?
  `;
  
  const values = [args.patient_id];
  
  if (args.allergen_type) {
    query += ' AND pa.allergen_type = ?';
    values.push(args.allergen_type);
  }
  
  if (args.severity) {
    query += ' AND pa.severity = ?';
    values.push(args.severity);
  }
  
  if (args.active_only !== false) {
    query += ' AND pa.status = "active"';
  }
  
  query += ' ORDER BY pa.severity DESC, pa.created_at DESC';
  
  const [rows] = await pool.execute(query, values);
  return { allergies: rows };
}

async function addMedicalHistory(args: any, pool: mysql.Pool): Promise<any> {
  const [result] = await pool.execute(`
    INSERT INTO medical_history (
      patient_id, history_type, condition, relation, onset_age, onset_date,
      severity, status, treatment_received, notes, confirmed_by_doctor, doctor_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `, [
    args.patient_id, args.history_type, args.condition, args.relation, args.onset_age,
    args.onset_date, args.severity, args.status, args.treatment_received, args.notes,
    args.confirmed_by_doctor || false, args.doctor_id
  ]);
  
  return { success: true, history_id: (result as any).insertId, message: 'Antecedente médico registrado correctamente' };
}

async function createPrescription(args: any, pool: mysql.Pool): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Crear prescripción principal
    const [prescResult] = await connection.execute(`
      INSERT INTO prescriptions (
        patient_id, doctor_id, medical_record_id, instructions, valid_until, notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())
    `, [
      args.patient_id, args.doctor_id, args.medical_record_id,
      args.instructions, args.valid_until, args.notes
    ]);
    
    const prescriptionId = (prescResult as any).insertId;
    
    // Agregar medicamentos
    for (const med of args.medications) {
      await connection.execute(`
        INSERT INTO prescription_medications (
          prescription_id, medication_name, dosage, frequency, duration_days,
          route, instructions, quantity_prescribed, refills_allowed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        prescriptionId, med.medication_name, med.dosage, med.frequency, med.duration_days,
        med.route || 'oral', med.instructions, med.quantity_prescribed, med.refills_allowed || 0
      ]);
    }
    
    await connection.commit();
    return { success: true, prescription_id: prescriptionId, message: 'Prescripción creada correctamente' };
    
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getActivePrescriptions(args: any, pool: mysql.Pool): Promise<any> {
  let query = `
    SELECT p.*, pm.medication_name, pm.dosage, pm.frequency, pm.instructions as med_instructions,
           d.name as doctor_name
    FROM prescriptions p
    LEFT JOIN prescription_medications pm ON p.id = pm.prescription_id
    LEFT JOIN doctors d ON p.doctor_id = d.id
    WHERE p.patient_id = ? AND p.status = 'active'
  `;
  
  const values = [args.patient_id];
  
  if (args.doctor_id) {
    query += ' AND p.doctor_id = ?';
    values.push(args.doctor_id);
  }
  
  if (args.medication_name) {
    query += ' AND pm.medication_name LIKE ?';
    values.push(`%${args.medication_name}%`);
  }
  
  if (!args.include_expired) {
    query += ' AND (p.valid_until IS NULL OR p.valid_until >= CURDATE())';
  }
  
  query += ' ORDER BY p.created_at DESC';
  
  const [rows] = await pool.execute(query, values);
  return { prescriptions: rows };
}

async function searchMedications(args: any, pool: mysql.Pool): Promise<any> {
  // Simular catálogo de medicamentos básico
  const medications = [
    { name: 'Acetaminofén', therapeutic_class: 'Analgésico', requires_prescription: false },
    { name: 'Ibuprofeno', therapeutic_class: 'Antiinflamatorio', requires_prescription: false },
    { name: 'Amoxicilina', therapeutic_class: 'Antibiótico', requires_prescription: true },
    { name: 'Losartán', therapeutic_class: 'Antihipertensivo', requires_prescription: true },
    { name: 'Metformina', therapeutic_class: 'Antidiabético', requires_prescription: true }
  ].filter(med => med.name.toLowerCase().includes(args.query.toLowerCase()));
  
  return { medications: medications.slice(0, args.limit || 20) };
}

async function createLabOrder(args: any, pool: mysql.Pool): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Crear orden principal
    const [orderResult] = await connection.execute(`
      INSERT INTO lab_orders (
        patient_id, doctor_id, medical_record_id, priority, clinical_indication,
        fasting_required, special_instructions, external_lab, notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ordered', NOW())
    `, [
      args.patient_id, args.doctor_id, args.medical_record_id, args.priority || 'routine',
      args.clinical_indication, args.fasting_required || false, args.special_instructions,
      args.external_lab, args.notes
    ]);
    
    const orderId = (orderResult as any).insertId;
    
    // Agregar exámenes
    for (const test of args.lab_tests) {
      await connection.execute(`
        INSERT INTO lab_order_tests (lab_order_id, test_code, test_name, special_handling)
        VALUES (?, ?, ?, ?)
      `, [orderId, test.test_code, test.test_name, test.special_handling]);
    }
    
    await connection.commit();
    return { success: true, lab_order_id: orderId, message: 'Orden de laboratorio creada correctamente' };
    
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getLabOrders(args: any, pool: mysql.Pool): Promise<any> {
  let query = `
    SELECT lo.*, lot.test_name, d.name as doctor_name
    FROM lab_orders lo
    LEFT JOIN lab_order_tests lot ON lo.id = lot.lab_order_id
    LEFT JOIN doctors d ON lo.doctor_id = d.id
    WHERE lo.patient_id = ?
  `;
  
  const values = [args.patient_id];
  
  if (args.status) {
    query += ' AND lo.status = ?';
    values.push(args.status);
  }
  
  if (args.pending_only) {
    query += ' AND lo.status IN ("ordered", "collected", "processing")';
  }
  
  query += ' ORDER BY lo.created_at DESC';
  
  const [rows] = await pool.execute(query, values);
  return { lab_orders: rows };
}

async function addLabResults(args: any, pool: mysql.Pool): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Agregar resultados
    for (const result of args.results) {
      await connection.execute(`
        INSERT INTO lab_results (
          lab_order_id, test_code, result_value, result_numeric, reference_range,
          unit, abnormal_flag, lab_comments, critical_result, result_date, lab_technician
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        args.lab_order_id, result.test_code, result.result_value, result.result_numeric,
        result.reference_range, result.unit, result.abnormal_flag, result.lab_comments,
        result.critical_result || false, args.result_date, args.lab_technician
      ]);
    }
    
    // Actualizar estado de la orden
    await connection.execute(
      'UPDATE lab_orders SET status = "completed", updated_at = NOW() WHERE id = ?',
      [args.lab_order_id]
    );
    
    await connection.commit();
    return { success: true, message: 'Resultados de laboratorio registrados correctamente' };
    
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getLabResults(args: any, pool: mysql.Pool): Promise<any> {
  let query = `
    SELECT lr.*, lo.clinical_indication, lot.test_name
    FROM lab_results lr
    LEFT JOIN lab_orders lo ON lr.lab_order_id = lo.id
    LEFT JOIN lab_order_tests lot ON lo.id = lot.lab_order_id AND lr.test_code = lot.test_code
    WHERE lo.patient_id = ?
  `;
  
  const values = [args.patient_id];
  
  if (args.test_code) {
    query += ' AND lr.test_code = ?';
    values.push(args.test_code);
  }
  
  if (args.abnormal_only) {
    query += ' AND lr.abnormal_flag IN ("high", "low", "critical_high", "critical_low", "abnormal")';
  }
  
  if (args.critical_only) {
    query += ' AND lr.critical_result = true';
  }
  
  query += ' ORDER BY lr.result_date DESC';
  
  const [rows] = await pool.execute(query, values);
  return { lab_results: rows };
}

async function createTreatmentPlan(args: any, pool: mysql.Pool): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Crear plan principal
    const [planResult] = await connection.execute(`
      INSERT INTO treatment_plans (
        patient_id, doctor_id, medical_record_id, plan_name, description,
        start_date, end_date, priority, goals, success_criteria, notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())
    `, [
      args.patient_id, args.doctor_id, args.medical_record_id, args.plan_name, args.description,
      args.start_date, args.end_date, args.priority || 'normal', args.goals, args.success_criteria, args.notes
    ]);
    
    const planId = (planResult as any).insertId;
    
    // Agregar tareas
    if (args.tasks) {
      for (const task of args.tasks) {
        await connection.execute(`
          INSERT INTO treatment_tasks (
            treatment_plan_id, task_name, description, task_type, frequency,
            duration, instructions, due_date, priority, reminder_enabled, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `, [
          planId, task.task_name, task.description, task.task_type, task.frequency,
          task.duration, task.instructions, task.due_date, task.priority || 'normal',
          task.reminder_enabled || false
        ]);
      }
    }
    
    await connection.commit();
    return { success: true, treatment_plan_id: planId, message: 'Plan de tratamiento creado correctamente' };
    
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getTreatmentPlans(args: any, pool: mysql.Pool): Promise<any> {
  let query = `
    SELECT tp.*, d.name as doctor_name,
           COUNT(tt.id) as total_tasks,
           COUNT(CASE WHEN tt.status = 'completed' THEN 1 END) as completed_tasks
    FROM treatment_plans tp
    LEFT JOIN doctors d ON tp.doctor_id = d.id
    LEFT JOIN treatment_tasks tt ON tp.id = tt.treatment_plan_id
    WHERE tp.patient_id = ?
  `;
  
  const values = [args.patient_id];
  
  if (args.status) {
    query += ' AND tp.status = ?';
    values.push(args.status);
  }
  
  if (args.active_only) {
    query += ' AND tp.status = "active"';
  }
  
  query += ' GROUP BY tp.id ORDER BY tp.created_at DESC';
  
  const [rows] = await pool.execute(query, values);
  
  if (args.include_tasks !== false) {
    for (const plan of rows as any[]) {
      const [tasks] = await pool.execute(
        'SELECT * FROM treatment_tasks WHERE treatment_plan_id = ? ORDER BY due_date',
        [plan.id]
      );
      plan.tasks = tasks;
    }
  }
  
  return { treatment_plans: rows };
}

async function updateTreatmentTask(args: any, pool: mysql.Pool): Promise<any> {
  const updates: string[] = [];
  const values: any[] = [];
  
  if (args.status) { updates.push('status = ?'); values.push(args.status); }
  if (args.completion_notes) { updates.push('completion_notes = ?'); values.push(args.completion_notes); }
  if (args.completion_date) { updates.push('completion_date = ?'); values.push(args.completion_date); }
  if (args.next_due_date) { updates.push('due_date = ?'); values.push(args.next_due_date); }
  
  updates.push('updated_at = NOW()');
  values.push(args.task_id);
  
  const query = `UPDATE treatment_tasks SET ${updates.join(', ')} WHERE id = ?`;
  await pool.execute(query, values);
  
  return { success: true, message: 'Tarea de tratamiento actualizada correctamente' };
}

async function getAppointmentsAdvanced(args: any, pool: mysql.Pool): Promise<any> {
  let query = `
    SELECT a.*, p.name as patient_name, p.document as patient_document,
           d.name as doctor_name, s.name as specialty_name, l.name as location_name
    FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.id
    LEFT JOIN doctors d ON a.doctor_id = d.id
    LEFT JOIN specialties s ON a.specialty_id = s.id
    LEFT JOIN locations l ON a.location_id = l.id
    WHERE 1=1
  `;
  
  const conditions: string[] = [];
  const values: any[] = [];
  
  if (args.date_from) {
    conditions.push('DATE(a.scheduled_at) >= ?');
    values.push(args.date_from);
  }
  
  if (args.date_to) {
    conditions.push('DATE(a.scheduled_at) <= ?');
    values.push(args.date_to);
  }
  
  if (args.patient_id) {
    conditions.push('a.patient_id = ?');
    values.push(args.patient_id);
  }
  
  if (args.doctor_id) {
    conditions.push('a.doctor_id = ?');
    values.push(args.doctor_id);
  }
  
  if (args.specialty_id) {
    conditions.push('a.specialty_id = ?');
    values.push(args.specialty_id);
  }
  
  if (args.status) {
    conditions.push('a.status = ?');
    values.push(args.status);
  }
  
  if (args.patient_name) {
    conditions.push('p.name LIKE ?');
    values.push(`%${args.patient_name}%`);
  }
  
  if (args.patient_document) {
    conditions.push('p.document LIKE ?');
    values.push(`%${args.patient_document}%`);
  }
  
  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ');
  }
  
  const sortBy = args.sort_by || 'scheduled_at';
  const sortDirection = args.sort_direction || 'ASC';
  query += ` ORDER BY ${sortBy} ${sortDirection}`;
  
  const limit = args.limit || 100;
  const offset = args.offset || 0;
  query += ` LIMIT ${limit} OFFSET ${offset}`;
  
  const [rows] = await pool.execute(query, values);
  return { appointments: rows, total_returned: (rows as any[]).length };
}

async function scheduleAppointmentAdvanced(args: any, pool: mysql.Pool): Promise<any> {
  // Verificar disponibilidad si se solicita
  if (args.check_availability) {
    const conflicts = await getAppointmentConflicts({
      doctor_id: args.doctor_id,
      proposed_datetime: args.scheduled_at,
      duration_minutes: args.duration_minutes || 30
    }, pool);
    
    if (conflicts.conflicts && conflicts.conflicts.length > 0) {
      return { success: false, message: 'Conflicto de horario detectado', conflicts: conflicts.conflicts };
    }
  }
  
  const [result] = await pool.execute(`
    INSERT INTO appointments (
      patient_id, doctor_id, specialty_id, location_id, scheduled_at,
      duration_minutes, appointment_type, reason, notes, priority, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', NOW())
  `, [
    args.patient_id, args.doctor_id, args.specialty_id, args.location_id, args.scheduled_at,
    args.duration_minutes || 30, args.appointment_type || 'Presencial', args.reason,
    args.notes, args.priority || 'normal'
  ]);
  
  return { success: true, appointment_id: (result as any).insertId, message: 'Cita programada correctamente' };
}

async function rescheduleAppointment(args: any, pool: mysql.Pool): Promise<any> {
  // Verificar disponibilidad si se solicita
  if (args.check_availability) {
    const conflicts = await getAppointmentConflicts({
      doctor_id: args.new_doctor_id,
      proposed_datetime: args.new_datetime,
      exclude_appointment_id: args.appointment_id
    }, pool);
    
    if (conflicts.conflicts && conflicts.conflicts.length > 0) {
      return { success: false, message: 'Conflicto de horario detectado', conflicts: conflicts.conflicts };
    }
  }
  
  const updates = ['scheduled_at = ?', 'updated_at = NOW()'];
  const values = [args.new_datetime];
  
  if (args.new_doctor_id) {
    updates.push('doctor_id = ?');
    values.push(args.new_doctor_id);
  }
  
  if (args.new_location_id) {
    updates.push('location_id = ?');
    values.push(args.new_location_id);
  }
  
  values.push(args.appointment_id);
  
  const query = `UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`;
  await pool.execute(query, values);
  
  return { success: true, message: 'Cita reprogramada correctamente' };
}

async function getAppointmentConflicts(args: any, pool: mysql.Pool): Promise<any> {
  const duration = args.duration_minutes || 30;
  const endTime = new Date(new Date(args.proposed_datetime).getTime() + duration * 60000);
  
  let query = `
    SELECT a.*, p.name as patient_name
    FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.id
    WHERE a.status != 'Cancelada'
    AND (
      (a.scheduled_at <= ? AND DATE_ADD(a.scheduled_at, INTERVAL a.duration_minutes MINUTE) > ?) OR
      (a.scheduled_at < ? AND DATE_ADD(a.scheduled_at, INTERVAL a.duration_minutes MINUTE) >= ?)
    )
  `;
  
  const values = [args.proposed_datetime, args.proposed_datetime, endTime.toISOString(), endTime.toISOString()];
  
  if (args.doctor_id) {
    query += ' AND a.doctor_id = ?';
    values.push(args.doctor_id);
  }
  
  if (args.patient_id) {
    query += ' AND a.patient_id = ?';
    values.push(args.patient_id);
  }
  
  if (args.exclude_appointment_id) {
    query += ' AND a.id != ?';
    values.push(args.exclude_appointment_id);
  }
  
  const [rows] = await pool.execute(query, values);
  return { conflicts: rows };
}

async function generatePatientReport(args: any, pool: mysql.Pool): Promise<any> {
  const report: any = {
    patient_id: args.patient_id,
    report_type: args.report_type || 'complete',
    generated_at: new Date().toISOString(),
    requested_by: args.requested_by
  };
  
  // Obtener información básica del paciente
  const [patientRows] = await pool.execute(`
    SELECT p.*, m.name as municipality_name, e.name as eps_name,
           TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age
    FROM patients p
    LEFT JOIN municipalities m ON p.municipality_id = m.id
    LEFT JOIN eps e ON p.insurance_eps_id = e.id
    WHERE p.id = ?
  `, [args.patient_id]);
  
  if ((patientRows as any[]).length === 0) {
    throw new Error('Paciente no encontrado');
  }
  
  report.patient = (patientRows as any[])[0];
  
  if (args.report_type === 'complete' || args.report_type === 'summary') {
    // Estadísticas generales
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT a.id) as total_appointments,
        COUNT(DISTINCT CASE WHEN a.status = 'Completada' THEN a.id END) as completed_appointments,
        COUNT(DISTINCT mr.id) as total_medical_records,
        COUNT(DISTINCT p.id) as active_prescriptions,
        MAX(a.scheduled_at) as last_appointment
      FROM appointments a
      LEFT JOIN medical_records mr ON a.patient_id = mr.patient_id
      LEFT JOIN prescriptions p ON a.patient_id = p.patient_id AND p.status = 'active'
      WHERE a.patient_id = ?
    `, [args.patient_id]);
    
    report.statistics = (stats as any[])[0];
  }
  
  return report;
}

async function getDashboardStats(args: any, pool: mysql.Pool): Promise<any> {
  const stats: any = {
    date_range: args.date_range || 'today',
    generated_at: new Date().toISOString()
  };
  
  let dateCondition = '';
  const values: any[] = [];
  
  switch (args.date_range) {
    case 'today':
      dateCondition = 'DATE(created_at) = CURDATE()';
      break;
    case 'week':
      dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
      break;
    case 'month':
      dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
      break;
    case 'custom':
      if (args.date_from && args.date_to) {
        dateCondition = 'DATE(created_at) BETWEEN ? AND ?';
        values.push(args.date_from, args.date_to);
      }
      break;
  }
  
  // Estadísticas de pacientes
  const [patientStats] = await pool.execute(`
    SELECT 
      COUNT(*) as total_patients,
      COUNT(CASE WHEN ${dateCondition || '1=1'} THEN 1 END) as new_patients
    FROM patients
    WHERE status = 'Activo'
  `, values);
  
  // Estadísticas de citas
  const [appointmentStats] = await pool.execute(`
    SELECT 
      COUNT(*) as total_appointments,
      COUNT(CASE WHEN status = 'Pendiente' THEN 1 END) as pending_appointments,
      COUNT(CASE WHEN status = 'Completada' THEN 1 END) as completed_appointments,
      COUNT(CASE WHEN status = 'Cancelada' THEN 1 END) as cancelled_appointments
    FROM appointments
    WHERE ${dateCondition || '1=1'}
  `, values);
  
  stats.patients = (patientStats as any[])[0];
  stats.appointments = (appointmentStats as any[])[0];
  
  return stats;
}

async function getAppointmentAnalytics(args: any, pool: mysql.Pool): Promise<any> {
  const analytics: any = {
    date_from: args.date_from,
    date_to: args.date_to,
    analysis_type: args.analysis_type || 'trends',
    generated_at: new Date().toISOString()
  };
  
  let query = `
    SELECT 
      DATE(scheduled_at) as date,
      COUNT(*) as total_appointments,
      COUNT(CASE WHEN status = 'Completada' THEN 1 END) as completed,
      COUNT(CASE WHEN status = 'Cancelada' THEN 1 END) as cancelled,
      COUNT(CASE WHEN status = 'Pendiente' THEN 1 END) as pending
    FROM appointments
    WHERE DATE(scheduled_at) BETWEEN ? AND ?
  `;
  
  const values = [args.date_from, args.date_to];
  
  if (args.doctor_id) {
    query += ' AND doctor_id = ?';
    values.push(args.doctor_id);
  }
  
  if (args.specialty_id) {
    query += ' AND specialty_id = ?';
    values.push(args.specialty_id);
  }
  
  query += ` GROUP BY DATE(scheduled_at) ORDER BY date`;
  
  const [rows] = await pool.execute(query, values);
  analytics.data = rows;
  
  return analytics;
}

async function getPatientAnalytics(args: any, pool: mysql.Pool): Promise<any> {
  const analytics: any = {
    analysis_type: args.analysis_type || 'demographics',
    generated_at: new Date().toISOString()
  };
  
  if (args.analysis_type === 'demographics') {
    const [genderStats] = await pool.execute(`
      SELECT gender, COUNT(*) as count
      FROM patients
      WHERE status = 'Activo'
      GROUP BY gender
    `);
    
    const [ageStats] = await pool.execute(`
      SELECT 
        CASE 
          WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) < 18 THEN '0-17'
          WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 18 AND 30 THEN '18-30'
          WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 31 AND 50 THEN '31-50'
          WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 51 AND 70 THEN '51-70'
          ELSE '70+'
        END as age_group,
        COUNT(*) as count
      FROM patients
      WHERE status = 'Activo'
      GROUP BY age_group
    `);
    
    analytics.gender_distribution = genderStats;
    analytics.age_distribution = ageStats;
  }
  
  return analytics;
}

async function intelligentSearch(args: any, pool: mysql.Pool): Promise<any> {
  const results: any = {
    query: args.query,
    search_in: args.search_in || ['patients', 'appointments', 'medical_records'],
    results: {},
    total_results: 0
  };
  
  const searchTerm = `%${args.query}%`;
  const limit = args.limit_per_entity || 10;
  
  // Buscar en pacientes
  if (args.search_in.includes('patients')) {
    const [patientResults] = await pool.execute(`
      SELECT p.*, m.name as municipality_name
      FROM patients p
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      WHERE (p.name LIKE ? OR p.document LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)
      AND p.status = 'Activo'
      LIMIT ?
    `, [searchTerm, searchTerm, searchTerm, searchTerm, limit]);
    
    results.results.patients = patientResults;
    results.total_results += (patientResults as any[]).length;
  }
  
  // Buscar en citas
  if (args.search_in.includes('appointments')) {
    const [appointmentResults] = await pool.execute(`
      SELECT a.*, p.name as patient_name, d.name as doctor_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      WHERE (a.reason LIKE ? OR a.notes LIKE ? OR p.name LIKE ?)
      LIMIT ?
    `, [searchTerm, searchTerm, searchTerm, limit]);
    
    results.results.appointments = appointmentResults;
    results.total_results += (appointmentResults as any[]).length;
  }
  
  return results;
}

async function getSystemHealth(args: any, pool: mysql.Pool): Promise<any> {
  const health: any = {
    database: 'connected',
    timestamp: new Date().toISOString(),
    enhanced_tools: ENHANCED_MEDICAL_TOOLS.length,
    status: 'Sistema médico mejorado funcionando correctamente'
  };
  
  if (args.include_performance) {
    // Verificar rendimiento básico
    const start = Date.now();
    await pool.execute('SELECT 1');
    const dbResponseTime = Date.now() - start;
    
    health.performance = {
      db_response_time_ms: dbResponseTime,
      status: dbResponseTime < 100 ? 'excellent' : dbResponseTime < 500 ? 'good' : 'slow'
    };
  }
  
  if (args.check_connections) {
    const [connectionInfo] = await pool.execute('SHOW STATUS LIKE "Threads_connected"');
    health.connections = {
      active_connections: (connectionInfo as any[])[0]?.Value || 'unknown'
    };
  }
  
  return health;
}

async function optimizeDatabase(args: any, pool: mysql.Pool): Promise<any> {
  const result: any = {
    operation: args.operation || 'analyze',
    dry_run: args.dry_run !== false,
    timestamp: new Date().toISOString(),
    results: []
  };
  
  if (args.operation === 'analyze') {
    // Analizar tablas principales
    const tables = ['patients', 'appointments', 'medical_records', 'prescriptions'];
    
    for (const table of tables) {
      try {
        const [analysis] = await pool.execute(`ANALYZE TABLE ${table}`);
        result.results.push({
          table,
          status: 'analyzed',
          details: analysis
        });
      } catch (error) {
        result.results.push({
          table,
          status: 'error',
          error: (error as Error).message
        });
      }
    }
  }
  
  if (args.operation === 'cleanup_old_data' && !args.dry_run) {
    const daysToKeep = args.days_to_keep || 365;
    
    // Eliminar registros de conversación antiguos si existen
    try {
      const [cleanupResult] = await pool.execute(
        'DELETE FROM conversation_memory WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
        [daysToKeep]
      );
      
      result.results.push({
        operation: 'cleanup_conversation_memory',
        rows_deleted: (cleanupResult as any).affectedRows
      });
    } catch (error) {
      result.results.push({
        operation: 'cleanup_conversation_memory',
        status: 'error',
        error: (error as Error).message
      });
    }
  }
  
  return result;
}