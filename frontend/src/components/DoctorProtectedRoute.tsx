import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { hasDoctorSession } from "@/lib/authStorage";

interface DoctorProtectedRouteProps {
  children: ReactNode;
}

const DoctorProtectedRoute = ({ children }: DoctorProtectedRouteProps) => {
  const isAuthenticated = hasDoctorSession();
  
  if (!isAuthenticated) {
    return <Navigate to="/doctor-login" replace />;
  }
  
  return <>{children}</>;
};

export default DoctorProtectedRoute;
