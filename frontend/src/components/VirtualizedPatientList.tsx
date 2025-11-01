import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Clock, Phone, FileText, CheckCircle, Trash2, PhoneCall } from "lucide-react";

interface PatientItemProps {
  item: any;
  sectionSpecialtyName: string;
  sectionSpecialtyId: number;
  isMultipleRequests: boolean;
  requestCount: number;
  changingPriorityId: number | null;
  callingPatientId: number | null;
  loadingItemId: number | null;
  deletingItemId: number | null;
  loading: boolean;
  handleChangePriority: (id: number, priority: string) => void;
  handleCallPatient: (item: any, section: any) => void;
  handleOpenCupsDialog: (item: any) => void;
  handleAssignFromQueue: (item: any) => void;
  handleDeleteFromQueue: (item: any) => void;
  formatWaitTime: (date: string) => string;
  formatRequestDateTime: (date: string) => string;
  calculateAge: (birthDate: string) => string;
}

const PatientCard = ({
  item,
  sectionSpecialtyName,
  sectionSpecialtyId,
  isMultipleRequests,
  requestCount,
  changingPriorityId,
  callingPatientId,
  loadingItemId,
  deletingItemId,
  loading,
  handleChangePriority,
  handleCallPatient,
  handleOpenCupsDialog,
  handleAssignFromQueue,
  handleDeleteFromQueue,
  formatWaitTime,
  formatRequestDateTime,
  calculateAge,
}: PatientItemProps) => {
  return (
    <div 
      className={`flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-all ${
        isMultipleRequests 
          ? 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100' 
          : 'hover:bg-medical-50'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 bg-medical-100 rounded-full flex items-center justify-center text-medical-700 font-semibold">
          {item.queue_position}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold">{item.patient_name}</span>
            {/* Badge de prioridad clickeable */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Badge 
                  variant={item.priority_level === "Urgente" || item.priority_level === "Alta" ? "destructive" : item.priority_level === "Normal" ? "default" : "secondary"}
                  className="text-xs cursor-pointer hover:opacity-80 transition-opacity"
                  title="Click para cambiar prioridad"
                >
                  {changingPriorityId === item.id ? "..." : item.priority_level}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem 
                  onClick={() => handleChangePriority(item.id, 'Urgente')}
                  disabled={changingPriorityId === item.id || item.priority_level === 'Urgente'}
                  className="text-red-600 font-semibold"
                >
                  🔴 Urgente
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleChangePriority(item.id, 'Alta')}
                  disabled={changingPriorityId === item.id || item.priority_level === 'Alta'}
                  className="text-orange-600 font-semibold"
                >
                  🟠 Alta
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleChangePriority(item.id, 'Normal')}
                  disabled={changingPriorityId === item.id || item.priority_level === 'Normal'}
                  className="text-blue-600"
                >
                  🔵 Normal
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleChangePriority(item.id, 'Baja')}
                  disabled={changingPriorityId === item.id || item.priority_level === 'Baja'}
                  className="text-gray-600"
                >
                  ⚪ Baja
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Badge especial para reagendamientos */}
            {item.call_type === 'reagendar' && (
              <Badge 
                className="text-xs bg-black text-yellow-400 hover:bg-black/90 font-bold"
              >
                ⚡ Reagendar
              </Badge>
            )}
            {/* Badge para pacientes con múltiples solicitudes */}
            {isMultipleRequests && (
              <Badge 
                className="text-xs bg-yellow-500 text-black hover:bg-yellow-600 font-bold"
              >
                📋 {requestCount} solicitudes
              </Badge>
            )}
          </div>
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <Phone className="w-3 h-3" />
            {item.patient_phone} • Doc: {item.patient_document}
            {item.patient_gender && item.patient_gender !== 'No especificado' && (
              <span className="ml-2">
                • {item.patient_gender === 'Masculino' ? '♂ Masculino' : item.patient_gender === 'Femenino' ? '♀ Femenino' : item.patient_gender}
              </span>
            )}
            {item.birth_date && (
              <span className="ml-2 text-medical-600 font-medium">
                • {calculateAge(item.birth_date)}
              </span>
            )}
          </div>
          {/* EPS del paciente */}
          {item.eps_name && (
            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <span className="font-semibold">EPS:</span> {item.eps_name}
            </div>
          )}
          {/* Motivo de la consulta */}
          <div className="text-xs text-gray-500 mt-1">
            {item.reason ? item.reason : 'Sin motivo especificado'}
          </div>
          {/* Información del servicio CUPS */}
          {item.cups_code && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs font-mono">
                {item.cups_code}
              </Badge>
              <span className="text-xs text-medical-700 font-medium">
                {item.cups_name}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="font-mono text-warning-600 font-semibold">
            {formatWaitTime(item.created_at)}
          </div>
          <div className="text-xs text-gray-500">
            Esperando
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Fecha {formatRequestDateTime(item.created_at)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Dr. {item.doctor_name}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => handleCallPatient(item, { specialty_name: sectionSpecialtyName, specialty_id: sectionSpecialtyId })}
            disabled={callingPatientId === item.id}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            title="Llamar con ElevenLabs"
          >
            {callingPatientId === item.id ? (
              <Clock className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <PhoneCall className="w-4 h-4 mr-1" />
            )}
            {callingPatientId === item.id ? 'Llamando...' : 'Llamar'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenCupsDialog(item)}
            disabled={loading || loadingItemId === item.id || deletingItemId === item.id}
            title={item.cups_code ? "Cambiar CUPS" : "Asignar CUPS"}
          >
            <FileText className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAssignFromQueue({ ...item, specialty_name: sectionSpecialtyName, specialty_id: sectionSpecialtyId })}
            disabled={loading || loadingItemId === item.id || deletingItemId === item.id}
            className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700"
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            {loadingItemId === item.id ? 'Asignando...' : 'Asignar'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleDeleteFromQueue({ ...item, specialty_name: sectionSpecialtyName, specialty_id: sectionSpecialtyId })}
            disabled={loading || loadingItemId === item.id || deletingItemId === item.id}
            title="Eliminar de la cola"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

interface VirtualizedPatientListProps {
  patients: any[];
  sectionSpecialtyName: string;
  sectionSpecialtyId: number;
  hasMultipleRequests: (doc: string) => boolean;
  getDuplicateRequestsCount: (doc: string) => number;
  changingPriorityId: number | null;
  callingPatientId: number | null;
  loadingItemId: number | null;
  deletingItemId: number | null;
  loading: boolean;
  handleChangePriority: (id: number, priority: string) => void;
  handleCallPatient: (item: any, section: any) => void;
  handleOpenCupsDialog: (item: any) => void;
  handleAssignFromQueue: (item: any) => void;
  handleDeleteFromQueue: (item: any) => void;
  formatWaitTime: (date: string) => string;
  formatRequestDateTime: (date: string) => string;
  calculateAge: (birthDate: string) => string;
}

export const VirtualizedPatientList = ({
  patients,
  sectionSpecialtyName,
  sectionSpecialtyId,
  hasMultipleRequests,
  getDuplicateRequestsCount,
  changingPriorityId,
  callingPatientId,
  loadingItemId,
  deletingItemId,
  loading,
  handleChangePriority,
  handleCallPatient,
  handleOpenCupsDialog,
  handleAssignFromQueue,
  handleDeleteFromQueue,
  formatWaitTime,
  formatRequestDateTime,
  calculateAge,
}: VirtualizedPatientListProps) => {
  // Si patients es undefined, significa que aún no se ha cargado (lazy loading)
  if (patients === undefined) {
    return (
      <div className="text-sm text-medical-600 italic py-4 text-center flex items-center justify-center gap-2">
        <Clock className="w-4 h-4 animate-spin" />
        Cargando pacientes...
      </div>
    );
  }

  // Si patients es un array vacío, realmente no hay pacientes
  if (patients.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic py-4 text-center">
        No hay pacientes en espera
      </div>
    );
  }

  // Renderizar directamente sin virtualización para evitar problemas de minificación
  return (
    <div className="space-y-3">
      {patients.map((item, index) => {
        const isMultiple = hasMultipleRequests(item.patient_document);
        const reqCount = getDuplicateRequestsCount(item.patient_document);
        
        return (
          <PatientCard
            key={item.id || index}
            item={item}
            sectionSpecialtyName={sectionSpecialtyName}
            sectionSpecialtyId={sectionSpecialtyId}
            isMultipleRequests={isMultiple}
            requestCount={reqCount}
            changingPriorityId={changingPriorityId}
            callingPatientId={callingPatientId}
            loadingItemId={loadingItemId}
            deletingItemId={deletingItemId}
            loading={loading}
            handleChangePriority={handleChangePriority}
            handleCallPatient={handleCallPatient}
            handleOpenCupsDialog={handleOpenCupsDialog}
            handleAssignFromQueue={handleAssignFromQueue}
            handleDeleteFromQueue={handleDeleteFromQueue}
            formatWaitTime={formatWaitTime}
            formatRequestDateTime={formatRequestDateTime}
            calculateAge={calculateAge}
          />
        );
      })}
    </div>
  );
};
