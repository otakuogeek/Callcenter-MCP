
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Calendar, BarChart3, PieChart, TrendingUp } from "lucide-react";

const Reports = () => {
  const reports = [
    {
      id: 1,
      title: "Reporte Diario de Llamadas",
      description: "Resumen completo de todas las llamadas del día",
      type: "Operacional",
      frequency: "Diario",
      lastGenerated: "Hoy 08:00 AM",
      format: "PDF",
      size: "2.3 MB"
    },
    {
      id: 2,
      title: "Análisis de Satisfacción del Cliente",
      description: "Métricas de satisfacción y feedback de pacientes",
      type: "Calidad",
      frequency: "Semanal",
      lastGenerated: "Lun 15 Ene",
      format: "Excel",
      size: "1.8 MB"
    },
    {
      id: 3,
      title: "Rendimiento de Agentes",
      description: "Estadísticas de productividad y eficiencia del equipo",
      type: "Recursos Humanos",
      frequency: "Mensual",
      lastGenerated: "01 Ene 2024",
      format: "PDF",
      size: "4.1 MB"
    },
    {
      id: 4,
      title: "Reporte de Citas Médicas",
      description: "Análisis de agendamiento y cumplimiento de citas",
      type: "Médico",
      frequency: "Semanal",
      lastGenerated: "Lun 15 Ene",
      format: "Excel",
      size: "3.2 MB"
    },
    {
      id: 5,
      title: "Análisis Demográfico de Pacientes",
      description: "Distribución geográfica y demográfica de la base de pacientes",
      type: "Estratégico",
      frequency: "Mensual",
      lastGenerated: "01 Ene 2024",
      format: "PowerPoint",
      size: "5.7 MB"
    },
    {
      id: 6,
      title: "Reporte Financiero",
      description: "Estado financiero y facturación de servicios",
      type: "Financiero",
      frequency: "Mensual",
      lastGenerated: "01 Ene 2024",
      format: "Excel",
      size: "2.9 MB"
    }
  ];

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Operacional":
        return "bg-medical-100 text-medical-800";
      case "Calidad":
        return "bg-success-100 text-success-800";
      case "Recursos Humanos":
        return "bg-warning-100 text-warning-800";
      case "Médico":
        return "bg-purple-100 text-purple-800";
      case "Estratégico":
        return "bg-blue-100 text-blue-800";
      case "Financiero":
        return "bg-emerald-100 text-emerald-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Operacional":
        return <BarChart3 className="w-4 h-4" />;
      case "Calidad":
        return <TrendingUp className="w-4 h-4" />;
      case "Recursos Humanos":
        return <FileText className="w-4 h-4" />;
      case "Médico":
        return <PieChart className="w-4 h-4" />;
      case "Estratégico":
        return <BarChart3 className="w-4 h-4" />;
      case "Financiero":
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-medical-50 to-white">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="mb-4">
            <SidebarTrigger className="text-medical-600 hover:text-medical-800" />
          </div>
          
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-medical-800 mb-2">Centro de Reportes</h1>
              <p className="text-medical-600">Generación y descarga de reportes del sistema</p>
            </div>

            {/* Estadísticas de Reportes */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-medical-600" />
                    <div>
                      <p className="text-sm text-gray-600">Total Reportes</p>
                      <p className="text-2xl font-bold text-medical-700">{reports.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-warning-600" />
                    <div>
                      <p className="text-sm text-gray-600">Diarios</p>
                      <p className="text-2xl font-bold text-warning-700">
                        {reports.filter(r => r.frequency === "Diario").length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-success-600" />
                    <div>
                      <p className="text-sm text-gray-600">Semanales</p>
                      <p className="text-2xl font-bold text-success-700">
                        {reports.filter(r => r.frequency === "Semanal").length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-sm text-gray-600">Mensuales</p>
                      <p className="text-2xl font-bold text-purple-700">
                        {reports.filter(r => r.frequency === "Mensual").length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Acciones Rápidas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-medical-700">Acciones Rápidas</CardTitle>
                <CardDescription>
                  Genera reportes específicos instantáneamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button className="h-16 flex flex-col gap-1">
                    <BarChart3 className="w-5 h-5" />
                    <span>Reporte del Día</span>
                  </Button>
                  <Button variant="outline" className="h-16 flex flex-col gap-1">
                    <PieChart className="w-5 h-5" />
                    <span>Análisis Semanal</span>
                  </Button>
                  <Button variant="outline" className="h-16 flex flex-col gap-1">
                    <TrendingUp className="w-5 h-5" />
                    <span>Reporte Personalizado</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Reportes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-medical-700">Reportes Disponibles</CardTitle>
                <CardDescription>
                  Historial y descarga de todos los reportes generados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-medical-50">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-medical-100 rounded-lg flex items-center justify-center">
                          {getTypeIcon(report.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-lg">{report.title}</span>
                            <Badge className={`text-xs ${getTypeColor(report.type)}`}>
                              {report.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{report.description}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>📅 {report.frequency}</span>
                            <span>📄 {report.format}</span>
                            <span>💾 {report.size}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right space-y-2">
                        <div className="text-sm text-gray-600">
                          Último: {report.lastGenerated}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Calendar className="w-4 h-4 mr-1" />
                            Programar
                          </Button>
                          <Button size="sm">
                            <Download className="w-4 h-4 mr-1" />
                            Descargar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Reports;
