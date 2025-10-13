import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Baby,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Clock,
  Heart,
  Info
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays, differenceInWeeks, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface PregnancyManagementProps {
  patientId: number;
  patientGender: string;
  isEditMode?: boolean;
}

export const PregnancyManagement = ({ 
  patientId, 
  patientGender,
  isEditMode = false 
}: PregnancyManagementProps) => {
  const [activePregnancy, setActivePregnancy] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showNewPregnancyForm, setShowNewPregnancyForm] = useState(false);
  const { toast } = useToast();

  // Formulario de nuevo embarazo
  const [formData, setFormData] = useState({
    start_date: '',
    expected_due_date: '',
    high_risk: false,
    risk_factors: '',
    notes: ''
  });

  // Solo mostrar si es femenino
  if (patientGender !== 'Femenino') {
    return null;
  }

  useEffect(() => {
    if (patientId && isEditMode) {
      loadActivePregnancy();
    }
  }, [patientId, isEditMode]);

  const loadActivePregnancy = async () => {
    setLoading(true);
    try {
      const response = await api.getActivePregnancy(patientId);
      if (response.has_active_pregnancy) {
        setActivePregnancy(response.data);
      }
    } catch (error) {
      console.error('Error loading pregnancy:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDueDate = (startDate: string): string => {
    if (!startDate) return '';
    const dueDate = addDays(new Date(startDate), 280); // 40 semanas = 280 días
    return format(dueDate, 'yyyy-MM-dd');
  };

  const handleStartDateChange = (date: string) => {
    setFormData({
      ...formData,
      start_date: date,
      expected_due_date: calculateDueDate(date)
    });
  };

  const handleCreatePregnancy = async () => {
    if (!formData.start_date) {
      toast({
        title: "Error",
        description: "La fecha de inicio (FUM) es obligatoria",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await api.createPregnancy({
        patient_id: patientId,
        ...formData
      });

      toast({
        title: "Embarazo registrado",
        description: response.message || "El embarazo se ha registrado exitosamente",
      });

      setShowNewPregnancyForm(false);
      setFormData({
        start_date: '',
        expected_due_date: '',
        high_risk: false,
        risk_factors: '',
        notes: ''
      });
      
      await loadActivePregnancy();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "No se pudo registrar el embarazo",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompletePregnancy = async () => {
    if (!activePregnancy) return;

    setLoading(true);
    try {
      await api.updatePregnancy(activePregnancy.id, {
        status: 'Completada',
        delivery_date: format(new Date(), 'yyyy-MM-dd')
      });

      toast({
        title: "Embarazo completado",
        description: "El embarazo se ha marcado como completado",
      });

      await loadActivePregnancy();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el embarazo",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Vista del embarazo activo
  const renderActivePregnancy = () => {
    if (!activePregnancy) return null;

    const currentWeeks = activePregnancy.current_weeks || 0;
    const currentDays = activePregnancy.current_days || 0;
    const daysUntilDue = activePregnancy.days_until_due || 0;
    const isOverdue = activePregnancy.is_overdue || false;

    return (
      <Card className="border-pink-200 bg-pink-50/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Baby className="h-5 w-5 text-pink-600" />
              <CardTitle className="text-lg text-pink-900">Embarazo Activo</CardTitle>
            </div>
            <Badge variant={activePregnancy.high_risk ? "destructive" : "default"}>
              {activePregnancy.high_risk ? "Alto Riesgo" : "Normal"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Información de gestación */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Edad Gestacional</Label>
              <p className="text-lg font-semibold text-pink-900">
                {currentWeeks} semanas {currentDays > 0 && `+ ${currentDays} días`}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">
                {isOverdue ? 'Días de retraso' : 'Días hasta FPP'}
              </Label>
              <p className={`text-lg font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                {Math.abs(daysUntilDue)} días
              </p>
            </div>
          </div>

          {/* Fechas importantes */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm">
                <strong>FUM:</strong> {activePregnancy.start_date ? 
                  format(new Date(activePregnancy.start_date), "dd 'de' MMMM, yyyy", { locale: es }) : 
                  'No especificada'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-500" />
              <span className="text-sm">
                <strong>Fecha Probable de Parto:</strong> {activePregnancy.expected_due_date ? 
                  format(new Date(activePregnancy.expected_due_date), "dd 'de' MMMM, yyyy", { locale: es }) : 
                  'No calculada'}
              </span>
            </div>
          </div>

          {/* Controles prenatales */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">
                <strong>Controles realizados:</strong> {activePregnancy.prenatal_controls_count || 0}
              </span>
            </div>
          </div>

          {/* Factores de riesgo */}
          {activePregnancy.high_risk && activePregnancy.risk_factors && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Factores de riesgo:</strong> {activePregnancy.risk_factors}
              </AlertDescription>
            </Alert>
          )}

          {/* Notas */}
          {activePregnancy.notes && (
            <div className="pt-2 border-t">
              <Label className="text-xs text-gray-600">Notas</Label>
              <p className="text-sm text-gray-700 mt-1">{activePregnancy.notes}</p>
            </div>
          )}

          {/* Botón para completar embarazo */}
          <div className="pt-4 border-t">
            <Button
              onClick={handleCompletePregnancy}
              variant="outline"
              size="sm"
              disabled={loading}
              className="w-full"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Marcar como Completado
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Formulario de nuevo embarazo
  const renderNewPregnancyForm = () => (
    <Card className="border-blue-200">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Registrar Embarazo
        </CardTitle>
        <CardDescription>
          Ingrese la información del embarazo actual
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fecha de Última Menstruación (FUM) */}
        <div className="space-y-2">
          <Label htmlFor="start_date" className="required">
            Fecha de Última Menstruación (FUM)
          </Label>
          <Input
            id="start_date"
            type="date"
            value={formData.start_date}
            onChange={(e) => handleStartDateChange(e.target.value)}
            max={format(new Date(), 'yyyy-MM-dd')}
          />
          <p className="text-xs text-gray-500">
            Fecha de la última menstruación antes del embarazo
          </p>
        </div>

        {/* Fecha Probable de Parto (auto-calculada) */}
        {formData.expected_due_date && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Fecha Probable de Parto (FPP):</strong>{' '}
              {format(new Date(formData.expected_due_date), "dd 'de' MMMM, yyyy", { locale: es })}
              <br />
              <span className="text-xs text-gray-600">
                Calculada automáticamente (FUM + 280 días)
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Embarazo de alto riesgo */}
        <div className="flex items-center space-x-2">
          <Switch
            id="high_risk"
            checked={formData.high_risk}
            onCheckedChange={(checked) => setFormData({ ...formData, high_risk: checked })}
          />
          <Label htmlFor="high_risk" className="cursor-pointer">
            Embarazo de Alto Riesgo
          </Label>
        </div>

        {/* Factores de riesgo */}
        {formData.high_risk && (
          <div className="space-y-2">
            <Label htmlFor="risk_factors">Factores de Riesgo</Label>
            <Textarea
              id="risk_factors"
              placeholder="Describa los factores de riesgo identificados..."
              value={formData.risk_factors}
              onChange={(e) => setFormData({ ...formData, risk_factors: e.target.value })}
              rows={3}
            />
          </div>
        )}

        {/* Notas */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notas Adicionales</Label>
          <Textarea
            id="notes"
            placeholder="Información relevante sobre el embarazo..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
          />
        </div>

        {/* Botones */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleCreatePregnancy}
            disabled={loading || !formData.start_date}
            className="flex-1"
          >
            <Plus className="h-4 w-4 mr-2" />
            Registrar Embarazo
          </Button>
          <Button
            onClick={() => setShowNewPregnancyForm(false)}
            variant="outline"
            disabled={loading}
          >
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Vista principal
  if (loading && !activePregnancy) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
            <p className="text-gray-500">Cargando información de embarazo...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {activePregnancy ? (
        renderActivePregnancy()
      ) : showNewPregnancyForm ? (
        renderNewPregnancyForm()
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Baby className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">No hay embarazo activo registrado</p>
            <Button onClick={() => setShowNewPregnancyForm(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Registrar Embarazo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
