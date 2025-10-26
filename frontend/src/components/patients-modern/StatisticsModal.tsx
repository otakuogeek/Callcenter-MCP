import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { Users, TrendingUp, Heart, Baby, User } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";

interface StatisticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COLORS = {
  primary: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#14b8a6', '#f97316'],
  gender: {
    'Masculino': '#3b82f6',
    'Femenino': '#ec4899',
    'Otro': '#8b5cf6',
    'No especificado': '#9ca3af'
  }
};

export const StatisticsModal = ({ open, onOpenChange }: StatisticsModalProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ['patient-statistics'],
    queryFn: async () => {
      const response = await fetch('/api/patients-v2/stats/demographics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Error al cargar estadísticas');
      const result = await response.json();
      return result.data;
    },
    enabled: open,
  });

  const formatGenderData = (genderStats: any[]) => {
    return genderStats.map(item => ({
      name: item.gender || 'No especificado',
      value: item.count,
      percentage: data ? ((item.count / data.total_patients) * 100).toFixed(1) : 0
    }));
  };

  const formatAgeRangeData = (ageStats: any[]) => {
    return ageStats.map(item => ({
      range: item.age_range,
      count: item.count
    }));
  };

  const formatBloodGroupData = (bloodStats: any[]) => {
    return bloodStats.map(item => ({
      type: item.name,
      count: item.count
    }));
  };

  const formatEstrateData = (estratoStats: any[]) => {
    return estratoStats.map(item => ({
      estrato: `Estrato ${item.estrato || 'N/R'}`,
      count: item.count
    }));
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <TrendingUp className="h-6 w-6" />
              Estadísticas Demográficas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-60 w-full" />
            <Skeleton className="h-60 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!data) return null;

  const genderData = formatGenderData(data.by_gender || []);
  const ageRangeData = formatAgeRangeData(data.by_age_range || []);
  const bloodGroupData = formatBloodGroupData(data.by_blood_group || []);
  const estratoData = formatEstrateData(data.by_estrato || []);

  // Calcular totales de niños
  const childrenTotal = (data.children_by_gender || []).reduce((sum: number, item: any) => sum + item.count, 0);
  const boysCount = (data.children_by_gender || []).find((item: any) => item.gender === 'Masculino')?.count || 0;
  const girlsCount = (data.children_by_gender || []).find((item: any) => item.gender === 'Femenino')?.count || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            Estadísticas Demográficas de Pacientes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 p-4">
          {/* Cards de resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-900 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Total Pacientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-700">{data.total_patients}</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-900 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Edad Promedio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-700">{data.average_age} años</div>
                <p className="text-xs text-purple-600 mt-1">Rango: {data.min_age} - {data.max_age} años</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-pink-900 flex items-center gap-2">
                  <Baby className="h-4 w-4" />
                  Niños/as &lt; 18 años
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-pink-700">{childrenTotal}</div>
                <p className="text-xs text-pink-600 mt-1">Niños: {boysCount} | Niñas: {girlsCount}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-900 flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Adultos Mayores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-700">{data.elderly_count}</div>
                <p className="text-xs text-amber-600 mt-1">≥ 60 años</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs con gráficos */}
          <Tabs defaultValue="gender" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="gender">Género</TabsTrigger>
              <TabsTrigger value="age">Edad</TabsTrigger>
              <TabsTrigger value="blood">Tipo Sangre</TabsTrigger>
              <TabsTrigger value="socio">Socioeconómico</TabsTrigger>
            </TabsList>

            {/* Distribución por Género */}
            <TabsContent value="gender" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Distribución por Género</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={genderData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) => `${name}: ${percentage}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {genderData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={COLORS.gender[entry.name as keyof typeof COLORS.gender] || COLORS.primary[index % COLORS.primary.length]} 
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>

                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={genderData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Distribución por Edad */}
            <TabsContent value="age" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Distribución por Rangos de Edad</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={450}>
                    <BarChart data={ageRangeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="range" 
                        angle={-45} 
                        textAnchor="end" 
                        height={120}
                        interval={0}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        label={{ value: 'Número de Pacientes', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="count" 
                        fill="#8b5cf6" 
                        name="Pacientes"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Distribución por Tipo de Sangre */}
            <TabsContent value="blood" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Distribución por Tipo de Sangre</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={bloodGroupData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ type, count }) => `${type}: ${count}`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {bloodGroupData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS.primary[index % COLORS.primary.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>

                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={bloodGroupData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="type" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Distribución Socioeconómica */}
            <TabsContent value="socio" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Distribución por Estrato Socioeconómico</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={estratoData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="estrato" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} name="Pacientes" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Top 10 EPS */}
              {data.by_eps && data.by_eps.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Top 10 EPS más comunes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.by_eps.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
