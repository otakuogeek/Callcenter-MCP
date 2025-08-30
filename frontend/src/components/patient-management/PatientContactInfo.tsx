import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Phone, Mail, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ContactForm {
  patient_id?: string;
  phone: string;
  phone_alt: string;
  email: string;
  address: string;
  municipality_id: string;
  estrato: string;
}

interface LookupData {
  municipalities: Array<{id: number, name: string}>;
  estratos: Array<{id: number, name: string}>;
}

interface PatientContactInfoProps {
  lookupData: LookupData | null;
  patientId?: string;
  onContactUpdated?: (contact: any) => void;
}

const PatientContactInfo = ({ lookupData, patientId, onContactUpdated }: PatientContactInfoProps) => {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [form, setForm] = useState<ContactForm>({
    patient_id: patientId || "",
    phone: "",
    phone_alt: "",
    email: "",
    address: "",
    municipality_id: "",
    estrato: ""
  });

  const validateForm = (): boolean => {
    if (!form.phone.trim()) {
      toast({
        title: "Error de validación",
        description: "El teléfono principal es obligatorio",
        variant: "destructive"
      });
      return false;
    }
    
    if (form.email && !isValidEmail(form.email)) {
      toast({
        title: "Error de validación",
        description: "El formato del correo electrónico no es válido",
        variant: "destructive"
      });
      return false;
    }
    
    return true;
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const formatPhoneNumber = (phone: string): string => {
    // Remover todo excepto números
    const numbers = phone.replace(/\D/g, '');
    
    // Formatear como número colombiano si tiene 10 dígitos
    if (numbers.length === 10) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
    }
    
    return phone;
  };

  const handlePhoneChange = (value: string, field: 'phone' | 'phone_alt') => {
    const formatted = formatPhoneNumber(value);
    setForm(prev => ({ ...prev, [field]: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/patients-contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...form,
          municipality_id: form.municipality_id ? parseInt(form.municipality_id) : null,
          estrato: form.estrato ? parseInt(form.estrato) : null
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Éxito",
          description: "Información de contacto guardada correctamente",
        });
        
        resetForm();
        setIsModalOpen(false);
        
        if (onContactUpdated) {
          onContactUpdated(result.data);
        }
        
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Error al guardar la información de contacto",
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
      phone: "",
      phone_alt: "",
      email: "",
      address: "",
      municipality_id: "",
      estrato: ""
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Información de Contacto
        </CardTitle>
        <CardDescription>
          Registre los datos de contacto y ubicación del paciente
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" variant="outline">
              <Phone className="h-4 w-4 mr-2" />
              Agregar Información de Contacto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Información de Contacto y Ubicación</DialogTitle>
              <DialogDescription>
                Complete los datos de contacto del paciente
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Información de Contacto */}
                <div className="md:col-span-2">
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Teléfonos y Correo
                  </h4>
                </div>
                
                <div>
                  <Label htmlFor="phone">Teléfono Principal *</Label>
                  <Input
                    id="phone"
                    required
                    value={form.phone}
                    onChange={(e) => handlePhoneChange(e.target.value, 'phone')}
                    placeholder="300-123-4567"
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone-alt">Teléfono Alternativo</Label>
                  <Input
                    id="phone-alt"
                    value={form.phone_alt}
                    onChange={(e) => handlePhoneChange(e.target.value, 'phone_alt')}
                    placeholder="301-123-4567"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="paciente@correo.com"
                      className="pl-10"
                    />
                  </div>
                </div>
                
                {/* Información de Ubicación */}
                <div className="md:col-span-2">
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3 mt-4 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Ubicación y Dirección
                  </h4>
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="address">Dirección Completa</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Calle 123 # 45-67, Barrio Centro"
                  />
                </div>
                
                <div>
                  <Label htmlFor="municipality">Municipio</Label>
                  <Select 
                    value={form.municipality_id} 
                    onValueChange={(value) => setForm(prev => ({ ...prev, municipality_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione municipio" />
                    </SelectTrigger>
                    <SelectContent>
                      {(lookupData?.municipalities || []).map(municipality => (
                        <SelectItem key={municipality.id} value={municipality.id.toString()}>
                          {municipality.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="estrato">Estrato Socioeconómico</Label>
                  <Select 
                    value={form.estrato} 
                    onValueChange={(value) => setForm(prev => ({ ...prev, estrato: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione estrato" />
                    </SelectTrigger>
                    <SelectContent>
                      {(lookupData?.estratos || []).map(estrato => (
                        <SelectItem key={estrato.id} value={estrato.id.toString()}>
                          {estrato.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Guardando..." : "Guardar Información de Contacto"}
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

export default PatientContactInfo;
