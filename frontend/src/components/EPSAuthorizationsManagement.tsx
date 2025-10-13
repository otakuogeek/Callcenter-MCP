import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Shield, CheckCircle2, XCircle, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

interface EPSRow {
  id: number;
  name: string;
  code: string;
  status: string;
}

interface SpecialtyRow {
  id: number;
  name: string;
  description?: string;
}

interface LocationRow {
  id: number;
  name: string;
  address?: string;
}

interface Authorization {
  id: number;
  eps_id: number;
  eps_name: string;
  eps_code: string;
  specialty_id: number;
  specialty_name: string;
  location_id: number;
  location_name: string;
  authorized: boolean;
  authorization_date: string;
  is_currently_valid: boolean;
  notes?: string;
}

const EPSAuthorizationsManagement = () => {
  const [epsList, setEpsList] = useState<EPSRow[]>([]);
  const [specialtiesList, setSpecialtiesList] = useState<SpecialtyRow[]>([]);
  const [locationsList, setLocationsList] = useState<LocationRow[]>([]);
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Estado del formulario
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEPS, setSelectedEPS] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<Set<number>>(new Set());

  // Estado para filtros
  const [filterEPS, setFilterEPS] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");

  // Estado para cards expandidas
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eps, specialties, locations, auths] = await Promise.all([
        api.getEps(),
        api.getSpecialties(),
        api.getLocations(),
        fetch(`${import.meta.env.VITE_API_URL}/eps-authorizations`).then(r => r.json())
      ]);

      // Cargar TODAS las EPS (activas e inactivas) para el filtro
      setEpsList(eps as EPSRow[]);
      setSpecialtiesList(specialties as SpecialtyRow[]);
      setLocationsList(locations as LocationRow[]);
      setAuthorizations(auths.data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Cargar especialidades autorizadas existentes para la combinación EPS-Ubicación
  const loadExistingAuthorizations = async (epsId: string, locationId: string) => {
    if (!epsId || !locationId) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/eps-authorizations/eps/${epsId}/location/${locationId}/specialties`
      );
      const { data } = await response.json();
      
      const specialtyIds = new Set<number>(data.map((item: any) => Number(item.specialty_id)));
      setSelectedSpecialties(specialtyIds);
    } catch (error) {
      console.error("Error loading existing authorizations:", error);
    }
  };

  // Manejar cambio de EPS
  const handleEPSChange = (value: string) => {
    setSelectedEPS(value);
    if (selectedLocation) {
      loadExistingAuthorizations(value, selectedLocation);
    }
  };

  // Manejar cambio de ubicación
  const handleLocationChange = (value: string) => {
    setSelectedLocation(value);
    if (selectedEPS) {
      loadExistingAuthorizations(selectedEPS, value);
    }
  };

  // Toggle de especialidad
  const toggleSpecialty = (specialtyId: number) => {
    const newSet = new Set(selectedSpecialties);
    if (newSet.has(specialtyId)) {
      newSet.delete(specialtyId);
    } else {
      newSet.add(specialtyId);
    }
    setSelectedSpecialties(newSet);
  };

  // Guardar autorizaciones
  const handleSaveAuthorizations = async () => {
    if (!selectedEPS || !selectedLocation) {
      toast({
        title: "Error",
        description: "Debe seleccionar una EPS y una ubicación",
        variant: "destructive",
      });
      return;
    }

    try {
      // Obtener autorizaciones actuales para esta combinación
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/eps-authorizations/eps/${selectedEPS}/location/${selectedLocation}/specialties`
      );
      const { data: currentAuths } = await response.json();
      const currentSpecialtyIds = new Set<number>(currentAuths.map((item: any) => Number(item.specialty_id)));

      // Determinar especialidades a agregar y a eliminar
      const toAdd = Array.from(selectedSpecialties).filter(id => !currentSpecialtyIds.has(id));
      const toRemove = Array.from(currentSpecialtyIds).filter((id: number) => !selectedSpecialties.has(id));

      // Crear nuevas autorizaciones
      if (toAdd.length > 0) {
        const authorizationsToCreate = toAdd.map(specialtyId => ({
          eps_id: parseInt(selectedEPS),
          specialty_id: specialtyId,
          location_id: parseInt(selectedLocation),
          authorized: true,
          authorization_date: new Date().toISOString().split('T')[0],
          notes: `Autorización creada desde la interfaz de gestión`
        }));

        await fetch(`${import.meta.env.VITE_API_URL}/eps-authorizations/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authorizations: authorizationsToCreate })
        });
      }

      // Eliminar autorizaciones desmarcadas
      if (toRemove.length > 0) {
        // Obtener IDs de las autorizaciones a eliminar
        const authsToDelete = authorizations.filter(
          auth => 
            auth.eps_id === parseInt(selectedEPS) && 
            auth.location_id === parseInt(selectedLocation) &&
            toRemove.includes(auth.specialty_id)
        );

        await Promise.all(
          authsToDelete.map(auth =>
            fetch(`${import.meta.env.VITE_API_URL}/eps-authorizations/${auth.id}`, {
              method: 'DELETE'
            })
          )
        );
      }

      toast({
        title: "Éxito",
        description: "Autorizaciones actualizadas correctamente",
      });

      // Recargar datos
      loadData();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron guardar las autorizaciones",
        variant: "destructive",
      });
    }
  };

  // Eliminar una autorización específica
  const handleDeleteAuthorization = async (authId: number) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/eps-authorizations/${authId}`, {
        method: 'DELETE'
      });

      toast({
        title: "Éxito",
        description: "Autorización eliminada correctamente",
      });

      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la autorización",
        variant: "destructive",
      });
    }
  };

  // Resetear formulario
  const resetForm = () => {
    setSelectedEPS("");
    setSelectedLocation("");
    setSelectedSpecialties(new Set());
  };

  // Filtrar autorizaciones
  const filteredAuthorizations = authorizations.filter(auth => {
    if (filterEPS !== "all" && auth.eps_id !== parseInt(filterEPS)) return false;
    if (filterLocation !== "all" && auth.location_id !== parseInt(filterLocation)) return false;
    return true;
  });

  // Agrupar autorizaciones por EPS y ubicación
  const groupedAuthorizations = filteredAuthorizations.reduce((acc, auth) => {
    const key = `${auth.eps_id}-${auth.location_id}`;
    if (!acc[key]) {
      acc[key] = {
        key,
        eps_id: auth.eps_id,
        location_id: auth.location_id,
        eps_name: auth.eps_name,
        eps_code: auth.eps_code,
        location_name: auth.location_name,
        specialties: []
      };
    }
    acc[key].specialties.push(auth);
    return acc;
  }, {} as Record<string, any>);

  // Convertir a array para mapear
  const authorizationsArray = Object.values(groupedAuthorizations);

  // Toggle de card expandida
  const toggleCard = (key: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedCards(newExpanded);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-medical-800 mb-2">EPS / Especialidades</h2>
        <p className="text-medical-600">
          Gestiona las autorizaciones de especialidades por EPS y ubicación
        </p>
      </div>

      {/* Métricas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Resumen de Autorizaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {authorizations.filter(a => a.is_currently_valid).length}
              </div>
              <div className="text-sm text-green-700">Autorizaciones Vigentes</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {new Set(authorizations.map(a => a.eps_id)).size}
              </div>
              <div className="text-sm text-blue-700">EPS con Autorizaciones</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {new Set(authorizations.map(a => a.specialty_id)).size}
              </div>
              <div className="text-sm text-purple-700">Especialidades Cubiertas</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {new Set(authorizations.map(a => a.location_id)).size}
              </div>
              <div className="text-sm text-orange-700">Sedes con Convenios</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtros y botón de agregar */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Autorizaciones Registradas</CardTitle>
              <CardDescription>
                Gestiona qué especialidades puede atender cada EPS en cada sede
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Autorización
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Gestionar Autorizaciones</DialogTitle>
                  <DialogDescription>
                    Seleccione una EPS y una ubicación, luego marque las especialidades autorizadas
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Selector de EPS */}
                  <div>
                    <Label>EPS</Label>
                    <Select value={selectedEPS} onValueChange={handleEPSChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione una EPS" />
                      </SelectTrigger>
                      <SelectContent>
                        {epsList.filter((eps) => eps.status === 'active').map((eps) => (
                          <SelectItem key={eps.id} value={eps.id.toString()}>
                            {eps.name} ({eps.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Selector de Ubicación */}
                  <div>
                    <Label>Ubicación / Sede</Label>
                    <Select value={selectedLocation} onValueChange={handleLocationChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione una ubicación" />
                      </SelectTrigger>
                      <SelectContent>
                        {locationsList.map((location) => (
                          <SelectItem key={location.id} value={location.id.toString()}>
                            {location.name}
                            {location.address && ` - ${location.address}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Checkboxes de Especialidades */}
                  {selectedEPS && selectedLocation && (
                    <div>
                      <Label className="mb-3 block">
                        Especialidades Autorizadas ({selectedSpecialties.size} seleccionadas)
                      </Label>
                      <div className="border rounded-lg p-4 max-h-[300px] overflow-y-auto">
                        <div className="space-y-3">
                          {specialtiesList.map((specialty) => (
                            <div
                              key={specialty.id}
                              className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded"
                            >
                              <Checkbox
                                id={`specialty-${specialty.id}`}
                                checked={selectedSpecialties.has(specialty.id)}
                                onCheckedChange={() => toggleSpecialty(specialty.id)}
                              />
                              <div className="flex-1">
                                <label
                                  htmlFor={`specialty-${specialty.id}`}
                                  className="text-sm font-medium leading-none cursor-pointer"
                                >
                                  {specialty.name}
                                </label>
                                {specialty.description && (
                                  <p className="text-sm text-gray-500 mt-1">
                                    {specialty.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mensaje si no hay selección */}
                  {(!selectedEPS || !selectedLocation) && (
                    <div className="text-center py-8 text-gray-500">
                      <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Seleccione una EPS y una ubicación para gestionar las especialidades</p>
                    </div>
                  )}

                  {/* Botones */}
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSaveAuthorizations}
                      disabled={!selectedEPS || !selectedLocation || selectedSpecialties.size === 0}
                    >
                      Guardar Autorizaciones
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filtros */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Label>
                Filtrar por EPS 
                <span className="text-xs text-gray-500 ml-2">
                  ({epsList.filter(e => e.status === 'active').length} activas, {epsList.filter(e => e.status !== 'active').length} inactivas)
                </span>
              </Label>
              <Select value={filterEPS} onValueChange={setFilterEPS}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las EPS" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">Todas las EPS</SelectItem>
                  
                  {/* Separador: EPS Activas */}
                  {epsList.filter(e => e.status === 'active').length > 0 && (
                    <div className="px-2 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border-b border-green-200">
                      ✓ EPS ACTIVAS ({epsList.filter(e => e.status === 'active').length})
                    </div>
                  )}
                  
                  {/* EPS Activas */}
                  {epsList
                    .filter(e => e.status === 'active')
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((eps) => {
                      const authCount = authorizations.filter(a => a.eps_id === eps.id).length;
                      return (
                        <SelectItem 
                          key={eps.id} 
                          value={eps.id.toString()}
                          className="font-bold text-green-700 hover:bg-green-50"
                        >
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            {eps.name} ({eps.code})
                            {authCount > 0 && ` - ${authCount} autorizaciones`}
                          </span>
                        </SelectItem>
                      );
                    })}
                  
                  {/* Separador: EPS Inactivas */}
                  {epsList.filter(e => e.status !== 'active').length > 0 && (
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border-y border-gray-200 mt-1">
                      ✗ EPS INACTIVAS ({epsList.filter(e => e.status !== 'active').length}) - No seleccionables
                    </div>
                  )}
                  
                  {/* EPS Inactivas - Deshabilitadas */}
                  {epsList
                    .filter(e => e.status !== 'active')
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((eps) => {
                      const authCount = authorizations.filter(a => a.eps_id === eps.id).length;
                      return (
                        <SelectItem 
                          key={eps.id} 
                          value={eps.id.toString()}
                          disabled
                          className="text-gray-400 opacity-60"
                        >
                          {eps.name} ({eps.code})
                          {authCount > 0 && ` - ${authCount} autorizaciones`}
                          {' [Inactiva]'}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label>Filtrar por Ubicación</Label>
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las ubicaciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las ubicaciones</SelectItem>
                  {locationsList.map((location) => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lista de autorizaciones agrupadas */}
          {loading ? (
            <div className="text-center py-8 text-gray-500">Cargando...</div>
          ) : authorizationsArray.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Shield className="w-16 h-16 mx-auto mb-4 opacity-30" />
              {filterEPS !== "all" || filterLocation !== "all" ? (
                <>
                  <p className="text-lg font-medium">No hay autorizaciones para este filtro</p>
                  <p className="text-sm mt-2 mb-4">
                    {filterEPS !== "all" && `EPS: ${epsList.find(e => e.id.toString() === filterEPS)?.name}`}
                    {filterEPS !== "all" && filterLocation !== "all" && " - "}
                    {filterLocation !== "all" && `Ubicación: ${locationsList.find(l => l.id.toString() === filterLocation)?.name}`}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setFilterEPS("all");
                        setFilterLocation("all");
                      }}
                    >
                      Limpiar filtros
                    </Button>
                    {filterEPS !== "all" && epsList.find(e => e.id.toString() === filterEPS)?.status === 'active' && (
                      <Button
                        onClick={() => {
                          setSelectedEPS(filterEPS);
                          if (filterLocation !== "all") {
                            setSelectedLocation(filterLocation);
                          }
                          setIsDialogOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Crear Autorización para esta EPS
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium">No hay autorizaciones registradas</p>
                  <p className="text-sm mt-2">
                    Haga clic en "Nueva Autorización" para comenzar
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {authorizationsArray.map((group) => {
                const isExpanded = expandedCards.has(group.key);
                const validAuths = group.specialties.filter((a: Authorization) => a.is_currently_valid).length;
                
                return (
                  <Card 
                    key={group.key} 
                    className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-medical-500"
                    onClick={() => toggleCard(group.key)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2 mb-2">
                            <Shield className="w-5 h-5 text-medical-600" />
                            {group.eps_name}
                          </CardTitle>
                          <Badge variant="outline" className="mb-3">
                            {group.eps_code}
                          </Badge>
                          <CardDescription className="flex items-center gap-2 mt-2">
                            <MapPin className="w-4 h-4" />
                            {group.location_name}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant={validAuths > 0 ? "default" : "secondary"}
                            className="mb-2"
                          >
                            {group.specialties.length} esp.
                          </Badge>
                          <div className="text-xs text-gray-500">
                            {validAuths} vigente{validAuths !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    
                    {isExpanded && (
                      <CardContent className="pt-0">
                        <div className="border-t pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-700">
                              Especialidades Autorizadas
                            </h4>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEPS(group.eps_id.toString());
                                setSelectedLocation(group.location_id.toString());
                                loadExistingAuthorizations(
                                  group.eps_id.toString(), 
                                  group.location_id.toString()
                                );
                                setIsDialogOpen(true);
                              }}
                            >
                              Editar
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {group.specialties.map((auth: Authorization) => (
                              <div
                                key={auth.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  {auth.is_currently_valid ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  )}
                                  <span className="text-sm font-medium">
                                    {auth.specialty_name}
                                  </span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAuthorization(auth.id);
                                  }}
                                  className="h-8 w-8 p-0"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EPSAuthorizationsManagement;
