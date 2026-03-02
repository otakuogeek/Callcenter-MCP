import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// Tabs import removed - unused
import {
  FileText, Calendar, User, Shield, Stethoscope, Pill, Activity,
  Search, Filter, Eye, Clock, AlertCircle, Heart, Clipboard
} from "lucide-react";
import { formatDateColombia, formatFullDateColombia } from "@/utils/dateHelpers";

interface DoctorMyRecordsProps {
  getMyMedicalRecords: (filters?: { patient_id?: number; status?: string; limit?: number; offset?: number }) => Promise<any[]>;
}

const DoctorMyRecords = ({ getMyMedicalRecords }: DoctorMyRecordsProps) => {
  const [records, setRecords] = useState<any[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [records, statusFilter, searchText]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await getMyMedicalRecords({ limit: 100 });
      setRecords(data);
    } catch (err) {
      console.error("Error loading records:", err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...records];
    if (statusFilter !== "all") {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    if (searchText.length >= 2) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter(r =>
        r.patient_name?.toLowerCase().includes(lower) ||
        r.patient_document?.includes(searchText) ||
        r.diagnosis?.toLowerCase().includes(lower) ||
        r.chief_complaint?.toLowerCase().includes(lower)
      );
    }
    setFilteredRecords(filtered);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      return formatFullDateColombia(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00') || dateStr;
    } catch {
      return dateStr;
    }
  };

  const formatDateShort = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      return formatDateColombia(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00') || dateStr;
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Cargando historias clínicas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar por paciente, cédula, diagnóstico..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-10 h-10 border-blue-200"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-10 border-blue-200">
            <Filter className="h-4 w-4 mr-1" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Completa">Completas</SelectItem>
            <SelectItem value="Borrador">Borradores</SelectItem>
            <SelectItem value="Archivada">Archivadas</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="h-10 px-4 flex items-center text-sm">
          {filteredRecords.length} registros
        </Badge>
      </div>

      {/* Records list */}
      <ScrollArea className="h-[550px] pr-2">
        {filteredRecords.length > 0 ? (
          <div className="space-y-3">
            {filteredRecords.map((record, idx) => (
              <Card
                key={record.id || idx}
                className={`hover:shadow-md transition-all cursor-pointer border-l-4 ${
                  record.status === 'Completa' ? 'border-l-green-400' :
                  record.status === 'Borrador' ? 'border-l-yellow-400' : 'border-l-gray-400'
                }`}
                onClick={() => setSelectedRecord(record)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-blue-600" />
                        <span className="font-semibold">{record.patient_name}</span>
                        <span className="text-xs text-gray-400">{record.patient_document}</span>
                        <Badge className={`text-xs ${
                          record.status === 'Completa' ? 'bg-green-100 text-green-800' :
                          record.status === 'Borrador' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {record.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{record.visit_type}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateShort(record.visit_date)}
                        </span>
                        {record.diagnosis && (
                          <span className="flex items-center gap-1 truncate max-w-[300px]">
                            <Clipboard className="h-3 w-3" />
                            {record.diagnosis}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No hay historias clínicas</p>
            <p className="text-gray-400 text-sm mt-1">
              {searchText || statusFilter !== 'all' ? 'Ajusta los filtros para ver más resultados' : 'Las historias clínicas que crees aparecerán aquí'}
            </p>
          </div>
        )}
      </ScrollArea>

      {/* Detail Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          {selectedRecord && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Historia Clínica - {selectedRecord.patient_name}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5" />
                    {selectedRecord.patient_document}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(selectedRecord.visit_date)}
                  </span>
                  <Badge variant="outline" className="text-xs">{selectedRecord.visit_type}</Badge>
                  <Badge className={`text-xs ${
                    selectedRecord.status === 'Completa' ? 'bg-green-100 text-green-800' :
                    selectedRecord.status === 'Borrador' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedRecord.status}
                  </Badge>
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 pr-4 mt-4">
                <div className="space-y-6">
                  {/* Motivo de consulta */}
                  {selectedRecord.chief_complaint && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" /> Motivo de Consulta
                      </h4>
                      <p className="text-gray-800 bg-red-50 p-3 rounded-lg">{selectedRecord.chief_complaint}</p>
                    </div>
                  )}

                  {/* Enfermedad actual */}
                  {selectedRecord.current_illness && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
                        <Stethoscope className="h-3.5 w-3.5 text-blue-500" /> Enfermedad Actual
                      </h4>
                      <p className="text-gray-800 bg-blue-50 p-3 rounded-lg">{selectedRecord.current_illness}</p>
                    </div>
                  )}

                  {/* Signos vitales */}
                  {selectedRecord.vital_signs && (() => {
                    const vs = typeof selectedRecord.vital_signs === 'string' ? JSON.parse(selectedRecord.vital_signs) : selectedRecord.vital_signs;
                    const hasData = Object.values(vs).some((v: any) => v && v !== '');
                    if (!hasData) return null;
                    return (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-500 uppercase flex items-center gap-1 mb-2">
                          <Activity className="h-3.5 w-3.5 text-green-500" /> Signos Vitales
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {vs.temperature && (
                            <div className="bg-gray-50 p-2 rounded-lg text-center">
                              <p className="text-xs text-gray-500">Temperatura</p>
                              <p className="font-bold text-lg">{vs.temperature}°C</p>
                            </div>
                          )}
                          {vs.systolic_bp && vs.diastolic_bp && (
                            <div className="bg-gray-50 p-2 rounded-lg text-center">
                              <p className="text-xs text-gray-500">Presión Arterial</p>
                              <p className="font-bold text-lg">{vs.systolic_bp}/{vs.diastolic_bp}</p>
                            </div>
                          )}
                          {vs.heart_rate && (
                            <div className="bg-gray-50 p-2 rounded-lg text-center">
                              <p className="text-xs text-gray-500">Frec. Cardíaca</p>
                              <p className="font-bold text-lg">{vs.heart_rate} <span className="text-xs">lpm</span></p>
                            </div>
                          )}
                          {vs.respiratory_rate && (
                            <div className="bg-gray-50 p-2 rounded-lg text-center">
                              <p className="text-xs text-gray-500">Frec. Respiratoria</p>
                              <p className="font-bold text-lg">{vs.respiratory_rate} <span className="text-xs">rpm</span></p>
                            </div>
                          )}
                          {vs.oxygen_saturation && (
                            <div className="bg-gray-50 p-2 rounded-lg text-center">
                              <p className="text-xs text-gray-500">SpO2</p>
                              <p className="font-bold text-lg">{vs.oxygen_saturation}%</p>
                            </div>
                          )}
                          {vs.weight && (
                            <div className="bg-gray-50 p-2 rounded-lg text-center">
                              <p className="text-xs text-gray-500">Peso</p>
                              <p className="font-bold text-lg">{vs.weight} <span className="text-xs">kg</span></p>
                            </div>
                          )}
                          {vs.height && (
                            <div className="bg-gray-50 p-2 rounded-lg text-center">
                              <p className="text-xs text-gray-500">Talla</p>
                              <p className="font-bold text-lg">{vs.height} <span className="text-xs">cm</span></p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Examen físico */}
                  {selectedRecord.physical_examination && (() => {
                    const pe = typeof selectedRecord.physical_examination === 'string' ? JSON.parse(selectedRecord.physical_examination) : selectedRecord.physical_examination;
                    const entries = Object.entries(pe).filter(([, v]) => v && v !== '');
                    if (entries.length === 0) return null;
                    const labels: Record<string, string> = {
                      general: 'Aspecto General', head_neck: 'Cabeza y Cuello', chest: 'Tórax',
                      heart: 'Corazón', abdomen: 'Abdomen', extremities: 'Extremidades', neurological: 'Neurológico'
                    };
                    return (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-500 uppercase flex items-center gap-1 mb-2">
                          <Heart className="h-3.5 w-3.5 text-purple-500" /> Examen Físico
                        </h4>
                        <div className="space-y-2">
                          {entries.map(([key, val]) => (
                            <div key={key} className="bg-purple-50 p-2 rounded-lg">
                              <p className="text-xs font-medium text-purple-700">{labels[key] || key}</p>
                              <p className="text-sm text-gray-800">{val as string}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Diagnóstico */}
                  {selectedRecord.diagnosis && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
                        <Clipboard className="h-3.5 w-3.5 text-green-600" /> Diagnóstico
                      </h4>
                      <p className="text-gray-800 bg-green-50 p-3 rounded-lg font-medium">{selectedRecord.diagnosis}</p>
                    </div>
                  )}

                  {/* Plan de tratamiento */}
                  {selectedRecord.treatment_plan && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
                        <Clipboard className="h-3.5 w-3.5 text-orange-500" /> Plan de Tratamiento
                      </h4>
                      <p className="text-gray-800 bg-orange-50 p-3 rounded-lg">{selectedRecord.treatment_plan}</p>
                    </div>
                  )}

                  {/* Prescripciones */}
                  {selectedRecord.prescriptions && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
                        <Pill className="h-3.5 w-3.5 text-orange-600" /> Prescripciones
                      </h4>
                      <pre className="text-sm text-gray-800 bg-orange-50 p-3 rounded-lg whitespace-pre-wrap font-sans">{selectedRecord.prescriptions}</pre>
                    </div>
                  )}

                  {/* Observaciones */}
                  {selectedRecord.observations && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
                        <FileText className="h-3.5 w-3.5 text-gray-500" /> Observaciones
                      </h4>
                      <p className="text-gray-800 bg-gray-50 p-3 rounded-lg">{selectedRecord.observations}</p>
                    </div>
                  )}

                  {/* Seguimiento */}
                  {selectedRecord.follow_up_date && (
                    <div className="bg-blue-50 p-3 rounded-lg flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-blue-800 font-medium">
                        Fecha de seguimiento: {formatDate(selectedRecord.follow_up_date)}
                      </span>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DoctorMyRecords;
