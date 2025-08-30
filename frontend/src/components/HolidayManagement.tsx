import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Plus, Edit, Trash2, MapPin } from "lucide-react";
import { useAppointmentData } from "@/hooks/useAppointmentData";
import { AnimatedForm, AnimatedInputField, AnimatedSelectField, AnimatedTextareaField } from "@/components/ui/animated-form";
import { AnimatedButton } from "@/components/ui/animated-button";
import { EnhancedAnimatedPresenceWrapper } from "@/components/ui/enhanced-animated-container";
import { toast } from "sonner";

interface Holiday {
  id: number;
  date: string;
  name: string;
  type: 'national' | 'regional' | 'local' | 'personal';
  location_id?: number;
  is_recurring: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface HolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  holiday?: Holiday | null;
  onHolidaySaved?: () => void;
}

interface HolidayFormData {
  date: string;
  name: string;
  type: 'national' | 'regional' | 'local' | 'personal';
  location_id?: number;
  is_recurring: boolean;
  description: string;
}

const HolidayModal = ({ isOpen, onClose, holiday, onHolidaySaved }: HolidayModalProps) => {
  const { locations } = useAppointmentData();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<HolidayFormData>({
    date: '',
    name: '',
    type: 'national',
    location_id: undefined,
    is_recurring: false,
    description: ''
  });

  // Initialize form data when holiday prop changes
  useEffect(() => {
    if (holiday) {
      setFormData({
        date: holiday.date,
        name: holiday.name,
        type: holiday.type,
        location_id: holiday.location_id,
        is_recurring: holiday.is_recurring,
        description: holiday.description || ''
      });
    } else {
      setFormData({
        date: '',
        name: '',
        type: 'national',
        location_id: undefined,
        is_recurring: false,
        description: ''
      });
    }
  }, [holiday]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.date || !formData.name) {
      toast.error('Fecha y nombre son obligatorios');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = holiday ? `/api/availabilities/holidays/${holiday.id}` : '/api/availabilities/holidays';
      const method = holiday ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error saving holiday');
      }

      const result = await response.json();
      toast.success(holiday ? 'Feriado actualizado exitosamente' : 'Feriado creado exitosamente');

      if (onHolidaySaved) {
        onHolidaySaved();
      }

      onClose();
    } catch (error: any) {
      console.error('Holiday save error:', error);
      toast.error(error.message || 'Error al guardar el feriado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <EnhancedAnimatedPresenceWrapper>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-medical-600" />
              {holiday ? 'Editar Feriado' : 'Crear Feriado'}
            </DialogTitle>
            <DialogDescription>
              {holiday ? 'Modifica la información del feriado' : 'Agrega un nuevo día no laboral al sistema'}
            </DialogDescription>
          </DialogHeader>

          <AnimatedForm
            className="space-y-4"
            onSubmit={handleSubmit}
          >
            <AnimatedInputField
              label="Fecha"
              type="date"
              value={formData.date}
              onChange={(value) => setFormData({ ...formData, date: value })}
              required
            />

            <AnimatedInputField
              label="Nombre del Feriado"
              type="text"
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              placeholder="Ej: Día de la Independencia"
              required
            />

            <AnimatedSelectField
              label="Tipo"
              value={formData.type}
              onChange={(value) => setFormData({ ...formData, type: value as HolidayFormData['type'] })}
              options={[
                { value: 'national', label: 'Nacional' },
                { value: 'regional', label: 'Regional' },
                { value: 'local', label: 'Local' },
                { value: 'personal', label: 'Personal' }
              ]}
              required
            />

            <AnimatedSelectField
              label="Ubicación (opcional)"
              placeholder="Aplicable a todas las ubicaciones"
              value={formData.location_id?.toString() || ''}
              onChange={(value) => setFormData({
                ...formData,
                location_id: value ? parseInt(value) : undefined
              })}
              options={[
                { value: '', label: 'Todas las ubicaciones' },
                ...locations.map((location) => ({
                  value: location.id.toString(),
                  label: `${location.name} - ${location.type}`
                }))
              ]}
            />

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_recurring"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="is_recurring" className="text-sm">
                Feriado recurrente (se repite cada año)
              </label>
            </div>

            <AnimatedTextareaField
              label="Descripción (opcional)"
              value={formData.description}
              onChange={(value) => setFormData({ ...formData, description: value })}
              placeholder="Descripción adicional del feriado"
              rows={3}
            />

            <div className="flex justify-end gap-3 pt-4">
              <AnimatedButton
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </AnimatedButton>

              <AnimatedButton
                type="submit"
                disabled={loading}
                loading={loading}
              >
                {loading ? (holiday ? 'Actualizando...' : 'Creando...') : (holiday ? 'Actualizar' : 'Crear')}
              </AnimatedButton>
            </div>
          </AnimatedForm>
        </DialogContent>
      </Dialog>
    </EnhancedAnimatedPresenceWrapper>
  );
};

interface HolidayManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

const HolidayManagement = ({ isOpen, onClose }: HolidayManagementProps) => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/availabilities/holidays?year=${year}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error fetching holidays');
      }

      const data = await response.json();
      setHolidays(data);
    } catch (error: any) {
      console.error('Fetch holidays error:', error);
      toast.error('Error al cargar feriados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHolidays();
    }
  }, [isOpen, year]);

  const handleDeleteHoliday = async (holidayId: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este feriado?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/availabilities/holidays/${holidayId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error deleting holiday');
      }

      toast.success('Feriado eliminado exitosamente');
      fetchHolidays();
    } catch (error: any) {
      console.error('Delete holiday error:', error);
      toast.error('Error al eliminar el feriado');
    }
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      national: 'Nacional',
      regional: 'Regional',
      local: 'Local',
      personal: 'Personal'
    };
    return labels[type as keyof typeof labels] || type;
  };

  return (
    <EnhancedAnimatedPresenceWrapper>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-medical-600" />
              Gestión de Feriados
            </DialogTitle>
            <DialogDescription>
              Administra los días no laborales del sistema
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Header with year selector and add button */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Año:</label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const y = new Date().getFullYear() + i - 2;
                    return (
                      <option key={y} value={y.toString()}>
                        {y}
                      </option>
                    );
                  })}
                </select>
              </div>

              <AnimatedButton
                onClick={() => {
                  setSelectedHoliday(null);
                  setShowModal(true);
                }}
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar Feriado
              </AnimatedButton>
            </div>

            {/* Holidays list */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recurrente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        Cargando feriados...
                      </td>
                    </tr>
                  ) : holidays.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No hay feriados registrados para este año
                      </td>
                    </tr>
                  ) : (
                    holidays.map((holiday) => (
                      <tr key={holiday.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(holiday.date).toLocaleDateString('es-CO')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {holiday.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            holiday.type === 'national' ? 'bg-red-100 text-red-800' :
                            holiday.type === 'regional' ? 'bg-blue-100 text-blue-800' :
                            holiday.type === 'local' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {getTypeLabel(holiday.type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {holiday.is_recurring ? 'Sí' : 'No'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedHoliday(holiday);
                                setShowModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-900"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteHoliday(holiday.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Holiday Modal */}
          <HolidayModal
            isOpen={showModal}
            onClose={() => {
              setShowModal(false);
              setSelectedHoliday(null);
            }}
            holiday={selectedHoliday}
            onHolidaySaved={fetchHolidays}
          />
        </DialogContent>
      </Dialog>
    </EnhancedAnimatedPresenceWrapper>
  );
};

export default HolidayManagement;
