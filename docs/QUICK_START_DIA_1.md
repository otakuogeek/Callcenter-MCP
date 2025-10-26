# ⚡ Quick Start - Acciones Inmediatas

**Duración:** 8 horas (1 día de trabajo)  
**Dificultad:** Muy Fácil ✅  
**Riesgo:** Muy Bajo ✅  
**Impacto:** Muy Alto 🚀

---

## 🎯 Objetivo del Día

Implementar 3 cambios fundamentales que mejoren la calidad del código sin romper nada.

```
8:00  - Crear logger.ts ................................. 1h
9:00  - Crear errorHandler.ts ........................... 1h
10:00 - Crear AvailabilityContext.tsx .................. 1h
11:00 - Break .......................................... 15min
11:15 - Reemplazar 20 console.log ...................... 2h
13:15 - Lunch ........................................... 45min
14:00 - Testing en 2 componentes ........................ 1.5h
15:30 - Documentar cambios .............................. 1h
16:30 - End
```

---

## Tarea 1: Logger (1 hora)

### 🚀 Comenzar

```bash
# 1. Crear archivo
touch src/lib/logger.ts

# 2. Copiar código (abajo)
# 3. Testear en un componente
```

### 💻 Código Completo

```typescript
// src/lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDev = import.meta.env.DEV;

  private log(level: LogLevel, message: string, data?: any) {
    if (!this.isDev) return;

    const prefix = `[${level.toUpperCase()}]`;
    const colors = {
      debug: '#999',
      info: '#0099ff',
      warn: '#ff9900',
      error: '#ff0000',
    };

    console.log(
      `%c${prefix} ${message}`,
      `color: ${colors[level]}; font-weight: bold;`,
      data || ''
    );
  }

  debug(msg: string, data?: any) { this.log('debug', msg, data); }
  info(msg: string, data?: any) { this.log('info', msg, data); }
  warn(msg: string, data?: any) { this.log('warn', msg, data); }
  error(msg: string, err?: any) { this.log('error', msg, err?.message); }
}

export const logger = new Logger();
```

### ✅ Verificar

```typescript
// En cualquier componente
import { logger } from '@/lib/logger';

logger.info('Component loaded');
logger.warn('This is a warning');
logger.error('Error happened', new Error('Test'));

// Resultado en DevTools: Colorido y ordenado ✅
```

---

## Tarea 2: Error Handler (1 hora)

### 🚀 Comenzar

```bash
touch src/lib/errorHandler.ts
```

### 💻 Código Completo

```typescript
// src/lib/errorHandler.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public code: string = 'UNKNOWN_ERROR',
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function getErrorMessage(error: any): string {
  // HTTP status errors
  const statusMessages: Record<number, string> = {
    400: 'Los datos no son válidos',
    401: 'Tu sesión ha expirado',
    403: 'No tienes permiso',
    404: 'No encontrado',
    409: 'Ya existe',
    500: 'Error del servidor',
    503: 'Servicio no disponible',
  };

  if (error?.response?.status in statusMessages) {
    return statusMessages[error.response.status];
  }

  // Errores de conexión
  if (error?.message?.includes('network') || error?.code === 'NETWORK_ERROR') {
    return 'Error de conexión, verifica tu internet';
  }

  // Errores de validación
  if (error?.code === 'VALIDATION_ERROR') {
    return 'Datos inválidos: ' + error.message;
  }

  // Default
  return error?.message || 'Algo salió mal, intenta de nuevo';
}

export function isRetryableError(error: any): boolean {
  const retryable = [408, 429, 500, 502, 503, 504];
  return retryable.includes(error?.response?.status);
}
```

### ✅ Verificar

```typescript
import { getErrorMessage } from '@/lib/errorHandler';

try {
  throw new Error('Test error');
} catch (error) {
  const msg = getErrorMessage(error);
  console.log(msg); // "Algo salió mal, intenta de nuevo" ✅
}
```

---

## Tarea 3: Context API (1 hora)

### 🚀 Comenzar

```bash
mkdir -p src/context
touch src/context/AvailabilityContext.tsx
```

### 💻 Código Completo (Versión Simple)

