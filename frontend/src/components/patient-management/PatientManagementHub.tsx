import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Plus, 
  Search, 
  Activity,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Importar todos los componentes especializados
import PatientBasicInfo from "./PatientBasicInfo";
import PatientContactInfo from "./PatientContactInfo";
import PatientMedicalInfo from "./PatientMedicalInfo";
import PatientInsuranceInfo from "./PatientInsuranceInfo";
import PatientDemographicInfo from "./PatientDemographicInfo";
import PatientsList from "./PatientsList";

interface LookupData {
  document_types: Array<{id: number, code: string, name: string}>;
  blood_groups: Array<{id: number, code: string, name: string}>;
  education_levels: Array<{id: number, name: string}>;
  marital_statuses: Array<{id: number, name: string}>;
  population_groups: Array<{id: number, name: string}>;
  disability_types: Array<{id: number, name: string}>;
  municipalities: Array<{id: number, name: string}>;
  eps: Array<{
    id: number;
    name: string;
    code?: string;
    affiliation_type?: string;
    has_agreement?: boolean;
    status?: string;
  }>;
  insurance_affiliation_types: Array<{id: string, name: string}>;
  gender_options: Array<{id: string, name: string}>;
  estratos: Array<{id: number, name: string}>;
}

interface Patient {
  id: string;
  document: string;
  name: string;
  phone: string;
  email?: string;
  birth_date: string;
  gender?: string;
  address?: string;
  municipality_name?: string;
  eps_name?: string;
  insurance_affiliation_type?: string;
  blood_group_name?: string;
  status?: string;
  created_at: string;
}

interface PatientProgress {
  basic: boolean;
  contact: boolean;
  medical: boolean;
  insurance: boolean;
  demographic: boolean;
}

