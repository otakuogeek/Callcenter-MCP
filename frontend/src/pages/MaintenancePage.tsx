import { AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg border-t-4 border-t-blue-600">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Sistema en Mantenimiento</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3 text-left">
            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              Estamos realizando mejoras importantes en nuestra plataforma para brindarte un mejor servicio.
            </p>
          </div>
          
          <p className="text-gray-600">
            El portal de pacientes no está disponible temporalmente. Por favor intenta acceder nuevamente más tarde.
          </p>

          <div className="pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Si tienes una urgencia médica, por favor comunícate a nuestras líneas de atención telefónica o acude al centro médico más cercano.
            </p>
          </div>
          
          <div className="text-xs text-gray-400 pt-2">
            &copy; {new Date().getFullYear()} Fundación Biosanar IPS
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
