import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { User, Calendar, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BasicPatientForm {
  document: string;
  document_type_id: string;
  name: string;
  birth_date: string;
  gender: string;
}

interface LookupData {
  document_types: Array<{id: number, code: string, name: string}>;
  gender_options: Array<{id: string, name: string}>;
}

interface PatientBasicInfoProps {
  lookupData: LookupData | null;
  onPatientCreated?: (patient: any) => void;
}

const PatientBasicInfo = ({ lookupData, onPatientCreated }: PatientBasicInfoProps) => {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetectingGender, setIsDetectingGender] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [form, setForm] = useState<BasicPatientForm>({
    document: "",
    document_type_id: "",
    name: "",
    birth_date: "",
    gender: ""
  });

  // Función para detectar género por nombre usando patrones básicos
  const detectGenderByName = (fullName: string): string => {
    if (!fullName || fullName.trim().length < 2) return "";
    
    const firstName = fullName.trim().split(' ')[0].toLowerCase();
    
    // Patrones de nombres femeninos comunes
    const femalePatterns = [
      /^ana/, /^maria/, /^luz/, /^carmen/, /^rosa/, /^angela/, /^claudia/, /^sandra/, /^patricia/,
      /^adriana/, /^monica/, /^veronica/, /^gloria/, /^esperanza/, /^soledad/, /^pilar/, /^mercedes/,
      /^isabel/, /^cristina/, /^beatriz/, /^silvia/, /^elena/, /^laura/, /^marta/, /^teresa/,
      /.*a$/, // nombres que terminan en 'a'
    ];
    
    // Patrones de nombres masculinos comunes
    const malePatterns = [
      /^carlos/, /^juan/, /^jose/, /^luis/, /^miguel/, /^antonio/, /^francisco/, /^manuel/,
      /^rafael/, /^pedro/, /^sergio/, /^fernando/, /^ricardo/, /^eduardo/, /^alberto/, /^roberto/,
      /^alejandro/, /^daniel/, /^david/, /^jorge/, /^mario/, /^oscar/, /^raul/, /^andres/,
      /^jesus/, /^martin/, /^pablo/, /^victor/, /^angel/, /^javier/, /^gustavo/, /^ivan/
    ];
    
    for (const pattern of femalePatterns) {
      if (pattern.test(firstName)) return "Femenino";
    }
    
    for (const pattern of malePatterns) {
      if (pattern.test(firstName)) return "Masculino";
    }
    
    return "";
  };

  const handleNameChange = async (name: string) => {
    setForm(prev => ({ ...prev, name }));
    
    if (name.trim().length >= 3) {
      setIsDetectingGender(true);
      
      // Simular un pequeño delay para el efecto visual
      setTimeout(() => {
        const detectedGender = detectGenderByName(name);
        if (detectedGender) {
          setForm(prev => ({ ...prev, gender: detectedGender }));
        }
        setIsDetectingGender(false);
      }, 500);
    }
  };

  const validateForm = (): boolean => {
    if (!form.document.trim()) {
      toast({
        title: "Error de validación",
        description: "El número de documento es obligatorio",
        variant: "destructive"
      });
      return false;
    }
    
    if (form.document.trim().length < 5) {
      toast({
        title: "Error de validación",
        description: "El documento debe tener al menos 5 caracteres",
        variant: "destructive"
      });
      return false;
    }
    
    if (!form.name.trim()) {
      toast({
        title: "Error de validación",
        description: "El nombre es obligatorio",
        variant: "destructive"
      });
      return false;
    }
    
    if (form.name.trim().split(' ').length < 2) {
      toast({
        title: "Advertencia",
        description: "Por favor ingrese el nombre completo",
        variant: "destructive"
      });
      return false;
    }
    
    // Validar fecha de nacimiento si está presente
    if (form.birth_date) {
      const birthDate = new Date(form.birth_date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 0 || age > 120) {
        toast({
          title: "Error de validación",
          description: "La fecha de nacimiento no es válida",
          variant: "destructive"
        });
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setSubmitting(true);
    
    try {
      // Usar variable de entorno para la URL base del API
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      
      const response = await fetch(`${apiBase}/patients/basic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          document: form.document.trim(),
          document_type_id: form.document_type_id ? parseInt(form.document_type_id) : null,
          name: form.name.trim(),
          birth_date: form.birth_date || null,
          gender: form.gender || 'No especificado'
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        toast({
          title: "Éxito",
          description: result.message || "Información básica del paciente guardada correctamente",
        });
        
        // Resetear formulario
        setForm({
          document: "",
          document_type_id: "",
          name: "",
          birth_date: "",
          gender: ""
        });
        
        setIsModalOpen(false);
        
        // Notificar al componente padre
        if (onPatientCreated) {
          onPatientCreated(result.data);
        }
        
      } else {
        // Manejar errores específicos
        if (response.status === 409) {
          toast({
            title: "Paciente ya existe",
            description: result.message || "Ya existe un paciente con este documento",
            variant: "destructive"
          });
        } else if (response.status === 401) {
          toast({
            title: "Sesión expirada",
            description: "Por favor inicie sesión nuevamente",
            variant: "destructive"
          });
          // Redirigir al login después de 2 segundos
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        } else {
          toast({
            title: "Error",
            description: result.message || "Error al guardar la información básica",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Error al guardar paciente:', error);
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con el servidor. Por favor verifique su conexión.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      document: "",
      document_type_id: "",
      name: "",
      birth_date: "",
      gender: ""
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Información Básica del Paciente
        </CardTitle>
        <CardDescription>
          Registre la información esencial del paciente (documento, nombre, fecha de nacimiento)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="w-full">
              <User className="h-4 w-4 mr-2" />
              Registrar Información Básica
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Información Básica del Paciente</DialogTitle>
              <DialogDescription>
                Complete los datos esenciales del paciente
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nombre Completo *</Label>
                  <div className="relative">
                    <Input
                      id="name"
                      required
                      value={form.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Escriba el nombre completo"
                    />
                    {isDetectingGender && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    El género se detectará automáticamente
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="document">Número de Documento *</Label>
                  <Input
                    id="document"
                    required
                    value={form.document}
                    onChange={(e) => setForm(prev => ({ ...prev, document: e.target.value }))}
                    placeholder="Número de identificación"
                  />
                </div>
                
                <div>
                  <Label htmlFor="document-type">Tipo de Documento</Label>
                  <Select 
                    value={form.document_type_id} 
                    onValueChange={(value) => setForm(prev => ({ ...prev, document_type_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(lookupData?.document_types || []).map(type => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.code} - {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="birth-date">Fecha de Nacimiento</Label>
                  <Input
                    id="birth-date"
                    type="date"
                    value={form.birth_date}
                    onChange={(e) => setForm(prev => ({ ...prev, birth_date: e.target.value }))}
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="gender">Género</Label>
                  <Select 
                    value={form.gender} 
                    onValueChange={(value) => setForm(prev => ({ ...prev, gender: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione género" />
                    </SelectTrigger>
                    <SelectContent>
                      {(lookupData?.gender_options || []).map(gender => (
                        <SelectItem key={gender.id} value={gender.id}>
                          {gender.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.gender && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Género seleccionado: {form.gender}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Guardando..." : "Guardar Información Básica"}
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

export default PatientBasicInfo;
