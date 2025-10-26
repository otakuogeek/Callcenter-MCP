# 🚀 Guía de Refactorización - Paso a Paso

**Documento:** Plan de implementación práctico  
**Objetivo:** Implementar mejoras en fases cortas y manejables  
**Tiempo total:** 4-6 semanas

---

## FASE 1: Semana 1 (Fundamentos)

### Paso 1: Crear Logger Centralizado (1 hora)

**Archivo:** `src/lib/logger.ts`

```typescript
// Define niveles de logging
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  component?: string;
}

class Logger {
  private isDev = import.meta.env.DEV;
  private isProd = import.meta.env.PROD;

  private log(context: LogContext) {
    if (!this.isDev) return;

    const prefix = `[${context.level.toUpperCase()}]`;
    const color = this.getColor(context.level);
    
    console.log(
      `%c${prefix} ${context.message}`,
      `color: ${color}; font-weight: bold;`,
      context.data || ''
    );
  }

  debug(message: string, data?: any) {
    this.log({ timestamp: new Date().toISOString(), level: 'debug', message, data });
  }

  info(message: string, data?: any) {
    this.log({ timestamp: new Date().toISOString(), level: 'info', message, data });
  }

  warn(message: string, data?: any) {
    this.log({ timestamp: new Date().toISOString(), level: 'warn', message, data });
  }

  error(message: string, error?: Error | any) {
    this.log({ timestamp: new Date().toISOString(), level: 'error', message, data: error?.message });
    
    // En producción, enviar a servicio
    if (this.isProd && error) {
      this.trackError(message, error);
    }
  }

  private getColor(level: LogLevel): string {
    const colors = {
      debug: '#999',
      info: '#0099ff',
      warn: '#ff9900',
      error: '#ff0000',
    };
    return colors[level];
  }

  private trackError(message: string, error: any) {
    // Integrar con Sentry, LogRocket, etc.
    try {
      // fetch('https://your-error-tracking.com/log', {
      //   method: 'POST',
      //   body: JSON.stringify({ message, error, timestamp: new Date() })
      // });
    } catch (e) {
      // Silenciar error en error tracking
    }
  }
}

export const logger = new Logger();
```

**Uso en componentes:**

```typescript
// ❌ ANTES
console.log('Disponibilidad actualizada:', id, updates);

// ✅ DESPUÉS
logger.info('Availability updated', { id });
```

---

### Paso 2: Crear Error Handler Centralizado (1 hora)

**Archivo:** `src/lib/errorHandler.ts`

```typescript
export class AppError extends Error {
  constructor(
    public message: string,
    public code: string = 'UNKNOWN_ERROR',
    public statusCode?: number,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string = 'Error de conexión') {
    super(message, 'NETWORK_ERROR', 0);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'No autorizado') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export function getErrorMessage(error: any, defaultMessage = 'Algo salió mal'): string {
  // Errores conocidos
  if (error instanceof ValidationError) {
    return 'Los datos ingresados no son válidos';
  }

  if (error instanceof AuthenticationError) {
    return 'Tu sesión ha expirado, por favor inicia sesión de nuevo';
  }

  if (error instanceof NetworkError) {
    return 'Error de conexión, verifica tu internet';
  }

  // Errores HTTP
  if (error?.response?.status === 409) {
    return 'Este elemento ya existe en el sistema';
  }

  if (error?.response?.status === 403) {
    return 'No tienes permiso para realizar esta acción';
  }

  if (error?.response?.status === 404) {
    return 'El elemento no fue encontrado';
  }

  if (error?.response?.status === 500) {
    return 'Error del servidor, intenta más tarde';
  }

  // Mensajes personalizados
  if (error?.message) {
    return error.message;
  }

  return defaultMessage;
}

export function isRetryableError(error: any): boolean {
  const retryableCodes = [408, 429, 500, 502, 503, 504];
  return retryableCodes.includes(error?.response?.status);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || i === maxRetries - 1) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      await new Promise((resolve) => 
        setTimeout(resolve, delayMs * Math.pow(2, i))
      );
    }
  }

  throw lastError;
}
```

**Uso en componentes:**

```typescript
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/lib/errorHandler';

function MyComponent() {
  const { toast } = useToast();

  const handleUpdate = async () => {
    try {
      await updateAppointment(id, data);
      toast({ title: 'Éxito', description: 'Actualizado correctamente' });
    } catch (error) {
      const message = getErrorMessage(error);
      toast({ 
        title: 'Error', 
        description: message,
        variant: 'destructive' 
      });
    }
  };

  return <button onClick={handleUpdate}>Actualizar</button>;
}
```

