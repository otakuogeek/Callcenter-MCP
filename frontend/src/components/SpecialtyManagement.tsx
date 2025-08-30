
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Plus, Edit, Trash2, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import api from "@/lib/api";

interface Specialty { id: number; name: string; description?: string; default_duration_minutes: number; active: number | boolean; }

const SpecialtyManagement = () => {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSpecialty, setEditingSpecialty] = useState<Specialty | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", default_duration_minutes: 30 });
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const rows = await api.getSpecialties();
        setSpecialties(rows);
      } catch (e: any) {
        toast({ title: "Error", description: e?.message || "No se pudieron cargar las especialidades", variant: "destructive" });
      }
    })();
  }, []);

  const handleSubmit = async () => {
    const name = formData.name.trim();
    const duration = Number(formData.default_duration_minutes);
    if (!name) { toast({ title: "Nombre requerido", description: "Ingresa el nombre de la especialidad", variant: "destructive" }); return; }
    if (!Number.isFinite(duration) || duration < 10 || duration > 480) { toast({ title: "Duración inválida", description: "Ingresa un valor entre 10 y 480 minutos", variant: "destructive" }); return; }
    try {
      if (editingSpecialty) {
        const saved = await api.updateSpecialty(editingSpecialty.id, { ...formData, name, default_duration_minutes: duration });
        setSpecialties(prev => prev.map(s => s.id === editingSpecialty.id ? { ...s, ...saved } : s));
        toast({ title: "Especialidad actualizada", description: `Se guardaron los cambios de "${name}"` });
      } else {
        const created = await api.createSpecialty({ ...formData, name, default_duration_minutes: duration });
        setSpecialties(prev => [...prev, created]);
        toast({ title: "Especialidad creada", description: `Se agregó "${name}"` });
      }
      setFormData({ name: "", description: "", default_duration_minutes: 30 });
      setEditingSpecialty(null);
      setIsDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || (editingSpecialty ? 'No se pudo actualizar' : 'No se pudo crear'), variant: "destructive" });
    }
  };

  const handleEdit = (specialty: Specialty) => {
    setEditingSpecialty(specialty);
    setFormData({
      name: specialty.name,
      description: specialty.description || "",
      default_duration_minutes: Number(specialty.default_duration_minutes) || 30,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const cur = specialties.find(s => s.id === id);
    if (!cur) return;
    try {
      const usage = await api.getSpecialtyUsage(id);
      const total = Number(usage.doctors||0) + Number(usage.locations||0) + Number(usage.queue||0);
      if (total > 0) {
        toast({ title: "No se puede eliminar", description: `Está asignada a ${usage.doctors} doctores, ${usage.locations} sedes y ${usage.queue} en cola.`, variant: 'destructive' });
        return;
      }
      const ok = window.confirm(`¿Eliminar la especialidad "${cur.name}"?`);
      if (!ok) return;
      await api.deleteSpecialty(id);
      setSpecialties(prev => prev.filter(s => s.id !== id));
      toast({ title: "Especialidad eliminada", description: `Se eliminó "${cur.name}"` });
    } catch (e: any) {
      toast({ title: "No se pudo eliminar", description: e?.message || 'Error eliminando la especialidad', variant: 'destructive' });
    }
  };

  // Activar/Inactivar podría implementarse vía updateSpecialty si existe un campo activo en API.

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5" />
              Gestión de Especialidades
            </CardTitle>
            <CardDescription>
              Crea y administra las especialidades médicas disponibles
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <Label htmlFor="search">Buscar</Label>
              <Input id="search" value={search} onChange={(e)=>{ setSearch(e.target.value); setPage(1);} } placeholder="Buscar por nombre o descripción" />
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  setFormData({ name: "", description: "", default_duration_minutes: 30 });
                  setEditingSpecialty(null);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva Especialidad
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSpecialty ? "Editar Especialidad" : "Nueva Especialidad"}
                </DialogTitle>
                <DialogDescription>
                  {editingSpecialty 
                    ? "Modifica los datos de la especialidad" 
                    : "Agrega una nueva especialidad médica al sistema"
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre de la Especialidad</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ej: Cardiología"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Descripción de la especialidad..."
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Duración de Consulta (minutos)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="10"
                    max="120"
                    value={formData.default_duration_minutes}
                    onChange={(e) => setFormData({...formData, default_duration_minutes: parseInt(e.target.value)})}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit}>
                    {editingSpecialty ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {(() => {
          const filtered = specialties.filter(s =>
            s.name.toLowerCase().includes(search.toLowerCase()) || (s.description||'').toLowerCase().includes(search.toLowerCase())
          );
          const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
          const clampedPage = Math.min(page, totalPages);
          const start = (clampedPage - 1) * pageSize;
          const items = filtered.slice(start, start + pageSize);
          return (
            <div className="space-y-4">
              {items.map((specialty) => (
            <div key={specialty.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{specialty.name}</h3>
                    <Badge variant={Number(specialty.active) ? "default" : "secondary"}>
                      {Number(specialty.active) ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{specialty.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{specialty.default_duration_minutes} min</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 mr-2">
                    <Switch
                      checked={Boolean(Number(specialty.active))}
                      onCheckedChange={async (checked) => {
                        try {
                          const saved = await api.updateSpecialty(specialty.id, { active: checked });
                          setSpecialties(prev => prev.map(s => s.id === specialty.id ? { ...s, ...saved } : s));
                          toast({ title: "Estado actualizado", description: `${specialty.name}: ${checked ? 'Activa' : 'Inactiva'}` });
                        } catch (e: any) {
                          toast({ title: "Error", description: e?.message || 'No se pudo cambiar el estado', variant: 'destructive' });
                        }
                      }}
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleEdit(specialty)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDelete(specialty.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-gray-600">{filtered.length} resultado(s) — Página {clampedPage} de {totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={clampedPage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Anterior</Button>
                  <Button variant="outline" size="sm" disabled={clampedPage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Siguiente</Button>
                </div>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
};

export default SpecialtyManagement;
