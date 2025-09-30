// ===================================================================
// HERRAMIENTAS AVANZADAS DE GESTIÓN DE PACIENTES - BIOSANARCALL
// Sistema mejorado de registro, consulta y edición de pacientes
// ===================================================================

import mysql from 'mysql2/promise';

// Herramientas MCP mejoradas específicamente para gestión de pacientes
export const PATIENT_MANAGEMENT_TOOLS = [
  
  // ===============================================
  // 1. REGISTRO AVANZADO DE PACIENTES
  // ===============================================
  
  {
    name: 'createPatientAdvanced',
    description: 'Registro completo de paciente con validaciones avanzadas y verificación de duplicados',
    inputSchema: {
      type: 'object',
      properties: {
        // Información personal básica
        document: { type: 'string', description: 'Documento de identidad (requerido)' },
        document_type_id: { type: 'number', description: 'ID del tipo de documento', default: 1 },
        name: { type: 'string', description: 'Nombre completo (requerido)' },
        birth_date: { type: 'string', description: 'Fecha de nacimiento YYYY-MM-DD (requerido)' },
        gender: { 
          type: 'string', 
          enum: ['Masculino', 'Femenino', 'Otro', 'No especificado'], 
          description: 'Género (requerido)',
          default: 'No especificado'
        },
        
        // Información de contacto
        phone: { type: 'string', description: 'Teléfono principal (requerido)' },
        phone_alt: { type: 'string', description: 'Teléfono alternativo' },
        email: { type: 'string', description: 'Correo electrónico' },
        
        // Información de ubicación
        address: { type: 'string', description: 'Dirección completa (requerido)' },
        municipality_id: { type: 'number', description: 'ID del municipio (requerido)' },
        zone_id: { type: 'number', description: 'ID de la zona' },
        
        // Información de seguro médico
        insurance_eps_id: { type: 'number', description: 'ID de la EPS (requerido)' },
        insurance_affiliation_type: { 
          type: 'string', 
          enum: ['Contributivo', 'Subsidiado', 'Vinculado', 'Particular', 'Otro'], 
          description: 'Tipo de afiliación (requerido)',
          default: 'Contributivo'
        },
        
        // Información médica básica
        blood_group_id: { type: 'number', description: 'ID del grupo sanguíneo' },
        has_disability: { type: 'boolean', description: 'Tiene alguna discapacidad', default: false },
        disability_type_id: { type: 'number', description: 'ID del tipo de discapacidad (si aplica)' },
        
        // Información socioeconómica
        marital_status_id: { type: 'number', description: 'ID del estado civil' },
        education_level_id: { type: 'number', description: 'ID del nivel educativo' },
        population_group_id: { type: 'number', description: 'ID del grupo poblacional' },
        estrato: { type: 'number', description: 'Estrato socioeconómico (0-6)', minimum: 0, maximum: 6 },
        
        // Configuraciones del registro
        notes: { type: 'string', description: 'Notas adicionales del paciente' },
        emergency_contact_name: { type: 'string', description: 'Nombre contacto de emergencia' },
        emergency_contact_phone: { type: 'string', description: 'Teléfono contacto de emergencia' },
        emergency_contact_relationship: { type: 'string', description: 'Relación con contacto de emergencia' },
        
        // Opciones de validación
        check_duplicates: { type: 'boolean', description: 'Verificar duplicados por documento/nombre', default: true },
        validate_data: { type: 'boolean', description: 'Realizar validaciones avanzadas', default: true },
        auto_generate_external_id: { type: 'boolean', description: 'Generar ID externo automáticamente', default: true },
        created_by: { type: 'string', description: 'Usuario que registra el paciente' }
      },
      required: ['document', 'name', 'birth_date', 'gender', 'phone', 'address', 'municipality_id', 'insurance_eps_id', 'insurance_affiliation_type']
    }
  },

  {
    name: 'createPatientQuick',
    description: 'Registro rápido de paciente con datos mínimos esenciales',
    inputSchema: {
      type: 'object',
      properties: {
        document: { type: 'string', description: 'Documento de identidad' },
        name: { type: 'string', description: 'Nombre completo' },
        phone: { type: 'string', description: 'Teléfono de contacto' },
        birth_date: { type: 'string', description: 'Fecha de nacimiento YYYY-MM-DD' },
        gender: { type: 'string', enum: ['Masculino', 'Femenino', 'Otro'], description: 'Género' },
        municipality_id: { type: 'number', description: 'ID del municipio', default: 1 },
        insurance_eps_id: { type: 'number', description: 'ID de la EPS', default: 1 },
        auto_complete: { type: 'boolean', description: 'Auto-completar con valores por defecto', default: true }
      },
      required: ['document', 'name', 'phone', 'birth_date', 'gender']
    }
  },

  {
    name: 'validatePatientData',
    description: 'Validar datos de paciente antes del registro',
    inputSchema: {
      type: 'object',
      properties: {
        document: { type: 'string', description: 'Documento de identidad' },
        name: { type: 'string', description: 'Nombre completo' },
        phone: { type: 'string', description: 'Teléfono' },
        email: { type: 'string', description: 'Email' },
        birth_date: { type: 'string', description: 'Fecha de nacimiento YYYY-MM-DD' },
        check_duplicates: { type: 'boolean', description: 'Verificar duplicados', default: true },
        validate_age: { type: 'boolean', description: 'Validar edad razonable', default: true },
        validate_format: { type: 'boolean', description: 'Validar formatos de datos', default: true }
      },
      required: ['document', 'name', 'birth_date']
    }
  },

  // ===============================================
  // 2. CONSULTA AVANZADA DE PACIENTES
  // ===============================================

  {
    name: 'searchPatientsUltra',
    description: 'Búsqueda ultra-avanzada de pacientes con filtros múltiples y algoritmos inteligentes',
    inputSchema: {
      type: 'object',
      properties: {
        // Búsqueda textual
        search_text: { type: 'string', description: 'Búsqueda general en nombre, documento, teléfono, email' },
        search_mode: { 
          type: 'string', 
          enum: ['exact', 'fuzzy', 'partial', 'phonetic'], 
          description: 'Modo de búsqueda',
          default: 'partial'
        },
        
        // Filtros específicos
        document: { type: 'string', description: 'Búsqueda exacta por documento' },
        name: { type: 'string', description: 'Búsqueda por nombre (parcial o completo)' },
        phone: { type: 'string', description: 'Búsqueda por teléfono' },
        email: { type: 'string', description: 'Búsqueda por email' },
        
        // Filtros demográficos
        age_min: { type: 'number', description: 'Edad mínima', minimum: 0, maximum: 120 },
        age_max: { type: 'number', description: 'Edad máxima', minimum: 0, maximum: 120 },
        gender: { type: 'string', enum: ['Masculino', 'Femenino', 'Otro', 'No especificado'], description: 'Género' },
        birth_year: { type: 'number', description: 'Año de nacimiento específico' },
        
        // Filtros geográficos
        municipality_id: { type: 'number', description: 'ID del municipio' },
        zone_id: { type: 'number', description: 'ID de la zona' },
        municipality_name: { type: 'string', description: 'Nombre del municipio (parcial)' },
        
        // Filtros de seguro médico
        insurance_eps_id: { type: 'number', description: 'ID de la EPS' },
        insurance_type: { type: 'string', enum: ['Contributivo', 'Subsidiado', 'Vinculado', 'Particular', 'Otro'], description: 'Tipo de afiliación' },
        eps_name: { type: 'string', description: 'Nombre de la EPS (parcial)' },
        
        // Filtros médicos
        blood_group_id: { type: 'number', description: 'ID del grupo sanguíneo' },
        has_disability: { type: 'boolean', description: 'Tiene discapacidad' },
        disability_type_id: { type: 'number', description: 'ID del tipo de discapacidad' },
        
        // Filtros socioeconómicos
        marital_status_id: { type: 'number', description: 'ID del estado civil' },
        education_level_id: { type: 'number', description: 'ID del nivel educativo' },
        population_group_id: { type: 'number', description: 'ID del grupo poblacional' },
        estrato_min: { type: 'number', description: 'Estrato mínimo', minimum: 0, maximum: 6 },
        estrato_max: { type: 'number', description: 'Estrato máximo', minimum: 0, maximum: 6 },
        
        // Filtros temporales
        registered_after: { type: 'string', description: 'Registrados después de YYYY-MM-DD' },
        registered_before: { type: 'string', description: 'Registrados antes de YYYY-MM-DD' },
        updated_after: { type: 'string', description: 'Actualizados después de YYYY-MM-DD' },
        
        // Filtros de estado
        status: { type: 'string', enum: ['Activo', 'Inactivo'], description: 'Estado del paciente' },
        has_appointments: { type: 'boolean', description: 'Tiene citas programadas o historial' },
        has_recent_appointments: { type: 'boolean', description: 'Tiene citas en los últimos 30 días' },
        has_pending_appointments: { type: 'boolean', description: 'Tiene citas pendientes' },
        
        // Configuraciones de resultado
        include_statistics: { type: 'boolean', description: 'Incluir estadísticas de cada paciente', default: false },
        include_contact_info: { type: 'boolean', description: 'Incluir información de contacto completa', default: true },
        include_medical_info: { type: 'boolean', description: 'Incluir información médica básica', default: false },
        include_demographics: { type: 'boolean', description: 'Incluir información demográfica', default: true },
        
        // Paginación y ordenamiento
        limit: { type: 'number', description: 'Máximo resultados', minimum: 1, maximum: 500, default: 50 },
        offset: { type: 'number', description: 'Desplazamiento para paginación', minimum: 0, default: 0 },
        sort_by: { 
          type: 'string', 
          enum: ['name', 'document', 'created_at', 'updated_at', 'age', 'last_appointment', 'municipality'], 
          description: 'Campo de ordenamiento',
          default: 'name'
        },
        sort_direction: { type: 'string', enum: ['ASC', 'DESC'], description: 'Dirección de ordenamiento', default: 'ASC' },
        
        // Opciones avanzadas
        highlight_matches: { type: 'boolean', description: 'Resaltar coincidencias en resultados', default: false },
        calculate_relevance: { type: 'boolean', description: 'Calcular score de relevancia', default: false },
        group_by_municipality: { type: 'boolean', description: 'Agrupar resultados por municipio', default: false }
      }
    }
  },

  {
    name: 'getPatientComplete',
    description: 'Obtener información completa de un paciente incluyendo historial y estadísticas',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        
        // Información a incluir
        include_personal_info: { type: 'boolean', description: 'Incluir información personal', default: true },
        include_contact_info: { type: 'boolean', description: 'Incluir información de contacto', default: true },
        include_medical_info: { type: 'boolean', description: 'Incluir información médica', default: true },
        include_insurance_info: { type: 'boolean', description: 'Incluir información de seguro', default: true },
        include_demographics: { type: 'boolean', description: 'Incluir información demográfica', default: true },
        
        // Historiales y estadísticas
        include_appointment_history: { type: 'boolean', description: 'Incluir historial de citas', default: false },
        include_appointment_stats: { type: 'boolean', description: 'Incluir estadísticas de citas', default: true },
        include_medical_records: { type: 'boolean', description: 'Incluir registros médicos', default: false },
        include_allergies: { type: 'boolean', description: 'Incluir alergias registradas', default: false },
        include_emergency_contacts: { type: 'boolean', description: 'Incluir contactos de emergencia', default: false },
        
        // Configuraciones temporales
        history_days_back: { type: 'number', description: 'Días hacia atrás para historial', default: 90 },
        stats_period: { 
          type: 'string', 
          enum: ['30_days', '90_days', '1_year', 'all_time'], 
          description: 'Período para estadísticas',
          default: '90_days'
        },
        
        // Opciones de formato
        format_dates: { type: 'boolean', description: 'Formatear fechas legibles', default: true },
        calculate_age: { type: 'boolean', description: 'Calcular edad actual', default: true },
        include_related_names: { type: 'boolean', description: 'Incluir nombres de entidades relacionadas', default: true }
      },
      required: ['patient_id']
    }
  },

  {
    name: 'findPatientDuplicates',
    description: 'Encontrar posibles pacientes duplicados en el sistema',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente para buscar duplicados (opcional)' },
        search_criteria: {
          type: 'array',
          items: { type: 'string', enum: ['document', 'name', 'phone', 'email', 'birth_date'] },
          description: 'Criterios para detectar duplicados',
          default: ['document', 'name', 'phone']
        },
        similarity_threshold: { type: 'number', description: 'Umbral de similitud (0-1)', minimum: 0, maximum: 1, default: 0.8 },
        include_inactive: { type: 'boolean', description: 'Incluir pacientes inactivos', default: false },
        max_results: { type: 'number', description: 'Máximo duplicados a retornar', default: 20 }
      }
    }
  },

  // ===============================================
  // 3. EDICIÓN AVANZADA DE PACIENTES
  // ===============================================

  {
    name: 'updatePatientAdvanced',
    description: 'Actualización avanzada de paciente con validaciones, historial de cambios y notificaciones',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente a actualizar (requerido)' },
        
        // Información personal
        personal_data: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nombre completo' },
            birth_date: { type: 'string', description: 'Fecha de nacimiento YYYY-MM-DD' },
            gender: { type: 'string', enum: ['Masculino', 'Femenino', 'Otro', 'No especificado'], description: 'Género' }
          }
        },
        
        // Información de contacto
        contact_data: {
          type: 'object',
          properties: {
            phone: { type: 'string', description: 'Teléfono principal' },
            phone_alt: { type: 'string', description: 'Teléfono alternativo' },
            email: { type: 'string', description: 'Correo electrónico' },
            address: { type: 'string', description: 'Dirección' },
            municipality_id: { type: 'number', description: 'ID del municipio' },
            zone_id: { type: 'number', description: 'ID de la zona' }
          }
        },
        
        // Información de seguro
        insurance_data: {
          type: 'object',
          properties: {
            insurance_eps_id: { type: 'number', description: 'ID de la EPS' },
            insurance_affiliation_type: { type: 'string', enum: ['Contributivo', 'Subsidiado', 'Vinculado', 'Particular', 'Otro'], description: 'Tipo de afiliación' }
          }
        },
        
        // Información médica
        medical_data: {
          type: 'object',
          properties: {
            blood_group_id: { type: 'number', description: 'ID del grupo sanguíneo' },
            has_disability: { type: 'boolean', description: 'Tiene discapacidad' },
            disability_type_id: { type: 'number', description: 'ID del tipo de discapacidad' }
          }
        },
        
        // Información socioeconómica
        socioeconomic_data: {
          type: 'object',
          properties: {
            marital_status_id: { type: 'number', description: 'ID del estado civil' },
            education_level_id: { type: 'number', description: 'ID del nivel educativo' },
            population_group_id: { type: 'number', description: 'ID del grupo poblacional' },
            estrato: { type: 'number', description: 'Estrato socioeconómico', minimum: 0, maximum: 6 }
          }
        },
        
        // Contactos de emergencia
        emergency_contacts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nombre del contacto' },
              phone: { type: 'string', description: 'Teléfono del contacto' },
              relationship: { type: 'string', description: 'Relación con el paciente' },
              is_primary: { type: 'boolean', description: 'Es contacto principal', default: false }
            }
          }
        },
        
        // Configuraciones de actualización
        notes: { type: 'string', description: 'Notas sobre la actualización' },
        status: { type: 'string', enum: ['Activo', 'Inactivo'], description: 'Estado del paciente' },
        reason_for_update: { type: 'string', description: 'Razón de la actualización' },
        updated_by: { type: 'string', description: 'Usuario que realiza la actualización' },
        
        // Validaciones y opciones
        validate_changes: { type: 'boolean', description: 'Validar cambios antes de aplicar', default: true },
        check_duplicates: { type: 'boolean', description: 'Verificar duplicados al cambiar datos clave', default: true },
        log_changes: { type: 'boolean', description: 'Registrar historial de cambios', default: true },
        send_notifications: { type: 'boolean', description: 'Enviar notificaciones de cambios', default: false },
        require_confirmation: { type: 'boolean', description: 'Requiere confirmación para cambios críticos', default: false }
      },
      required: ['patient_id']
    }
  },

  {
    name: 'updatePatientField',
    description: 'Actualizar un campo específico del paciente con validación',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        field_name: { 
          type: 'string',
          enum: ['name', 'phone', 'phone_alt', 'email', 'address', 'municipality_id', 'zone_id', 'insurance_eps_id', 'insurance_affiliation_type', 'blood_group_id', 'marital_status_id', 'education_level_id', 'population_group_id', 'estrato', 'status', 'notes'],
          description: 'Nombre del campo a actualizar'
        },
        new_value: { type: 'string', description: 'Nuevo valor para el campo' },
        validate_value: { type: 'boolean', description: 'Validar el nuevo valor', default: true },
        log_change: { type: 'boolean', description: 'Registrar el cambio', default: true },
        updated_by: { type: 'string', description: 'Usuario que realiza el cambio' },
        change_reason: { type: 'string', description: 'Razón del cambio' }
      },
      required: ['patient_id', 'field_name', 'new_value']
    }
  },

  {
    name: 'getPatientChangeHistory',
    description: 'Obtener historial de cambios de un paciente',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        field_name: { type: 'string', description: 'Campo específico (opcional)' },
        date_from: { type: 'string', description: 'Fecha desde YYYY-MM-DD' },
        date_to: { type: 'string', description: 'Fecha hasta YYYY-MM-DD' },
        changed_by: { type: 'string', description: 'Usuario que realizó cambios' },
        limit: { type: 'number', description: 'Máximo registros', default: 50 }
      },
      required: ['patient_id']
    }
  },

  // ===============================================
  // 4. HERRAMIENTAS DE GESTIÓN Y UTILIDADES
  // ===============================================

  {
    name: 'mergePatientRecords',
    description: 'Fusionar registros de pacientes duplicados',
    inputSchema: {
      type: 'object',
      properties: {
        primary_patient_id: { type: 'number', description: 'ID del paciente principal (se mantiene)' },
        duplicate_patient_ids: { 
          type: 'array',
          items: { type: 'number' },
          description: 'IDs de pacientes duplicados (se fusionan)'
        },
        merge_appointments: { type: 'boolean', description: 'Fusionar citas', default: true },
        merge_medical_records: { type: 'boolean', description: 'Fusionar registros médicos', default: true },
        merge_contact_history: { type: 'boolean', description: 'Fusionar historial de contactos', default: true },
        preserve_all_data: { type: 'boolean', description: 'Preservar todos los datos únicos', default: true },
        merge_notes: { type: 'string', description: 'Notas sobre la fusión' },
        performed_by: { type: 'string', description: 'Usuario que realiza la fusión (requerido)' }
      },
      required: ['primary_patient_id', 'duplicate_patient_ids', 'performed_by']
    }
  },

  {
    name: 'archivePatient',
    description: 'Archivar paciente manteniendo historial pero marcándolo como inactivo',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        archive_reason: { 
          type: 'string',
          enum: ['deceased', 'moved', 'no_contact', 'request', 'duplicate', 'other'],
          description: 'Razón del archivo'
        },
        archive_notes: { type: 'string', description: 'Notas adicionales del archivo' },
        preserve_data: { type: 'boolean', description: 'Preservar todos los datos históricos', default: true },
        notify_related: { type: 'boolean', description: 'Notificar a usuarios relacionados', default: false },
        archived_by: { type: 'string', description: 'Usuario que archiva (requerido)' }
      },
      required: ['patient_id', 'archive_reason', 'archived_by']
    }
  },

  {
    name: 'restorePatient',
    description: 'Restaurar paciente archivado',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' },
        restore_reason: { type: 'string', description: 'Razón de la restauración' },
        update_contact_info: { type: 'boolean', description: 'Actualizar información de contacto', default: false },
        verify_data: { type: 'boolean', description: 'Verificar y validar datos antes de restaurar', default: true },
        restored_by: { type: 'string', description: 'Usuario que restaura (requerido)' }
      },
      required: ['patient_id', 'restore_reason', 'restored_by']
    }
  },

  // ===============================================
  // 5. HERRAMIENTA DE DISPONIBILIDADES DE CITAS
  // ===============================================
  
  {
    name: 'getAvailableAppointments',
    description: 'Obtener citas disponibles desde la tabla availabilities con información completa de especialidades, médicos y ubicaciones',
    inputSchema: {
      type: 'object',
      properties: {
        // Filtros de fecha
        date_from: { type: 'string', description: 'Fecha desde YYYY-MM-DD (por defecto: hoy)' },
        date_to: { type: 'string', description: 'Fecha hasta YYYY-MM-DD (por defecto: +30 días)' },
        specific_date: { type: 'string', description: 'Fecha específica YYYY-MM-DD' },
        
        // Filtros de especialidad
        specialty_id: { type: 'number', description: 'ID de especialidad específica' },
        specialty_name: { type: 'string', description: 'Nombre de especialidad (búsqueda parcial)' },
        
        // Filtros de ubicación
        location_id: { type: 'number', description: 'ID de ubicación específica' },
        location_name: { type: 'string', description: 'Nombre de ubicación (búsqueda parcial)' },
        
        // Filtros de médico
        doctor_id: { type: 'number', description: 'ID de médico específico' },
        doctor_name: { type: 'string', description: 'Nombre de médico (búsqueda parcial)' },
        
        // Filtros de horario
        time_from: { type: 'string', description: 'Hora desde HH:MM (ej: 08:00)' },
        time_to: { type: 'string', description: 'Hora hasta HH:MM (ej: 17:00)' },
        
        // Filtros de disponibilidad
        only_available: { type: 'boolean', description: 'Solo mostrar disponibilidades con cupos libres', default: true },
        min_available_slots: { type: 'number', description: 'Mínimo de cupos disponibles', default: 1 },
        status: { type: 'string', enum: ['Activa', 'Cancelada', 'Completa'], description: 'Estado de la disponibilidad', default: 'Activa' },
        
        // Configuraciones de resultado
        include_slot_details: { type: 'boolean', description: 'Incluir detalles de slots disponibles por hora', default: true },
        include_booked_info: { type: 'boolean', description: 'Incluir información de slots ocupados', default: false },
        calculate_time_slots: { type: 'boolean', description: 'Calcular slots de tiempo específicos', default: true },
        group_by_date: { type: 'boolean', description: 'Agrupar resultados por fecha', default: false },
        group_by_doctor: { type: 'boolean', description: 'Agrupar resultados por médico', default: false },
        
        // Paginación y ordenamiento
        limit: { type: 'number', description: 'Máximo resultados', minimum: 1, maximum: 200, default: 50 },
        offset: { type: 'number', description: 'Desplazamiento para paginación', minimum: 0, default: 0 },
        sort_by: { 
          type: 'string', 
          enum: ['date', 'start_time', 'doctor_name', 'specialty_name', 'location_name', 'available_slots'], 
          description: 'Campo de ordenamiento',
          default: 'date'
        },
        sort_direction: { type: 'string', enum: ['ASC', 'DESC'], description: 'Dirección de ordenamiento', default: 'ASC' }
      }
    }
  },

  {
    name: 'getPatientStatistics',
    description: 'Obtener estadísticas detalladas de pacientes del sistema',
    inputSchema: {
      type: 'object',
      properties: {
        analysis_type: {
          type: 'string',
          enum: ['overview', 'demographics', 'geographic', 'insurance', 'medical', 'activity'],
          description: 'Tipo de análisis estadístico',
          default: 'overview'
        },
        date_range: {
          type: 'string',
          enum: ['today', 'week', 'month', 'quarter', 'year', 'all_time'],
          description: 'Rango temporal para el análisis',
          default: 'month'
        },
        group_by: {
          type: 'array',
          items: { type: 'string', enum: ['municipality', 'eps', 'age_group', 'gender', 'status', 'registration_date'] },
          description: 'Campos para agrupar estadísticas'
        },
        include_trends: { type: 'boolean', description: 'Incluir análisis de tendencias', default: false },
        include_comparisons: { type: 'boolean', description: 'Incluir comparaciones con períodos anteriores', default: false }
      }
    }
  }
];

