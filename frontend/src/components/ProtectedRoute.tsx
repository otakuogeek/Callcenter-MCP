
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: ReactNode;
}

// Función para verificar si un token JWT está expirado
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convertir a milisegundos
    return Date.now() >= exp;
  } catch {
    return true; // Si no se puede decodificar, considerarlo expirado
  }
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const token = localStorage.getItem("token");
  
  // Verificar si hay token y si no está expirado
  const isAuthenticated = token && !isTokenExpired(token);
  
  // Si el token está expirado, limpiar localStorage
  if (token && isTokenExpired(token)) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

export default ProtectedRoute;
