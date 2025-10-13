
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stethoscope, User, MapPin, Shield, Layers, ShieldCheck } from "lucide-react";
import SpecialtyManagement from "./SpecialtyManagement";
import DoctorManagement from "./DoctorManagement";
import LocationManagement from "./LocationManagement";
import EpsManagement from "./EpsManagement";
import LocationTypeManagement from "./LocationTypeManagement";
import ServiceManagement from "./ServiceManagement";
import EPSAuthorizationsManagement from "./EPSAuthorizationsManagement";

const ManagementModule = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-medical-800 mb-2">Gestión de Recursos</h2>
        <p className="text-medical-600">Administra especialidades, doctores, ubicaciones y convenios EPS</p>
      </div>

      <Tabs defaultValue="specialties" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="specialties" className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4" />
            Especialidades
          </TabsTrigger>
          <TabsTrigger value="doctors" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Doctores
          </TabsTrigger>
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Ubicaciones
          </TabsTrigger>
          {/* Oculta: Servicios
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Servicios
          </TabsTrigger>
          */}
          <TabsTrigger value="eps" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            EPS
          </TabsTrigger>
          <TabsTrigger value="eps-authorizations" className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            EPS/Especialidades
          </TabsTrigger>
          <TabsTrigger value="location-types" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Tipos de Sede
          </TabsTrigger>
        </TabsList>

        <TabsContent value="specialties">
          <SpecialtyManagement />
        </TabsContent>

        <TabsContent value="doctors">
          <DoctorManagement />
        </TabsContent>

        <TabsContent value="locations">
          <LocationManagement />
        </TabsContent>

        <TabsContent value="services">
          <ServiceManagement />
        </TabsContent>

        <TabsContent value="eps">
          <EpsManagement />
        </TabsContent>

        <TabsContent value="eps-authorizations">
          <EPSAuthorizationsManagement />
        </TabsContent>

        <TabsContent value="location-types">
          <LocationTypeManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ManagementModule;