// ===================================================================
// FUNCIÓN DE EJECUCIÓN PARA HERRAMIENTAS DE PACIENTES
// ===================================================================

export async function executePatientManagementTool(
  toolName: string, 
  args: any, 
  pool: mysql.Pool
): Promise<any> {
  
  try {
    switch (toolName) {
      // Registro de pacientes
      case 'createPatientAdvanced':
        return await createPatientAdvanced(args, pool);
      case 'createPatientQuick':
        return await createPatientQuick(args, pool);
      case 'validatePatientData':
        return await validatePatientData(args, pool);
      
      // Consulta de pacientes
      case 'searchPatientsUltra':
        return await searchPatientsUltra(args, pool);
      case 'getPatientComplete':
        return await getPatientComplete(args, pool);
      case 'findPatientDuplicates':
        return await findPatientDuplicates(args, pool);
      
      // Edición de pacientes
      case 'updatePatientAdvanced':
        return await updatePatientAdvanced(args, pool);
      case 'updatePatientField':
        return await updatePatientField(args, pool);
      case 'getPatientChangeHistory':
        return await getPatientChangeHistory(args, pool);
      
      // Gestión y utilidades
      case 'mergePatientRecords':
        return await mergePatientRecords(args, pool);
      case 'archivePatient':
        return await archivePatient(args, pool);
      case 'restorePatient':
        return await restorePatient(args, pool);
      case 'getPatientStatistics':
        return await getPatientStatistics(args, pool);
      
      // Disponibilidades de citas
      case 'getAvailableAppointments':
        return await getAvailableAppointments(args, pool);
      
      default:
        throw new Error(`Herramienta de gestión de pacientes ${toolName} no implementada`);
    }
    
  } catch (error: any) {
    console.error(`Error ejecutando herramienta de pacientes ${toolName}:`, error);
    throw new Error(`Error en ${toolName}: ${error.message}`);
  }
}

