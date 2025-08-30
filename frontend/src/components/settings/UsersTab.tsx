
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import UserTable from "@/components/UserTable";
import AddUserModal from "@/components/AddUserModal";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import EditUserModal from "@/components/EditUserModal";

interface User { id: number; name: string; email: string; role: string; phone?: string | null; department?: string | null; status: string; created_at?: string }

const UsersTab = () => {
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getUsers();
        if (!cancelled) setUsers(data as any);
      } catch (e: any) {
        toast({ title: "Error", description: e.message || "No se pudieron cargar los usuarios", variant: "destructive" });
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const handleAddUser = async (newUser: any) => {
    try {
      const created = await api.createUser({
        name: newUser.name,
        email: newUser.email,
        role: newUser.role || 'agent',
        status: 'Activo',
        phone: newUser.phone || null,
        department: newUser.department || null,
        password: newUser.password || 'Cambiar123!'
      });
      setUsers(prev => [created, ...prev]);
      toast({ title: "Usuario agregado", description: "El usuario ha sido agregado exitosamente" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "No se pudo crear el usuario", variant: "destructive" });
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setIsEditOpen(true);
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      await api.deleteUser(userId);
      setUsers(prev => prev.filter(user => user.id !== userId));
      toast({ title: "Usuario eliminado", description: "El usuario ha sido eliminado del sistema" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "No se pudo eliminar el usuario", variant: "destructive" });
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Usuarios</CardTitle>
          <CardDescription>Administra los usuarios del sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold">Usuarios Activos ({users.length})</h3>
                <Button onClick={() => setIsAddUserModalOpen(true)} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Agregar Usuario
                </Button>
              </div>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar usuarios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
            </div>
            
            <UserTable 
              users={filteredUsers.map(u => ({
                ...u,
                createdAt: (u as any).created_at ? new Date((u as any).created_at).toLocaleDateString() : '—',
                phone: u.phone || undefined,
                department: u.department || undefined,
              })) as any}
              onEditUser={handleEditUser}
              onDeleteUser={handleDeleteUser}
            />
          </div>
        </CardContent>
      </Card>

      <EditUserModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        user={editingUser}
        onUserUpdated={async (payload) => {
          if (!editingUser) return;
          try {
            const updated = await api.updateUser(editingUser.id, payload);
            setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...updated } : u));
            toast({ title: "Usuario actualizado", description: "Los cambios fueron guardados" });
          } catch (e: any) {
            toast({ title: "Error", description: e.message || "No se pudo actualizar el usuario", variant: "destructive" });
          }
        }}
      />

      <AddUserModal 
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onUserAdded={handleAddUser}
      />
    </>
  );
};

export default UsersTab;