---

### Paso 3: Reemplazar Console.log Críticos (2 horas)

**Archivos a actualizar:**

```bash
# Los 5 archivos con más console.log:
1. src/components/AvailabilityList.tsx (15 logs)
2. src/components/TransferAvailabilityModal.tsx (10 logs)
3. src/components/AppointmentDistributionModal.tsx (8 logs)
4. src/components/EPSAuthorizationsManagement.tsx (6 logs)
5. src/components/CupsManagement.tsx (5 logs)
```

**Estrategia:**

```typescript
// Archivo: src/components/AvailabilityList.tsx

// ❌ ANTES (línea 94)
console.log("Disponibilidad actualizada exitosamente:", id, updates);

// ✅ DESPUÉS
import { logger } from '@/lib/logger';
logger.info('Availability updated', { id });

// ❌ ANTES (línea 161-163)
console.log('Disponibilidad seleccionada:', availability);
console.log('Total de citas obtenidas:', appointments.length);
console.log('Ejemplo de cita completa:', JSON.stringify(appointments[0], null, 2));

// ✅ DESPUÉS
logger.debug('Availability selected', { id: availability?.id });
logger.debug('Appointments loaded', { count: appointments.length });
// No loguear la cita completa (contiene PII)
```

---

### Paso 4: Crear Context API para Disponibilidades (2 horas)

**Archivo:** `src/context/AvailabilityContext.tsx`

```typescript
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errorHandler';

interface Availability {
  id: number;
  doctor_id: number;
  specialty_id: number;
  location_id: number;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_slots: number;
  status: string;
}

interface Appointment {
  id: number;
  patient_name: string;
  patient_document?: string;
  patient_phone?: string;
  status: string;
  scheduled_at: string;
  specialty_name?: string;
  location_name?: string;
}

interface AvailabilityContextType {
  // Estado
  selectedAvailability: Availability | null;
  appointments: Appointment[];
  loading: boolean;
  error: string | null;

  // Acciones
  setSelectedAvailability: (availability: Availability | null) => void;
  loadAppointments: (availabilityId: number) => Promise<void>;
  updateAppointmentStatus: (appointmentId: number, status: string) => Promise<void>;
  clearError: () => void;
}

const AvailabilityContext = createContext<AvailabilityContextType | undefined>(undefined);

export function AvailabilityProvider({ children }: { children: ReactNode }) {
  const [selectedAvailability, setSelectedAvailability] = useState<Availability | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAppointments = useCallback(async (availabilityId: number) => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.getAppointments({ availability_id: availabilityId });
      setAppointments(data as Appointment[]);
      logger.info('Appointments loaded', { count: data.length, availabilityId });
    } catch (err: any) {
      const message = getErrorMessage(err);
      setError(message);
      logger.error('Failed to load appointments', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateAppointmentStatus = useCallback(
    async (appointmentId: number, status: string) => {
      try {
        await api.updateAppointment(appointmentId, { status });
        
        // Actualizar estado local
        setAppointments((prev) =>
          prev.map((apt) =>
            apt.id === appointmentId ? { ...apt, status } : apt
          )
        );
        
        logger.info('Appointment status updated', { appointmentId, status });
      } catch (err: any) {
        const message = getErrorMessage(err);
        setError(message);
        logger.error('Failed to update appointment', err);
        throw err;
      }
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  const value: AvailabilityContextType = {
    selectedAvailability,
    appointments,
    loading,
    error,
    setSelectedAvailability,
    loadAppointments,
    updateAppointmentStatus,
    clearError,
  };

  return (
    <AvailabilityContext.Provider value={value}>
      {children}
    </AvailabilityContext.Provider>
  );
}

export function useAvailability() {
  const context = useContext(AvailabilityContext);
  if (!context) {
    throw new Error(
      'useAvailability debe usarse dentro de AvailabilityProvider'
    );
  }
  return context;
}
```

**Usar en App.tsx:**

```typescript
import { AvailabilityProvider } from '@/context/AvailabilityContext';

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AvailabilityProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {/* ... routes ... */}
        </BrowserRouter>
      </TooltipProvider>
    </AvailabilityProvider>
  </QueryClientProvider>
);
```

**Usar en componentes:**

