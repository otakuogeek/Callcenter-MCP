import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Plus, Edit, Trash2 } from "lucide-react";
import api from "@/lib/api";

interface Zone { id: number; name: string; description?: string | null }
interface Municipality { id: number; name: string; zone_id: number; zone_name?: string }

const LocationManagement = () => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(false);

  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [isMunicipalityDialogOpen, setIsMunicipalityDialogOpen] = useState(false);
  // Selecteds reserved for future edit support
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState<Municipality | null>(null);

  const [zoneForm, setZoneForm] = useState({ name: "", description: "" });
  const [municipalityForm, setMunicipalityForm] = useState({ name: "", zoneId: "" });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [zs, ms] = await Promise.all([api.getZones(), api.getMunicipalitiesByZone()]);
        setZones(zs as Zone[]);
        setMunicipalities(ms as any);
      } catch (e) {
        console.error('Error cargando zonas/municipios:', e);
        // noop: UI starts empty if error
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleAddZone = async () => {
    if (!zoneForm.name.trim()) return;
    try {
      const created = await api.createZone({ name: zoneForm.name.trim(), description: zoneForm.description || null });
      setZones((prev) => [...prev, created as Zone]);
      setZoneForm({ name: "", description: "" });
      setIsZoneDialogOpen(false);
    } catch (e) {
      // ignore error toast for now
    }
  };

  const handleAddMunicipality = async () => {
    if (!municipalityForm.name.trim() || !municipalityForm.zoneId) return;
    try {
      const payload = { name: municipalityForm.name.trim(), zone_id: Number(municipalityForm.zoneId) };
      const created = await api.createMunicipality(payload);
      setMunicipalities((prev) => [...prev, created as any]);
      setMunicipalityForm({ name: "", zoneId: "" });
      setIsMunicipalityDialogOpen(false);
    } catch (e) {
      // ignore
    }
  };

  const handleDeleteZone = async (zoneId: number) => {
    try {
      await api.deleteZone(zoneId);
      setZones((prev) => prev.filter(z => z.id !== zoneId));
      setMunicipalities((prev) => prev.filter(m => m.zone_id !== zoneId));
    } catch (e) {
      // ignore
    }
  };

  const handleDeleteMunicipality = async (municipalityId: number) => {
    try {
      await api.deleteMunicipality(municipalityId);
      setMunicipalities((prev) => prev.filter(m => m.id !== municipalityId));
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-medical-800 mb-2">Gestión de Ubicaciones</h2>
        <p className="text-medical-600">Administra zonas y municipios donde se presta el servicio</p>
      </div>

  <Tabs defaultValue="zones" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="zones" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Zonas
          </TabsTrigger>
          <TabsTrigger value="municipalities" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Municipios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="zones">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Zonas de Servicio</CardTitle>
                  <CardDescription>Regiones donde se presta el servicio médico</CardDescription>
                </div>
                <Dialog open={isZoneDialogOpen} onOpenChange={setIsZoneDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Zona
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Agregar Nueva Zona</DialogTitle>
                      <DialogDescription>
                        Ingrese la información de la nueva zona de servicio
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="zone-name">Nombre de la Zona</Label>
                        <Input
                          id="zone-name"
                          value={zoneForm.name}
                          onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                          placeholder="Ej: Zona Norte"
                        />
                      </div>
                      <div>
                        <Label htmlFor="zone-description">Descripción</Label>
                        <Input
                          id="zone-description"
                          value={zoneForm.description}
                          onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
                          placeholder="Descripción de la zona"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsZoneDialogOpen(false)}>
                          Cancelar
                        </Button>
                          <Button onClick={handleAddZone} disabled={loading}>
                          Agregar
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Municipios</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
          {zones.map((zone) => (
                    <TableRow key={zone.id}>
                      <TableCell className="font-medium">{zone.name}</TableCell>
                      <TableCell>{zone.description}</TableCell>
                      <TableCell>
            {municipalities.filter(m => m.zone_id === zone.id).length} municipios
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Edit className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-red-600"
              onClick={() => handleDeleteZone(zone.id)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="municipalities">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Municipios de Servicio</CardTitle>
                  <CardDescription>Municipios donde se presta el servicio médico</CardDescription>
                </div>
                <Dialog open={isMunicipalityDialogOpen} onOpenChange={setIsMunicipalityDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Municipio
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Agregar Nuevo Municipio</DialogTitle>
                      <DialogDescription>
                        Ingrese la información del nuevo municipio
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="municipality-name">Nombre del Municipio</Label>
                        <Input
                          id="municipality-name"
                          value={municipalityForm.name}
                          onChange={(e) => setMunicipalityForm({ ...municipalityForm, name: e.target.value })}
                          placeholder="Ej: Bucaramanga"
                        />
                      </div>
                      <div>
                        <Label htmlFor="municipality-zone">Zona</Label>
                        <Select 
                          value={municipalityForm.zoneId} 
                          onValueChange={(value) => setMunicipalityForm({ ...municipalityForm, zoneId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una zona" />
                          </SelectTrigger>
                          <SelectContent>
                            {zones.map((zone) => (
                              <SelectItem key={zone.id} value={String(zone.id)}>
                                {zone.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsMunicipalityDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleAddMunicipality} disabled={loading}>
                          Agregar
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Municipio</TableHead>
                    <TableHead>Zona</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
          {municipalities.map((municipality) => (
                    <TableRow key={municipality.id}>
                      <TableCell className="font-medium">{municipality.name}</TableCell>
            <TableCell>{municipality.zone_name || zones.find(z => z.id === municipality.zone_id)?.name}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Edit className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-red-600"
              onClick={() => handleDeleteMunicipality(municipality.id)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LocationManagement;
