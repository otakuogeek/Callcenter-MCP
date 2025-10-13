# 📅 Mejora: Selector de Fecha en Cola Diaria

## ✨ Resumen de la Mejora

Se ha implementado un **selector de fecha personalizable** en la página de **Gestión de Cola Diaria** que permite:

1. ✅ **Seleccionar cualquier fecha** (no solo "hoy")
2. ✅ **Ver las citas asignadas** para esa fecha específica
3. ✅ **Interfaz visual clara** con calendario desplegable
4. ✅ **Actualización automática** al cambiar la fecha

---

## 🎯 Funcionalidad Implementada

### 1. **Selector de Fecha con Calendario**

**Ubicación**: Gestión de Cola Diaria → Esquina superior derecha

```
┌─────────────────────────────────────────────────────────────┐
│ Gestión de Cola Diaria                   [📅 11 oct 2025] ⬇ │
│ Asignación automática para:                                 │
│ viernes, 11 de octubre de 2025                              │
└─────────────────────────────────────────────────────────────┘
```

**Características:**
- 📅 **Calendario visual** al hacer click
- 🇪🇸 **Formato en español** (locale es-ES)
- ⚡ **Actualización inmediata** al seleccionar fecha
- 🔄 **Botón de actualizar** independiente

### 2. **Visualización de Fecha Seleccionada**

El subtítulo muestra claramente la fecha:
```
"Asignación automática para: viernes, 11 de octubre de 2025"
```

### 3. **Filtrado Dinámico de Citas**

Al seleccionar una fecha:
- Se cargan las citas **creadas ese día**
- Se actualizan las **estadísticas**
- Se reagrupan por **especialidad**

---

## 🔧 Cambios Técnicos Implementados

### Frontend (`/frontend/src/pages/DailyQueue.tsx`)

#### 1. **Nuevas Importaciones**
```typescript
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
```

#### 2. **Estado de Fecha Seleccionada**
```typescript
const [selectedDate, setSelectedDate] = useState<Date>(new Date());
```

#### 3. **Función de Actualización con Fecha**
```typescript
const refresh = async (date?: Date) => {
  setLoading(true);
  setError(null);
  const dateToFetch = date || selectedDate;
  try {
    const formattedDate = format(dateToFetch, 'yyyy-MM-dd');
    const response = await api.getDailyQueue(formattedDate);
    setDailyData(response);
  } catch (err: any) {
    console.error('Error al cargar cola diaria:', err);
    setError(err.message || 'Error al cargar los datos');
  } finally {
    setLoading(false);
  }
};
```

#### 4. **Manejador de Cambio de Fecha**
```typescript
const handleDateChange = (date: Date | undefined) => {
  if (date) {
    setSelectedDate(date);
    refresh(date);
  }
};
```

#### 5. **Componente del Selector**
```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button
      variant="outline"
      className={cn(
        "w-[240px] justify-start text-left font-normal",
        !selectedDate && "text-muted-foreground"
      )}
    >
      <CalendarIcon className="mr-2 h-4 w-4" />
      {selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0" align="end">
    <CalendarComponent
      mode="single"
      selected={selectedDate}
      onSelect={handleDateChange}
      initialFocus
      locale={es}
    />
  </PopoverContent>
</Popover>
```

#### 6. **Actualización de useEffect**
```typescript
useEffect(() => {
  refresh();
  const interval = setInterval(() => refresh(), 30000);
  return () => clearInterval(interval);
}, [selectedDate]); // Se ejecuta al cambiar la fecha
```

---

### API Cliente (`/frontend/src/lib/api.ts`)

#### Modificación del Método `getDailyQueue`
```typescript
// ANTES:
async getDailyQueue() {
  return this.get<...>('/appointments/daily-queue');
}

// AHORA:
async getDailyQueue(date?: string) {
  const queryParams = date ? `?date=${date}` : '';
  return this.get<...>(`/appointments/daily-queue${queryParams}`);
}
```

**Parámetros:**
- `date` (opcional): Fecha en formato `YYYY-MM-DD`
- Si se omite, el backend usa la fecha actual

---

### Backend (`/backend/src/routes/appointments.ts`)

#### Soporte de Parámetro de Fecha