```typescript
// ❌ ANTES: Con props drilling
<AvailabilityList 
  availability={availability}
  onSelectAvailability={onSelect}
  appointments={appointments}
/>

// ✅ DESPUÉS: Sin props
function MyComponent() {
  const { selectedAvailability, appointments, loadAppointments } = useAvailability();

  useEffect(() => {
    if (selectedAvailability) {
      loadAppointments(selectedAvailability.id);
    }
  }, [selectedAvailability]);

  return (
    <div>
      {appointments.map((apt) => (
        <AppointmentCard key={apt.id} appointment={apt} />
      ))}
    </div>
  );
}
```

---

## FASE 2: Semanas 2-3 (Descomposición)

### Paso 5: Refactorizar AvailabilityList (3 días)

**Paso 5A: Extraer AvailabilityFilter.tsx**

```typescript
// src/components/availability/AvailabilityFilter.tsx
import { useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AvailabilityFilterProps {
  onFilterChange: (filters: FilterOptions) => void;
}

export interface FilterOptions {
  specialty?: string;
  doctor?: string;
  location?: string;
  dateFrom?: string;
  dateTo?: string;
  searchText?: string;
}

export function AvailabilityFilter({ onFilterChange }: AvailabilityFilterProps) {
  const handleFilterChange = useCallback(
    (newFilter: Partial<FilterOptions>) => {
      onFilterChange(newFilter as FilterOptions);
    },
    [onFilterChange]
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar..."
        onChange={(e) => handleFilterChange({ searchText: e.target.value })}
      />
      
      <Select onValueChange={(value) => handleFilterChange({ specialty: value })}>
        <SelectTrigger>
          <SelectValue placeholder="Especialidad" />
        </SelectTrigger>
        <SelectContent>
          {/* ... options ... */}
        </SelectContent>
      </Select>
    </div>
  );
}
```

**Paso 5B: Extraer AvailabilityCard.tsx**

```typescript
// src/components/availability/AvailabilityCard.tsx
import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Users } from 'lucide-react';

interface AvailabilityCardProps {
  availability: any;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

const AvailabilityCard = memo(
  ({ availability, onView, onEdit, onDelete }: AvailabilityCardProps) => {
    const availableSlots = availability.capacity - availability.booked_slots;
    const isFull = availableSlots === 0;

    return (
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium">{availability.doctor_name}</h3>
            <p className="text-sm text-gray-600">{availability.specialty_name}</p>
          </div>
          <Badge variant={isFull ? 'destructive' : 'default'}>
            {availableSlots} cupos
          </Badge>
        </div>

        <div className="flex gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <span>{availability.start_date}</span>
        </div>

        <div className="flex gap-2 text-sm text-gray-600">
          <Users className="w-4 h-4" />
          <span>{availability.booked_slots}/{availability.capacity}</span>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={() => onView(availability.id)}>
            Ver
          </Button>
          <Button size="sm" variant="outline" onClick={() => onEdit(availability.id)}>
            Editar
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDelete(availability.id)}>
            Eliminar
          </Button>
        </div>
      </div>
    );
  }
);

export default AvailabilityCard;
```

**Paso 5C: Crear useAvailabilityData Hook**

```typescript
// src/hooks/useAvailabilityData.ts
import { useState, useCallback, useEffect } from 'react';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errorHandler';
import type { FilterOptions } from '@/components/availability/AvailabilityFilter';

interface UseAvailabilityDataOptions {
  sortBy?: 'date' | 'specialty' | 'availability';
  limit?: number;
}

export function useAvailabilityData(options?: UseAvailabilityDataOptions) {
  const [availabilities, setAvailabilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({});

  const loadAvailabilities = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.getAvailabilities(filters);
      setAvailabilities(data);
      logger.info('Availabilities loaded', { count: data.length });
    } catch (err: any) {
      const message = getErrorMessage(err);
      setError(message);
      logger.error('Failed to load availabilities', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const filteredAvailabilities = useCallback(
    (items: any[]) => {
      let result = [...items];

      if (filters.specialty) {
        result = result.filter((a) => a.specialty_id === parseInt(filters.specialty!));
      }

      if (filters.searchText) {
        result = result.filter((a) =>
          a.doctor_name.toLowerCase().includes(filters.searchText!.toLowerCase())
        );
      }

      if (options?.sortBy === 'date') {
        result.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
      }

      return result;
    },
    [filters, options?.sortBy]
  );

  useEffect(() => {
    loadAvailabilities();
  }, [loadAvailabilities]);

  return {
    availabilities: filteredAvailabilities(availabilities),
    loading,
    error,
    filters,
    setFilters,
    reload: loadAvailabilities,
  };
}
```