// ===================================================================
// IMPLEMENTACIONES DE FUNCIONES - REGISTRO
// ===================================================================

async function createPatientAdvanced(args: any, pool: mysql.Pool): Promise<any> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Validar duplicados si se solicita
    if (args.check_duplicates) {
      const [duplicates] = await connection.execute(`
        SELECT id, document, name, phone 
        FROM patients 
        WHERE document = ? OR (name = ? AND phone = ?)
        LIMIT 5
      `, [args.document, args.name, args.phone]);
      
      if ((duplicates as any[]).length > 0) {
        await connection.rollback();
        return {
          success: false,
          error: 'Posibles duplicados encontrados',
          duplicates: duplicates,
          suggestion: 'Revisar pacientes existentes antes de continuar'
        };
      }
    }
    
    // Validaciones avanzadas si se solicita
    if (args.validate_data) {
      const validation = await validatePatientDataInternal(args);
      if (!validation.valid) {
        await connection.rollback();
        return {
          success: false,
          error: 'Validación de datos falló',
          validation_errors: validation.errors
        };
      }
    }
    
    // Generar external_id si se solicita
    let external_id = null;
    if (args.auto_generate_external_id) {
      external_id = `PAT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }
    
    // Insertar paciente
    const [result] = await connection.execute(`
      INSERT INTO patients (
        external_id, document, document_type_id, name, phone, phone_alt, email,
        birth_date, gender, address, municipality_id, zone_id, insurance_eps_id,
        insurance_affiliation_type, blood_group_id, population_group_id,
        education_level_id, marital_status_id, has_disability, disability_type_id,
        estrato, notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Activo', NOW())
    `, [
      external_id,
      args.document,
      args.document_type_id || 1,
      args.name,
      args.phone,
      args.phone_alt || null,
      args.email || null,
      args.birth_date,
      args.gender,
      args.address,
      args.municipality_id,
      args.zone_id || null,
      args.insurance_eps_id,
      args.insurance_affiliation_type,
      args.blood_group_id || null,
      args.population_group_id || null,
      args.education_level_id || null,
      args.marital_status_id || null,
      args.has_disability || false,
      args.disability_type_id || null,
      args.estrato || null,
      args.notes || null
    ]);
    
    const patient_id = (result as any).insertId;
    
    // Registrar contactos de emergencia si se proporcionan
    if (args.emergency_contact_name && args.emergency_contact_phone) {
      // Nota: Aquí se podría insertar en una tabla de contactos de emergencia si existe
      // Por ahora, se incluye en las notas del paciente
      await connection.execute(`
        UPDATE patients 
        SET notes = CONCAT(IFNULL(notes, ''), 
            '\nContacto de emergencia: ', ?, 
            ' - Tel: ', ?, 
            ' - Relación: ', IFNULL(?, 'No especificada'))
        WHERE id = ?
      `, [args.emergency_contact_name, args.emergency_contact_phone, args.emergency_contact_relationship, patient_id]);
    }
    
    await connection.commit();
    
    // Obtener el paciente completo creado
    const [patientData] = await connection.execute(`
      SELECT 
        p.*,
        m.name as municipality_name,
        eps.name as eps_name,
        bg.name as blood_group_name,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age
      FROM patients p
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps ON p.insurance_eps_id = eps.id
      LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id
      WHERE p.id = ?
    `, [patient_id]);
    
    return {
      success: true,
      patient_id: patient_id,
      external_id: external_id,
      patient: (patientData as any[])[0],
      message: 'Paciente registrado exitosamente',
      created_by: args.created_by || 'Sistema',
      created_at: new Date().toISOString()
    };
    
  } catch (error: any) {
    await connection.rollback();
    throw new Error(`Error registrando paciente: ${error.message}`);
  } finally {
    connection.release();
  }
}

async function createPatientQuick(args: any, pool: mysql.Pool): Promise<any> {
  try {
    // Auto-completar valores por defecto si se solicita
    const patientData = {
      ...args,
      document_type_id: args.document_type_id || 1,
      municipality_id: args.municipality_id || 1,
      insurance_eps_id: args.insurance_eps_id || 1,
      insurance_affiliation_type: 'Contributivo',
      address: args.address || 'Por actualizar',
      email: args.email || null,
      phone_alt: null,
      blood_group_id: null,
      population_group_id: 1,
      education_level_id: 1,
      marital_status_id: 1,
      has_disability: false,
      estrato: 3,
      notes: 'Registro rápido - Datos por completar'
    };
    
    // Usar la función avanzada con datos completados
    return await createPatientAdvanced({
      ...patientData,
      check_duplicates: true,
      validate_data: true,
      auto_generate_external_id: true,
      created_by: 'Registro Rápido'
    }, pool);
    
  } catch (error: any) {
    throw new Error(`Error en registro rápido: ${error.message}`);
  }
}

async function validatePatientData(args: any, pool: mysql.Pool): Promise<any> {
  try {
    const validation = await validatePatientDataInternal(args);
    
    // Verificar duplicados si se solicita
    let duplicates = [];
    if (args.check_duplicates) {
      const [duplicateResults] = await pool.execute(`
        SELECT id, document, name, phone, email
        FROM patients 
        WHERE document = ? OR (name = ? AND phone = ?) OR email = ?
        LIMIT 10
      `, [args.document, args.name, args.phone, args.email]);
      
      duplicates = duplicateResults as any[];
    }
    
    return {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      suggestions: validation.suggestions,
      duplicates: duplicates,
      duplicate_count: duplicates.length
    };
    
  } catch (error: any) {
    throw new Error(`Error validando datos: ${error.message}`);
  }
}

// Función auxiliar de validación interna
async function validatePatientDataInternal(args: any): Promise<any> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  // Validar documento
  if (!args.document || args.document.trim().length < 5) {
    errors.push('Documento de identidad debe tener al menos 5 caracteres');
  }
  
  // Validar nombre
  if (!args.name || args.name.trim().length < 3) {
    errors.push('Nombre debe tener al menos 3 caracteres');
  }
  
  // Validar fecha de nacimiento
  if (args.birth_date) {
    const birthDate = new Date(args.birth_date);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    
    if (age < 0 || age > 120) {
      errors.push('Fecha de nacimiento resulta en edad no válida (0-120 años)');
    }
    
    if (age < 18) {
      warnings.push('Paciente menor de edad - pueden requerirse datos del tutor');
    }
  }
  
  // Validar teléfono
  if (args.phone && !/^\d{10}$/.test(args.phone.replace(/\D/g, ''))) {
    warnings.push('Formato de teléfono puede no ser válido (se esperan 10 dígitos)');
  }
  
  // Validar email
  if (args.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email)) {
    errors.push('Formato de email no válido');
  }
  
  // Sugerencias
  if (!args.email) {
    suggestions.push('Considerar agregar email para comunicaciones');
  }
  
  if (!args.phone_alt) {
    suggestions.push('Considerar agregar teléfono alternativo');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

// ===================================================================
// IMPLEMENTACIONES DE FUNCIONES - CONSULTA
// ===================================================================

async function searchPatientsUltra(args: any, pool: mysql.Pool): Promise<any> {
  try {
    let query = `
      SELECT DISTINCT
        p.id,
        p.external_id,
        p.document,
        p.name,
        p.phone,
        p.phone_alt,
        p.email,
        p.birth_date,
        p.gender,
        p.address,
        p.status,
        p.created_at,
        p.notes,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age,
        m.name as municipality_name,
        eps.name as eps_name,
        bg.name as blood_group_name
    `;
    
    // Agregar estadísticas si se solicita
    if (args.include_statistics) {
      query += `,
        COUNT(DISTINCT a.id) as total_appointments,
        COUNT(DISTINCT CASE WHEN a.status = 'Completada' THEN a.id END) as completed_appointments,
        COUNT(DISTINCT CASE WHEN a.status = 'Pendiente' THEN a.id END) as pending_appointments,
        MAX(a.scheduled_at) as last_appointment_date
      `;
    }
    
    query += `
      FROM patients p
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps ON p.insurance_eps_id = eps.id
      LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id
    `;
    
    if (args.include_statistics || args.has_appointments || args.has_recent_appointments || args.has_pending_appointments) {
      query += ` LEFT JOIN appointments a ON p.id = a.patient_id`;
    }
    
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    
    // Búsqueda textual general
    if (args.search_text) {
      const searchTerm = `%${args.search_text}%`;
      conditions.push('(p.name LIKE ? OR p.document LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)');
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    // Filtros específicos
    if (args.document) {
      conditions.push('p.document = ?');
      params.push(args.document);
    }
    
    if (args.name) {
      conditions.push('p.name LIKE ?');
      params.push(`%${args.name}%`);
    }
    
    if (args.phone) {
      conditions.push('(p.phone LIKE ? OR p.phone_alt LIKE ?)');
      params.push(`%${args.phone}%`, `%${args.phone}%`);
    }
    
    if (args.email) {
      conditions.push('p.email LIKE ?');
      params.push(`%${args.email}%`);
    }
    
    // Filtros demográficos
    if (args.gender) {
      conditions.push('p.gender = ?');
      params.push(args.gender);
    }
    
    if (args.birth_year) {
      conditions.push('YEAR(p.birth_date) = ?');
      params.push(args.birth_year);
    }
    
    // Filtros geográficos
    if (args.municipality_id) {
      conditions.push('p.municipality_id = ?');
      params.push(args.municipality_id);
    }
    
    if (args.municipality_name) {
      conditions.push('m.name LIKE ?');
      params.push(`%${args.municipality_name}%`);
    }
    
    // Filtros de seguro
    if (args.insurance_eps_id) {
      conditions.push('p.insurance_eps_id = ?');
      params.push(args.insurance_eps_id);
    }
    
    if (args.insurance_type) {
      conditions.push('p.insurance_affiliation_type = ?');
      params.push(args.insurance_type);
    }
    
    // Filtros de estado
    if (args.status) {
      conditions.push('p.status = ?');
      params.push(args.status);
    }
    
    // Filtros temporales
    if (args.registered_after) {
      conditions.push('DATE(p.created_at) >= ?');
      params.push(args.registered_after);
    }
    
    if (args.registered_before) {
      conditions.push('DATE(p.created_at) <= ?');
      params.push(args.registered_before);
    }
    
    query += ` WHERE ${conditions.join(' AND ')}`;
    
    // Agrupación si se incluyen estadísticas
    if (args.include_statistics) {
      query += ` GROUP BY p.id`;
    }
    
    // Filtros HAVING para edad
    const havingConditions: string[] = [];
    if (args.age_min) {
      havingConditions.push('age >= ?');
      params.push(args.age_min);
    }
    
    if (args.age_max) {
      havingConditions.push('age <= ?');
      params.push(args.age_max);
    }
    
    if (havingConditions.length > 0) {
      query += ` HAVING ${havingConditions.join(' AND ')}`;
    }
    
    // Ordenamiento
    const sortField = args.sort_by || 'name';
    const sortDirection = args.sort_direction || 'ASC';
    query += ` ORDER BY ${sortField} ${sortDirection}`;
    
    // Paginación
    const limit = Math.min(args.limit || 50, 500);
    const offset = args.offset || 0;
    query += ` LIMIT ${limit} OFFSET ${offset}`;
    
    const [rows] = await pool.execute(query, params);
    
    return {
      patients: rows,
      total: (rows as any[]).length,
      search_criteria: args,
      pagination: {
        limit,
        offset,
        has_more: (rows as any[]).length === limit
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error: any) {
    throw new Error(`Error en búsqueda ultra de pacientes: ${error.message}`);
  }
}

async function getPatientComplete(args: any, pool: mysql.Pool): Promise<any> {
  try {
    // Información básica del paciente
    const [patientRows] = await pool.execute(`
      SELECT 
        p.*,
        m.name as municipality_name,
        z.name as zone_name,
        eps.name as eps_name,
        bg.name as blood_group_name,
        dt.name as document_type_name,
        ms.name as marital_status_name,
        el.name as education_level_name,
        pg.name as population_group_name,
        dit.name as disability_type_name,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age
      FROM patients p
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN zones z ON p.zone_id = z.id
      LEFT JOIN eps ON p.insurance_eps_id = eps.id
      LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id
      LEFT JOIN document_types dt ON p.document_type_id = dt.id
      LEFT JOIN marital_statuses ms ON p.marital_status_id = ms.id
      LEFT JOIN education_levels el ON p.education_level_id = el.id
      LEFT JOIN population_groups pg ON p.population_group_id = pg.id
      LEFT JOIN disability_types dit ON p.disability_type_id = dit.id
      WHERE p.id = ?
    `, [args.patient_id]);
    
    if ((patientRows as any[]).length === 0) {
      throw new Error('Paciente no encontrado');
    }
    
    const patient = (patientRows as any[])[0];
    const profile: any = { patient };
    
    // Estadísticas de citas si se solicita
    if (args.include_appointment_stats) {
      const daysBack = args.history_days_back || 90;
      const [appointmentStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_appointments,
          COUNT(CASE WHEN status = 'Completada' THEN 1 END) as completed_appointments,
          COUNT(CASE WHEN status = 'Pendiente' THEN 1 END) as pending_appointments,
          COUNT(CASE WHEN status = 'Cancelada' THEN 1 END) as cancelled_appointments,
          COUNT(CASE WHEN status = 'Confirmada' THEN 1 END) as confirmed_appointments,
          MAX(scheduled_at) as last_appointment_date,
          MIN(scheduled_at) as first_appointment_date,
          AVG(duration_minutes) as avg_duration_minutes
        FROM appointments 
        WHERE patient_id = ? AND scheduled_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      `, [args.patient_id, daysBack]);
      
      profile.appointment_stats = (appointmentStats as any[])[0];
    }
    
    // Historial de citas si se solicita
    if (args.include_appointment_history) {
      const [appointmentHistory] = await pool.execute(`
        SELECT 
          a.id,
          a.scheduled_at,
          a.duration_minutes,
          a.status,
          a.reason,
          a.notes,
          a.appointment_type,
          d.name as doctor_name,
          s.name as specialty_name,
          l.name as location_name
        FROM appointments a
        LEFT JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN specialties s ON a.specialty_id = s.id
        LEFT JOIN locations l ON a.location_id = l.id
        WHERE a.patient_id = ?
        ORDER BY a.scheduled_at DESC
        LIMIT 20
      `, [args.patient_id]);
      
      profile.appointment_history = appointmentHistory;
    }
    
    // Próximas citas
    const [upcomingAppointments] = await pool.execute(`
      SELECT 
        a.id,
        a.scheduled_at,
        a.duration_minutes,
        a.status,
        a.reason,
        a.appointment_type,
        d.name as doctor_name,
        s.name as specialty_name,
        l.name as location_name
      FROM appointments a
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.patient_id = ? AND a.scheduled_at >= NOW()
      ORDER BY a.scheduled_at ASC
      LIMIT 10
    `, [args.patient_id]);
    
    profile.upcoming_appointments = upcomingAppointments;
    
    return {
      success: true,
      profile,
      generated_at: new Date().toISOString(),
      data_completeness: calculateDataCompleteness(patient)
    };
    
  } catch (error: any) {
    throw new Error(`Error obteniendo paciente completo: ${error.message}`);
  }
}

