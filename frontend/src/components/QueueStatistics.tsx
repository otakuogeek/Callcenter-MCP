import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, CalendarIcon, TrendingUp, Users, Activity, AlertCircle, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface StatisticsData {
  totals: {
    total_requests: number;
    pending: number;
    reassigned: number;
    cancelled: number;
    expired: number;
  };
  byChannel: Array<{ channel: string; total: number }>;
  bySpecialty: Array<{ specialty: string; total: number }>;
  byGender: Array<{ gender: string; total: number }>;
  byPriority: Array<{ priority_level: string; total: number }>;
  byStatus: Array<{ status: string; total: number }>;
  byCallType: Array<{ call_type: string; total: number }>;
  bySpecialtyEps: Array<{ 
    specialty: string; 
    specialty_id: number;
    eps_name: string; 
    eps_id: number;
    total: number 
  }>;
  daily: Array<{ date: string; total: number }>;
}

const COLORS = {
  primary: ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"],
  status: {
    pending: "#FFA500",
    reassigned: "#00C49F",
    cancelled: "#FF8042",
    expired: "#888888",
  },
  priority: {
    Baja: "#82CA9D",
    Normal: "#8884D8",
    Alta: "#FFBB28",
    Urgente: "#FF8042",
  },
};

interface QueueStatisticsProps {
  searchTerm?: string;
}

