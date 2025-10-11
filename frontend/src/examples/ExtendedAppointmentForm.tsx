// Ejemplo de uso de los nuevos tipos de appointment en formularios
// Este archivo muestra cómo integrar la nueva estructura

import { useState } from 'react';
import { 
  AppointmentFormData, 
  AppointmentValidationErrors,
  getDefaultAppointmentFormData,
  convertFormDataToAppointmentCreate,
  APPOINTMENT_TYPE_OPTIONS,
  PRIORITY_LEVEL_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  APPOINTMENT_SOURCE_OPTIONS,
  DURATION_OPTIONS
} from '@/types/appointment';

// Ejemplo de componente de formulario extendido
export const ExtendedAppointmentForm = () => {
  const [formData, setFormData] = useState<AppointmentFormData>(
    getDefaultAppointmentFormData()
  );
  const [errors, setErrors] = useState<AppointmentValidationErrors>({});
  const [loading, setLoading] = useState(false);

  // Función para manejar cambios en el formulario
  const handleFormChange = (field: keyof AppointmentFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Limpiar error del campo modificado
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  // Validación del formulario
  const validateForm = (): AppointmentValidationErrors => {
    const newErrors: AppointmentValidationErrors = {};

    if (!formData.patientId) {
      newErrors.patientId = 'Debe seleccionar un paciente';
    }

    if (!formData.date) {
      newErrors.date = 'La fecha es requerida';
    }

    if (!formData.time) {
      newErrors.time = 'La hora es requerida';
    }

    if (!formData.reason && !formData.consultationReasonDetailed) {
      newErrors.reason = 'Debe especificar el motivo de la consulta';
    }

    if (!formData.doctorId) {
      newErrors.doctorId = 'Debe seleccionar un doctor';
    }

    if (!formData.specialtyId) {
      newErrors.specialtyId = 'Debe seleccionar una especialidad';
    }

    if (!formData.locationId) {
      newErrors.locationId = 'Debe seleccionar una ubicación';
    }

    if (formData.copayAmount && isNaN(parseFloat(formData.copayAmount))) {
      newErrors.copayAmount = 'El copago debe ser un número válido';
    }

    if (formData.followUpRequired && !formData.followUpDate) {
      newErrors.followUpDate = 'Debe especificar la fecha de seguimiento';
    }

    return newErrors;
  };

  // Envío del formulario
  const handleSubmit = async () => {
    const validationErrors = validateForm();
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const appointmentData = convertFormDataToAppointmentCreate(formData);
      
      // Aquí iría la llamada a la API
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(appointmentData),
      });

      if (response.ok) {
        // Éxito - limpiar formulario o cerrar modal
        setFormData(getDefaultAppointmentFormData());
        console.log('Cita creada exitosamente');
      } else {
        throw new Error('Error al crear la cita');
      }
    } catch (error) {
      setErrors({ general: 'Error al guardar la cita' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Información del Paciente */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Información del Paciente</h3>
        
        {/* Selector de paciente */}
        <div>
          <label>Paciente *</label>
          {/* Aquí iría el componente de selección de paciente */}
          {errors.patientId && <span className="text-red-500">{errors.patientId}</span>}
        </div>
      </div>

      {/* Información de la Cita */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Detalles de la Cita</h3>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Fecha */}
          <div>
            <label>Fecha *</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleFormChange('date', e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
            {errors.date && <span className="text-red-500">{errors.date}</span>}
          </div>

          {/* Hora */}
          <div>
            <label>Hora *</label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => handleFormChange('time', e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
            {errors.time && <span className="text-red-500">{errors.time}</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Duración */}
          <div>
            <label>Duración</label>
            <select
              value={formData.duration}
              onChange={(e) => handleFormChange('duration', e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              {DURATION_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de cita */}
          <div>
            <label>Tipo de Cita</label>
            <select
              value={formData.appointmentType}
              onChange={(e) => handleFormChange('appointmentType', e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              {APPOINTMENT_TYPE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Prioridad */}
        <div>
          <label>Nivel de Prioridad</label>
          <select
            value={formData.priorityLevel}
            onChange={(e) => handleFormChange('priorityLevel', e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            {PRIORITY_LEVEL_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Motivo de la Consulta */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Motivo de la Consulta</h3>
        
        <div>
          <label>Motivo Principal *</label>
          <input
            type="text"
            value={formData.reason}
            onChange={(e) => handleFormChange('reason', e.target.value)}
            placeholder="Ej: Consulta general, control, síntomas..."
            className="w-full border rounded px-3 py-2"
          />
          {errors.reason && <span className="text-red-500">{errors.reason}</span>}
        </div>

        <div>
          <label>Descripción Detallada</label>
          <textarea
            value={formData.consultationReasonDetailed}
            onChange={(e) => handleFormChange('consultationReasonDetailed', e.target.value)}
            placeholder="Descripción más detallada del motivo de la consulta..."
            rows={3}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label>Síntomas</label>
          <textarea
            value={formData.symptoms}
            onChange={(e) => handleFormChange('symptoms', e.target.value)}
            placeholder="Síntomas que presenta el paciente..."
            rows={2}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      {/* Información Médica */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Información Médica</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label>Alergias</label>
            <textarea
              value={formData.allergies}
              onChange={(e) => handleFormChange('allergies', e.target.value)}
              placeholder="Alergias conocidas del paciente..."
              rows={2}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label>Medicamentos Actuales</label>
            <textarea
              value={formData.medications}
              onChange={(e) => handleFormChange('medications', e.target.value)}
              placeholder="Medicamentos que está tomando..."
              rows={2}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Seguimiento */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Seguimiento</h3>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.followUpRequired}
            onChange={(e) => handleFormChange('followUpRequired', e.target.checked)}
            id="followUpRequired"
          />
          <label htmlFor="followUpRequired">Requiere seguimiento</label>
        </div>

        {formData.followUpRequired && (
          <div>
            <label>Fecha de Seguimiento</label>
            <input
              type="date"
              value={formData.followUpDate}
              onChange={(e) => handleFormChange('followUpDate', e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
            {errors.followUpDate && <span className="text-red-500">{errors.followUpDate}</span>}
          </div>
        )}
      </div>

      {/* Seguro y Pago */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Seguro y Pago</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label>Tipo de Seguro</label>
            <input
              type="text"
              value={formData.insuranceType}
              onChange={(e) => handleFormChange('insuranceType', e.target.value)}
              placeholder="EPS, Particular, etc."
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label>Compañía de Seguros</label>
            <input
              type="text"
              value={formData.insuranceCompany}
              onChange={(e) => handleFormChange('insuranceCompany', e.target.value)}
              placeholder="Nombre de la compañía..."
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label>Método de Pago</label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => handleFormChange('paymentMethod', e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Seleccionar método</option>
              {PAYMENT_METHOD_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Copago</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.copayAmount}
              onChange={(e) => handleFormChange('copayAmount', e.target.value)}
              placeholder="0.00"
              className="w-full border rounded px-3 py-2"
            />
            {errors.copayAmount && <span className="text-red-500">{errors.copayAmount}</span>}
          </div>
        </div>
      </div>

      {/* Contacto de Emergencia */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Contacto de Emergencia</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label>Nombre del Contacto</label>
            <input
              type="text"
              value={formData.emergencyContactName}
              onChange={(e) => handleFormChange('emergencyContactName', e.target.value)}
              placeholder="Nombre completo..."
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label>Teléfono de Emergencia</label>
            <input
              type="tel"
              value={formData.emergencyContactPhone}
              onChange={(e) => handleFormChange('emergencyContactPhone', e.target.value)}
              placeholder="Número de teléfono..."
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Notas Adicionales */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Notas Adicionales</h3>
        
        <div>
          <label>Notas Generales</label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleFormChange('notes', e.target.value)}
            placeholder="Notas adicionales sobre la cita..."
            rows={3}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label>Notas Adicionales Específicas</label>
          <textarea
            value={formData.additionalNotes}
            onChange={(e) => handleFormChange('additionalNotes', e.target.value)}
            placeholder="Información adicional relevante..."
            rows={2}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      {/* Error general */}
      {errors.general && (
        <div className="text-red-500 bg-red-50 p-3 rounded">
          {errors.general}
        </div>
      )}

      {/* Botones */}
      <div className="flex space-x-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar Cita'}
        </button>
        
        <button
          type="button"
          onClick={() => setFormData(getDefaultAppointmentFormData())}
          className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
};