// Función auxiliar para calcular completitud de datos
function calculateDataCompleteness(patient: any): any {
  const requiredFields = ['name', 'document', 'birth_date', 'gender', 'phone', 'address', 'municipality_id', 'insurance_eps_id'];
  const optionalFields = ['email', 'phone_alt', 'zone_id', 'blood_group_id', 'marital_status_id', 'education_level_id', 'population_group_id'];
  
  const completedRequired = requiredFields.filter(field => patient[field] != null && patient[field] !== '').length;
  const completedOptional = optionalFields.filter(field => patient[field] != null && patient[field] !== '').length;
  
  return {
    required_completeness: (completedRequired / requiredFields.length) * 100,
    optional_completeness: (completedOptional / optionalFields.length) * 100,
    overall_completeness: ((completedRequired + completedOptional) / (requiredFields.length + optionalFields.length)) * 100,
    missing_required: requiredFields.filter(field => !patient[field]),
    missing_optional: optionalFields.filter(field => !patient[field])
  };
}

// ===================================================================
// IMPLEMENTACIONES RESTANTES (CONTINUARÁ...)
// ===================================================================

// Las demás funciones se implementarán siguiendo el mismo patrón
// Por ahora, funciones placeholder para compilación

async function findPatientDuplicates(args: any, pool: mysql.Pool): Promise<any> {
  try {
    let duplicates: any[] = [];
    
    // Si se proporciona un patient_id específico, buscar duplicados de ese paciente
    if (args.patient_id) {
      const [targetPatient] = await pool.execute(
        'SELECT document, name, phone, email, birth_date FROM patients WHERE id = ?',
        [args.patient_id]
      );
      
      if ((targetPatient as any[]).length === 0) {
        throw new Error('Paciente no encontrado');
      }
      
      const target = (targetPatient as any[])[0];
      
      // Buscar duplicados por documento
      if (args.search_criteria.includes('document') && target.document) {
        const [docDuplicates] = await pool.execute(
          'SELECT *, "document" as match_type FROM patients WHERE document = ? AND id != ?',
          [target.document, args.patient_id]
        );
        duplicates.push(...(docDuplicates as any[]));
      }
      
      // Buscar duplicados por nombre
      if (args.search_criteria.includes('name') && target.name) {
        const [nameDuplicates] = await pool.execute(
          'SELECT *, "name" as match_type FROM patients WHERE name = ? AND id != ?',
          [target.name, args.patient_id]
        );
        duplicates.push(...(nameDuplicates as any[]));
      }
      
      // Buscar duplicados por teléfono
      if (args.search_criteria.includes('phone') && target.phone) {
        const [phoneDuplicates] = await pool.execute(
          'SELECT *, "phone" as match_type FROM patients WHERE (phone = ? OR phone_alt = ?) AND id != ?',
          [target.phone, target.phone, args.patient_id]
        );
        duplicates.push(...(phoneDuplicates as any[]));
      }
      
    } else {
      // Buscar duplicados generales en todo el sistema
      const queries = [];
      
      if (args.search_criteria.includes('document')) {
        queries.push(`
          SELECT p1.*, p2.id as duplicate_id, p2.name as duplicate_name, "document" as match_type
          FROM patients p1
          JOIN patients p2 ON p1.document = p2.document AND p1.id < p2.id
          WHERE p1.document IS NOT NULL AND p1.document != ''
        `);
      }
      
      if (args.search_criteria.includes('name')) {
        queries.push(`
          SELECT p1.*, p2.id as duplicate_id, p2.name as duplicate_name, "name" as match_type
          FROM patients p1
          JOIN patients p2 ON p1.name = p2.name AND p1.id < p2.id
          WHERE p1.name IS NOT NULL AND p1.name != ''
        `);
      }
      
      if (args.search_criteria.includes('phone')) {
        queries.push(`
          SELECT p1.*, p2.id as duplicate_id, p2.name as duplicate_name, "phone" as match_type
          FROM patients p1
          JOIN patients p2 ON (p1.phone = p2.phone OR p1.phone = p2.phone_alt OR p1.phone_alt = p2.phone) AND p1.id < p2.id
          WHERE p1.phone IS NOT NULL AND p1.phone != ''
        `);
      }
      
      for (const query of queries) {
        const [results] = await pool.execute(query);
        duplicates.push(...(results as any[]));
      }
    }
    
    // Remover duplicados de la lista de duplicados (en caso de múltiples criterios)
    const uniqueDuplicates = duplicates.filter((duplicate, index, self) => 
      index === self.findIndex(d => d.id === duplicate.id)
    );
    
    // Limitar resultados si se especifica
    const limitedDuplicates = args.max_results ? 
      uniqueDuplicates.slice(0, args.max_results) : 
      uniqueDuplicates;
    
    return {
      patient_id: args.patient_id || null,
      search_criteria: args.search_criteria,
      duplicates_found: limitedDuplicates.length,
      duplicates: limitedDuplicates,
      similarity_threshold: args.similarity_threshold,
      include_inactive: args.include_inactive,
      recommendations: generateDuplicateRecommendations(limitedDuplicates)
    };
    
  } catch (error: any) {
    throw new Error(`Error buscando duplicados: ${error.message}`);
  }
}

