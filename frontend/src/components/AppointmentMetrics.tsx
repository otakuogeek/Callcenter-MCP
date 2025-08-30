
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, CheckCircle, AlertCircle, Building, TrendingUp, Users, Clock, Activity } from "lucide-react";
import { motion } from "framer-motion";
import type { Availability, Location } from "@/hooks/useAppointmentData";

interface AppointmentMetricsProps {
  availabilities: Availability[];
  locations: Location[];
  date?: Date;
}

const AppointmentMetrics = ({ availabilities, locations, date }: AppointmentMetricsProps) => {
  // Helper para formatear fecha local a YYYY-MM-DD
  const toYMDLocal = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const target = date ?? new Date();
  const targetYMD = toYMDLocal(target);

  const dayAvailabilities = availabilities.filter(a => a.date === targetYMD);
  const activeAvailabilities = dayAvailabilities.filter(availability => availability.status === "Activa").length;
  const completedAvailabilities = dayAvailabilities.filter(availability => availability.status === "Completa").length;
  const cancelledAvailabilities = dayAvailabilities.filter(availability => availability.status === "Cancelada").length;
  const totalCapacityDay = dayAvailabilities.reduce((sum, availability) => sum + availability.capacity, 0);
  const totalBookedDay = dayAvailabilities.reduce((sum, availability) => sum + availability.bookedSlots, 0);
  const totalActiveLocations = locations.filter(location => location.status === "Activa").length;
  const occupancyRate = totalCapacityDay > 0 ? Math.round((totalBookedDay / totalCapacityDay) * 100) : 0;

  const metrics = [
    {
      title: "Agendas del Día",
      value: dayAvailabilities.length,
      icon: CalendarIcon,
      color: "bg-gradient-to-br from-blue-500 to-blue-600",
      bgColor: "from-blue-50 to-blue-100",
      textColor: "text-blue-700",
      description: "Total programado",
      trend: "+12%"
    },
    {
      title: "Agendas Activas",
      value: activeAvailabilities,
      icon: CheckCircle,
      color: "bg-gradient-to-br from-green-500 to-green-600",
      bgColor: "from-green-50 to-green-100",
      textColor: "text-green-700",
      description: "En funcionamiento",
      trend: "+8%"
    },
    {
  title: "Cupos del Día",
  value: totalCapacityDay,
      icon: Users,
      color: "bg-gradient-to-br from-purple-500 to-purple-600",
      bgColor: "from-purple-50 to-purple-100",
      textColor: "text-purple-700",
      description: "Capacidad total",
      trend: "+5%"
    },
    {
      title: "Tasa de Ocupación",
      value: `${occupancyRate}%`,
      icon: TrendingUp,
      color: "bg-gradient-to-br from-orange-500 to-orange-600",
      bgColor: "from-orange-50 to-orange-100",
      textColor: "text-orange-700",
  description: "Cupos ocupados vs. capacidad",
      trend: occupancyRate > 80 ? "+15%" : "+3%"
    }
  ];

  const statusMetrics = [
    { label: "Activas", value: activeAvailabilities, color: "bg-green-500", textColor: "text-green-700" },
    { label: "Completadas", value: completedAvailabilities, color: "bg-blue-500", textColor: "text-blue-700" },
    { label: "Canceladas", value: cancelledAvailabilities, color: "bg-red-500", textColor: "text-red-700" }
  ];

  return (
    <div className="space-y-6">
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 border-0 shadow-md">
              <CardContent className={`p-0 bg-gradient-to-br ${metric.bgColor}`}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl ${metric.color} flex items-center justify-center shadow-lg`}>
                      <metric.icon className="w-6 h-6 text-white" />
                    </div>
                    <Badge variant="secondary" className="bg-white/80 text-gray-700 text-xs">
                      {metric.trend}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                    <p className={`text-3xl font-bold ${metric.textColor}`}>{metric.value}</p>
                    <p className="text-xs text-gray-500">{metric.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Panel de resumen adicional */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estado de agendas */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Estado de Agendas Hoy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusMetrics.map((status, index) => (
              <div key={status.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${status.color}`}></div>
                  <span className="font-medium text-gray-700">{status.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${status.textColor}`}>{status.value}</span>
                  <span className="text-sm text-gray-500">agendas</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Información de ubicaciones */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Building className="w-5 h-5 text-purple-600" />
              Información de Ubicaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                <Building className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-purple-700">{totalActiveLocations}</p>
                <p className="text-sm text-purple-600">Ubicaciones Activas</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <Clock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-700">{totalBookedDay}</p>
                <p className="text-sm text-blue-600">Cupos Ocupados</p>
              </div>
            </div>
            
            {/* Barra de progreso de ocupación */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Ocupación del día</span>
                <span className="font-medium text-gray-900">{occupancyRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <motion.div 
                  className={`h-3 rounded-full transition-all duration-1000 ${
                    occupancyRate >= 90 ? 'bg-red-500' :
                    occupancyRate >= 70 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${occupancyRate}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </div>
              <p className="text-xs text-gray-500">
                {totalBookedDay} de {totalCapacityDay} cupos ocupados
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AppointmentMetrics;
