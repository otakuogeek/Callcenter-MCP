import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Users, GraduationCap, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DemographicForm {
  patient_id?: string;
  population_group_id: string;
  education_level_id: string;
  marital_status_id: string;
  occupation: string;
  demographic_notes: string;
}

interface LookupData {
  population_groups: Array<{id: number, name: string}>;
  education_levels: Array<{id: number, name: string}>;
  marital_statuses: Array<{id: number, name: string}>;
}

interface PatientDemographicInfoProps {
  lookupData: LookupData | null;
  patientId?: string;
  onDemographicUpdated?: (demographic: any) => void;
}

const PatientDemographicInfo = ({ lookupData, patientId, onDemographicUpdated }: PatientDemographicInfoProps) => {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [form, setForm] = useState<DemographicForm>({
    patient_id: patientId || "",
    population_group_id: "",
    education_level_id: "",
    marital_status_id: "",
    occupation: "",
    demographic_notes: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/patients-demographic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...form,
          population_group_id: form.population_group_id ? parseInt(form.population_group_id) : null,
          education_level_id: form.education_level_id ? parseInt(form.education_level_id) : null,
          marital_status_id: form.marital_status_id ? parseInt(form.marital_status_id) : null
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Éxito",
          description: "Información demográfica guardada correctamente",
        });
        
        resetForm();
        setIsModalOpen(false);
        
        if (onDemographicUpdated) {
          onDemographicUpdated(result.data);
        }
        
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Error al guardar la información demográfica",
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
      population_group_id: "",
      education_level_id: "",
      marital_status_id: "",
      occupation: "",
      demographic_notes: ""
    });
  };

  const getPopulationGroupDescription = (groupName: string) => {
    const descriptions: Record<string, string> = {
      'Indígena': 'Población perteneciente a pueblos indígenas reconocidos',
      'Afrocolombiano': 'Población afrodescendiente, palenquera o raizal',
      'ROM (Gitano)': 'Población perteneciente al pueblo ROM',
      'Mestizo': 'Población mestiza mayoritaria',
      'Blanco': 'Población blanca',
      'Otro': 'Otro grupo poblacional'
    };
    return descriptions[groupName] || '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-purple-500" />
          Información Demográfica
        </CardTitle>
        <CardDescription>
          Registre información social y demográfica del paciente
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" variant="outline">
              <Users className="h-4 w-4 mr-2" />
              Agregar Información Demográfica
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Información Demográfica y Social</DialogTitle>
              <DialogDescription>
                Complete la información social y demográfica del paciente
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Grupo Poblacional */}
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Identificación Étnica
                </h4>
                
                <div>
                  <Label htmlFor="population-group">Grupo Poblacional</Label>
                  <Select 
                    value={form.population_group_id} 
                    onValueChange={(value) => setForm(prev => ({ ...prev, population_group_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione grupo poblacional" />
                    </SelectTrigger>
                    <SelectContent>
                      {(lookupData?.population_groups || []).map(group => (
                        <SelectItem key={group.id} value={group.id.toString()}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Información importante para políticas de salud diferencial
                  </p>
                </div>
              </div>
              
              {/* Información Educativa */}
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Nivel Educativo
                </h4>
                
                <div>
                  <Label htmlFor="education-level">Nivel de Educación</Label>
                  <Select 
                    value={form.education_level_id} 
                    onValueChange={(value) => setForm(prev => ({ ...prev, education_level_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione nivel educativo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(lookupData?.education_levels || []).map(level => (
                        <SelectItem key={level.id} value={level.id.toString()}>
                          {level.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ayuda a adaptar la comunicación y educación en salud
                  </p>
                </div>
              </div>
              
              {/* Estado Civil y Ocupación */}
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Información Personal
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="marital-status">Estado Civil</Label>
                    <Select 
                      value={form.marital_status_id} 
                      onValueChange={(value) => setForm(prev => ({ ...prev, marital_status_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione estado civil" />
                      </SelectTrigger>
                      <SelectContent>
                        {(lookupData?.marital_statuses || []).map(status => (
                          <SelectItem key={status.id} value={status.id.toString()}>
                            {status.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="occupation">Ocupación</Label>
                    <Select 
                      value={form.occupation} 
                      onValueChange={(value) => setForm(prev => ({ ...prev, occupation: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione ocupación" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Empleado">Empleado</SelectItem>
                        <SelectItem value="Independiente">Trabajador Independiente</SelectItem>
                        <SelectItem value="Estudiante">Estudiante</SelectItem>
                        <SelectItem value="Pensionado">Pensionado</SelectItem>
                        <SelectItem value="Ama de casa">Ama de Casa</SelectItem>
                        <SelectItem value="Desempleado">Desempleado</SelectItem>
                        <SelectItem value="Menor de edad">Menor de Edad</SelectItem>
                        <SelectItem value="Otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Información relevante para factores de riesgo ocupacional
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Notas Adicionales */}
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                  Información Adicional
                </h4>
                
                <div>
                  <Label htmlFor="demographic-notes">Notas Demográficas</Label>
                  <Textarea
                    id="demographic-notes"
                    value={form.demographic_notes}
                    onChange={(e) => setForm(prev => ({ ...prev, demographic_notes: e.target.value }))}
                    placeholder="Información adicional relevante sobre el contexto social del paciente..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Contexto social, cultural o familiar relevante para la atención
                  </p>
                </div>
              </div>
              
              {/* Información sobre datos demográficos */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h5 className="text-sm font-medium text-amber-800 mb-2">Uso de Datos Demográficos</h5>
                <ul className="text-xs text-amber-700 space-y-1">
                  <li>• Esta información se usa para análisis epidemiológicos</li>
                  <li>• Ayuda a identificar necesidades específicas de atención</li>
                  <li>• Permite aplicar enfoques de salud diferencial</li>
                  <li>• Es confidencial y se maneja según normativas de protección de datos</li>
                </ul>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Guardando..." : "Guardar Información Demográfica"}
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

export default PatientDemographicInfo;