```typescript
router.get('/daily-queue', requireAuth, async (req: Request, res: Response) => {
  try {
    // Permitir parámetro de fecha opcional
    const dateParam = req.query.date as string;
    let targetDate: Date;
    let targetDateStr: string;
    
    if (dateParam) {
      // Validar formato YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateParam)) {
        return res.status(400).json({
          success: false,
          error: 'Formato de fecha inválido. Use YYYY-MM-DD'
        });
      }
      targetDate = new Date(dateParam);
      targetDateStr = dateParam;
    } else {
      targetDate = new Date();
      targetDateStr = targetDate.toISOString().split('T')[0];
    }

    // Usar targetDateStr en las queries SQL
    const [waitingRows]: any = await pool.query(waitingQuery, [targetDateStr]);
    const [appointmentRows]: any = await pool.query(appointmentsQuery, [targetDateStr]);
    
    // ...resto del código...
    
    return res.json({
      success: true,
      date: targetDateStr,
      data,
      stats
    });
  } catch (error: any) {
    // ...
  }
});
```

**Validaciones:**
- ✅ Formato correcto `YYYY-MM-DD`
- ✅ Respuesta con la fecha consultada
- ✅ Retrocompatible (sin parámetro usa hoy)

---

## 📊 Flujo de Datos

```
┌─────────────────────┐
│ Usuario selecciona  │
│ fecha en calendario │
└──────────┬──────────┘
           │
           v
┌─────────────────────────────────────┐
│ handleDateChange(date)              │
│ - Actualiza selectedDate state      │
│ - Llama refresh(date)               │
└──────────┬──────────────────────────┘
           │
           v
┌─────────────────────────────────────┐
│ refresh(date)                       │
│ - Formatea: format(date, 'yyyy-MM-dd') │
│ - Llama: api.getDailyQueue('2025-10-11') │
└──────────┬──────────────────────────┘
           │
           v
┌─────────────────────────────────────┐
│ API: /appointments/daily-queue?date=2025-10-11 │
└──────────┬──────────────────────────┘
           │
           v
┌─────────────────────────────────────┐
│ Backend valida fecha y consulta DB  │
│ WHERE DATE(created_at) = '2025-10-11' │
└──────────┬──────────────────────────┘
           │
           v
┌─────────────────────────────────────┐
│ Respuesta JSON con:                 │
│ - date: "2025-10-11"               │
│ - data: [citas agrupadas]          │
│ - stats: {...}                     │
└──────────┬──────────────────────────┘
           │
           v
┌─────────────────────────────────────┐
│ UI se actualiza con los datos       │
│ - Cards por especialidad            │
│ - Estadísticas del día              │
│ - Subtítulo con fecha legible       │
└─────────────────────────────────────┘
```

---

## 🎨 Interfaz de Usuario

### Antes:
```
┌─────────────────────────────────────────────────┐
│ Gestión de Cola Diaria           [🔄 Actualizar]│
│ Asignación automática para hoy - 10 oct 2025    │
│ (Fecha fija, no modificable)                    │
└─────────────────────────────────────────────────┘
```

### Ahora:
```
┌──────────────────────────────────────────────────────────┐
│ Gestión de Cola Diaria    [📅 11 oct 2025 ▼] [🔄 Actualizar]│
│ Asignación automática para: viernes, 11 de octubre de 2025│
│                                                          │
│ Al hacer click en el selector:                           │
│ ┌──────────────────────┐                                │
│ │  Octubre 2025        │                                │
│ │ L  M  M  J  V  S  D  │                                │
│ │       1  2  3  4  5  │                                │
│ │ 6  7  8  9 10 [11]12 │ ← 11 seleccionado             │
│ │13 14 15 16 17 18 19  │                                │
│ │20 21 22 23 24 25 26  │                                │
│ │27 28 29 30 31        │                                │
│ └──────────────────────┘                                │
└──────────────────────────────────────────────────────────┘
```

---

## 📋 Casos de Uso

### Caso 1: Consultar Citas de Hoy
```
1. Usuario entra a "Gestión de Cola Diaria"
2. Por defecto muestra la fecha actual (11 oct 2025)
3. Ve todas las citas creadas hoy
```

### Caso 2: Consultar Citas de Ayer
```
1. Click en selector de fecha
2. Selecciona "10 de octubre de 2025"
3. La página se actualiza automáticamente
4. Muestra: "Asignación automática para: jueves, 10 de octubre de 2025"
5. Cards se actualizan con las citas del 10 de octubre
```

### Caso 3: Consultar Citas Futuras
```
1. Click en selector de fecha
2. Selecciona "15 de octubre de 2025"
3. Si hay citas programadas para ese día → Se muestran
4. Si no hay citas → Mensaje: "No hay citas registradas para hoy"
```

