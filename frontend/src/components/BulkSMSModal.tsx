import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Loader2, Users, MessageSquare, CheckCircle, XCircle, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BulkSMSModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface EligibleCount {
  total_eligible: number;
  by_specialty: Array<{
    id: number;
    name: string;
    patient_count: number;
  }>;
}

interface EPSInfo {
  id: number;
  name: string;
  patient_count: number;
}

interface BulkSMSResult {
  total_eligible: number;
  sent: number;
  failed: number;
  results: Array<{
    patient_id: number;
    patient_name: string;
    phone: string;
    specialty: string;
    status: 'success' | 'failed';
    message_id?: string;
    error?: string;
  }>;
}

const BulkSMSModal = ({ isOpen, onClose, onSuccess }: BulkSMSModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingCount, setLoadingCount] = useState(false);
  const [maxCount, setMaxCount] = useState<number>(10);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");
  const [eligibleCount, setEligibleCount] = useState<EligibleCount | null>(null);
  const [sendResult, setSendResult] = useState<BulkSMSResult | null>(null);
  const [fromPosition, setFromPosition] = useState<number>(1);
  const [toPosition, setToPosition] = useState<number>(50);
  const [availableEPS, setAvailableEPS] = useState<EPSInfo[]>([]);
  const [excludedEPS, setExcludedEPS] = useState<Set<number>>(new Set());
  const [loadingEPS, setLoadingEPS] = useState(false);

  const smsMessage = 'Le informamos que hay citas disponibles para [Nombre de Especialidad]. Agende su cita en: https://biosanarcall.site/users';

  // Cargar conteo de pacientes elegibles
  useEffect(() => {
    if (isOpen) {
      loadEligibleCount();
      loadAvailableEPS();
    }
  }, [isOpen, selectedSpecialty]);

  const loadEligibleCount = async () => {
    try {
      setLoadingCount(true);
      const params = selectedSpecialty !== "all" ? `?specialty_id=${selectedSpecialty}` : "";
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://biosanarcall.site/api'}/sms/waiting-list/count${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setEligibleCount(data.data);
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error: any) {
      console.error('Error cargando conteo:', error);
      toast({
        title: "❌ Error",
        description: "No se pudo cargar el conteo de pacientes",
        variant: "destructive",
      });
    } finally {
      setLoadingCount(false);
    }
  };

  const loadAvailableEPS = async () => {
    try {
      setLoadingEPS(true);
      const params = selectedSpecialty !== "all" ? `?specialty_id=${selectedSpecialty}` : "";
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://biosanarcall.site/api'}/sms/waiting-list/eps-list${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAvailableEPS(data.data);
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error: any) {
      console.error('Error cargando EPS:', error);
      toast({
        title: "❌ Error",
        description: "No se pudo cargar la lista de EPS",
        variant: "destructive",
      });
    } finally {
      setLoadingEPS(false);
    }
  };

  const toggleEPSExclusion = (epsId: number) => {
    setExcludedEPS(prev => {
      const newSet = new Set(prev);
      if (newSet.has(epsId)) {
        newSet.delete(epsId);
      } else {
        newSet.add(epsId);
      }
      return newSet;
    });
  };

  const handleSendBulkSMS = async () => {
    // Validaciones
    if (fromPosition < 1) {
      toast({
        title: "⚠️ Validación",
        description: "La posición inicial debe ser al menos 1",
        variant: "destructive",
      });
      return;
    }

    if (toPosition < fromPosition) {
      toast({
        title: "⚠️ Validación",
        description: "La posición final debe ser mayor o igual a la posición inicial",
        variant: "destructive",
      });
      return;
    }

    if (eligibleCount && toPosition > eligibleCount.total_eligible) {
      toast({
        title: "⚠️ Validación",
        description: `Solo hay ${eligibleCount.total_eligible} pacientes en la lista. Ajuste la posición final.`,
        variant: "destructive",
      });
      return;
    }

    const rangeCount = toPosition - fromPosition + 1;

    try {
      setLoading(true);
      setSendResult(null);

      // Variables para acumular resultados de múltiples lotes
      let totalSent = 0;
      let totalFailed = 0;
      let allResults: any[] = [];
      let currentFromPosition = fromPosition;
      let currentToPosition = toPosition;
      let batchNumber = 1;

      // Procesar lotes hasta completar todos los SMS
      while (currentFromPosition <= toPosition) {
        const payload: any = {
          max_count: rangeCount,
          from_position: currentFromPosition,
          to_position: currentToPosition
        };

        if (selectedSpecialty !== "all") {
          payload.specialty_id = Number(selectedSpecialty);
        }

        // Agregar EPS excluidas
        if (excludedEPS.size > 0) {
          payload.excluded_eps_ids = Array.from(excludedEPS);
        }

        console.log(`📤 Enviando lote ${batchNumber}:`, payload);

        const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://biosanarcall.site/api'}/sms/send-bulk-waiting-list`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Error al enviar SMS');
        }

        // Acumular resultados
        totalSent += data.data.sent || 0;
        totalFailed += data.data.failed || 0;
        allResults = [...allResults, ...(data.data.results || [])];

        // Mostrar progreso
        toast({
          title: `📤 Lote ${batchNumber} completado`,
          description: `${data.data.sent} enviados, ${data.data.failed} fallidos`,
        });

        // Verificar si hay más lotes pendientes
        if (data.data.batch_info?.has_more_batches) {
          currentFromPosition = data.data.batch_info.next_from_position;
          currentToPosition = data.data.batch_info.next_to_position;
          batchNumber++;
          
          // Pausa breve entre lotes para no saturar el servidor
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          // No hay más lotes, salir del bucle
          break;
        }
      }

      // Resultado final consolidado
      const finalResult = {
        total_eligible: allResults.length,
        sent: totalSent,
        failed: totalFailed,
        results: allResults
      };

      setSendResult(finalResult);
      
      toast({
        title: "✅ Envío Completado",
        description: `Total: ${totalSent} SMS enviados exitosamente de ${allResults.length} intentos`,
      });

      if (onSuccess) {
        onSuccess();
      }

    } catch (error: any) {
      console.error('Error enviando SMS masivo:', error);
      toast({
        title: "❌ Error",
        description: error.message || "No se pudieron enviar los SMS",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSendResult(null);
      setMaxCount(10);
      setSelectedSpecialty("all");
      setFromPosition(1);
      setToPosition(50);
      setExcludedEPS(new Set());
      setAvailableEPS([]);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            Enviar SMS Masivo - Lista de Espera
          </DialogTitle>
          <DialogDescription>
            Envíe invitaciones a pacientes en lista de espera para agendar su cita
          </DialogDescription>
        </DialogHeader>

        {!sendResult ? (
          <>
            {/* Información del conteo */}
            {loadingCount ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : eligibleCount && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Pacientes Elegibles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600 mb-4">
                    {eligibleCount.total_eligible}
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {eligibleCount.by_specialty.map((spec) => (
                      <div key={spec.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{spec.name}</span>
                        <Badge variant="outline">{spec.patient_count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Filtro por especialidad */}
            <div className="space-y-2">
              <Label htmlFor="specialty">Filtrar por Especialidad (Opcional)</Label>
              <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                <SelectTrigger id="specialty">
                  <SelectValue placeholder="Todas las especialidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las especialidades</SelectItem>
                  {eligibleCount?.by_specialty.map((spec) => (
                    <SelectItem key={spec.id} value={spec.id.toString()}>
                      {spec.name} ({spec.patient_count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rango de posiciones */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fromPosition">
                  Desde posición
                  {eligibleCount && (
                    <span className="text-xs text-gray-500 block mt-1">
                      (Mínimo: 1)
                    </span>
                  )}
                </Label>
                <Input
                  id="fromPosition"
                  type="number"
                  min={1}
                  max={eligibleCount?.total_eligible || 1000}
                  value={fromPosition}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFromPosition(val);
                    // Ajustar toPosition si es necesario
                    if (val > toPosition) {
                      setToPosition(val);
                    }
                  }}
                  placeholder="Ej: 1"
                  className="text-center"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="toPosition">
                  Hasta posición
                  {eligibleCount && (
                    <span className="text-xs text-gray-500 block mt-1">
                      (Máximo: {eligibleCount.total_eligible})
                    </span>
                  )}
                </Label>
                <Input
                  id="toPosition"
                  type="number"
                  min={fromPosition}
                  max={eligibleCount?.total_eligible || 1000}
                  value={toPosition}
                  onChange={(e) => setToPosition(Number(e.target.value))}
                  placeholder="Ej: 50"
                  className="text-center"
                />
              </div>
            </div>

            {/* Resumen del rango */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">
                  Total de SMS a enviar:
                </span>
                <Badge variant="default" className="text-base">
                  {Math.max(0, toPosition - fromPosition + 1)}
                </Badge>
              </div>
              <p className="text-xs text-blue-700 mt-2">
                Se enviarán SMS desde la posición {fromPosition} hasta la {toPosition} de la lista de espera
                {selectedSpecialty !== "all" && eligibleCount && 
                  ` para ${eligibleCount.by_specialty.find(s => s.id.toString() === selectedSpecialty)?.name || 'la especialidad seleccionada'}`
                }.
              </p>
            </div>

            {/* Filtro de EPS */}
            {loadingEPS ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : availableEPS.length > 0 && (
              <Card className="border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-orange-600" />
                    EPS a Omitir (Opcional)
                  </CardTitle>
                  <p className="text-xs text-gray-500">
                    Marque las EPS que NO desea incluir en el envío de SMS
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                    {availableEPS.map((eps) => (
                      <div 
                        key={eps.id} 
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          excludedEPS.has(eps.id) 
                            ? 'bg-red-50 border-red-300' 
                            : 'bg-white border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <Checkbox
                          id={`eps-${eps.id}`}
                          checked={excludedEPS.has(eps.id)}
                          onCheckedChange={() => toggleEPSExclusion(eps.id)}
                        />
                        <label
                          htmlFor={`eps-${eps.id}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${
                              excludedEPS.has(eps.id) ? 'text-red-700 line-through' : 'text-gray-700'
                            }`}>
                              {eps.name}
                            </span>
                            <Badge 
                              variant={excludedEPS.has(eps.id) ? "destructive" : "outline"}
                              className="ml-2"
                            >
                              {eps.patient_count}
                            </Badge>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                  {excludedEPS.size > 0 && (
                    <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-xs text-orange-800">
                        <strong>{excludedEPS.size}</strong> EPS excluida(s): No se enviarán SMS a pacientes con estas EPS.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Preview del mensaje */}
            <div className="space-y-2">
              <Label>Vista Previa del Mensaje</Label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
                <p className="text-gray-700">
                  {smsMessage.replace('[Nombre de Especialidad]', selectedSpecialty !== "all" 
                    ? eligibleCount?.by_specialty.find(s => s.id.toString() === selectedSpecialty)?.name || '[Nombre de Especialidad]'
                    : '[Nombre de Especialidad]'
                  )}
                </p>
              </div>
              <p className="text-xs text-gray-500">
                El texto "[Nombre de Especialidad]" se reemplazará con la especialidad de cada paciente
              </p>
            </div>
          </>
        ) : (
          /* Resultados del envío */
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Users className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                    <div className="text-2xl font-bold">{sendResult.total_eligible}</div>
                    <div className="text-xs text-gray-500">Total</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
                    <div className="text-2xl font-bold text-green-600">{sendResult.sent}</div>
                    <div className="text-xs text-gray-500">Exitosos</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <XCircle className="h-8 w-8 mx-auto text-red-600 mb-2" />
                    <div className="text-2xl font-bold text-red-600">{sendResult.failed}</div>
                    <div className="text-xs text-gray-500">Fallidos</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de resultados */}
            <div className="max-h-60 overflow-y-auto border rounded-lg">
              {sendResult.results.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 border-b last:border-b-0 ${
                    result.status === 'success' ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{result.patient_name}</p>
                    <p className="text-xs text-gray-500">
                      {result.phone} · {result.specialty}
                    </p>
                  </div>
                  <div>
                    {result.status === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {!sendResult ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleSendBulkSMS} disabled={loading || loadingCount}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar {Math.max(0, toPosition - fromPosition + 1)} SMS
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose} className="w-full">
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkSMSModal;
