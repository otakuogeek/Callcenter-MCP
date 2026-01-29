import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";
import { jwtDecode } from "jwt-decode";

export interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any | null;
  onUserUpdated: (payload: any) => Promise<void> | void;
}

const EditUserModal = ({ isOpen, onClose, user, onUserUpdated }: EditUserModalProps) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    role: "agent",
    status: "Activo",
    password: "",
  });
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        const role = decoded.role || '';
        setCurrentUserRole(role);
        setIsSuperAdmin(role === 'superadmin');
      } catch (e) {
        console.error('Error decoding token:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        department: user.department || "",
        role: user.role || "agent",
        status: user.status || "Activo",
        password: "",
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const payload: any = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone || null,
      department: formData.department || null,
      role: formData.role,
      status: formData.status,
    };
    if (formData.password) payload.password = formData.password;
    await onUserUpdated(payload);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
          <DialogDescription>Actualiza la información del usuario del sistema</DialogDescription>
        </DialogHeader>
        
        {user?.role === 'superadmin' && !isSuperAdmin && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              No tienes permisos para editar un Super Administrador
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre Completo</Label>
            <Input 
              id="name" 
              value={formData.name} 
              onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
              disabled={user?.role === 'superadmin' && !isSuperAdmin}
            />
          </div>
          <div>
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input 
              id="email" 
              type="email" 
              value={formData.email} 
              onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
              disabled={user?.role === 'superadmin' && !isSuperAdmin}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <Input 
                id="phone" 
                value={formData.phone} 
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                disabled={user?.role === 'superadmin' && !isSuperAdmin}
              />
            </div>
            <div>
              <Label htmlFor="department">Departamento</Label>
              <Input 
                id="department" 
                value={formData.department} 
                onChange={(e) => setFormData({ ...formData, department: e.target.value })} 
                disabled={user?.role === 'superadmin' && !isSuperAdmin}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Rol</Label>
              <Select 
                value={formData.role} 
                onValueChange={(v) => setFormData({ ...formData, role: v })}
                disabled={user?.role === 'superadmin' && !isSuperAdmin}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona rol" /></SelectTrigger>
                <SelectContent>
                  {isSuperAdmin && <SelectItem value="superadmin">Super Admin</SelectItem>}
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="agent">Agente</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="reception">Recepcionista</SelectItem>
                </SelectContent>
              </Select>
              {formData.role === 'superadmin' && (
                <p className="text-xs text-orange-600 mt-1">⚠️ Acceso total al sistema</p>
              )}
            </div>
            <div>
              <Label>Estado</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v) => setFormData({ ...formData, status: v })}
                disabled={user?.role === 'superadmin' && !isSuperAdmin}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="password">Nueva Contraseña (opcional)</Label>
            <Input 
              id="password" 
              type="password" 
              value={formData.password} 
              onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
              placeholder="Dejar en blanco para no cambiar" 
              disabled={user?.role === 'superadmin' && !isSuperAdmin}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button 
              type="submit" 
              disabled={user?.role === 'superadmin' && !isSuperAdmin}
            >
              Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserModal;
