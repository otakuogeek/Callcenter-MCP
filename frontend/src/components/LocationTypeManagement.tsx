import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import api from "@/lib/api";

interface LocationType {
  id: number;
  name: string;
  status: "active" | "inactive";
}

const LocationTypeManagement = () => {
  const [types, setTypes] = useState<LocationType[]>([]);
  const [form, setForm] = useState<{ name: string; status: 'active'|'inactive' }>({ name: "", status: 'active' });
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try { const rows = await api.getLocationTypes(); setTypes(rows as any); } catch {
        toast({ title: "Error", description: "No se pudieron cargar los tipos de sede", variant: "destructive" });
      }
    })();
  }, []);

  const addType = async () => {
    if (!form.name.trim()) return;
    try {
      const created = await api.createLocationType({ name: form.name.trim(), status: form.status });
      setTypes((prev) => [...prev, created as any]);
      setForm({ name: "", status: 'active' });
      setIsAddOpen(false);
      toast({ title: "Tipo agregado", description: `Se agregó "${(created as any)?.name ?? ''}"` });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || 'No se pudo crear el tipo', variant: 'destructive' });
    }
  };

  const toggleStatus = async (id: number) => {
    const cur = types.find(t => t.id === id); if (!cur) return;
    const next = cur.status === 'active' ? 'inactive' : 'active';
    try {
      await api.updateLocationType(id, { status: next });
      setTypes(list => list.map(t => t.id === id ? { ...t, status: next } : t));
      toast({ title: "Estado actualizado", description: `${cur.name}: ${next === 'active' ? 'Activo' : 'Inactivo'}` });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || 'No se pudo actualizar el estado', variant: 'destructive' });
    }
  };

  const remove = async (id: number) => {
    const cur = types.find(t => t.id === id);
    if (!cur) return;
    const ok = window.confirm(`¿Eliminar el tipo "${cur.name}"?`);
    if (!ok) return;
    try {
      await api.deleteLocationType(id);
      setTypes(list => list.filter(t => t.id !== id));
      toast({ title: "Tipo eliminado", description: `Se eliminó "${cur.name}"` });
    } catch (e: any) {
      toast({ title: "No se pudo eliminar", description: e?.message || 'Error eliminando el tipo', variant: 'destructive' });
    }
  };

  const startEdit = (id: number) => {
    const cur = types.find(t => t.id === id); if (!cur) return;
    setEditingId(id);
    setEditingName(cur.name);
  };

  const cancelEdit = () => { setEditingId(null); setEditingName(""); };

  const saveEdit = async (id: number) => {
    const name = editingName.trim();
    if (!name) { toast({ title: "Nombre requerido", description: "Ingresa un nombre válido" }); return; }
    try {
      const updated = await api.updateLocationType(id, { name });
      setTypes(list => list.map(t => t.id === id ? { ...t, name: (updated as any)?.name ?? name } : t));
      toast({ title: "Tipo actualizado", description: `Nuevo nombre: "${(updated as any)?.name ?? name}"` });
      cancelEdit();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || 'No se pudo actualizar el tipo', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Tipos de Sede</CardTitle>
            <CardDescription>Gestiona los tipos de sede disponibles para las ubicaciones</CardDescription>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setForm({ name: "", status: 'active' }); }}>
                <Plus className="w-4 h-4 mr-1"/> Nuevo tipo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo Tipo de Sede</DialogTitle>
                <DialogDescription>Define un nombre y el estado inicial.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="lt-name">Nombre</Label>
                  <Input id="lt-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Sede Principal" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.status === 'active'} onCheckedChange={(v) => setForm((f) => ({ ...f, status: v ? 'active' : 'inactive' }))} />
                  <span className={form.status === 'active' ? 'text-green-700' : 'text-gray-500'}>{form.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
                  <Button onClick={addType} disabled={!form.name.trim()}>Crear</Button>
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
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  {editingId === t.id ? (
                    <div className="flex items-center gap-2">
                      <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="h-8 max-w-xs" />
                      <Button size="sm" variant="secondary" onClick={() => saveEdit(t.id)} disabled={!editingName.trim()}>
                        <Check className="w-3 h-3 mr-1"/>Guardar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        <X className="w-3 h-3 mr-1"/>Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>{t.name}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(t.id)}>
                        <Pencil className="w-3 h-3"/>
                      </Button>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={t.status === 'active'} onCheckedChange={() => toggleStatus(t.id)} />
                    <span className={t.status === 'active' ? 'text-green-700' : 'text-gray-500'}>{t.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" className="text-red-600" onClick={() => remove(t.id)}>
                    <Trash2 className="w-3 h-3 mr-1"/>Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default LocationTypeManagement;
