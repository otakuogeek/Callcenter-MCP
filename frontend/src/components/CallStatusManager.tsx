import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

export default function CallStatusManager({ open, onOpenChange }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState('bg-gray-100 text-gray-800');
  const [sortOrder, setSortOrder] = useState<number | ''>('' as any);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Record<number, { name: string; color: string; sort_order: number | '' }>>({});

  const load = async () => {
    setLoading(true);
    try {
      const rows = await api.getCallStatuses();
      setItems(rows);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const onCreate = async () => {
    if (!name.trim()) return;
    await api.createCallStatus({ name: name.trim(), color, sort_order: sortOrder === '' ? null : Number(sortOrder) });
    setName(''); setColor('bg-gray-100 text-gray-800'); setSortOrder('' as any);
    await load();
  };

  const onDelete = async (id: number) => {
    await api.deleteCallStatus(id);
    await load();
  };

  const startEdit = (it: any) => {
    setEditing(prev => ({ ...prev, [it.id]: { name: it.name, color: it.color || '', sort_order: it.sort_order ?? '' } }));
  };
  const cancelEdit = (id: number) => {
    setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
  };
  const saveEdit = async (id: number) => {
    const d = editing[id]; if (!d) return;
    await api.updateCallStatus(id, { name: d.name, color: d.color || null, sort_order: d.sort_order === '' ? null : Number(d.sort_order) });
    cancelEdit(id);
    await load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Estados de Llamadas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <Label>Nombre</Label>
              <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Pendiente" />
            </div>
            <div>
              <Label>Clase CSS</Label>
              <Input value={color} onChange={(e)=>setColor(e.target.value)} placeholder="bg-medical-100 text-medical-800" />
              <div className="mt-1"><Badge className={color}>Vista previa</Badge></div>
            </div>
            <div>
              <Label>Orden</Label>
              <Input type="number" value={sortOrder} onChange={(e)=>setSortOrder(e.target.value === '' ? '' : Number(e.target.value))} placeholder="10" />
            </div>
            <div className="col-span-3">
              <Button onClick={onCreate} disabled={loading || !name.trim()}>Agregar</Button>
            </div>
          </div>
          <div className="border-t pt-3">
            {loading ? <div>Cargando…</div> : (
              <ul className="space-y-2">
                {items.map(it => {
                  const ed = editing[it.id];
                  return (
                    <li key={it.id} className="p-2 border rounded">
                      {!ed ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className={it.color || ''}>{it.name}</Badge>
                            <span className="text-xs text-gray-500">orden: {it.sort_order ?? '-'}</span>
                          </div>
                          <div className="space-x-2">
                            <Button variant="outline" onClick={() => startEdit(it)}>Editar</Button>
                            <Button variant="outline" onClick={() => onDelete(it.id)}>Eliminar</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-3 items-end">
                          <div>
                            <Label>Nombre</Label>
                            <Input value={ed.name} onChange={e=>setEditing(prev=>({ ...prev, [it.id]: { ...prev[it.id], name: e.target.value } }))} />
                          </div>
                          <div>
                            <Label>Clase CSS</Label>
                            <Input value={ed.color} onChange={e=>setEditing(prev=>({ ...prev, [it.id]: { ...prev[it.id], color: e.target.value } }))} />
                            <div className="mt-1"><Badge className={ed.color || ''}>Vista previa</Badge></div>
                          </div>
                          <div>
                            <Label>Orden</Label>
                            <Input type="number" value={ed.sort_order} onChange={e=>setEditing(prev=>({ ...prev, [it.id]: { ...prev[it.id], sort_order: e.target.value === '' ? '' : Number(e.target.value) } }))} />
                          </div>
                          <div className="col-span-3 space-x-2">
                            <Button onClick={()=>saveEdit(it.id)} disabled={!ed.name.trim()}>Guardar</Button>
                            <Button variant="outline" onClick={()=>cancelEdit(it.id)}>Cancelar</Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
