import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InsuranceForm {
  patient_id?: string;
  insurance_eps_id: string;
  insurance_affiliation_type: string;
  insurance_notes: string;
}

interface LookupData {
  eps: Array<{
    id: number;
    name: string;
    code?: string;
    affiliation_type?: string;
    has_agreement?: boolean;
    status?: string;
  }>;
  insurance_affiliation_types: Array<{id: string, name: string}>;
}

interface PatientInsuranceInfoProps {
  lookupData: LookupData | null;
  patientId?: string;
  onInsuranceUpdated?: (insurance: any) => void;
}

const PatientInsuranceInfo = ({ lookupData, patientId, onInsuranceUpdated }: PatientInsuranceInfoProps) => {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [form, setForm] = useState<InsuranceForm>({
    patient_id: patientId || "",
    insurance_eps_id: "",
    insurance_affiliation_type: "",
    insurance_notes: ""
  });

  const validateForm = (): boolean => {
    if (!form.insurance_eps_id) {
      toast({
        title: "Error de validación",
        description: "Debe seleccionar una EPS",
        variant: "destructive"
      });
      return false;
    }
    
    if (!form.insurance_affiliation_type) {
      toast({
        title: "Error de validación",
        description: "Debe seleccionar el tipo de afiliación",
        variant: "destructive"
      });
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/patients-insurance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...form,
          insurance_eps_id: parseInt(form.insurance_eps_id)
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Éxito",
          description: "Información de seguro guardada correctamente",
        });
        
        resetForm();
        setIsModalOpen(false);
        
        if (onInsuranceUpdated) {
          onInsuranceUpdated(result.data);
        }
        
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Error al guardar la información de seguro",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Error de conexión al guardar la información",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      patient_id: patientId || "",
      insurance_eps_id: "",
      insurance_affiliation_type: "",
      insurance_notes: ""
    });
  };

  const getAffiliationTypeColor = (type: string) => {
    switch (type) {
      case 'Contributivo':
        return 'text-green-600';
      case 'Subsidiado':
        return 'text-blue-600';
      case 'Especial':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  const getAffiliationTypeDescription = (type: string) => {
    switch (type) {
      case 'Contributivo':
        return 'Para personas con capacidad de pago (empleados, pensionados, independientes)';
      case 'Subsidiado':
        return 'Para personas sin capacidad de pago (población más vulnerable)';
      case 'Especial':
        return 'Para servidores públicos, fuerzas militares y grupos especiales';
      default:
        return '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-500" />
          Información de Seguro
        </CardTitle>
        <CardDescription>
          Registre la información del seguro de salud del paciente (EPS, tipo de afiliación)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" variant="outline">
              <Shield className="h-4 w-4 mr-2" />
              Agregar Información de Seguro
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Información de Seguro de Salud</DialogTitle>
              <DialogDescription>
                Complete la información del seguro médico del paciente
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Información de EPS */}
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Entidad Promotora de Salud
                </h4>
                
                <div>
                  <Label htmlFor="eps">EPS *</Label>
                  <Select 
                    value={form.insurance_eps_id} 
                    onValueChange={(value) => setForm(prev => ({ ...prev, insurance_eps_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione la EPS" />
                    </SelectTrigger>
                    <SelectContent>
                      {(lookupData?.eps || []).map(eps => (
                        <SelectItem key={eps.id} value={eps.id.toString()}>
                          <div className="flex items-center justify-between w-full">
                            <span>{eps.name}</span>
                            <div className="flex items-center gap-1 ml-2">
                              {eps.has_agreement && (
                                <span className="text-green-600 text-xs">✓</span>
                              )}
                              {eps.affiliation_type && (
                                <span className="text-xs text-muted-foreground">
                                  ({eps.affiliation_type})
                                </span>
                              )}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Seleccione la Entidad Promotora de Salud del paciente. 
                    Las EPS con ✓ tienen convenio activo con la IPS.
                  </p>
                </div>
              </div>
              
              {/* Tipo de Afiliación */}
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                  Tipo de Afiliación
                </h4>
                
                <div>
                  <Label htmlFor="affiliation-type">Régimen de Afiliación *</Label>
                  <Select 
                    value={form.insurance_affiliation_type} 
                    onValueChange={(value) => setForm(prev => ({ ...prev, insurance_affiliation_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione el tipo de afiliación" />
                    </SelectTrigger>
                    <SelectContent>
                      {(lookupData?.insurance_affiliation_types || []).map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          <div className="flex flex-col">
                            <span className={getAffiliationTypeColor(type.id)}>
                              {type.name}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {form.insurance_affiliation_type && (
                    <div className="mt-2 p-3 bg-muted rounded-md">
                      <p className={`text-sm font-medium ${getAffiliationTypeColor(form.insurance_affiliation_type)}`}>
                        {form.insurance_affiliation_type}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getAffiliationTypeDescription(form.insurance_affiliation_type)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Información Importante */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="text-sm font-medium text-blue-800 mb-2">Información Importante</h5>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Esta información es necesaria para la facturación y autorización de servicios</li>
                  <li>• Verifique que la EPS y el tipo de afiliación sean correctos</li>
                  <li>• El tipo de afiliación determina los procedimientos de autorización</li>
                </ul>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Guardando..." : "Guardar Información de Seguro"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Limpiar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default PatientInsuranceInfo;
