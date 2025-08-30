import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Heart, Activity, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MedicalForm {
  patient_id?: string;
  blood_group_id: string;
  has_disability: boolean;
  disability_type_id: string;
  medical_notes: string;
  allergies: string;
  chronic_conditions: string;
}

interface LookupData {
  blood_groups: Array<{id: number, code: string, name: string}>;
  disability_types: Array<{id: number, name: string}>;
}

interface PatientMedicalInfoProps {
  lookupData: LookupData | null;
  patientId?: string;
  onMedicalUpdated?: (medical: any) => void;
}

const PatientMedicalInfo = ({ lookupData, patientId, onMedicalUpdated }: PatientMedicalInfoProps) => {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [form, setForm] = useState<MedicalForm>({
    patient_id: patientId || "",
    blood_group_id: "",
    has_disability: false,
    disability_type_id: "",
    medical_notes: "",
    allergies: "",
    chronic_conditions: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/patients-medical', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...form,
          blood_group_id: form.blood_group_id ? parseInt(form.blood_group_id) : null,
          disability_type_id: form.disability_type_id ? parseInt(form.disability_type_id) : null
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Éxito",
          description: "Información médica guardada correctamente",
        });
        
        resetForm();
        setIsModalOpen(false);
        
        if (onMedicalUpdated) {
          onMedicalUpdated(result.data);
        }
        
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Error al guardar la información médica",
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
      blood_group_id: "",
      has_disability: false,
      disability_type_id: "",
      medical_notes: "",
      allergies: "",
      chronic_conditions: ""
    });
  };

  const getBloodGroupDisplay = (group: any) => {
    return `${group.code} (${group.name})`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500" />
          Información Médica
        </CardTitle>
        <CardDescription>
          Registre información médica importante del paciente
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" variant="outline">
              <Heart className="h-4 w-4 mr-2" />
              Agregar Información Médica
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Información Médica del Paciente</DialogTitle>
              <DialogDescription>
                Complete los datos médicos relevantes
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Grupo Sanguíneo */}
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Información Básica
                </h4>
                
                <div>
                  <Label htmlFor="blood-group">Grupo Sanguíneo</Label>
                  <Select 
                    value={form.blood_group_id} 
                    onValueChange={(value) => setForm(prev => ({ ...prev, blood_group_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione grupo sanguíneo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(lookupData?.blood_groups || []).map(group => (
                        <SelectItem key={group.id} value={group.id.toString()}>
                          {getBloodGroupDisplay(group)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Esta información es crucial en emergencias médicas
                  </p>
                </div>
              </div>
              
              {/* Discapacidades */}
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Condiciones Especiales
                </h4>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="has-disability"
                      checked={form.has_disability}
                      onCheckedChange={(checked) => {
                        setForm(prev => ({ 
                          ...prev, 
                          has_disability: checked as boolean,
                          disability_type_id: checked ? prev.disability_type_id : ""
                        }));
                      }}
                    />
                    <Label htmlFor="has-disability" className="text-sm">
                      El paciente tiene alguna discapacidad
                    </Label>
                  </div>
                  
                  {form.has_disability && (
                    <div>
                      <Label htmlFor="disability-type">Tipo de Discapacidad</Label>
                      <Select 
                        value={form.disability_type_id} 
                        onValueChange={(value) => setForm(prev => ({ ...prev, disability_type_id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione tipo de discapacidad" />
                        </SelectTrigger>
                        <SelectContent>
                          {(lookupData?.disability_types || []).map(type => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Alergias y Condiciones */}
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                  Historial Médico
                </h4>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="allergies">Alergias Conocidas</Label>
                    <Textarea
                      id="allergies"
                      value={form.allergies}
                      onChange={(e) => setForm(prev => ({ ...prev, allergies: e.target.value }))}
                      placeholder="Ej: Alérgico a la penicilina, mariscos, polen..."
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Liste todas las alergias conocidas, especialmente medicamentos
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="chronic-conditions">Condiciones Crónicas</Label>
                    <Textarea
                      id="chronic-conditions"
                      value={form.chronic_conditions}
                      onChange={(e) => setForm(prev => ({ ...prev, chronic_conditions: e.target.value }))}
                      placeholder="Ej: Diabetes tipo 2, hipertensión, asma..."
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enfermedades crónicas o condiciones médicas permanentes
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="medical-notes">Notas Médicas Adicionales</Label>
                    <Textarea
                      id="medical-notes"
                      value={form.medical_notes}
                      onChange={(e) => setForm(prev => ({ ...prev, medical_notes: e.target.value }))}
                      placeholder="Información médica adicional relevante..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Guardando..." : "Guardar Información Médica"}
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

export default PatientMedicalInfo;