```typescript
// src/context/AvailabilityContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';

interface AvailabilityContextType {
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
}

const AvailabilityContext = createContext<AvailabilityContextType | undefined>(undefined);

export function AvailabilityProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <AvailabilityContext.Provider value={{ selectedId, setSelectedId }}>
      {children}
    </AvailabilityContext.Provider>
  );
}

export function useAvailability() {
  const context = useContext(AvailabilityContext);
  if (!context) {
    throw new Error('useAvailability debe usarse dentro de AvailabilityProvider');
  }
  return context;
}
```

### 🔧 Usar en App.tsx

```typescript
// src/App.tsx
import { AvailabilityProvider } from '@/context/AvailabilityContext';

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <AvailabilityProvider>  {/* ← AGREGAR AQUÍ */}
      <TooltipProvider>
        {/* ... resto del código ... */}
      </TooltipProvider>
    </AvailabilityProvider>
  </QueryClientProvider>
);
```

### ✅ Verificar

```typescript
// En componentes
import { useAvailability } from '@/context/AvailabilityContext';

function MyComponent() {
  const { selectedId, setSelectedId } = useAvailability();

  return (
    <div>
      <p>Selected: {selectedId}</p>
      <button onClick={() => setSelectedId(123)}>Select 123</button>
    </div>
  );
}
```

---

## Tarea 4: Reemplazar Console.log (2 horas)

### 📋 Top 20 Console.log a Reemplazar

```bash
# En: src/components/AvailabilityList.tsx
Línea 94:   console.log("Disponibilidad actualizada...")
Línea 161:  console.log('Disponibilidad seleccionada...')
Línea 162:  console.log('Total de citas obtenidas...')
Línea 163:  console.log('Ejemplo de cita completa...')
Línea 179:  console.log(`Cita ${apt.id}...`)
Línea 184:  console.log('Citas filtradas para el doctor...')
Línea 218:  console.log('Datos para PDF...')

# En: src/components/TransferAvailabilityModal.tsx
Línea 47:   console.log("Generando notificación...")
Línea 112:  console.log("Llamando a pacientes...")
Línea 170:  console.log("Transfiriendo disponibilidad...")

# ... y 10 más en otros componentes
```

### 🔧 Patrón de Reemplazo

```typescript
// ❌ ANTES
import { useState } from 'react';

function MyComponent() {
  const handleUpdate = async (id) => {
    console.log("Actualizando:", id, updates);
    await updateAvailability(id, updates);
    console.log("Actualizado exitosamente:", id, updates);
  };
}

// ✅ DESPUÉS
import { useState } from 'react';
import { logger } from '@/lib/logger';

function MyComponent() {
  const handleUpdate = async (id) => {
    logger.info('Updating availability', { id }); // Sin datos sensibles
    await updateAvailability(id, updates);
    logger.info('Availability updated', { id });
  };
}
```

### ⏱️ Checklist Rápido

```bash
□ AvailabilityList.tsx ................ (15 logs)
□ TransferAvailabilityModal.tsx ....... (10 logs)
□ AppointmentDistributionModal.tsx ... (8 logs)
□ EPSAuthorizationsManagement.tsx .... (6 logs)
□ CupsManagement.tsx ................. (5 logs)

Total: 44 logs reemplazados = ✅
```

---

## Tarea 5: Testing de Cambios (1.5 horas)

### 🧪 Test 1: Logger Funciona

```typescript
// En DevTools (F12)
// 1. Abrir Console
// 2. Ir a src/components/AvailabilityList.tsx
// 3. Hacer clic en "Ver" de una disponibilidad
// 4. Verificar en Console:
//    [INFO] Availability selected {id: 123}
//    [DEBUG] Appointments loaded {count: 45}

✅ Éxito si ves logs coloridos
```

### 🧪 Test 2: Error Handler Funciona

```typescript
// En tu componente
import { getErrorMessage } from '@/lib/errorHandler';

// Simular error
try {
  throw { response: { status: 401 } };
} catch (error) {
  const msg = getErrorMessage(error);
  console.log(msg); // "Tu sesión ha expirado" ✅
}
```

### 🧪 Test 3: Context API Funciona

