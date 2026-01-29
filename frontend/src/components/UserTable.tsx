
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2, MoreHorizontal, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { jwtDecode } from "jwt-decode";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string;
  department: string;
  status: string;
  createdAt: string;
}

interface UserTableProps {
  users: User[];
  onEditUser: (user: User) => void;
  onDeleteUser: (userId: number) => void;
}

const UserTable = ({ users, onEditUser, onDeleteUser }: UserTableProps) => {
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        setCurrentUserRole(decoded.role || '');
      } catch (e) {
        console.error('Error decoding token:', e);
      }
    }
  }, []);

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "superadmin":
        return "destructive";
      case "admin":
        return "destructive";
      case "supervisor":
        return "default";
      case "agent":
        return "secondary";
      case "doctor":
        return "default";
      default:
        return "outline";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "superadmin":
        return "Super Admin";
      case "admin":
        return "Administrador";
      case "agent":
        return "Agente";
      case "supervisor":
        return "Supervisor";
      case "doctor":
        return "Doctor";
      case "reception":
        return "Recepcionista";
      default:
        return role;
    }
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Departamento</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha de Creación</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                No hay usuarios registrados
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => {
              const isSuperAdmin = user.role === 'superadmin';
              const canEdit = currentUserRole === 'superadmin' || !isSuperAdmin;
              
              return (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {user.name}
                    {isSuperAdmin && <ShieldCheck className="h-4 w-4 text-orange-600" title="Super Administrador" />}
                  </div>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={getRoleBadgeVariant(user.role)} className={isSuperAdmin ? "bg-gradient-to-r from-orange-500 to-red-600" : ""}>
                    {getRoleLabel(user.role)}
                  </Badge>
                </TableCell>
                <TableCell>{user.department || "N/A"}</TableCell>
                <TableCell>{user.phone || "N/A"}</TableCell>
                <TableCell>
                  <Badge variant={user.status === "Activo" ? "default" : "secondary"}>
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell>{user.createdAt}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => onEditUser(user)}
                        disabled={!canEdit}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => onDeleteUser(user.id)}
                        className="text-red-600"
                        disabled={!canEdit}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default UserTable;