// Función auxiliar para generar recomendaciones de duplicados
function generateDuplicateRecommendations(duplicates: any[]): string[] {
  const recommendations: string[] = [];
  
  if (duplicates.length === 0) {
    recommendations.push('No se encontraron duplicados potenciales');
  } else if (duplicates.length <= 3) {
    recommendations.push('Revisar manualmente los duplicados encontrados');
    recommendations.push('Considerar fusionar registros si son del mismo paciente');
  } else {
    recommendations.push('Alto número de duplicados - implementar proceso de limpieza masiva');
    recommendations.push('Priorizar duplicados por documento de identidad');
    recommendations.push('Validar información de contacto antes de fusionar');
  }
  
  return recommendations;
}

async function updatePatientAdvanced(args: any, pool: mysql.Pool): Promise<any> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Verificar que el paciente existe
    const [existingPatient] = await connection.execute(
      'SELECT id, name, document FROM patients WHERE id = ?',
      [args.patient_id]
    );
    
    if ((existingPatient as any[]).length === 0) {
      await connection.rollback();
      throw new Error('Paciente no encontrado');
    }
    
    const currentPatient = (existingPatient as any[])[0];
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    const changes: any[] = [];
    
    // Actualizar información personal
    if (args.personal_data) {
      for (const [field, value] of Object.entries(args.personal_data)) {
        if (value !== undefined && value !== null) {
          updateFields.push(`${field} = ?`);
          updateValues.push(value);
          changes.push({
            field: field,
            old_value: (currentPatient as any)[field],
            new_value: value,
            category: 'personal_data'
          });
        }
      }
    }
    
    // Actualizar información de contacto
    if (args.contact_data) {
      for (const [field, value] of Object.entries(args.contact_data)) {
        if (value !== undefined && value !== null) {
          updateFields.push(`${field} = ?`);
          updateValues.push(value);
          changes.push({
            field: field,
            old_value: (currentPatient as any)[field],
            new_value: value,
            category: 'contact_data'
          });
        }
      }
    }
    
    // Actualizar información de seguro
    if (args.insurance_data) {
      for (const [field, value] of Object.entries(args.insurance_data)) {
        if (value !== undefined && value !== null) {
          updateFields.push(`${field} = ?`);
          updateValues.push(value);
          changes.push({
            field: field,
            old_value: (currentPatient as any)[field],
            new_value: value,
            category: 'insurance_data'
          });
        }
      }
    }
    
    // Actualizar información médica
    if (args.medical_data) {
      for (const [field, value] of Object.entries(args.medical_data)) {
        if (value !== undefined && value !== null) {
          updateFields.push(`${field} = ?`);
          updateValues.push(value);
          changes.push({
            field: field,
            old_value: (currentPatient as any)[field],
            new_value: value,
            category: 'medical_data'
          });
        }
      }
    }
    
    // Actualizar información socioeconómica
    if (args.socioeconomic_data) {
      for (const [field, value] of Object.entries(args.socioeconomic_data)) {
        if (value !== undefined && value !== null) {
          updateFields.push(`${field} = ?`);
          updateValues.push(value);
          changes.push({
            field: field,
            old_value: (currentPatient as any)[field],
            new_value: value,
            category: 'socioeconomic_data'
          });
        }
      }
    }
    
    // Campos individuales
    if (args.notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(args.notes);
      changes.push({
        field: 'notes',
        old_value: (currentPatient as any).notes,
        new_value: args.notes,
        category: 'general'
      });
    }
    
    if (args.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(args.status);
      changes.push({
        field: 'status',
        old_value: (currentPatient as any).status,
        new_value: args.status,
        category: 'general'
      });
    }
    
    if (updateFields.length === 0) {
      await connection.rollback();
      return {
        success: false,
        message: 'No se proporcionaron campos para actualizar'
      };
    }
    
    // Validar cambios si se solicita
    if (args.validate_changes) {
      // Validación simplificada - puede expandirse según necesidades
      if (args.personal_data?.birth_date) {
        const birthDate = new Date(args.personal_data.birth_date);
        const age = new Date().getFullYear() - birthDate.getFullYear();
        if (age < 0 || age > 120) {
          await connection.rollback();
          return {
            success: false,
            error: 'Fecha de nacimiento inválida',
            validation_errors: ['La edad calculada no es válida (0-120 años)']
          };
        }
      }
      
      if (args.contact_data?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.contact_data.email)) {
        await connection.rollback();
        return {
          success: false,
          error: 'Email inválido',
          validation_errors: ['Formato de email no válido']
        };
      }
    }
    
    // Agregar campo de última actualización
    updateFields.push('updated_at = NOW()');
    updateValues.push(args.patient_id);
    
    // Ejecutar actualización
    await connection.execute(
      `UPDATE patients SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    // Registrar historial de cambios si se solicita
    if (args.log_changes && changes.length > 0) {
      for (const change of changes) {
        await connection.execute(`
          INSERT INTO patient_change_history 
          (patient_id, field_name, old_value, new_value, category, changed_by, change_reason, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
          args.patient_id,
          change.field,
          change.old_value,
          change.new_value,
          change.category,
          args.updated_by || 'Sistema',
          args.reason_for_update || 'Actualización general'
        ]);
      }
    }
    
    await connection.commit();
    
    // Obtener el paciente actualizado
    const [updatedPatient] = await connection.execute(`
      SELECT 
        p.*,
        m.name as municipality_name,
        eps.name as eps_name,
        bg.name as blood_group_name,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age
      FROM patients p
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps ON p.insurance_eps_id = eps.id
      LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id
      WHERE p.id = ?
    `, [args.patient_id]);
    
    return {
      success: true,
      patient: (updatedPatient as any[])[0],
      changes_made: changes.length,
      changes_details: changes,
      message: 'Paciente actualizado exitosamente',
      updated_by: args.updated_by || 'Sistema',
      updated_at: new Date().toISOString()
    };
    
  } catch (error: any) {
    await connection.rollback();
    throw new Error(`Error actualizando paciente: ${error.message}`);
  } finally {
    connection.release();
  }
}

