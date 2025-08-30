import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Shuffle, Settings, Trash2, Eye } from "lucide-react";
import { useAppointmentData } from "@/hooks/useAppointmentData";
import { AnimatedButton } from "@/components/ui/animated-button";
import { EnhancedAnimatedPresenceWrapper } from "@/components/ui/enhanced-animated-container";
import BatchAvailabilityModal from "./BatchAvailabilityModal";
import HolidayManagement from "./HolidayManagement";
import AppointmentDistributionModal from "./AppointmentDistributionModal";
import { toast } from "sonner";

interface BatchAvailability {
  id: number;
  batch_id: string;
  date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_slots: number;
  status: string;
  doctor_name: string;
  specialty_name: string;
  location_name: string;
}

interface BatchGroup {
  batch_id: string;
  availabilities: BatchAvailability[];
  total_capacity: number;
  total_booked: number;
  date_range: {
    start: string;
    end: string;
  };
}

const AdvancedAvailabilityManager = () => {
  const { locations, specialties, doctors } = useAppointmentData();
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [batchGroups, setBatchGroups] = useState<BatchGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch batch groups on component mount
  useEffect(() => {
    fetchBatchGroups();
  }, []);

  const fetchBatchGroups = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/availabilities?batch_only=true', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error fetching batch availabilities');
      }

      const availabilities: BatchAvailability[] = await response.json();

      // Group by batch_id
      const groups: { [key: string]: BatchAvailability[] } = {};
      availabilities.forEach(avail => {
        if (avail.batch_id) {
          if (!groups[avail.batch_id]) {
            groups[avail.batch_id] = [];
          }
          groups[avail.batch_id].push(avail);
        }
      });

      // Convert to BatchGroup array
      const batchGroupsArray: BatchGroup[] = Object.entries(groups).map(([batchId, avails]) => {
        const sortedAvails = avails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const totalCapacity = avails.reduce((sum, avail) => sum + avail.capacity, 0);
        const totalBooked = avails.reduce((sum, avail) => sum + avail.booked_slots, 0);

        return {
          batch_id: batchId,
          availabilities: sortedAvails,
          total_capacity: totalCapacity,
          total_booked: totalBooked,
          date_range: {
            start: sortedAvails[0]?.date || '',
            end: sortedAvails[sortedAvails.length - 1]?.date || ''
          }
        };
      });

      setBatchGroups(batchGroupsArray);
    } catch (error: any) {
      console.error('Fetch batch groups error:', error);
      toast.error('Error al cargar los lotes de agendas');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchCreated = (batchId: string, count: number) => {
    toast.success(`Lote creado exitosamente con ${count} agendas`);
    fetchBatchGroups();
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este lote de agendas? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/availabilities/batch/${batchId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error deleting batch');
      }

      const result = await response.json();
      toast.success(`Lote eliminado exitosamente (${result.deleted_count} agendas)`);
      fetchBatchGroups();
    } catch (error: any) {
      console.error('Delete batch error:', error);
      toast.error('Error al eliminar el lote');
    }
  };

  const handleDistributeAppointments = (batchId: string) => {
    setSelectedBatchId(batchId);
    setShowDistributionModal(true);
  };

  const formatDateRange = (start: string, end: string) => {
    if (!start || !end) return 'N/A';

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (startDate.toDateString() === endDate.toDateString()) {
      return startDate.toLocaleDateString('es-CO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    return `${startDate.toLocaleDateString('es-CO')} - ${endDate.toLocaleDateString('es-CO')}`;
  };

  const getBatchStatus = (batch: BatchGroup) => {
    const totalAvailable = batch.total_capacity - batch.total_booked;
    const utilizationRate = batch.total_capacity > 0 ? (batch.total_booked / batch.total_capacity) * 100 : 0;

    if (utilizationRate === 0) return { label: 'Sin reservas', color: 'bg-gray-100 text-gray-800' };
    if (utilizationRate < 50) return { label: 'Baja ocupación', color: 'bg-green-100 text-green-800' };
    if (utilizationRate < 80) return { label: 'Media ocupación', color: 'bg-yellow-100 text-yellow-800' };
    if (utilizationRate < 100) return { label: 'Alta ocupación', color: 'bg-orange-100 text-orange-800' };
    return { label: 'Completo', color: 'bg-red-100 text-red-800' };
  };

  return (
    <EnhancedAnimatedPresenceWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gestión Avanzada de Agendas</h2>
            <p className="text-gray-600">Crea agendas por rangos, gestiona feriados y distribuye citas automáticamente</p>
          </div>

          <div className="flex gap-3">
            <AnimatedButton
              variant="outline"
              onClick={() => setShowHolidayModal(true)}
              size="sm"
            >
              <Settings className="w-4 h-4 mr-2" />
              Feriados
            </AnimatedButton>

            <AnimatedButton
              onClick={() => setShowBatchModal(true)}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear por Rango
            </AnimatedButton>
          </div>
        </div>

        {/* Batch Groups List */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Lotes de Agendas</h3>
            <p className="text-sm text-gray-600">Gestiona tus lotes de agendas creados por rangos</p>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Cargando lotes...</p>
              </div>
            ) : batchGroups.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">No hay lotes de agendas</h4>
                <p className="text-gray-600 mb-4">Crea tu primer lote de agendas por rango para comenzar</p>
                <AnimatedButton onClick={() => setShowBatchModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Lote
                </AnimatedButton>
              </div>
            ) : (
              <div className="space-y-4">
                {batchGroups.map((batch) => {
                  const status = getBatchStatus(batch);
                  const utilizationRate = batch.total_capacity > 0 ? (batch.total_booked / batch.total_capacity) * 100 : 0;

                  return (
                    <div key={batch.batch_id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-medium text-gray-900">
                              Lote {batch.batch_id.split('_')[1]}
                            </h4>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>
                              {status.label}
                            </span>
                          </div>

                          <div className="text-sm text-gray-600 mb-2">
                            {formatDateRange(batch.date_range.start, batch.date_range.end)}
                          </div>

                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-gray-600">
                              <strong>{batch.availabilities.length}</strong> fechas
                            </span>
                            <span className="text-gray-600">
                              <strong>{batch.total_capacity}</strong> cupos totales
                            </span>
                            <span className="text-gray-600">
                              <strong>{batch.total_booked}</strong> reservados
                            </span>
                            <span className="text-gray-600">
                              <strong>{batch.total_capacity - batch.total_booked}</strong> disponibles
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <AnimatedButton
                            variant="outline"
                            size="sm"
                            onClick={() => handleDistributeAppointments(batch.batch_id)}
                          >
                            <Shuffle className="w-4 h-4 mr-2" />
                            Distribuir
                          </AnimatedButton>

                          <AnimatedButton
                            variant="outline"
                            size="sm"
                            onClick={() => {/* TODO: View batch details */}}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Ver
                          </AnimatedButton>

                          <AnimatedButton
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteBatch(batch.batch_id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Eliminar
                          </AnimatedButton>
                        </div>
                      </div>

                      {/* Utilization Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-medical-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${utilizationRate}%` }}
                        ></div>
                      </div>

                      <div className="flex justify-between text-xs text-gray-600 mt-1">
                        <span>{utilizationRate.toFixed(1)}% ocupado</span>
                        <span>{batch.total_capacity - batch.total_booked} cupos restantes</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        <BatchAvailabilityModal
          isOpen={showBatchModal}
          onClose={() => setShowBatchModal(false)}
          onBatchCreated={handleBatchCreated}
        />

        <HolidayManagement
          isOpen={showHolidayModal}
          onClose={() => setShowHolidayModal(false)}
        />

        <AppointmentDistributionModal
          isOpen={showDistributionModal}
          onClose={() => {
            setShowDistributionModal(false);
            setSelectedBatchId('');
          }}
          batchId={selectedBatchId}
        />
      </div>
    </EnhancedAnimatedPresenceWrapper>
  );
};

export default AdvancedAvailabilityManager;
