# Sistema de Rango de Posiciones para Envío de SMS Masivo

## ✅ Funcionalidad Implementada

Se ha agregado la capacidad de seleccionar un **rango específico de posiciones** en la lista de espera para el envío de SMS masivos.

## 🎯 Características

### Frontend (`BulkSMSModal.tsx`)

**Nuevos campos agregados:**

1. **Desde posición** (from_position)
   - Valor por defecto: 1
   - Mínimo: 1
   - Máximo: Total de pacientes elegibles
   - Auto-ajusta "Hasta posición" si es necesario

2. **Hasta posición** (to_position)
   - Valor por defecto: 50
   - Mínimo: Valor de "Desde posición"
   - Máximo: Total de pacientes elegibles

**Funcionalidades:**

- ✅ Validación automática de rangos
- ✅ Ajuste dinámico al cambiar "Desde posición"
- ✅ Resumen visual del total de SMS a enviar
- ✅ Descripción del rango seleccionado
- ✅ Integración con filtro de especialidad

### Backend (`sms.routes.ts`)

**Endpoint actualizado:** `POST /api/sms/send-bulk-waiting-list`

**Nuevos parámetros opcionales:**

```typescript
{
  specialty_id?: number,     // Filtrar por especialidad (opcional)
  max_count: number,         // Para compatibilidad
  from_position?: number,    // Posición inicial (default: 1)
  to_position?: number       // Posición final (default: max_count)
}
```

**Lógica implementada:**

```typescript
// Calcular offset y limit para SQL
const fromPos = from_position || 1;
const toPos = to_position || max_count;
const offset = fromPos - 1;  // SQL OFFSET empieza en 0
const limit = toPos - fromPos + 1;

// Aplicar en query
LIMIT ? OFFSET ?
```

## 📋 Ejemplo de Uso

### Caso 1: Enviar a las primeras 50 posiciones de Ecografías

1. Seleccionar especialidad: **Ecografías**
2. Desde posición: **1**
3. Hasta posición: **50**
4. Total de SMS: **50**

### Caso 2: Enviar de la posición 51 a la 100 de Medicina Interna

1. Seleccionar especialidad: **Medicina Interna**
2. Desde posición: **51**
3. Hasta posición: **100**
4. Total de SMS: **50**

### Caso 3: Enviar a todas las especialidades (posiciones 1-200)

1. Seleccionar: **Todas las especialidades**
2. Desde posición: **1**
3. Hasta posición: **200**
4. Total de SMS: **200**

## 🔍 Orden de Envío

Los pacientes se ordenan por:

1. **Prioridad** (urgent → high → normal → low)
2. **Fecha de creación** (FIFO dentro de cada prioridad)

Luego se aplica el rango de posiciones sobre esta lista ordenada.

## 🎨 Interfaz Visual

```
┌─────────────────────────────────────────────┐
│  Filtrar por Especialidad                   │
│  [Dropdown: Ecografías (232)]               │
├─────────────────────────────────────────────┤
│  Desde posición    │  Hasta posición        │
│  (Mínimo: 1)       │  (Máximo: 232)         │
│  [  1  ]           │  [  50  ]              │
├─────────────────────────────────────────────┤
│  📊 Total de SMS a enviar: 50               │
│  Se enviarán SMS desde la posición 1 hasta  │
│  la 50 de la lista de espera para Ecografías│
└─────────────────────────────────────────────┘
```

## 📊 Validaciones Implementadas

### Frontend
- ✅ La posición inicial debe ser al menos 1
- ✅ La posición final debe ser mayor o igual a la inicial
- ✅ No puede superar el total de pacientes elegibles

### Backend
- ✅ Validación de rango válido (toPos >= fromPos)
- ✅ Cálculo correcto de OFFSET y LIMIT
- ✅ Log detallado del rango seleccionado

## 🚀 Estado del Sistema

- ✅ Backend compilado y reiniciado
- ✅ Frontend compilado correctamente
- ✅ Cambios verificados en bundles
- ✅ Parámetros `from_position` y `to_position` detectados en código compilado

## 📝 Archivos Modificados

1. **Frontend:**
   - `/frontend/src/components/BulkSMSModal.tsx`
     - Agregados estados: `fromPosition`, `toPosition`
     - Reemplazado input de cantidad por 2 inputs de rango
     - Agregado resumen visual del rango
     - Actualizada lógica de validación y envío

2. **Backend:**
   - `/backend/src/routes/sms.routes.ts`
     - Actualizada documentación del endpoint
     - Agregados parámetros `from_position` y `to_position`
     - Implementada lógica de OFFSET y LIMIT
     - Agregado logging del rango seleccionado

## 🎯 Próximos Pasos Recomendados

1. Probar el envío con diferentes rangos
2. Verificar logs del backend para confirmar rangos correctos
3. Validar que los SMS lleguen a los pacientes correctos
4. Considerar agregar indicador visual de posición en la lista de espera

---

**Fecha de implementación:** 1 de noviembre de 2025
**Sistema:** Biosanarcall Medical System - SMS Masivo