async function updatePatientField(args: any, pool: mysql.Pool): Promise<any> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Verificar que el paciente existe y obtener valor actual
    const [currentData] = await connection.execute(
      `SELECT id, ${args.field_name} as current_value FROM patients WHERE id = ?`,
      [args.patient_id]
    );
    
    if ((currentData as any[]).length === 0) {
      await connection.rollback();
      throw new Error('Paciente no encontrado');
    }
    
    const currentValue = (currentData as any[])[0].current_value;
    
    // Validar nuevo valor si se solicita
    if (args.validate_value) {
      let isValid = true;
      let errors: string[] = [];
      
      // Validaciones básicas por campo
      switch (args.field_name) {
        case 'email':
          if (args.new_value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.new_value)) {
            isValid = false;
            errors.push('Formato de email no válido');
          }
          break;
        case 'phone':
        case 'phone_alt':
          if (args.new_value && !/^\d{10}$/.test(args.new_value.replace(/\D/g, ''))) {
            errors.push('Formato de teléfono puede no ser válido (se esperan 10 dígitos)');
          }
          break;
        case 'estrato':
          const estrato = parseInt(args.new_value);
          if (isNaN(estrato) || estrato < 0 || estrato > 6) {
            isValid = false;
            errors.push('Estrato debe ser un número entre 0 y 6');
          }
          break;
      }
      
      if (!isValid) {
        await connection.rollback();
        return {
          success: false,
          error: 'Validación del campo falló',
          validation_errors: errors
        };
      }
    }
    
    // Actualizar el campo
    await connection.execute(
      `UPDATE patients SET ${args.field_name} = ?, updated_at = NOW() WHERE id = ?`,
      [args.new_value, args.patient_id]
    );
    
    // Registrar cambio si se solicita
    if (args.log_change) {
      await connection.execute(`
        INSERT INTO patient_change_history 
        (patient_id, field_name, old_value, new_value, category, changed_by, change_reason, created_at)
        VALUES (?, ?, ?, ?, 'field_update', ?, ?, NOW())
      `, [
        args.patient_id,
        args.field_name,
        currentValue,
        args.new_value,
        args.updated_by || 'Sistema',
        args.change_reason || 'Actualización de campo individual'
      ]);
    }
    
    await connection.commit();
    
    return {
      success: true,
      field_updated: args.field_name,
      old_value: currentValue,
      new_value: args.new_value,
      updated_by: args.updated_by || 'Sistema',
      message: `Campo ${args.field_name} actualizado exitosamente`
    };
    
  } catch (error: any) {
    await connection.rollback();
    throw new Error(`Error actualizando campo: ${error.message}`);
  } finally {
    connection.release();
  }
}

async function getPatientChangeHistory(args: any, pool: mysql.Pool): Promise<any> {
  try {
    let query = `
      SELECT 
        pch.*,
        p.name as patient_name,
        p.document as patient_document
      FROM patient_change_history pch
      LEFT JOIN patients p ON pch.patient_id = p.id
      WHERE pch.patient_id = ?
    `;
    
    const params: any[] = [args.patient_id];
    
    // Agregar filtros opcionales
    if (args.field_name) {
      query += ' AND pch.field_name = ?';
      params.push(args.field_name);
    }
    
    if (args.date_from) {
      query += ' AND DATE(pch.created_at) >= ?';
      params.push(args.date_from);
    }
    
    if (args.date_to) {
      query += ' AND DATE(pch.created_at) <= ?';
      params.push(args.date_to);
    }
    
    if (args.changed_by) {
      query += ' AND pch.changed_by = ?';
      params.push(args.changed_by);
    }
    
    query += ' ORDER BY pch.created_at DESC';
    
    if (args.limit) {
      query += ' LIMIT ?';
      params.push(args.limit);
    }
    
    const [history] = await pool.execute(query, params);
    
    return {
      patient_id: args.patient_id,
      change_history: history,
      total_changes: (history as any[]).length,
      filters_applied: {
        field_name: args.field_name || null,
        date_from: args.date_from || null,
        date_to: args.date_to || null,
        changed_by: args.changed_by || null
      }
    };
    
  } catch (error: any) {
    throw new Error(`Error obteniendo historial de cambios: ${error.message}`);
  }
}

