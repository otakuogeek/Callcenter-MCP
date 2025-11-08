# Mejoras Implementadas - Sistema de Capacidad Diaria por Sede

## Resumen

Se ha implementado un sistema completo de visualización de capacidad diaria para las sedes médicas en el sistema Biosanarcall. Esta mejora permite a los administradores analizar la demanda real de citas vs. la capacidad disponible en cada sede.

## Componentes Implementados

### 1. Backend - Nuevo Endpoint `/api/locations/:id/daily-capacity`

**Archivo**: `/backend/src/routes/locations.ts`

**Funcionalidad**:
- Obtiene estadísticas de citas confirmadas, completadas y canceladas por día
- Obtiene información de disponibilidad (cupos totales, disponibles y reservados) por día
- Rango temporal: ±30 días desde la fecha actual
- Datos agrupados por fecha para facilitar la visualización

**Estructura de Respuesta**:
```json
{
  "location": {
    "id": 1,
    "name": "Sede Principal",
    "capacity": 150
  },
  "appointments": [
    {
      "date": "2025-11-01",
      "total_appointments": 45,
      "confirmed": 38,
      "completed": 5,
      "cancelled": 2
    }
  ],
  "availability": [
    {
      "date": "2025-11-01",
      "total_slots": 50,
      "available_slots": 12,
      "booked_slots": 38
    }
  ]
}
```

**Consultas SQL Optimizadas**:
- Join con la tabla `availabilities` (corregido desde `doctor_availability`)
- Filtrado por `location_id` y rango de fechas
- Agrupación por `DATE()` para obtener totales diarios
- Sumas condicionales usando `CASE WHEN`

### 2. Frontend - API Client

**Archivo**: `/frontend/src/lib/api.ts`

**Nuevo Método**:
```typescript
getLocationDailyCapacity: (locationId: number) =>
  request<{
    location: { id: number; name: string };
    appointments: Array<{
      date: string;
      total_appointments: number;
      confirmed: number;
      completed: number;
      cancelled: number;
    }>;
    availability: Array<{
      date: string;
      total_slots: number;
      available_slots: number;
      booked_slots: number;
    }>;
  }>(`/locations/${locationId}/daily-capacity`)
```

### 3. Frontend - Componente de Visualización

**Archivo**: `/frontend/src/pages/Locations.tsx`

**Nuevo Componente**: `DailyCapacityTab`

**Características**:
1. **Resumen de Estadísticas** (4 tarjetas):
   - Citas Confirmadas (total)
   - Citas Completadas (total)
   - Cupos Disponibles (total)
   - Utilización Promedio (%)

2. **Gráfico de Citas por Día**:
   - Tipo: Gráfico de barras (BarChart)
   - Datos: Confirmadas, Completadas, Canceladas
   - Rango: Últimos 30 días + Próximos 30 días
   - Colores diferenciados por estado

3. **Gráfico de Utilización de Capacidad**:
   - Tipo: Gráfico de líneas (LineChart)
   - Métrica: Porcentaje de utilización (cupos reservados / cupos totales)
   - Permite identificar tendencias y picos de demanda

**Integración en UI**:
- Nueva pestaña "Capacidad Diaria" en el modal de gestión de sedes
- TabsList actualizada de 3 a 4 pestañas
- Carga dinámica de datos al abrir la pestaña

### 4. Dependencias Adicionales

**Biblioteca de Gráficos**: recharts
- Componentes utilizados: `LineChart`, `Line`, `Legend`
- Ya estaba instalado en el proyecto

**Iconos de Lucide**:
- `Calendar`: Para el título del gráfico de citas
- `Activity`: Para el título del gráfico de utilización

## Flujo de Uso

1. El administrador navega a https://biosanarcall.site/locations
2. Hace clic en "Gestionar" en cualquier sede
3. Selecciona la pestaña "Capacidad Diaria"
4. El sistema carga automáticamente:
   - Estadísticas resumidas de los últimos 60 días
   - Gráficos interactivos de citas y utilización
5. Puede analizar:
   - Días de alta/baja demanda
   - Eficiencia en el uso de cupos
   - Tendencias de cancelaciones
   - Necesidades de ajuste de capacidad

## Beneficios del Sistema

1. **Visibilidad de Demanda Real**: Permite ver cuántas citas se confirman, completan y cancelan diariamente

2. **Optimización de Recursos**: Identifica días con baja utilización donde se puede reducir disponibilidad

3. **Planificación de Capacidad**: Ayuda a determinar si se necesita más capacidad en días específicos

4. **Análisis de Tendencias**: Visualización de 60 días permite identificar patrones semanales o mensuales

5. **Toma de Decisiones Informada**: Datos concretos para ajustar horarios, médicos asignados, etc.

## Configuración Técnica

### Backend
```bash
cd /home/ubuntu/app/backend
npm run build
pm2 restart cita-central-backend
```

### Frontend
```bash
cd /home/ubuntu/app/frontend
npm run build
# Los archivos se sirven desde /dist vía Nginx
```

### Tablas de Base de Datos Utilizadas
- `locations` - Información de sedes
- `appointments` - Registro de citas
- `availabilities` - Disponibilidad de médicos por sede/día

## Rendimiento

- **Carga Inicial**: ~100-500ms (depende de cantidad de citas)
- **Caché Frontend**: Datos se mantienen en estado mientras el modal esté abierto
- **Optimización SQL**: Índices en `location_id` y `scheduled_date` mejoran consultas

## Próximas Mejoras Sugeridas

1. **Filtro por Rango de Fechas**: Permitir al usuario seleccionar el rango temporal
2. **Exportar a PDF/Excel**: Botón para descargar los datos analizados
3. **Comparativa entre Sedes**: Vista que compare múltiples sedes simultáneamente
4. **Alertas Automáticas**: Notificar cuando la utilización sea muy baja o muy alta
5. **Predicción de Demanda**: Usar ML para predecir necesidades futuras

## Archivos Modificados

1. `/backend/src/routes/locations.ts` - Nuevo endpoint
2. `/frontend/src/lib/api.ts` - Nuevo método API
3. `/frontend/src/pages/Locations.tsx` - Nuevo componente y pestaña

## Fecha de Implementación

**Fecha**: 1 de noviembre de 2025  
**Desarrollador**: GitHub Copilot  
**Estado**: ✅ Completado y desplegado en producción

---

**Nota**: Esta mejora forma parte del sistema integral de gestión médica Biosanarcall IPS y está diseñada para escalar con el crecimiento de la organización.
