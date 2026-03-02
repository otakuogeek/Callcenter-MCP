
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { SessionProvider } from "./SessionProvider";
import { hasAdminSession } from "@/lib/authStorage";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const isAuthenticated = hasAdminSession();
  
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  
  // Envolver con SessionProvider para auto-logout por inactividad
  return <SessionProvider>{children}</SessionProvider>;
};

export default ProtectedRoute;