export const QueueStatistics = ({ searchTerm = "" }: QueueStatisticsProps) => {
  const { toast } = useToast();
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(new Date().setDate(new Date().getDate() - 30))
  );
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [exporting, setExporting] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [channelDetails, setChannelDetails] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Estados para filtro de especialidad por EPS
  const [selectedSpecialtyFilter, setSelectedSpecialtyFilter] = useState<string>("all");
  const [availableSpecialties, setAvailableSpecialties] = useState<Array<{id: number; name: string}>>([]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) {
        params.append("startDate", format(startDate, "yyyy-MM-dd"));
      }
      if (endDate) {
        params.append("endDate", format(endDate, "yyyy-MM-dd"));
      }

      const response: any = await api.get(`/appointments/waiting-list/statistics?${params.toString()}`);
      
      if (response.success) {
        setStatistics(response.data);
        
        // Extraer especialidades únicas para el filtro
        if (response.data.bySpecialtyEps) {
          const uniqueSpecialties = Array.from(
            new Map(
              response.data.bySpecialtyEps
                .filter((item: any) => item.specialty_id != null && item.specialty != null)
                .map((item: any) => [
                  item.specialty_id,
                  { id: item.specialty_id, name: item.specialty }
                ])
            ).values()
          ).sort((a, b) => a.name.localeCompare(b.name));
          
          setAvailableSpecialties(uniqueSpecialties as Array<{id: number; name: string}>);
        }
      } else {
        throw new Error(response.error || "Error al cargar estadísticas");
      }
    } catch (error: any) {
      console.error("Error fetching statistics:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar las estadísticas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, [startDate, endDate]);

  const fetchChannelDetails = async (channel: string) => {
    try {
      setLoadingDetails(true);
      setSelectedChannel(channel);
      setIsModalOpen(true);

      const params = new URLSearchParams();
      params.append("requested_by", channel);
      if (startDate) {
        params.append("startDate", format(startDate, "yyyy-MM-dd"));
      }
      if (endDate) {
        params.append("endDate", format(endDate, "yyyy-MM-dd"));
      }
      // Agregar filtro de búsqueda si existe
      if (searchTerm && searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      const response: any = await api.get(`/appointments/waiting-list?${params.toString()}`);
      
      if (response.success && Array.isArray(response.data)) {
        setChannelDetails(response.data);
      } else if (Array.isArray(response)) {
        // Si la respuesta es directamente un array
        setChannelDetails(response);
      } else {
        setChannelDetails([]);
      }
    } catch (error: any) {
      console.error("Error fetching channel details:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar los detalles del canal",
        variant: "destructive",
      });
      setChannelDetails([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleBarClick = (data: any) => {
    if (data && data.channel) {
      fetchChannelDetails(data.channel);
    }
  };

  const exportToPDF = async () => {
    if (!statistics) return;

    try {
      setExporting(true);
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 20;

      // Header
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("Estadísticas de Lista de Espera", pageWidth / 2, yPosition, { align: "center" });
      
      yPosition += 10;
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const dateRange = `${startDate ? format(startDate, "dd/MM/yyyy", { locale: es }) : "Inicio"} - ${endDate ? format(endDate, "dd/MM/yyyy", { locale: es }) : "Hoy"}`;
      pdf.text(dateRange, pageWidth / 2, yPosition, { align: "center" });
      
      yPosition += 10;
      pdf.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, pageWidth / 2, yPosition, { align: "center" });
      
      yPosition += 15;

      // Totals Summary
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Resumen General", 15, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const totalsData = [
        `Total de Solicitudes: ${statistics.totals.total_requests}`,
        `Pendientes: ${statistics.totals.pending}`,
        `Reasignadas: ${statistics.totals.reassigned}`,
        `Canceladas: ${statistics.totals.cancelled}`,
        `Expiradas: ${statistics.totals.expired}`,
      ];

      totalsData.forEach((line) => {
        pdf.text(line, 20, yPosition);
        yPosition += 6;
      });

      yPosition += 10;

      // Capture charts as images
      const chartElements = document.querySelectorAll(".stat-chart");
      
      for (let i = 0; i < chartElements.length; i++) {
        const element = chartElements[i] as HTMLElement;
        
        if (yPosition > pageHeight - 80) {
          pdf.addPage();
          yPosition = 20;
        }

        try {
          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
          });

          const imgData = canvas.toDataURL("image/png");
          const imgWidth = pageWidth - 30;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          pdf.addImage(imgData, "PNG", 15, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 10;
        } catch (error) {
          console.error("Error capturing chart:", error);
        }
      }

      // Footer
      const timestamp = format(new Date(), "yyyyMMdd_HHmmss");
      pdf.save(`estadisticas-cola-espera-${timestamp}.pdf`);

      toast({
        title: "PDF Generado",
        description: "El reporte ha sido descargado exitosamente",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-sm text-muted-foreground">No se pudieron cargar las estadísticas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with date filters and export */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "dd/MM/yyyy", { locale: es }) : "Fecha inicio"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <span className="text-sm text-muted-foreground">a</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "dd/MM/yyyy", { locale: es }) : "Fecha fin"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <Button onClick={exportToPDF} disabled={exporting} size="sm">
          <Download className="mr-2 h-4 w-4" />
          {exporting ? "Generando PDF..." : "Exportar PDF"}
        </Button>
      </div>

      {/* Totals Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totals.total_requests}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{statistics.totals.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reasignadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{statistics.totals.reassigned}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Canceladas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{statistics.totals.cancelled}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expiradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">{statistics.totals.expired}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend */}
        <Card className="stat-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tendencia Diaria
            </CardTitle>
            <CardDescription>Solicitudes por día</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={statistics.daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), "dd/MM", { locale: es })}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => format(new Date(value), "dd MMMM yyyy", { locale: es })}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#8884d8"
                  strokeWidth={2}
                  name="Solicitudes"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Channel Distribution */}
        <Card className="stat-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Distribución por Canal
            </CardTitle>
            <CardDescription>Origen de las solicitudes (Click para ver detalles)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statistics.byChannel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="channel" type="category" width={120} />
                <Tooltip cursor={{ fill: 'rgba(0, 136, 254, 0.1)' }} />
                <Legend />
                <Bar 
                  dataKey="total" 
                  fill="#8884d8" 
                  name="Solicitudes"
                  onClick={handleBarClick}
                  cursor="pointer"
                >
                  {statistics.byChannel.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS.primary[index % COLORS.primary.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Specialty Breakdown */}
        <Card className="stat-chart">
          <CardHeader>
            <CardTitle>Distribución por Especialidad</CardTitle>
            <CardDescription>Solicitudes por área médica</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statistics.bySpecialty}
                  dataKey="total"
                  nameKey="specialty"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.specialty}: ${entry.total}`}
                >
                  {statistics.bySpecialty.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS.primary[index % COLORS.primary.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Specialty by EPS Breakdown */}
        <Card className="stat-chart col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Solicitudes por Especialidad y EPS</CardTitle>
                <CardDescription>Desglose de solicitudes por entidad de salud</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Filtrar:</label>
                <select
                  value={selectedSpecialtyFilter}
                  onChange={(e) => setSelectedSpecialtyFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-medical-500"
                >
                  <option value="all">Todas las especialidades</option>
                  {availableSpecialties.map((spec) => (
                    <option key={spec.id} value={spec.id.toString()}>
                      {spec.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              // Filtrar datos nulos primero
              const validData = (statistics.bySpecialtyEps || []).filter(
                (item) => item.specialty_id != null && item.specialty != null
              );

              const filteredData = selectedSpecialtyFilter === "all"
                ? validData
                : validData.filter(
                    (item) => item.specialty_id?.toString() === selectedSpecialtyFilter
                  );

              // Agrupar por especialidad
              const groupedBySpecialty = filteredData.reduce((acc: any, item) => {
                const specialtyName = item.specialty || 'Sin especialidad';
                if (!acc[specialtyName]) {
                  acc[specialtyName] = [];
                }
                acc[specialtyName].push({
                  eps: item.eps_name || 'Sin EPS',
                  total: item.total
                });
                return acc;
              }, {});

              return (
                <div className="space-y-6">
                  {Object.entries(groupedBySpecialty).map(([specialty, epsData]: [string, any]) => {
                    const totalSpecialty = epsData.reduce((sum: number, item: any) => sum + item.total, 0);
                    
                    return (
                      <div key={specialty} className="border rounded-lg p-4 bg-gray-50">
                        <h4 className="font-semibold text-lg text-medical-800 mb-3">
                          {specialty} <span className="text-sm text-gray-600">({totalSpecialty} solicitudes)</span>
                        </h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={epsData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="eps" type="category" width={150} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="total" fill="#0088FE" name="Solicitudes" />
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                          {epsData.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded border">
                              <span className="text-sm font-medium text-gray-700">{item.eps}</span>
                              <span className="text-sm font-bold text-medical-600">{item.total}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  
                  {Object.keys(groupedBySpecialty).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No hay datos para la especialidad seleccionada
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Gender Distribution */}
        <Card className="stat-chart">
          <CardHeader>
            <CardTitle>Distribución por Género</CardTitle>
            <CardDescription>Pacientes por género</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statistics.byGender}
                  dataKey="total"
                  nameKey="gender"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.gender}: ${entry.total}`}
                >
                  {statistics.byGender.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS.primary[index % COLORS.primary.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Priority Levels */}
        <Card className="stat-chart">
          <CardHeader>
            <CardTitle>Niveles de Prioridad</CardTitle>
            <CardDescription>Distribución por urgencia</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statistics.byPriority}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="priority_level" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Solicitudes">
                  {statistics.byPriority.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS.priority[entry.priority_level as keyof typeof COLORS.priority] || "#8884d8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Overview */}
        <Card className="stat-chart">
          <CardHeader>
            <CardTitle>Estados de Solicitudes</CardTitle>
            <CardDescription>Distribución por estado</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statistics.byStatus}
                  dataKey="total"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  label={(entry) => `${entry.status}: ${entry.total}`}
                >
                  {statistics.byStatus.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS.status[entry.status as keyof typeof COLORS.status] || "#8884d8"}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Call Type Distribution */}
        {statistics.byCallType && statistics.byCallType.length > 0 && (
          <Card className="stat-chart">
            <CardHeader>
              <CardTitle>Tipo de Llamada</CardTitle>
              <CardDescription>Normal vs Reagendar</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statistics.byCallType}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="call_type" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="#82ca9d" name="Llamadas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de Detalles por Canal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Detalles de Solicitudes - {selectedChannel}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
            <DialogDescription>
              {loadingDetails ? (
                "Cargando detalles..."
              ) : (
                `${channelDetails.length} solicitud(es) encontrada(s) desde ${selectedChannel}`
              )}
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center p-8">
              <Activity className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Especialidad</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha Registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channelDetails.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No se encontraron solicitudes
                      </TableCell>
                    </TableRow>
                  ) : (
                    channelDetails.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {item.patient_name || "N/A"}
                        </TableCell>
                        <TableCell>{item.patient_document || "N/A"}</TableCell>
                        <TableCell>{item.specialty_name || "N/A"}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              item.priority_level === "Urgente"
                                ? "bg-red-100 text-red-800"
                                : item.priority_level === "Alta"
                                ? "bg-yellow-100 text-yellow-800"
                                : item.priority_level === "Normal"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {item.priority_level || "Normal"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              item.status === "pending"
                                ? "bg-orange-100 text-orange-800"
                                : item.status === "reassigned"
                                ? "bg-green-100 text-green-800"
                                : item.status === "cancelled"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {item.status === "pending"
                              ? "Pendiente"
                              : item.status === "reassigned"
                              ? "Reasignada"
                              : item.status === "cancelled"
                              ? "Cancelada"
                              : "Expirada"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {item.created_at
                            ? format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: es })
                            : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
