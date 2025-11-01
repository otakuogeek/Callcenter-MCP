
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Plus, Edit, Trash2, Phone, Mail, Loader2, Key } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";

interface Doctor { id: number; name: string; email?: string; phone?: string; license_number: string; active: number | boolean; }

const DoctorManagement = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<number[]>([]);
  const [loadingSpecs, setLoadingSpecs] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<number[]>([]);
  const [loadingLocs, setLoadingLocs] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", license_number: "" });
  const { toast } = useToast();

  // Estado para el modal de contraseña
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordDoctor, setPasswordDoctor] = useState<Doctor | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [rows, specs, locs] = await Promise.all([
          api.getDoctors(),
          api.getSpecialties(),
          api.getLocations(),
        ]);
        setDoctors(rows);
        setSpecialties(specs);
        setLocations(locs);
      } catch (e: any) {
        toast({ title: "Error", description: e?.message || "No se pudieron cargar los datos", variant: "destructive" });
      }
    })();
  }, []);

  const handleSubmit = async () => {
    const name = formData.name.trim();
    const license = formData.license_number.trim();
    if (!name) { toast({ title: "Nombre requerido", description: "Ingresa el nombre del doctor", variant: "destructive" }); return; }
    if (!license) { toast({ title: "Registro requerido", description: "Ingresa el número de registro médico", variant: "destructive" }); return; }
    if (selectedSpecialties.length === 0) { toast({ title: "Especialidad requerida", description: "Selecciona al menos una especialidad", variant: "destructive" }); return; }
    
    try {
      if (editingDoctor) {
        const saved = await api.updateDoctor(editingDoctor.id, { ...formData, name, license_number: license, specialties: selectedSpecialties, locations: selectedLocations });
        setDoctors(prev => prev.map(d => d.id === editingDoctor.id ? { ...d, ...saved } : d));
        toast({ title: "Doctor actualizado", description: `Se guardaron los cambios de ${name}` });
      } else {
        const created = await api.createDoctor({ ...formData, name, license_number: license, specialties: selectedSpecialties, locations: selectedLocations });
        setDoctors(prev => [created, ...prev]);
        toast({ title: "Doctor creado", description: `Se agregó ${name}` });
      }
      setFormData({ name: "", email: "", phone: "", license_number: "" });
      setEditingDoctor(null);
      setSelectedSpecialties([]);
      setSelectedLocations([]);
      setIsDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || (editingDoctor ? 'No se pudo actualizar' : 'No se pudo crear'), variant: "destructive" });
    }
  };

  const handleEdit = (doctor: Doctor) => {
    setEditingDoctor(doctor);
    setFormData({
      name: doctor.name,
      email: doctor.email,
      phone: doctor.phone,
      license_number: String((doctor as any).license_number || ""),
    });
    // Cargar especialidades del doctor para preseleccionar
    setLoadingSpecs(true);
    api.getDoctorSpecialties(doctor.id)
      .then((rows) => setSelectedSpecialties(rows.map((r: any) => Number(r.id))))
      .finally(() => setLoadingSpecs(false));
    // Cargar ubicaciones del doctor para preseleccionar
    setLoadingLocs(true);
    api.getDoctorLocations(doctor.id)
      .then((rows) => setSelectedLocations(rows.map((r: any) => Number(r.id))))
      .finally(() => setLoadingLocs(false));
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const doctor = doctors.find(d => d.id === id);
    if (!doctor) return;
    const token = localStorage.getItem('token');
    if (!token) {
      toast({
        title: "No autenticado",
        description: "Debes iniciar sesión para eliminar doctores. Por favor, vuelve a loguearte.",
        variant: "destructive"
      });
      return;
    }
    if (!confirm(`¿Confirmas eliminar al doctor ${doctor.name}?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      await api.deleteDoctor(id);
      setDoctors(prev => prev.filter((d: any) => Number(d.id) !== Number(id)));
      toast({ title: "Doctor eliminado", description: `Se eliminó a ${doctor.name}` });
    } catch (e: any) {
      toast({ title: "Error al eliminar", description: e?.message || 'No se pudo eliminar el doctor', variant: "destructive" });
    }
  };

  const handleToggleStatus = async (doctor: Doctor) => {
    const newStatus = !Number(doctor.active);
    const action = newStatus ? "activar" : "desactivar";
    
    if (!confirm(`¿Confirmas ${action} al doctor ${doctor.name}?`)) return;
    
    try {
      await api.updateDoctor(doctor.id, { active: newStatus });
      setDoctors(prev => prev.map(d => 
        d.id === doctor.id ? { ...d, active: newStatus } : d
      ));
      toast({ 
        title: `Doctor ${newStatus ? 'activado' : 'desactivado'}`, 
        description: `${doctor.name} está ahora ${newStatus ? 'activo' : 'inactivo'}` 
      });
    } catch (e: any) {
      toast({ 
        title: "Error al cambiar estado", 
        description: e?.message || `No se pudo ${action} el doctor`, 
        variant: "destructive" 
      });
    }
  };

  const handleSetPassword = async () => {
    if (!passwordDoctor) return;
    
    // Validaciones
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Contraseña inválida",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive"
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Las contraseñas no coinciden",
        description: "Por favor verifica que ambas contraseñas sean iguales",
        variant: "destructive"
      });
      return;
    }

    setSettingPassword(true);

    try {
      const result = await api.setDoctorPassword(passwordDoctor.id, newPassword);
      
      toast({
        title: "Contraseña establecida",
        description: `${passwordDoctor.name} ahora puede acceder al panel de doctores`,
      });

      // Limpiar y cerrar el modal
      setNewPassword("");
      setConfirmPassword("");
      setPasswordDoctor(null);
      setIsPasswordDialogOpen(false);
    } catch (e: any) {
      toast({
        title: "Error al establecer contraseña",
        description: e?.message || "No se pudo establecer la contraseña",
        variant: "destructive"
      });
    } finally {
      setSettingPassword(false);
    }
  };

  const openPasswordDialog = (doctor: Doctor) => {
    setPasswordDoctor(doctor);
    setNewPassword("");
    setConfirmPassword("");
    setIsPasswordDialogOpen(true);
  };

  // Activación/inactivación podría manejarse desde API en una mejora futura.

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Gestión de Doctores
            </CardTitle>
            <CardDescription>
              Administra el personal médico y sus especialidades
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  setFormData({ name: "", email: "", phone: "", license_number: "" });
                  setEditingDoctor(null);
                  setSelectedSpecialties([]);
                  setSelectedLocations([]);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Doctor
              </Button>
            </DialogTrigger>
              <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingDoctor ? "Editar Doctor" : "Nuevo Doctor"}
                </DialogTitle>
                <DialogDescription>
                  {editingDoctor 
                    ? "Modifica los datos del doctor" 
                    : "Agrega un nuevo doctor al sistema"
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Dr. Juan Pérez"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="doctor@ips.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+57 300 123 4567"
                  />
                </div>
                {/* Especialidades del médico */}
                <div>
                  <Label>Especialidades</Label>
                  <div className="mt-2 border rounded-md p-3 max-h-60 overflow-auto">
                    {loadingSpecs ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {specialties.map((s) => {
                          const checked = selectedSpecialties.includes(Number(s.id));
                          return (
                            <label key={s.id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const isChecked = Boolean(v);
                                  setSelectedSpecialties((prev) =>
                                    isChecked ? [...prev, Number(s.id)] : prev.filter((id) => id !== Number(s.id))
                                  );
                                }}
                              />
                              <span>{s.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Seleccionadas: {selectedSpecialties.length}
                  </div>
                </div>
                {/* Ubicaciones del médico */}
                <div>
                  <Label>Ubicaciones donde atiende</Label>
                  <div className="mt-2 border rounded-md p-3 max-h-60 overflow-auto">
                    {loadingLocs ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {locations.map((l) => {
                          const checked = selectedLocations.includes(Number(l.id));
                          return (
                            <label key={l.id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const isChecked = Boolean(v);
                                  setSelectedLocations((prev) =>
                                    isChecked ? [...prev, Number(l.id)] : prev.filter((id) => id !== Number(l.id))
                                  );
                                }}
                              />
                              <span>{l.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Seleccionadas: {selectedLocations.length}
                  </div>
                </div>
                <div>
                  <Label htmlFor="license">Registro Médico</Label>
                  <Input
                    id="license"
          value={formData.license_number}
          onChange={(e) => setFormData({...formData, license_number: e.target.value})}
                    placeholder="MP12345"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit}>
                    {editingDoctor ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {doctors.map((doctor) => (
            <div key={doctor.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{doctor.name}</h3>
                    <Badge variant={Number(doctor.active) ? "default" : "secondary"}>
                      {Number(doctor.active) ? "Activo" : "Inactivo"}
                    </Badge>
                    {Array.isArray((doctor as any).specialties) && (doctor as any).specialties.length > 0 ? (
                      <>
                        <Badge variant="outline">{(doctor as any).specialties[0].name}</Badge>
                        {(doctor as any).specialties.length > 1 && (
                          <Badge variant="secondary">+{(doctor as any).specialties.length - 1} más</Badge>
                        )}
                      </>
                    ) : (
                      <Badge variant="secondary">Sin especialidad</Badge>
                    )}
                    {Array.isArray((doctor as any).locations) && (
                      (doctor as any).locations.length > 0 ? (
                        <>
                          <Badge variant="outline">{(doctor as any).locations[0].name}</Badge>
                          {(doctor as any).locations.length > 1 && (
                            <Badge variant="secondary">+{(doctor as any).locations.length - 1} sedes</Badge>
                          )}
                        </>
                      ) : (
                        <Badge variant="secondary">Sin sede</Badge>
                      )
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      <span>{doctor.email}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      <span>{doctor.phone}</span>
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    Registro: {(doctor as any).license_number}
                  </div>
                  {/* Especialidades adicionales ya se indican con "+N más" en el encabezado. */}
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={Number(doctor.active) === 1}
                      onCheckedChange={() => handleToggleStatus(doctor)}
                    />
                    <span className="text-sm text-gray-500">
                      {Number(doctor.active) ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleEdit(doctor)}
                    title="Editar doctor"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openPasswordDialog(doctor)}
                    title="Gestionar contraseña para acceso al panel"
                  >
                    <Key className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDelete(doctor.id)}
                    title="Eliminar doctor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Modal para establecer/cambiar contraseña */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Gestionar Contraseña de Acceso
            </DialogTitle>
            <DialogDescription>
              {passwordDoctor && (
                <>
                  Establece la contraseña para <strong>{passwordDoctor.name}</strong> para acceder al panel de doctores en{" "}
                  <a 
                    href="https://biosanarcall.site/doctor-login" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    biosanarcall.site/doctor-login
                  </a>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="newPassword">Nueva Contraseña</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                disabled={settingPassword}
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                disabled={settingPassword}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
              <p className="font-medium mb-1">ℹ️ Información importante:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>La contraseña debe tener al menos 6 caracteres</li>
                <li>El doctor usará su email ({passwordDoctor?.email || 'configurar email'}) para iniciar sesión</li>
                <li>Puede cambiar la contraseña en cualquier momento</li>
              </ul>
            </div>

            {/* Opción rápida para resetear a contraseña temporal */}
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Opción rápida:</strong> Establecer contraseña temporal
              </p>
              <Button 
                variant="secondary"
                size="sm"
                onClick={() => {
                  setNewPassword("temp123");
                  setConfirmPassword("temp123");
                }}
                disabled={settingPassword}
                className="w-full"
              >
                Usar contraseña temporal: <code className="ml-1 bg-gray-200 px-1 rounded">temp123</code>
              </Button>
            </div>

            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsPasswordDialogOpen(false);
                  setNewPassword("");
                  setConfirmPassword("");
                  setPasswordDoctor(null);
                }}
                disabled={settingPassword}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSetPassword}
                disabled={settingPassword || !newPassword || !confirmPassword}
              >
                {settingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Establecer Contraseña
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default DoctorManagement;