const PatientManagementHub = () => {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [lookupData, setLookupData] = useState<LookupData | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientProgress, setPatientProgress] = useState<PatientProgress>({
    basic: false,
    contact: false,
    medical: false,
    insurance: false,
    demographic: false
  });
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    loadLookupData();
  }, []);

  const loadLookupData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/lookups/all', {
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        const removeDuplicatesByName = (items: any[]) => {
          const seen = new Set();
          return items.filter(item => {
            const key = item.name || item.code;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        };

        const removeDuplicatesByCode = (items: any[]) => {
          const seen = new Set();
          return items.filter(item => {
            const key = item.code;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        };

        const enhancedLookupData = {
          document_types: removeDuplicatesByCode(data.data.document_types || []),
          blood_groups: removeDuplicatesByCode(data.data.blood_groups || []),
          education_levels: removeDuplicatesByName(data.data.education_levels || []),
          marital_statuses: removeDuplicatesByName(data.data.marital_statuses || []),
          population_groups: removeDuplicatesByName(data.data.population_groups || []),
          disability_types: removeDuplicatesByName(data.data.disability_types || []),
          municipalities: removeDuplicatesByName(data.data.municipalities || []),
          eps: removeDuplicatesByName(data.data.eps || []),
          gender_options: [
            { id: 'Masculino', name: 'Masculino' },
            { id: 'Femenino', name: 'Femenino' },
            { id: 'Otro', name: 'Otro' }
          ],
          insurance_affiliation_types: [
            { id: 'Contributivo', name: 'Contributivo' },
            { id: 'Subsidiado', name: 'Subsidiado' },
            { id: 'Especial', name: 'Especial' }
          ],
          estratos: [
            { id: 1, name: 'Estrato 1' },
            { id: 2, name: 'Estrato 2' },
            { id: 3, name: 'Estrato 3' },
            { id: 4, name: 'Estrato 4' },
            { id: 5, name: 'Estrato 5' },
            { id: 6, name: 'Estrato 6' }
          ]
        };
        setLookupData(enhancedLookupData);
      }
    } catch (error) {
      console.error('Error loading lookup data:', error);
      toast({
        title: "Error",
        description: "Error al cargar los datos de configuración",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePatientCreated = (patient: any) => {
    setSelectedPatient(patient);
    setPatientProgress(prev => ({ ...prev, basic: true }));
    toast({
      title: "Paciente creado",
      description: "Puede continuar agregando más información",
    });
  };

  const handleContactUpdated = (contact: any) => {
    setPatientProgress(prev => ({ ...prev, contact: true }));
    toast({
      title: "Contacto actualizado",
      description: "Información de contacto guardada correctamente",
    });
  };

  const handleMedicalUpdated = (medical: any) => {
    setPatientProgress(prev => ({ ...prev, medical: true }));
    toast({
      title: "Información médica actualizada",
      description: "Datos médicos guardados correctamente",
    });
  };

  const handleInsuranceUpdated = (insurance: any) => {
    setPatientProgress(prev => ({ ...prev, insurance: true }));
    toast({
      title: "Seguro actualizado",
      description: "Información de seguro guardada correctamente",
    });
  };

  const handleDemographicUpdated = (demographic: any) => {
    setPatientProgress(prev => ({ ...prev, demographic: true }));
    toast({
      title: "Información demográfica actualizada",
      description: "Datos demográficos guardados correctamente",
    });
  };

  const handlePatientSelected = (patient: Patient) => {
    setSelectedPatient(patient);
    // TODO: Cargar el progreso real del paciente desde el backend
    setPatientProgress({
      basic: true,
      contact: !!patient.phone,
      medical: !!patient.blood_group_name,
      insurance: !!patient.eps_name,
      demographic: true // Asumimos que tiene datos demográficos básicos
    });
  };

  const getCompletionPercentage = () => {
    const completedSections = Object.values(patientProgress).filter(Boolean).length;
    return Math.round((completedSections / 5) * 100);
  };

  const getNextStep = () => {
    if (!patientProgress.basic) return "Información Básica";
    if (!patientProgress.contact) return "Información de Contacto";
    if (!patientProgress.medical) return "Información Médica";
    if (!patientProgress.insurance) return "Información de Seguro";
    if (!patientProgress.demographic) return "Información Demográfica";
    return "Completado";
  };

  const ProgressIndicator = ({ label, completed }: { label: string; completed: boolean }) => (
    <div className="flex items-center gap-2">
      {completed ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : (
        <AlertCircle className="h-4 w-4 text-orange-500" />
      )}
      <span className={`text-sm ${completed ? 'text-green-700' : 'text-orange-700'}`}>
        {label}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header con resumen */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            Centro de Gestión de Pacientes - BiosanarcAll 2025
          </CardTitle>
          <CardDescription>
            Herramientas especializadas para el registro y gestión integral de pacientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedPatient && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-blue-800 mb-2">
                Paciente Activo: {selectedPatient.name}
              </h3>
              <div className="flex items-center gap-4 mb-3">
                <Badge variant="outline">{selectedPatient.document}</Badge>
                <Badge variant="secondary">
                  Completado: {getCompletionPercentage()}%
                </Badge>
                <Badge variant="outline">
                  Siguiente: {getNextStep()}
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                <ProgressIndicator label="Básica" completed={patientProgress.basic} />
                <ProgressIndicator label="Contacto" completed={patientProgress.contact} />
                <ProgressIndicator label="Médica" completed={patientProgress.medical} />
                <ProgressIndicator label="Seguro" completed={patientProgress.insurance} />
                <ProgressIndicator label="Demográfica" completed={patientProgress.demographic} />
              </div>
            </div>
          )}
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Nuevo Enfoque Modular</p>
                <p>Cada herramienta maneja un aspecto específico del paciente. Esto permite:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Registro más rápido y enfocado</li>
                  <li>Menor cantidad de campos por formulario</li>
                  <li>Mejor organización de la información</li>
                  <li>Capacidad de completar información gradualmente</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="register">Registro</TabsTrigger>
          <TabsTrigger value="search">Buscar/Gestionar</TabsTrigger>
        </TabsList>

        {/* Tab de Resumen */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Herramientas Disponibles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-blue-500" />
                    <span>Información Básica</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-green-500" />
                    <span>Contacto y Ubicación</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-red-500" />
                    <span>Información Médica</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-purple-500" />
                    <span>Seguro de Salud</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-orange-500" />
                    <span>Información Demográfica</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-gray-500" />
                    <span>Búsqueda y Gestión</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Flujo Recomendado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span>
                    <span>Información Básica</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400 ml-2" />
                  <div className="flex items-center gap-2">
                    <span className="bg-green-100 text-green-800 rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span>
                    <span>Contacto</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400 ml-2" />
                  <div className="flex items-center gap-2">
                    <span className="bg-red-100 text-red-800 rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span>
                    <span>Información Médica</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400 ml-2" />
                  <div className="flex items-center gap-2">
                    <span className="bg-purple-100 text-purple-800 rounded-full w-5 h-5 flex items-center justify-center text-xs">4</span>
                    <span>Seguro</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400 ml-2" />
                  <div className="flex items-center gap-2">
                    <span className="bg-orange-100 text-orange-800 rounded-full w-5 h-5 flex items-center justify-center text-xs">5</span>
                    <span>Demográfica</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  className="w-full" 
                  onClick={() => setActiveTab("register")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Paciente
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setActiveTab("search")}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Buscar Pacientes
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab de Registro */}
        <TabsContent value="register" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PatientBasicInfo 
              lookupData={lookupData}
              onPatientCreated={handlePatientCreated}
            />
            
            <PatientContactInfo 
              lookupData={lookupData}
              patientId={selectedPatient?.id}
              onContactUpdated={handleContactUpdated}
            />
            
            <PatientMedicalInfo 
              lookupData={lookupData}
              patientId={selectedPatient?.id}
              onMedicalUpdated={handleMedicalUpdated}
            />
            
            <PatientInsuranceInfo 
              lookupData={lookupData}
              patientId={selectedPatient?.id}
              onInsuranceUpdated={handleInsuranceUpdated}
            />
            
            <div className="lg:col-span-2">
              <PatientDemographicInfo 
                lookupData={lookupData}
                patientId={selectedPatient?.id}
                onDemographicUpdated={handleDemographicUpdated}
              />
            </div>
          </div>
        </TabsContent>

        {/* Tab de Búsqueda y Gestión */}
        <TabsContent value="search">
          <PatientsList 
            lookupData={lookupData}
            onPatientSelected={handlePatientSelected}
            onPatientEdit={(patient) => {
              setSelectedPatient(patient);
              setActiveTab("register");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PatientManagementHub;
