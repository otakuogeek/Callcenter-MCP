import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shuffle, Calendar, Users, BarChart3 } from "lucide-react";
import { AnimatedForm, AnimatedInputField } from "@/components/ui/animated-form";
import { AnimatedButton } from "@/components/ui/animated-button";
import { EnhancedAnimatedPresenceWrapper } from "@/components/ui/enhanced-animated-container";
import { toast } from "sonner";

interface AppointmentDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId?: string;
}

interface DistributionResult {
  batch_id: string;
  total_appointments: number;
  distribution: Array<{
    availability_id: number;
    date: string;
    appointments: number;
  }>;
  summary: {
    dates_count: number;
    appointments_per_date: number;
    remaining_appointments: number;
  };
}

const AppointmentDistributionModal = ({
  isOpen,
  onClose,
  batchId
}: AppointmentDistributionModalProps) => {
  const [loading, setLoading] = useState(false);
  const [totalAppointments, setTotalAppointments] = useState<number>(0);
  const [distribution, setDistribution] = useState<DistributionResult | null>(null);
  const [batchAvailabilities, setBatchAvailabilities] = useState<any[]>([]);

  // Fetch batch availabilities when modal opens
  useEffect(() => {
    if (isOpen && batchId) {
      fetchBatchAvailabilities();
    }
  }, [isOpen, batchId]);

  const fetchBatchAvailabilities = async () => {
    if (!batchId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/availabilities/batch/${batchId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error fetching batch availabilities');
      }

      const data = await response.json();
      setBatchAvailabilities(data);
    } catch (error: any) {
      console.error('Fetch batch error:', error);
      toast.error('Error al cargar las agendas del lote');
    }
  };

  const handleDistribute = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!batchId || totalAppointments <= 0) {
      toast.error('Debe especificar un número válido de citas');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/availabilities/distribute-appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          batch_id: batchId,
          total_appointments: totalAppointments
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error distributing appointments');
      }

      const result = await response.json();
      setDistribution(result);
      toast.success('Citas distribuidas exitosamente');
    } catch (error: any) {
      console.error('Distribution error:', error);
      toast.error(error.message || 'Error al distribuir las citas');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTotalAppointments(0);
    setDistribution(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <EnhancedAnimatedPresenceWrapper>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shuffle className="w-5 h-5 text-medical-600" />
              Distribución Aleatoria de Citas
            </DialogTitle>
            <DialogDescription>
              Distribuye un número determinado de citas de manera equitativa entre las fechas disponibles
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Batch Info */}
            {batchAvailabilities.length > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Información del Lote</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Fechas disponibles:</span>
                    <span className="ml-2 font-medium">{batchAvailabilities.length}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Capacidad total:</span>
                    <span className="ml-2 font-medium">
                      {batchAvailabilities.reduce((sum, avail) => sum + avail.capacity, 0)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-blue-700">
                  Rango: {batchAvailabilities.length > 0 ?
                    `${new Date(batchAvailabilities[0].date).toLocaleDateString('es-CO')} - ${new Date(batchAvailabilities[batchAvailabilities.length - 1].date).toLocaleDateString('es-CO')}`
                    : 'N/A'
                  }
                </div>
              </div>
            )}

            {/* Distribution Form */}
            {!distribution && (
              <AnimatedForm
                className="space-y-4"
                onSubmit={handleDistribute}
              >
                <AnimatedInputField
                  label="Número Total de Citas"
                  type="number"
                  value={totalAppointments.toString()}
                  onChange={(value) => setTotalAppointments(parseInt(value) || 0)}
                  min="1"
                  placeholder="Ej: 100"
                  required
                />

                <div className="flex justify-end gap-3">
                  <AnimatedButton
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={loading}
                  >
                    Cancelar
                  </AnimatedButton>

                  <AnimatedButton
                    type="submit"
                    disabled={loading || totalAppointments <= 0}
                    loading={loading}
                  >
                    {loading ? 'Distribuyendo...' : 'Distribuir Citas'}
                  </AnimatedButton>
                </div>
              </AnimatedForm>
            )}

            {/* Distribution Results */}
            {distribution && (
              <div className="space-y-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-green-900 mb-2 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Resultado de la Distribución
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-green-700">Total de citas:</span>
                      <span className="ml-2 font-medium">{distribution.total_appointments}</span>
                    </div>
                    <div>
                      <span className="text-green-700">Fechas:</span>
                      <span className="ml-2 font-medium">{distribution.summary.dates_count}</span>
                    </div>
                    <div>
                      <span className="text-green-700">Citas por fecha:</span>
                      <span className="ml-2 font-medium">{distribution.summary.appointments_per_date}</span>
                    </div>
                  </div>
                  {distribution.summary.remaining_appointments > 0 && (
                    <div className="mt-2 text-xs text-green-700">
                      {distribution.summary.remaining_appointments} citas adicionales distribuidas en las primeras fechas
                    </div>
                  )}
                </div>

                {/* Distribution Table */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Citas Asignadas</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacidad</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disponible</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {distribution.distribution.map((item, index) => {
                        const availability = batchAvailabilities.find(a => a.id === item.availability_id);
                        const available = availability ? availability.capacity - availability.booked_slots : 0;

                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(item.date).toLocaleDateString('es-CO', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                              {item.appointments}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {availability?.capacity || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                available >= item.appointments
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {available}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3">
                  <AnimatedButton
                    variant="outline"
                    onClick={resetForm}
                  >
                    Nueva Distribución
                  </AnimatedButton>

                  <AnimatedButton
                    onClick={handleClose}
                  >
                    Cerrar
                  </AnimatedButton>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </EnhancedAnimatedPresenceWrapper>
  );
};

export default AppointmentDistributionModal;
