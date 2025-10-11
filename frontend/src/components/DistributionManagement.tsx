import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useDistribution } from '@/hooks/useDistribution';
import { Edit, Save, X, Users, Calendar, Clock, MapPin, Stethoscope } from 'lucide-react';
import { safeFormatDate } from '@/utils/dateHelpers';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DistributionManagementProps {
  distributions: Array<{
    day_date: string;
    quota: number;
    assigned: number;
    remaining?: number;
    doctor_name: string;
    specialty_name: string;
    location_name: string;
    availability_id: number;
    availability_date: string;
    start_time: string;
    end_time: string;
  }>;
  onDistributionUpdate?: () => void;
}

const DistributionManagement: React.FC<DistributionManagementProps> = ({ 
  distributions, 
  onDistributionUpdate 
}) => {
  const { updateAssignedSlots, loading } = useDistribution();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newAssigned, setNewAssigned] = useState<number>(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleEditClick = (distribution: any) => {
    setEditingId(distribution.availability_id);
    setNewAssigned(distribution.assigned);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (editingId === null) return;

    const result = await updateAssignedSlots(editingId, newAssigned);
    if (result) {
      setEditingId(null);
      setIsDialogOpen(false);
      if (onDistributionUpdate) {
        onDistributionUpdate();
      }
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setNewAssigned(0);
    setIsDialogOpen(false);
  };

  const getUtilizationColor = (assigned: number, quota: number) => {
    const rate = (assigned / quota) * 100;
    if (rate >= 90) return 'text-red-600';
    if (rate >= 80) return 'text-yellow-600';
    if (rate >= 60) return 'text-blue-600';
    return 'text-green-600';
  };

  const getUtilizationVariant = (assigned: number, quota: number) => {
    const rate = (assigned / quota) * 100;
    if (rate >= 90) return 'destructive';
    if (rate >= 80) return 'secondary';
    if (rate >= 60) return 'default';
    return 'outline';
  };

  if (!distributions || distributions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No hay distribuciones para gestionar.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Gestión de Cupos</h3>
          <p className="text-sm text-muted-foreground">
            Edita los cupos asignados para cada disponibilidad
          </p>
        </div>
        <Badge variant="outline">
          {distributions.length} distribuciones
        </Badge>
      </div>

      <div className="grid gap-4">
        {distributions.map((distribution) => {
          const utilizationRate = (distribution.assigned / distribution.quota) * 100;
          const remaining = distribution.remaining || (distribution.quota - distribution.assigned);

          return (
            <Card key={distribution.availability_id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {safeFormatDate(distribution.day_date, 'EEEE, dd MMMM yyyy', { locale: es })}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {distribution.start_time} - {distribution.end_time}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {distribution.doctor_name}
                      </span>
                    </CardDescription>
                  </div>
                  <Dialog open={isDialogOpen && editingId === distribution.availability_id} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditClick(distribution)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Editar Cupos Asignados</DialogTitle>
                        <DialogDescription>
                          Modifica la cantidad de cupos asignados para esta disponibilidad.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Información de la disponibilidad</Label>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              {safeFormatDate(distribution.day_date, 'dd/MM/yyyy', { locale: es })}
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="h-3 w-3" />
                              {distribution.doctor_name}
                            </div>
                            <div className="flex items-center gap-2">
                              <Stethoscope className="h-3 w-3" />
                              {distribution.specialty_name}
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3" />
                              {distribution.location_name}
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="assigned">
                            Cupos asignados (máximo: {distribution.quota})
                          </Label>
                          <Input
                            id="assigned"
                            type="number"
                            min="0"
                            max={distribution.quota}
                            value={newAssigned}
                            onChange={(e) => setNewAssigned(parseInt(e.target.value) || 0)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Disponibles: {distribution.quota - newAssigned}
                          </p>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={handleCancel}>
                          <X className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                        <Button 
                          onClick={handleSave} 
                          disabled={loading || newAssigned > distribution.quota || newAssigned < 0}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Guardar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Información de especialidad y ubicación */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Stethoscope className="h-3 w-3" />
                    {distribution.specialty_name}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {distribution.location_name}
                  </Badge>
                </div>

                {/* Estadísticas de cupos */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">{distribution.quota}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${getUtilizationColor(distribution.assigned, distribution.quota)}`}>
                      {distribution.assigned}
                    </div>
                    <div className="text-xs text-muted-foreground">Asignados</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{remaining}</div>
                    <div className="text-xs text-muted-foreground">Disponibles</div>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Utilización</span>
                    <Badge variant={getUtilizationVariant(distribution.assigned, distribution.quota)}>
                      {utilizationRate.toFixed(1)}%
                    </Badge>
                  </div>
                  <Progress 
                    value={utilizationRate} 
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default DistributionManagement;