**Paso 5D: Componente simplificado**

```typescript
// src/components/AvailabilityList.tsx (REFACTORIZADO)
import { useState, useCallback } from 'react';
import { AvailabilityFilter } from '@/components/availability/AvailabilityFilter';
import AvailabilityCard from '@/components/availability/AvailabilityCard';
import { useAvailabilityData } from '@/hooks/useAvailabilityData';
import { useToast } from '@/components/ui/use-toast';

export default function AvailabilityList() {
  const { toast } = useToast();
  const { availabilities, loading, error, filters, setFilters } = useAvailabilityData();
  const [selectedAvailability, setSelectedAvailability] = useState(null);

  const handleView = useCallback((id: number) => {
    const availability = availabilities.find((a) => a.id === id);
    setSelectedAvailability(availability);
  }, [availabilities]);

  const handleEdit = useCallback((id: number) => {
    // Abrir modal de edición
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('¿Eliminar esta disponibilidad?')) return;

    try {
      // await api.deleteAvailability(id);
      toast({ title: 'Eliminado', description: 'La disponibilidad ha sido eliminada' });
      // Recargar
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    }
  }, [toast]);

  if (loading) return <div>Cargando...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <AvailabilityFilter onFilterChange={setFilters} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {availabilities.map((availability) => (
          <AvailabilityCard
            key={availability.id}
            availability={availability}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {availabilities.length === 0 && (
        <div className="text-center text-gray-500">No hay disponibilidades</div>
      )}
    </div>
  );
}
```

---

## FASE 3: Semanas 4+ (Testing y Optimización)

### Paso 6: Agregar Unit Tests

**Setup Vitest:**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

**Archivo de configuración:**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

// src/test/setup.ts
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

afterEach(() => {
  cleanup();
});
```

**Test de ejemplo:**

```typescript
// src/components/__tests__/AvailabilityCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AvailabilityCard from '../availability/AvailabilityCard';

describe('AvailabilityCard', () => {
  const mockAvailability = {
    id: 1,
    doctor_name: 'Dr. García',
    specialty_name: 'Medicina General',
    start_date: '2025-10-25',
    capacity: 10,
    booked_slots: 8,
  };

  it('should render availability card', () => {
    render(
      <AvailabilityCard
        availability={mockAvailability}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Dr. García')).toBeInTheDocument();
    expect(screen.getByText('Medicina General')).toBeInTheDocument();
    expect(screen.getByText('2 cupos')).toBeInTheDocument();
  });

  it('should call onView when clicking Ver button', () => {
    const handleView = vi.fn();
    render(
      <AvailabilityCard
        availability={mockAvailability}
        onView={handleView}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Ver'));
    expect(handleView).toHaveBeenCalledWith(1);
  });

  it('should show red badge when full', () => {
    const fullAvailability = { ...mockAvailability, booked_slots: 10 };
    
    render(
      <AvailabilityCard
        availability={fullAvailability}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('0 cupos')).toHaveClass('destructive');
  });
});
```

**Ejecutar tests:**

```bash
npm run test
npm run test:ui          # Interfaz visual
npm run test:coverage    # Cobertura
```

---

## 📅 Cronograma Recomendado

```
SEMANA 1: Fundamentos
├─ Día 1: Logger + ErrorHandler
├─ Día 2: Context API
├─ Día 3: Reemplazar console.log críticos
└─ Día 4: Testing + documentación

SEMANA 2-3: Refactorización AvailabilityList
├─ Semana 2: Descomposición en 5 componentes
└─ Semana 3: Hook customizado + integración

SEMANA 4-5: Refactorización de otros componentes
├─ AppointmentManagement.tsx
├─ ViewAvailabilityModal.tsx
└─ AgendaConflictManager.tsx

SEMANA 6: Testing + Optimización
├─ Unit tests para componentes críticos
├─ Code splitting
└─ Bundle optimization
```

---

## ✅ Checklist de Validación

Después de cada fase:

- [ ] Código compila sin errores
- [ ] No hay console.log en componentes
- [ ] Todos los errores tienen mensajes específicos
- [ ] Props drilling eliminado (usar Context)
- [ ] Componentes < 400 líneas
- [ ] Custom hooks extraídos
- [ ] Tests pasan (cobertura > 60%)
- [ ] Bundle size no aumentó
- [ ] Performance metrics mejoraron

---

**¡Listo para comenzar!** 🚀