async function mergePatientRecords(args: any, pool: mysql.Pool): Promise<any> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Verificar que el paciente principal existe
    const [primaryPatient] = await connection.execute(
      'SELECT * FROM patients WHERE id = ?',
      [args.primary_patient_id]
    );
    
    if ((primaryPatient as any[]).length === 0) {
      await connection.rollback();
      throw new Error('Paciente principal no encontrado');
    }
    
    // Verificar que todos los pacientes duplicados existen
    for (const duplicateId of args.duplicate_patient_ids) {
      const [duplicate] = await connection.execute(
        'SELECT id, name, document FROM patients WHERE id = ?',
        [duplicateId]
      );
      
      if ((duplicate as any[]).length === 0) {
        await connection.rollback();
        throw new Error(`Paciente duplicado con ID ${duplicateId} no encontrado`);
      }
    }
    
    const mergeResults: any = {
      appointments_merged: 0,
      medical_records_merged: 0,
      contact_history_merged: 0,
      notes_merged: [] as any[],
      duplicate_patients_archived: 0
    };
    
    // Fusionar citas si se solicita
    if (args.merge_appointments) {
      for (const duplicateId of args.duplicate_patient_ids) {
        const [updateResult] = await connection.execute(
          'UPDATE appointments SET patient_id = ? WHERE patient_id = ?',
          [args.primary_patient_id, duplicateId]
        );
        mergeResults.appointments_merged += (updateResult as any).affectedRows;
      }
    }
    
    // Fusionar registros médicos si se solicita (si existen las tablas)
    if (args.merge_medical_records) {
      for (const duplicateId of args.duplicate_patient_ids) {
        // Actualizar registros médicos
        try {
          const [medicalUpdate] = await connection.execute(
            'UPDATE medical_records SET patient_id = ? WHERE patient_id = ?',
            [args.primary_patient_id, duplicateId]
          );
          mergeResults.medical_records_merged += (medicalUpdate as any).affectedRows;
        } catch (error) {
          // Tabla puede no existir, continuar
        }
        
        // Actualizar prescripciones
        try {
          await connection.execute(
            'UPDATE prescriptions SET patient_id = ? WHERE patient_id = ?',
            [args.primary_patient_id, duplicateId]
          );
        } catch (error) {
          // Tabla puede no existir, continuar
        }
      }
    }
    
    // Preservar notas importantes de pacientes duplicados
    if (args.preserve_all_data) {
      for (const duplicateId of args.duplicate_patient_ids) {
        const [duplicateData] = await connection.execute(
          'SELECT name, document, notes FROM patients WHERE id = ?',
          [duplicateId]
        );
        
        const duplicate = (duplicateData as any[])[0];
        if (duplicate.notes) {
          mergeResults.notes_merged.push({
            from_patient_id: duplicateId,
            from_patient_name: duplicate.name,
            from_patient_document: duplicate.document,
            notes: duplicate.notes
          });
          
          // Agregar notas del duplicado al paciente principal
          await connection.execute(`
            UPDATE patients 
            SET notes = CONCAT(
              IFNULL(notes, ''), 
              '\n--- Fusionado de paciente ', ?, ' (', ?, ') ---\n',
              ?
            )
            WHERE id = ?
          `, [duplicate.document, duplicate.name, duplicate.notes, args.primary_patient_id]);
        }
      }
    }
    
    // Marcar pacientes duplicados como inactivos/archivados
    for (const duplicateId of args.duplicate_patient_ids) {
      await connection.execute(`
        UPDATE patients 
        SET status = 'Inactivo',
            notes = CONCAT(
              IFNULL(notes, ''), 
              '\n--- FUSIONADO CON PACIENTE ID: ', ?, ' ---\n',
              'Fecha de fusión: ', NOW(), '\n',
              'Realizado por: ', ?, '\n',
              'Motivo: ', ?
            ),
            updated_at = NOW()
        WHERE id = ?
      `, [args.primary_patient_id, args.performed_by, args.merge_notes || 'Fusión de registros duplicados', duplicateId]);
      
      mergeResults.duplicate_patients_archived++;
    }
    
    // Registrar la operación de fusión en el historial del paciente principal
    await connection.execute(`
      INSERT INTO patient_change_history 
      (patient_id, field_name, old_value, new_value, category, changed_by, change_reason, created_at)
      VALUES (?, 'merge_operation', ?, ?, 'merge', ?, ?, NOW())
    `, [
      args.primary_patient_id,
      JSON.stringify(args.duplicate_patient_ids),
      JSON.stringify(mergeResults),
      args.performed_by,
      args.merge_notes || 'Fusión de registros duplicados'
    ]);
    
    await connection.commit();
    
    return {
      success: true,
      primary_patient_id: args.primary_patient_id,
      duplicate_patient_ids: args.duplicate_patient_ids,
      merge_results: mergeResults,
      message: 'Registros de pacientes fusionados exitosamente',
      performed_by: args.performed_by,
      performed_at: new Date().toISOString()
    };
    
  } catch (error: any) {
    await connection.rollback();
    throw new Error(`Error fusionando registros de pacientes: ${error.message}`);
  } finally {
    connection.release();
  }
}

async function archivePatient(args: any, pool: mysql.Pool): Promise<any> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Verificar que el paciente existe
    const [patient] = await connection.execute(
      'SELECT id, name, document, status FROM patients WHERE id = ?',
      [args.patient_id]
    );
    
    if ((patient as any[]).length === 0) {
      await connection.rollback();
      throw new Error('Paciente no encontrado');
    }
    
    const patientData = (patient as any[])[0];
    
    if (patientData.status === 'Inactivo') {
      return {
        success: false,
        message: 'El paciente ya está archivado/inactivo'
      };
    }
    
    // Verificar si tiene citas pendientes
    const [pendingAppointments] = await connection.execute(
      "SELECT COUNT(*) as pending_count FROM appointments WHERE patient_id = ? AND status = 'Pendiente' AND scheduled_at > NOW()",
      [args.patient_id]
    );
    
    const pendingCount = (pendingAppointments as any[])[0].pending_count;
    if (pendingCount > 0 && args.archive_reason !== 'deceased') {
      return {
        success: false,
        message: `El paciente tiene ${pendingCount} cita(s) pendiente(s). Cancele las citas antes de archivar.`,
        pending_appointments: pendingCount
      };
    }
    
    // Archivar el paciente
    await connection.execute(`
      UPDATE patients 
      SET status = 'Inactivo',
          notes = CONCAT(
            IFNULL(notes, ''), 
            '\n--- PACIENTE ARCHIVADO ---\n',
            'Fecha: ', NOW(), '\n',
            'Razón: ', ?, '\n',
            'Archivado por: ', ?, '\n',
            'Notas: ', ?, '\n',
            '------------------------\n'
          ),
          updated_at = NOW()
      WHERE id = ?
    `, [args.archive_reason, args.archived_by, args.archive_notes || 'Sin notas adicionales', args.patient_id]);
    
    // Si es por fallecimiento, cancelar todas las citas futuras
    if (args.archive_reason === 'deceased') {
      await connection.execute(
        "UPDATE appointments SET status = 'Cancelada', notes = CONCAT(IFNULL(notes, ''), '\nCancelada por fallecimiento del paciente') WHERE patient_id = ? AND scheduled_at > NOW()",
        [args.patient_id]
      );
    }
    
    // Registrar en el historial de cambios
    await connection.execute(`
      INSERT INTO patient_change_history 
      (patient_id, field_name, old_value, new_value, category, changed_by, change_reason, created_at)
      VALUES (?, 'archive_operation', 'Activo', 'Inactivo', 'archive', ?, ?, NOW())
    `, [args.patient_id, args.archived_by, `Archivado - ${args.archive_reason}: ${args.archive_notes || 'Sin notas'}`]);
    
    await connection.commit();
    
    return {
      success: true,
      patient_id: args.patient_id,
      patient_name: patientData.name,
      patient_document: patientData.document,
      archive_reason: args.archive_reason,
      archive_notes: args.archive_notes,
      archived_by: args.archived_by,
      archived_at: new Date().toISOString(),
      appointments_cancelled: args.archive_reason === 'deceased' ? pendingCount : 0,
      message: 'Paciente archivado exitosamente'
    };
    
  } catch (error: any) {
    await connection.rollback();
    throw new Error(`Error archivando paciente: ${error.message}`);
  } finally {
    connection.release();
  }
}

async function restorePatient(args: any, pool: mysql.Pool): Promise<any> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Verificar que el paciente existe y está inactivo
    const [patient] = await connection.execute(
      'SELECT id, name, document, status FROM patients WHERE id = ?',
      [args.patient_id]
    );
    
    if ((patient as any[]).length === 0) {
      await connection.rollback();
      throw new Error('Paciente no encontrado');
    }
    
    const patientData = (patient as any[])[0];
    
    if (patientData.status === 'Activo') {
      return {
        success: false,
        message: 'El paciente ya está activo'
      };
    }
    
    // Verificar datos si se solicita
    if (args.verify_data) {
      // Validaciones básicas
      const [currentData] = await connection.execute(
        'SELECT name, document, phone, birth_date FROM patients WHERE id = ?',
        [args.patient_id]
      );
      
      const current = (currentData as any[])[0];
      const validation = await validatePatientDataInternal({
        document: current.document,
        name: current.name,
        phone: current.phone,
        birth_date: current.birth_date
      });
      
      if (!validation.valid) {
        return {
          success: false,
          message: 'Los datos del paciente requieren actualización antes de la restauración',
          validation_errors: validation.errors,
          validation_warnings: validation.warnings
        };
      }
    }
    
    // Restaurar el paciente
    await connection.execute(`
      UPDATE patients 
      SET status = 'Activo',
          notes = CONCAT(
            IFNULL(notes, ''), 
            '\n--- PACIENTE RESTAURADO ---\n',
            'Fecha: ', NOW(), '\n',
            'Razón: ', ?, '\n',
            'Restaurado por: ', ?, '\n',
            '-------------------------\n'
          ),
          updated_at = NOW()
      WHERE id = ?
    `, [args.restore_reason, args.restored_by, args.patient_id]);
    
    // Registrar en el historial de cambios
    await connection.execute(`
      INSERT INTO patient_change_history 
      (patient_id, field_name, old_value, new_value, category, changed_by, change_reason, created_at)
      VALUES (?, 'restore_operation', 'Inactivo', 'Activo', 'restore', ?, ?, NOW())
    `, [args.patient_id, args.restored_by, args.restore_reason]);
    
    await connection.commit();
    
    // Obtener el paciente restaurado
    const [restoredPatient] = await connection.execute(`
      SELECT 
        p.*,
        m.name as municipality_name,
        eps.name as eps_name,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age
      FROM patients p
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps ON p.insurance_eps_id = eps.id
      WHERE p.id = ?
    `, [args.patient_id]);
    
    return {
      success: true,
      patient: (restoredPatient as any[])[0],
      restore_reason: args.restore_reason,
      restored_by: args.restored_by,
      restored_at: new Date().toISOString(),
      message: 'Paciente restaurado exitosamente'
    };
    
  } catch (error: any) {
    await connection.rollback();
    throw new Error(`Error restaurando paciente: ${error.message}`);
  } finally {
    connection.release();
  }
}

