
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { clearAdminSession } from "@/lib/authStorage";

const LogoutButton = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = () => {
    clearAdminSession();
    localStorage.removeItem("userEmail");
    
    toast({
      title: "Sesión cerrada",
      description: "Ha cerrado sesión exitosamente",
    });
    
    navigate("/admin/login");
  };

  return (
    <Button
      variant="outline"
      onClick={handleLogout}
      className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
    >
      <LogOut className="w-4 h-4 mr-2" />
      Cerrar Sesión
    </Button>
  );
};

export default LogoutButton;