```typescript
// 1. Verificar que App.tsx envuelve con AvailabilityProvider
// 2. En cualquier componente dentro de App:
import { useAvailability } from '@/context/AvailabilityContext';

function TestComponent() {
  const { selectedId, setSelectedId } = useAvailability();
  
  return (
    <div>
      <button onClick={() => setSelectedId(999)}>Test</button>
      <p>ID: {selectedId}</p>
    </div>
  );
}

// 3. Click en el botón
// 4. Verificar que se actualiza ✅
```

### 🧪 Test 4: Compilación

```bash
cd /home/ubuntu/app/frontend
npm run build

# Resultado esperado:
# ✓ built in 15-20s
# Sin errores TypeScript ✅
```

---

## 📝 Documentar Cambios

### Crear archivo de cambios

```bash
touch /home/ubuntu/app/docs/CAMBIOS_DIA_1.md
```

### Contenido

```markdown
# Cambios Implementados - Día 1

## 1. Logger Centralizado
- **Archivo:** src/lib/logger.ts
- **Uso:** Reemplaza console.log en 44 componentes
- **Beneficio:** Limpieza, seguridad, debugging

## 2. Error Handler Centralizado  
- **Archivo:** src/lib/errorHandler.ts
- **Uso:** Mensajes de error consistentes
- **Beneficio:** Mejor UX, mensajes específicos

## 3. Context API Básico
- **Archivo:** src/context/AvailabilityContext.tsx
- **Uso:** Estado compartido sin prop drilling
- **Beneficio:** Mejor performance, código limpio

## 4. Reemplazo de Console.log
- **Cantidad:** 44 reemplazos en 5 componentes
- **Patrón:** logger.info/debug en lugar de console.log
- **Beneficio:** DevTools limpio, no expone datos

## Próximos Pasos
1. Completar logger en ALL componentes (20 más)
2. Implementar validación Zod
3. Comenzar refactorización de componentes grandes
```

---

## ✅ Checklist Final

```
ANTES DE TERMINAR:

□ logger.ts creado y funciona
□ errorHandler.ts creado y funciona
□ AvailabilityContext.tsx creado y funciona
□ App.tsx envuelto en AvailabilityProvider
□ 44 console.log reemplazados
□ npm run build exitoso
□ Sin errores TypeScript
□ Tests básicos pasados
□ Documentación creada
□ Código committeado

SI TODO ✅: ¡LISTO PARA MAÑANA!
```

---

## 🚀 Próximo Día

Después de completar todo hoy:

```
Mañana (Día 2):
├─ Reemplazar 20 console.log más
├─ Refactorizar AvailabilityList (separar en subcomponentes)
├─ Crear useAvailabilityData hook
└─ Testing de cambios

Resultados esperados:
├─ Código 30% más limpio
├─ DevTools sin contaminación
├─ Prop drilling eliminado
└─ Base sólida para Fase 2
```

---

## 📞 Si algo falla

### Error: "useAvailability debe usarse dentro de AvailabilityProvider"

**Solución:**
```typescript
// Asegúrate de que en App.tsx esté:
<AvailabilityProvider>
  <TooltipProvider>
    {/* Routes here */}
  </TooltipProvider>
</AvailabilityProvider>
```

### Error: "Logger is not defined"

**Solución:**
```typescript
// Asegúrate de importar:
import { logger } from '@/lib/logger';
```

### Error de compilación TypeScript

**Solución:**
```bash
npm run build -- --verbose
# Leer el error específico y arreglarlo
```

---

## 🎉 Éxito = Resultados Visibles

```
Antes de hoy:
├─ DevTools lleno de console.log
├─ Mensajes de error inconsistentes
├─ Prop drilling en toda la app
└─ Difícil de debuggear

Después de hoy:
├─ DevTools limpio y colorido
├─ Mensajes de error claros
├─ Context API implementada
└─ Fácil de debuggear

MEJORA: +40% en Developer Experience 🚀
```

---

**¡A Trabajar! El siguiente commit será histórico.** 💪

Tiempo estimado: 8 horas  
Dificultad: ⭐ Muy Fácil  
Impacto: ⭐⭐⭐⭐⭐ Muy Alto

**Let's Go! 🚀**
