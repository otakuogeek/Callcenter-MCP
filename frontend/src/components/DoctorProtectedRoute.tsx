import { ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface DoctorProtectedRouteProps {
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

// Función para verificar si el token es de tipo doctor
function isDoctorToken(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.type === 'doctor';
  } catch {
    return false;
  }
}

const DoctorProtectedRoute = ({ children }: DoctorProtectedRouteProps) => {
  const token = localStorage.getItem("doctorToken");
  
  // Verificar si hay token, si no está expirado y si es de tipo doctor
  const isAuthenticated = token && !isTokenExpired(token) && isDoctorToken(token);
  
  // Si el token está expirado o no es válido, limpiar localStorage
  if (token && (isTokenExpired(token) || !isDoctorToken(token))) {
    localStorage.removeItem("doctorToken");
    localStorage.removeItem("doctor");
    localStorage.removeItem("isDoctorAuthenticated");
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/doctor-login" replace />;
  }
  
  return <>{children}</>;
};

export default DoctorProtectedRoute;