async function getPatientStatistics(args: any, pool: mysql.Pool): Promise<any> {
  try {
    const stats: any = {
      analysis_type: args.analysis_type || 'overview',
      timestamp: new Date().toISOString()
    };
    
    // Estadísticas generales
    const [overview] = await pool.execute(`
      SELECT 
        COUNT(*) as total_patients,
        COUNT(CASE WHEN status = 'Activo' THEN 1 END) as active_patients,
        COUNT(CASE WHEN status = 'Inactivo' THEN 1 END) as inactive_patients,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as registered_today,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as registered_this_week,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as registered_this_month
      FROM patients
    `);
    
    stats.overview = (overview as any[])[0];
    
    return stats;
    
  } catch (error: any) {
    throw new Error(`Error obteniendo estadísticas de pacientes: ${error.message}`);
  }
}

// ===================================================================
// FUNCIÓN PARA OBTENER DISPONIBILIDADES DE CITAS
// ===================================================================

async function getAvailableAppointments(args: any, pool: mysql.Pool): Promise<any> {
  try {
    // Configurar fechas por defecto
    const dateFrom = args.date_from || new Date().toISOString().split('T')[0]; // Hoy
    const dateTo = args.date_to || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // +30 días
    
    let query = `
      SELECT 
        a.id as availability_id,
        a.date,
        a.start_time,
        a.end_time,
        a.capacity,
        a.booked_slots,
        (a.capacity - a.booked_slots) as available_slots,
        a.status,
        a.notes as availability_notes,
        a.duration_minutes,
        a.break_between_slots,
        
        -- Información del médico
        d.id as doctor_id,
        d.name as doctor_name,
        d.phone as doctor_phone,
        d.email as doctor_email,
        d.license_number as doctor_license,
        
        -- Información de la especialidad
        s.id as specialty_id,
        s.name as specialty_name,
        s.description as specialty_description,
        
        -- Información de la ubicación
        l.id as location_id,
        l.name as location_name,
        l.address as location_address,
        l.phone as location_phone,
        l.type as location_type,
        l.status as location_status,
        
        -- Información adicional
        CASE 
          WHEN (a.capacity - a.booked_slots) > 0 THEN 'Disponible'
          WHEN (a.capacity - a.booked_slots) = 0 THEN 'Completo'
          ELSE 'Sin cupos'
        END as availability_status,
        
        CASE 
          WHEN a.date = CURDATE() THEN 'Hoy'
          WHEN a.date = DATE_ADD(CURDATE(), INTERVAL 1 DAY) THEN 'Mañana'
          WHEN a.date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'Esta semana'
          ELSE 'Próximamente'
        END as date_category
        
      FROM availabilities a
      INNER JOIN doctors d ON a.doctor_id = d.id
      INNER JOIN specialties s ON a.specialty_id = s.id
      INNER JOIN locations l ON a.location_id = l.id
    `;
    
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    
    // Filtros de fecha
    if (args.specific_date) {
      conditions.push('a.date = ?');
      params.push(args.specific_date);
    } else {
      conditions.push('a.date >= ? AND a.date <= ?');
      params.push(dateFrom, dateTo);
    }
    
    // Filtros de estado
    if (args.status) {
      conditions.push('a.status = ?');
      params.push(args.status);
    }
    
    // Solo disponibilidades con cupos si se solicita
    if (args.only_available) {
      conditions.push('(a.capacity - a.booked_slots) >= ?');
      params.push(args.min_available_slots || 1);
    }
    
    // Filtros de especialidad
    if (args.specialty_id) {
      conditions.push('a.specialty_id = ?');
      params.push(args.specialty_id);
    }
    
    if (args.specialty_name) {
      conditions.push('s.name LIKE ?');
      params.push(`%${args.specialty_name}%`);
    }
    
    // Filtros de ubicación
    if (args.location_id) {
      conditions.push('a.location_id = ?');
      params.push(args.location_id);
    }
    
    if (args.location_name) {
      conditions.push('l.name LIKE ?');
      params.push(`%${args.location_name}%`);
    }
    
    // Filtros de médico
    if (args.doctor_id) {
      conditions.push('a.doctor_id = ?');
      params.push(args.doctor_id);
    }
    
    if (args.doctor_name) {
      conditions.push('d.name LIKE ?');
      params.push(`%${args.doctor_name}%`);
    }
    
    // Filtros de horario
    if (args.time_from) {
      conditions.push('a.start_time >= ?');
      params.push(args.time_from);
    }
    
    if (args.time_to) {
      conditions.push('a.end_time <= ?');
      params.push(args.time_to);
    }
    
    query += ` WHERE ${conditions.join(' AND ')}`;
    
    // Ordenamiento
    const sortField = args.sort_by || 'date';
    const sortDirection = args.sort_direction || 'ASC';
    
    // Mapear campos de ordenamiento
    const sortMapping: { [key: string]: string } = {
      'date': 'a.date, a.start_time',
      'start_time': 'a.start_time',
      'doctor_name': 'd.name',
      'specialty_name': 's.name',
      'location_name': 'l.name',
      'available_slots': '(a.capacity - a.booked_slots)'
    };
    
    const orderBy = sortMapping[sortField] || 'a.date, a.start_time';
    query += ` ORDER BY ${orderBy} ${sortDirection}`;
    
    // Paginación
    const limit = Math.min(args.limit || 50, 200);
    const offset = args.offset || 0;
    query += ` LIMIT ${limit} OFFSET ${offset}`;
    
    const [availabilities] = await pool.execute(query, params);
    
    // Procesar resultados para incluir slots de tiempo si se solicita
    let processedResults = availabilities as any[];
    
    if (args.calculate_time_slots) {
      processedResults = (availabilities as any[]).map(availability => {
        const timeSlots = calculateTimeSlots(
          availability.start_time,
          availability.end_time,
          availability.duration_minutes,
          availability.break_between_slots,
          availability.booked_slots,
          availability.capacity
        );
        
        return {
          ...availability,
          time_slots: timeSlots,
          total_time_slots: timeSlots.length,
          available_time_slots: timeSlots.filter((slot: any) => slot.status === 'available').length
        };
      });
    }
    
    // Agrupar resultados si se solicita
    let groupedResults = processedResults;
    if (args.group_by_date) {
      groupedResults = groupBy(processedResults, 'date');
    } else if (args.group_by_doctor) {
      groupedResults = groupBy(processedResults, 'doctor_name');
    }
    
    // Obtener estadísticas generales
    const totalAvailable = processedResults.reduce((sum, item) => sum + item.available_slots, 0);
    const totalCapacity = processedResults.reduce((sum, item) => sum + item.capacity, 0);
    const totalBooked = processedResults.reduce((sum, item) => sum + item.booked_slots, 0);
    
    return {
      success: true,
      availabilities: groupedResults,
      total_results: processedResults.length,
      summary: {
        total_availabilities: processedResults.length,
        total_capacity: totalCapacity,
        total_booked: totalBooked,
        total_available: totalAvailable,
        occupation_rate: totalCapacity > 0 ? ((totalBooked / totalCapacity) * 100).toFixed(2) + '%' : '0%'
      },
      filters_applied: {
        date_from: args.specific_date || dateFrom,
        date_to: args.specific_date || dateTo,
        specialty_id: args.specialty_id || null,
        location_id: args.location_id || null,
        doctor_id: args.doctor_id || null,
        only_available: args.only_available !== false,
        min_available_slots: args.min_available_slots || 1
      },
      pagination: {
        limit,
        offset,
        has_more: processedResults.length === limit
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error: any) {
    throw new Error(`Error obteniendo disponibilidades de citas: ${error.message}`);
  }
}

// ===================================================================
// FUNCIONES AUXILIARES PARA DISPONIBILIDADES
// ===================================================================

function calculateTimeSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number,
  breakMinutes: number,
  bookedSlots: number,
  totalCapacity: number
): any[] {
  const slots: any[] = [];
  
  // Convertir tiempos a minutos desde medianoche
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const slotDuration = durationMinutes + breakMinutes;
  
  let currentMinutes = startMinutes;
  let slotNumber = 1;
  
  while (currentMinutes + durationMinutes <= endMinutes) {
    const slotStartTime = minutesToTime(currentMinutes);
    const slotEndTime = minutesToTime(currentMinutes + durationMinutes);
    
    // Determinar si el slot está disponible (simplificado)
    // En un sistema real, necesitarías verificar las citas específicas
    const isBooked = slotNumber <= bookedSlots;
    
    slots.push({
      slot_number: slotNumber,
      start_time: slotStartTime,
      end_time: slotEndTime,
      duration_minutes: durationMinutes,
      status: isBooked ? 'booked' : 'available',
      capacity: 1 // Asumiendo 1 paciente por slot
    });
    
    currentMinutes += slotDuration;
    slotNumber++;
  }
  
  return slots;
}

function timeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function groupBy(array: any[], key: string): any {
  return array.reduce((groups, item) => {
    const groupKey = item[key];
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {});
}