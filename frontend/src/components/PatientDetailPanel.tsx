import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
// Separator import removed - unused
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User, Phone, Mail, Calendar, Shield, Heart,
  FileText, Pill, AlertTriangle, Activity, Clock,
  Stethoscope, Droplets, History, AlertCircle,
  Clipboard, ArrowLeft
} from "lucide-react";
import { formatDateColombia, formatFullDateColombia } from "@/utils/dateHelpers";

interface PatientDetailPanelProps {
  patientId: number;
  getPatientHistory: (patientId: number) => Promise<any>;
  onCreateRecord?: (patientId: number, patientName: string) => void;
  onClose?: () => void;
}

const PatientDetailPanel = ({ patientId, getPatientHistory, onCreateRecord, onClose }: PatientDetailPanelProps) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [patientId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getPatientHistory(patientId);
      setData(result);
    } catch (err: any) {
      setError(err.message || "Error al cargar historial");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      return formatDateColombia(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00') || dateStr;
    } catch {
      return dateStr;
    }
  };

  const formatDateLong = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      return formatFullDateColombia(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00') || dateStr;
    } catch {
      return dateStr;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "Mortal": return "bg-red-600 text-white";
      case "Severa": return "bg-red-500 text-white";
      case "Moderada": return "bg-orange-500 text-white";
      case "Leve": return "bg-yellow-500 text-white";
      default: return "bg-gray-400 text-white";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Activo": return "bg-red-100 text-red-800";
      case "Controlado": return "bg-green-100 text-green-800";
      case "Curado": return "bg-blue-100 text-blue-800";
      case "Inactivo": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Cargando historial del paciente...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <p className="text-red-500">{error || "No se pudo cargar la información"}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={loadHistory}>
          Reintentar
        </Button>
      </div>
    );
  }

  const { patient, medicalRecords = [], allergies = [], medications = [], medicalHistory = [] } = data;

  return (
    <div className="space-y-4">
      {/* Header del paciente */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <User className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{patient.name}</h2>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5" />
                  {patient.document}
                </span>
                {patient.age != null && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {patient.age} años
                  </span>
                )}
                {patient.gender && (
                  <Badge variant="outline" className="text-xs">
                    {patient.gender}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Volver
              </Button>
            )}
            {onCreateRecord && (
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => onCreateRecord(patient.id, patient.name)}>
                <FileText className="h-4 w-4 mr-1" /> Nueva Historia
              </Button>
            )}
          </div>
        </div>

        {/* Info badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-white/70 rounded-lg p-2.5 flex items-center gap-2">
            <Phone className="h-4 w-4 text-green-600" />
            <span className="text-sm">{patient.phone || "Sin teléfono"}</span>
          </div>
          <div className="bg-white/70 rounded-lg p-2.5 flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-600" />
            <span className="text-sm truncate">{patient.email || "Sin email"}</span>
          </div>
          <div className="bg-white/70 rounded-lg p-2.5 flex items-center gap-2">
            <Heart className="h-4 w-4 text-red-500" />
            <span className="text-sm">{patient.eps_name || "Sin EPS"}</span>
          </div>
          <div className="bg-white/70 rounded-lg p-2.5 flex items-center gap-2">
            <Droplets className="h-4 w-4 text-red-600" />
            <span className="text-sm">{patient.blood_group || "Sin grupo"}</span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-4 mt-3">
          <Badge variant="outline" className="bg-white/60 text-xs py-1">
            <FileText className="h-3 w-3 mr-1" />
            {medicalRecords.length} consultas registradas
          </Badge>
          <Badge variant="outline" className="bg-white/60 text-xs py-1">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {allergies.length} alergias
          </Badge>
          <Badge variant="outline" className="bg-white/60 text-xs py-1">
            <Pill className="h-3 w-3 mr-1" />
            {medications.length} medicamentos activos
          </Badge>
        </div>
      </div>

      {/* Tabs de contenido */}
      <Tabs defaultValue="records" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="records" className="flex items-center gap-1 text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Consultas</span>
            <Badge variant="secondary" className="ml-1 text-xs h-5">{medicalRecords.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="allergies" className="flex items-center gap-1 text-xs sm:text-sm">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Alergias</span>
            <Badge variant="secondary" className="ml-1 text-xs h-5">{allergies.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="medications" className="flex items-center gap-1 text-xs sm:text-sm">
            <Pill className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Medicamentos</span>
            <Badge variant="secondary" className="ml-1 text-xs h-5">{medications.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1 text-xs sm:text-sm">
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Antecedentes</span>
            <Badge variant="secondary" className="ml-1 text-xs h-5">{medicalHistory.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Consultas / Historias Clínicas */}
        <TabsContent value="records" className="mt-3">
          <ScrollArea className="h-[400px] pr-2">
            {medicalRecords.length > 0 ? (
              <div className="space-y-3">
                {medicalRecords.map((record: any, idx: number) => (
                  <Card key={record.id || idx} className="border-l-4 border-l-blue-400 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-blue-600" />
                          <span className="font-semibold text-sm">{formatDateLong(record.visit_date)}</span>
                          <Badge variant="outline" className="text-xs">{record.visit_type}</Badge>
                          <Badge className={`text-xs ${record.status === 'Completa' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {record.status}
                          </Badge>
                        </div>
                      </div>
                      {record.doctor_name && (
                        <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                          <Stethoscope className="h-3 w-3" /> Dr/a. {record.doctor_name}
                        </p>
                      )}
                      {record.chief_complaint && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-gray-500 uppercase">Motivo de consulta</p>
                          <p className="text-sm text-gray-800">{record.chief_complaint}</p>
                        </div>
                      )}
                      {record.diagnosis && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-gray-500 uppercase">Diagnóstico</p>
                          <p className="text-sm text-gray-800 font-medium">{record.diagnosis}</p>
                        </div>
                      )}
                      {record.treatment_plan && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-gray-500 uppercase">Tratamiento</p>
                          <p className="text-sm text-gray-700">{record.treatment_plan}</p>
                        </div>
                      )}
                      {record.prescriptions && (
                        <div className="bg-orange-50 rounded-lg p-2 mt-2">
                          <p className="text-xs font-medium text-orange-700 uppercase flex items-center gap-1">
                            <Pill className="h-3 w-3" /> Prescripciones
                          </p>
                          <p className="text-sm text-orange-900 whitespace-pre-line">{record.prescriptions}</p>
                        </div>
                      )}
                      {record.vital_signs && (() => {
                        const vs = typeof record.vital_signs === 'string' ? JSON.parse(record.vital_signs) : record.vital_signs;
                        const hasData = Object.values(vs).some((v: any) => v && v !== '');
                        if (!hasData) return null;
                        return (
                          <div className="bg-blue-50 rounded-lg p-2 mt-2">
                            <p className="text-xs font-medium text-blue-700 uppercase flex items-center gap-1 mb-1">
                              <Activity className="h-3 w-3" /> Signos Vitales
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs">
                              {vs.temperature && <span className="bg-white px-2 py-0.5 rounded">T: {vs.temperature}°C</span>}
                              {vs.systolic_bp && vs.diastolic_bp && <span className="bg-white px-2 py-0.5 rounded">PA: {vs.systolic_bp}/{vs.diastolic_bp}</span>}
                              {vs.heart_rate && <span className="bg-white px-2 py-0.5 rounded">FC: {vs.heart_rate} lpm</span>}
                              {vs.respiratory_rate && <span className="bg-white px-2 py-0.5 rounded">FR: {vs.respiratory_rate} rpm</span>}
                              {vs.oxygen_saturation && <span className="bg-white px-2 py-0.5 rounded">SpO2: {vs.oxygen_saturation}%</span>}
                              {vs.weight && <span className="bg-white px-2 py-0.5 rounded">Peso: {vs.weight} kg</span>}
                              {vs.height && <span className="bg-white px-2 py-0.5 rounded">Talla: {vs.height} cm</span>}
                            </div>
                          </div>
                        );
                      })()}
                      {record.follow_up_date && (
                        <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Seguimiento: {formatDate(record.follow_up_date)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No hay consultas registradas</p>
                <p className="text-gray-400 text-sm mt-1">Las historias clínicas aparecerán aquí</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Alergias */}
        <TabsContent value="allergies" className="mt-3">
          <ScrollArea className="h-[400px] pr-2">
            {allergies.length > 0 ? (
              <div className="space-y-3">
                {allergies.map((allergy: any, idx: number) => (
                  <Card key={allergy.id || idx} className="border-l-4 border-l-red-400">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="font-semibold">{allergy.allergen}</span>
                            <Badge variant="outline" className="text-xs">{allergy.allergy_type}</Badge>
                            <Badge className={`text-xs ${getSeverityColor(allergy.severity)}`}>
                              {allergy.severity}
                            </Badge>
                          </div>
                          {allergy.reaction && (
                            <p className="text-sm text-gray-600 ml-6">Reacción: {allergy.reaction}</p>
                          )}
                          {allergy.notes && (
                            <p className="text-xs text-gray-500 ml-6 mt-1">{allergy.notes}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Sin alergias registradas</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Medicamentos */}
        <TabsContent value="medications" className="mt-3">
          <ScrollArea className="h-[400px] pr-2">
            {medications.length > 0 ? (
              <div className="space-y-3">
                {medications.map((med: any, idx: number) => (
                  <Card key={med.id || idx} className="border-l-4 border-l-orange-400">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Pill className="h-4 w-4 text-orange-600" />
                        <span className="font-semibold">{med.medication_name}</span>
                        <Badge className={`text-xs ${med.status === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {med.status}
                        </Badge>
                      </div>
                      <div className="ml-6 space-y-0.5 text-sm text-gray-600">
                        {med.dosage && <p>Dosis: {med.dosage}</p>}
                        {med.frequency && <p>Frecuencia: {med.frequency}</p>}
                        {med.route && <p>Vía: {med.route}</p>}
                        {med.reason && <p className="text-gray-500 text-xs mt-1">Motivo: {med.reason}</p>}
                        <div className="flex gap-3 text-xs text-gray-400 mt-1">
                          {med.start_date && <span>Inicio: {formatDate(med.start_date)}</span>}
                          {med.end_date && <span>Fin: {formatDate(med.end_date)}</span>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <Pill className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Sin medicamentos activos registrados</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Antecedentes */}
        <TabsContent value="history" className="mt-3">
          <ScrollArea className="h-[400px] pr-2">
            {medicalHistory.length > 0 ? (
              <div className="space-y-3">
                {medicalHistory.map((hist: any, idx: number) => (
                  <Card key={hist.id || idx} className="border-l-4 border-l-purple-400">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Clipboard className="h-4 w-4 text-purple-600" />
                        <span className="font-semibold">{hist.condition_name}</span>
                        <Badge variant="outline" className="text-xs">{hist.history_type}</Badge>
                        <Badge className={`text-xs ${getStatusColor(hist.current_status)}`}>
                          {hist.current_status}
                        </Badge>
                      </div>
                      <div className="ml-6 text-sm text-gray-600 space-y-0.5">
                        {hist.description && <p>{hist.description}</p>}
                        {hist.treatment && <p className="text-xs text-gray-500">Tratamiento: {hist.treatment}</p>}
                        {hist.diagnosis_date && (
                          <p className="text-xs text-gray-400">Diagnosticado: {formatDate(hist.diagnosis_date)}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <History className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Sin antecedentes registrados</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PatientDetailPanel;