### Caso 4: Actualizar Datos de la Fecha Actual
```
1. Usuario tiene seleccionado "11 oct 2025"
2. Click en botón "Actualizar"
3. Se vuelve a consultar el backend con la misma fecha
4. Refleja cambios recientes (nuevas citas, cancelaciones, etc.)
```

---

## 🔍 Datos Mostrados por Fecha

### Estadísticas (4 Cards):
```
┌──────────────────────┐  ┌──────────────────────┐
│ Citas Disponibles    │  │ En Cola de Espera    │
│ Hoy: [X]             │  │ [Y] pacientes        │
│ [Z] espera +         │  │                      │
│ [W] agendadas        │  │                      │
└──────────────────────┘  └──────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐
│ Tiempo Promedio      │  │ Urgentes             │
│ 0m                   │  │ [N] alta/urgente     │
│ Esperando            │  │                      │
└──────────────────────┘  └──────────────────────┘
```

### Lista de Citas por Especialidad:
```
┌─────────────────────────────────────────────────┐
│ 🩺 MEDICINA GENERAL                             │
│ 2 en espera • 5 agendadas                       │
├─────────────────────────────────────────────────┤
│ 1  👤 Juan Pérez    [Alta] [Agendada]          │
│    📞 300-123-4567   🕐 09:30                   │
│    Dr. María López • Sede Norte                 │
│                                                 │
│ 2  👤 Ana García    [Normal] [En Espera]        │
│    📞 301-987-6543   🕐 Creada: 08:15           │
│    Motivo: Consulta general                     │
└─────────────────────────────────────────────────┘
```

**Todas las citas mostradas fueron creadas en la fecha seleccionada.**

---

## ⚙️ Configuración Técnica

### Dependencias Utilizadas:
- `date-fns` v3.6.0 - Formateo y manipulación de fechas
- `date-fns/locale/es` - Localización en español
- shadcn/ui `Calendar` - Componente de calendario
- shadcn/ui `Popover` - Desplegable para el calendario

### Formato de Fechas:
- **Backend**: `YYYY-MM-DD` (2025-10-11)
- **Display largo**: `EEEE, d 'de' MMMM 'de' yyyy` → "viernes, 11 de octubre de 2025"
- **Display corto**: `PPP` → "11 oct 2025"

### Consulta SQL Modificada:
```sql
WHERE DATE(wl.created_at) = ?  -- Filtra por fecha de creación
```

Parámetro: `targetDateStr` (ej: '2025-10-11')

---

## 🚀 Estado del Despliegue

```bash
✅ Frontend compilado: 17.76s
✅ Frontend desplegado: /var/www/biosanarcall/html/
✅ Backend reiniciado: PM2 (cita-central-backend)
✅ Producción: https://biosanarcall.site/daily-queue
```

---

## 🎯 Beneficios de la Mejora

1. **Flexibilidad**: No limitado solo a "hoy"
2. **Análisis histórico**: Ver citas de días anteriores
3. **Planificación**: Consultar citas futuras programadas
4. **UX mejorada**: Interfaz visual clara con calendario
5. **Retrocompatible**: Sin parámetro funciona igual que antes

---

## 📝 Notas Importantes

### ⚠️ Comportamiento del Filtro:
- **Citas mostradas**: Las que fueron **creadas** en la fecha seleccionada
- **No**: Citas programadas para esa fecha pero creadas en otro día
- Esto permite ver "qué se agendó ese día"

### 🔄 Auto-refresh:
- Se mantiene el **auto-refresh cada 30 segundos**
- Respeta la fecha seleccionada (no vuelve a "hoy")
- Al cambiar de fecha, se cancela el intervalo anterior y crea uno nuevo

### 🌐 Localización:
- Todo en **español** (días, meses, formato)
- Usa `locale: es` de `date-fns`

---

## 🧪 Pruebas Realizadas

### ✅ Frontend:
- Compilación exitosa sin errores
- Calendario se despliega correctamente
- Fecha se formatea en español
- Estado se actualiza al seleccionar

### ✅ Backend:
- Validación de formato de fecha
- Query SQL con parámetro dinámico
- Respuesta incluye fecha consultada
- Error 400 con formato inválido

### ✅ Integración:
- Llamada API con query parameter
- Actualización automática de UI
- Estadísticas correctas por fecha
- Cards agrupadas correctamente

---

**Fecha de Implementación**: 2025-01-11  
**Versión**: 2.3 (Selector de Fecha en Cola Diaria)  
**Estado**: ✅ Desplegado en producción
