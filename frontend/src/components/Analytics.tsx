import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { safeDayOfWeek } from "@/utils/dateHelpers";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Clock,
  MapPin,
  Activity,
  Heart,
  Stethoscope,
  Download,
  Filter
} from "lucide-react";
import api from "@/lib/api";

const Analytics = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<"week"|"month"|"quarter"|"year">("month");
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos reales
  const [overview, setOverview] = useState<
    { totals: { total_consultations: number; unique_patients: number; avg_duration_minutes: number | null; completion_rate: number | null }, by_day: { date: string; consultations: number }[], by_hour: { hour: string; consultations: number }[] } | null
  >(null);
  const [locData, setLocData] = useState<
    { by_zone: { name: string; value: number }[]; top_municipalities: { name: string; consultations: number; zone: string }[]; trend_by_zone: { month: string; zone: string; consultations: number }[] } | null
  >(null);
  const [specData, setSpecData] = useState<{ by_specialty: { name: string; consultations: number }[] } | null>(null);

  const apiRange = useMemo(() => {
    switch (selectedPeriod) {
      case 'week': return '7d' as const;
      case 'month': return '30d' as const;
      case 'quarter': return '90d' as const;
      case 'year': return '365d' as const;
    }
  }, [selectedPeriod]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true); setError(null);
      try {
        const [ov, loc, spec] = await Promise.all([
          api.getAnalyticsOverview({ range: apiRange, zone_id: selectedZone !== 'all' ? Number(selectedZone) : undefined }),
          api.getAnalyticsLocations({ range: apiRange, months: 4 }),
          api.getAnalyticsSpecialties({ range: apiRange }),
        ]);
        if (!mounted) return;
        setOverview(ov);
        setLocData(loc);
        setSpecData(spec);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'No se pudieron cargar los datos');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [apiRange, selectedZone]);

  // Zonas dinámicas desde backend
  const [zones, setZones] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    let mounted = true;
    api.getZones().then(z => { if (mounted) setZones(z); }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Datos de consultas por zona (reales)
  const consultationsByZone = (locData?.by_zone || []).map((z, i) => ({ name: z.name || 'Sin zona', value: z.value, color: i % 2 === 0 ? "#3b82f6" : "#10b981" }));

  // Top 10 municipios
  const consultationsByMunicipality = (locData?.top_municipalities || []).map(m => ({ name: m.name, consultations: m.consultations, zone: m.zone }));

  // Evolución temporal por zona (por mes)
  const monthlyDataByZone = useMemo(() => {
    const trend = locData?.trend_by_zone || [];
    const months = Array.from(new Set(trend.map(t => t.month)));
    const zonesSet = Array.from(new Set(trend.map(t => t.zone)));
    return months.map(m => {
      const row: Record<string, any> = { month: m };
      zonesSet.forEach(z => {
        const it = trend.find(t => t.month === m && t.zone === z);
        row[z] = it ? it.consultations : 0;
      });
      return row;
    });
  }, [locData]);

  const stats = [
    {
      title: "Total Consultas",
      value: overview ? new Intl.NumberFormat().format(overview.totals.total_consultations) : "-",
      change: "",
      trend: "up",
      icon: Calendar,
      color: "text-blue-600"
    },
    {
      title: "Pacientes Únicos",
      value: overview ? new Intl.NumberFormat().format(overview.totals.unique_patients) : "-",
      change: "",
      trend: "up",
      icon: Users,
      color: "text-green-600"
    },
    {
      title: "Tiempo Promedio",
      value: overview && overview.totals.avg_duration_minutes != null ? `${overview.totals.avg_duration_minutes} min` : "-",
      change: "",
      trend: "down",
      icon: Clock,
      color: "text-orange-600"
    },
    {
      title: "Tasa de Finalización",
      value: overview && overview.totals.completion_rate != null ? `${Math.round(overview.totals.completion_rate * 100)}%` : "-",
      change: "",
      trend: "up",
      icon: Heart,
      color: "text-red-600"
    }
  ];

  const specialtyData = (specData?.by_specialty || []).map((s, i) => ({ name: s.name, consultations: s.consultations, color: ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4"][i % 6] }));

  const weeklyData = useMemo(() => {
    const days = overview?.by_day || [];
    const order = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const map = new Map<string, { sum: number; count: number }>();
    days.forEach(d => {
      const dow = safeDayOfWeek(d.date);
      if (dow === null) return;
      const key = order[dow];
      const cur = map.get(key) || { sum: 0, count: 0 };
      cur.sum += d.consultations; cur.count += 1; map.set(key, cur);
    });
    return order.map(k => ({ day: k, consultations: map.get(k) ? Math.round((map.get(k)!.sum) / map.get(k)!.count) : 0, satisfaction: 4.8 }));
  }, [overview]);

  const hourlyData = overview?.by_hour || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-medical-800">Analytics</h1>
          <p className="text-medical-600 mt-1">
            Análisis detallado del rendimiento y estadísticas del sistema
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedZone} onValueChange={setSelectedZone}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por zona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las zonas</SelectItem>
              {zones.map(zone => (
                <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">7 días</SelectItem>
              <SelectItem value="month">30 días</SelectItem>
              <SelectItem value="quarter">3 meses</SelectItem>
              <SelectItem value="year">1 año</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

  {error && <div className="text-red-600">{error}</div>}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="border-medical-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-medical-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-medical-800">{stat.value}</p>
                  <div className="flex items-center mt-1">
                    {stat.trend === "up" ? (
                      <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                    )}
                    <span className={`text-sm ${stat.trend === "up" ? "text-green-600" : "text-red-600"}`}>
                      {stat.change}
                    </span>
                  </div>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="locations">Ubicaciones</TabsTrigger>
          <TabsTrigger value="specialties">Especialidades</TabsTrigger>
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-medical-200">
              <CardHeader>
                <CardTitle className="text-medical-800">Consultas por Día</CardTitle>
                <CardDescription>Distribución semanal de consultas</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="consultations"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-medical-200">
              <CardHeader>
                <CardTitle className="text-medical-800">Distribución Horaria</CardTitle>
                <CardDescription>Consultas por hora del día</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="consultations" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="locations">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Consultas por Zona */}
            <Card className="border-medical-200">
              <CardHeader>
                <CardTitle className="text-medical-800">Consultas por Zona</CardTitle>
                <CardDescription>Distribución de consultas entre zonas de servicio</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={consultationsByZone}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {consultationsByZone.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Evolución por Zona */}
            <Card className="border-medical-200">
              <CardHeader>
                <CardTitle className="text-medical-800">Evolución por Zona</CardTitle>
                <CardDescription>Tendencia mensual de consultas por zona</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyDataByZone}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {Object.keys((monthlyDataByZone[0] || {})).filter(k => k !== 'month').map((key, idx) => (
                      <Line key={key} type="monotone" dataKey={key} stroke={["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6"][idx % 5]} strokeWidth={2} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Municipios */}
            <Card className="border-medical-200 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-medical-800">Top Municipios por Consultas</CardTitle>
                <CardDescription>Los 10 municipios con mayor actividad</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={consultationsByMunicipality} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} />
                    <Tooltip />
                    <Bar dataKey="consultations" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="specialties">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-medical-200">
              <CardHeader>
                <CardTitle className="text-medical-800">Consultas por Especialidad</CardTitle>
                <CardDescription>Distribución de consultas médicas</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={specialtyData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="consultations"
                      label={({ name, consultations }) => `${name}: ${consultations}`}
                    >
                      {specialtyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-medical-200">
              <CardHeader>
                <CardTitle className="text-medical-800">Ranking Especialidades</CardTitle>
                <CardDescription>Especialidades más solicitadas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {specialtyData.map((specialty, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: specialty.color }}
                        />
                        <span className="font-medium">{specialty.name}</span>
                      </div>
                      <Badge variant="secondary">{specialty.consultations}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-medical-200">
              <CardHeader>
                <CardTitle className="text-medical-800">Satisfacción Semanal</CardTitle>
                <CardDescription>Puntuación promedio de satisfacción</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis domain={[4.0, 5.0]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="satisfaction"
                      stroke="#10b981"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-medical-200">
              <CardHeader>
                <CardTitle className="text-medical-800">Métricas de Calidad</CardTitle>
                <CardDescription>Indicadores clave de rendimiento</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Tiempo respuesta promedio</span>
                    <Badge variant="outline">2.3 min</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Tasa de finalización</span>
                    <Badge className="bg-green-100 text-green-800">98.5%</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Pacientes recurrentes</span>
                    <Badge className="bg-blue-100 text-blue-800">76%</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Cancelaciones</span>
                    <Badge className="bg-orange-100 text-orange-800">3.2%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;
