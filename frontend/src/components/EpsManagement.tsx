import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Shield } from "lucide-react";
import api from "@/lib/api";

interface EPSRow {
  id: number;
  name: string;
  code: string;
  status: "active" | "inactive";
  has_agreement: 0 | 1 | boolean;
  agreement_date?: string | null;
  notes?: string | null;
}

const EpsManagement = () => {
  const [epsList, setEpsList] = useState<EPSRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEps, setSelectedEps] = useState<EPSRow | null>(null);
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [dateEditingId, setDateEditingId] = useState<number | null>(null);
  const [dateValue, setDateValue] = useState<string>("");
  const [epsForm, setEpsForm] = useState({
    name: "",
    code: "",
    status: "active" as "active" | "inactive",
    hasAgreement: false,
    agreementDate: "",
    notes: ""
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const rows = await api.getEps();
        setEpsList(rows as any);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleAddEps = async () => {
    if (!epsForm.name || !epsForm.code) return;
    try {
      const created = await api.createEps({
        name: epsForm.name.trim(),
        code: epsForm.code.trim().toUpperCase(),
        status: epsForm.status,
        has_agreement: epsForm.hasAgreement,
        agreement_date: epsForm.hasAgreement ? epsForm.agreementDate || null : null,
        notes: epsForm.notes || null,
      });
      setEpsList((prev) => [...prev, created as any]);
      setEpsForm({ name: "", code: "", status: "active", hasAgreement: false, agreementDate: "", notes: "" });
      setIsDialogOpen(false);
    } catch {}
  };

  const handleDeleteEps = async (epsId: number) => {
    try { await api.deleteEps(epsId); setEpsList((l) => l.filter(e => e.id !== epsId)); } catch {}
  };

  const toggleEpsStatus = async (epsId: number) => {
    const current = epsList.find(e => e.id === epsId); if (!current) return;
    const nextStatus = current.status === "active" ? "inactive" : "active";
    try {
      await api.updateEps(epsId, { status: nextStatus });
      setEpsList((list) => list.map(e => e.id === epsId ? { ...e, status: nextStatus } : e));
    } catch {}
  };

  const toggleAgreement = async (epsId: number) => {
    const current = epsList.find(e => e.id === epsId); if (!current) return;
    const next = !Boolean(current.has_agreement);
    try {
      await api.updateEps(epsId, { has_agreement: next, agreement_date: next ? current.agreement_date || null : null });
      setEpsList((list) => list.map(e => e.id === epsId ? { ...e, has_agreement: next } : e));
    } catch {}
  };

  const openDateDialog = (eps: EPSRow) => {
    if (!Boolean(eps.has_agreement)) return; // no permitir si no hay convenio
    setDateEditingId(eps.id);
    setDateValue((eps.agreement_date || "") as string);
    setIsDateDialogOpen(true);
  };

  const saveAgreementDate = async () => {
    if (!dateEditingId) return;
    try {
      await api.updateEps(dateEditingId, { agreement_date: dateValue || null });
      setEpsList((list) => list.map(e => e.id === dateEditingId ? { ...e, agreement_date: dateValue || null } : e));
      setIsDateDialogOpen(false);
      setDateEditingId(null);
      setDateValue("");
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-medical-800 mb-2">Gestión de EPS</h2>
        <p className="text-medical-600">Administra las EPS con convenio para prestación de servicios</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Resumen de Convenios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {epsList.filter(eps => Boolean(eps.has_agreement) && eps.status === "active").length}
              </div>
              <div className="text-sm text-green-700">EPS con Convenio Activo</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {epsList.filter(eps => !Boolean(eps.has_agreement)).length}
              </div>
              <div className="text-sm text-yellow-700">EPS sin Convenio</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {epsList.length}
              </div>
              <div className="text-sm text-blue-700">Total EPS Registradas</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>EPS Registradas</CardTitle>
              <CardDescription>Lista de EPS y estado de convenios</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar EPS
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Agregar Nueva EPS</DialogTitle>
                  <DialogDescription>
                    Ingrese la información de la nueva EPS
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="eps-name">Nombre de la EPS</Label>
                    <Input
                      id="eps-name"
                      value={epsForm.name}
                      onChange={(e) => setEpsForm({ ...epsForm, name: e.target.value })}
                      placeholder="Ej: Sanitas EPS"
                    />
                  </div>
                  <div>
                    <Label htmlFor="eps-code">Código</Label>
                    <Input
                      id="eps-code"
                      value={epsForm.code}
                      onChange={(e) => setEpsForm({ ...epsForm, code: e.target.value })}
                      placeholder="Ej: EPS001"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Estado</Label>
                      <p className="text-sm text-gray-600">¿La EPS está activa?</p>
                    </div>
                    <Switch
                      checked={epsForm.status === "active"}
                      onCheckedChange={(checked) => setEpsForm({ ...epsForm, status: checked ? "active" : "inactive" })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Tiene Convenio</Label>
                      <p className="text-sm text-gray-600">¿Existe convenio activo?</p>
                    </div>
                    <Switch 
                      checked={epsForm.hasAgreement}
                      onCheckedChange={(checked) => setEpsForm({ ...epsForm, hasAgreement: checked })}
                    />
                  </div>
                  {epsForm.hasAgreement && (
                    <div>
                      <Label htmlFor="agreement-date">Fecha del Convenio</Label>
                      <Input
                        id="agreement-date"
                        type="date"
                        value={epsForm.agreementDate}
                        onChange={(e) => setEpsForm({ ...epsForm, agreementDate: e.target.value })}
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="eps-notes">Notas</Label>
                    <Input
                      id="eps-notes"
                      value={epsForm.notes}
                      onChange={(e) => setEpsForm({ ...epsForm, notes: e.target.value })}
                      placeholder="Observaciones adicionales"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddEps}>
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
                <TableHead>EPS</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Convenio</TableHead>
                <TableHead>Fecha Convenio</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {epsList.map((eps) => (
                <TableRow key={eps.id}>
                  <TableCell className="font-medium">{eps.name}</TableCell>
                  <TableCell>{eps.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={eps.status === "active"}
                        onCheckedChange={() => toggleEpsStatus(eps.id)}
                      />
                      <Badge variant={eps.status === "active" ? "default" : "secondary"}>
                        {eps.status === "active" ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={Boolean(eps.has_agreement)}
                        onCheckedChange={() => toggleAgreement(eps.id)}
                      />
                      <Badge variant={Boolean(eps.has_agreement) ? "default" : "destructive"}>
                        {Boolean(eps.has_agreement) ? "Con Convenio" : "Sin Convenio"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{eps.agreement_date || "N/A"}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!Boolean(eps.has_agreement)}
                        onClick={() => openDateDialog(eps)}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        {eps.agreement_date ? "Cambiar" : "Asignar"}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{eps.notes || "Sin notas"}</TableCell>
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
                        onClick={() => handleDeleteEps(eps.id)}
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
          {/* Dialogo para asignar/editar fecha del convenio */}
          <Dialog open={isDateDialogOpen} onOpenChange={setIsDateDialogOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Fecha del Convenio</DialogTitle>
                <DialogDescription>Asigna o edita la fecha del convenio para esta EPS.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="agreement-date-edit">Fecha</Label>
                  <Input
                    id="agreement-date-edit"
                    type="date"
                    value={dateValue}
                    onChange={(e) => setDateValue(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDateDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={saveAgreementDate}>Guardar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default EpsManagement;
