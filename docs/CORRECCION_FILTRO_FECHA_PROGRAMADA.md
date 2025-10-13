# 🔧 Corrección: Filtro de Citas por Fecha Programada

## 🎯 Problema Identificado

**Antes**: El sistema mostraba las citas que fueron **creadas** en la fecha seleccionada.

**Ahora**: El sistema muestra las citas **programadas/agendadas** para la fecha seleccionada.

---

## ✨ Cambio Implementado

### Comportamiento Anterior (Incorrecto):
```
Usuario selecciona: 8 de octubre de 2025
Sistema mostraba: Citas CREADAS el 8 de octubre
Problema: No muestra las citas que están agendadas para ese día
```

### Comportamiento Actual (Correcto):
```
Usuario selecciona: 8 de octubre de 2025
Sistema muestra: Citas PROGRAMADAS para el 8 de octubre
Correcto: Muestra todas las citas que los pacientes tienen ese día
```

---

## 🔧 Cambios Técnicos en Backend

### Archivo: `/backend/src/routes/appointments.ts`

#### 1. **Query de Lista de Espera**

**Antes:**
```sql
WHERE wl.status = 'pending'
  AND DATE(wl.created_at) = ?  -- ❌ Filtraba por fecha de creación
```

**Ahora:**
```sql
WHERE wl.status = 'pending'
  AND DATE(a.date) = ?  -- ✅ Filtra por fecha de la cita programada
```

#### 2. **Query de Citas Otorgadas**

**Antes:**
```sql
WHERE DATE(app.created_at) = ?  -- ❌ Filtraba por fecha de creación
ORDER BY app.created_at
```

**Ahora:**
```sql
WHERE DATE(app.scheduled_at) = ?  -- ✅ Filtra por fecha programada
ORDER BY app.scheduled_at
```

---

## 🎨 Cambios en Frontend

### Archivo: `/frontend/src/pages/DailyQueue.tsx`

#### 1. **Título Actualizado**

**Antes:**
```tsx
<p className="text-medical-600">
  Asignación automática para: {fecha}
</p>
```

**Ahora:**
```tsx
<p className="text-medical-600">
  Citas programadas para: {fecha}
</p>
```

#### 2. **Descripción de la Lista**

**Antes:**
```tsx
<p className="text-sm text-gray-600">
  Pacientes en espera de asignación para hoy
</p>
```

**Ahora:**
```tsx
<p className="text-sm text-gray-600">
  Pacientes con citas programadas para la fecha seleccionada
</p>
```

---

## 📊 Comparación Visual

### Ejemplo Práctico:

**Fecha Seleccionada**: 8 de octubre de 2025

#### ❌ Comportamiento Anterior:
```
Mostraba:
- Cita #1: Creada el 8/10, programada para el 15/10
- Cita #2: Creada el 8/10, programada para el 20/10
- Cita #3: Creada el 8/10, programada para el 8/10

NO mostraba:
- Cita #4: Creada el 1/10, programada para el 8/10  ← FALTABA
- Cita #5: Creada el 5/10, programada para el 8/10  ← FALTABA
```

#### ✅ Comportamiento Actual:
```
Muestra:
- Cita #3: Programada para el 8/10 (creada el 8/10)
- Cita #4: Programada para el 8/10 (creada el 1/10)
- Cita #5: Programada para el 8/10 (creada el 5/10)

NO muestra:
- Cita #1: Programada para el 15/10
- Cita #2: Programada para el 20/10
```

---

## 🔍 Campos Comparados

### Lista de Espera (`appointments_waiting_list`)

| Campo | Descripción | Uso Anterior | Uso Actual |
|-------|-------------|--------------|------------|
| `wl.created_at` | Cuándo se agregó a lista de espera | ❌ Filtro | ℹ️ Solo info |
| `a.date` | Fecha de la cita programada | ℹ️ Solo info | ✅ Filtro |

**Query:**
```sql
-- Filtro correcto:
WHERE DATE(a.date) = '2025-10-08'
```

### Citas Otorgadas (`appointments`)

| Campo | Descripción | Uso Anterior | Uso Actual |
|-------|-------------|--------------|------------|
| `app.created_at` | Cuándo se creó la cita | ❌ Filtro | ℹ️ Solo info |
| `app.scheduled_at` | Fecha/hora programada | ℹ️ Solo info | ✅ Filtro |

**Query:**
```sql
-- Filtro correcto:
WHERE DATE(app.scheduled_at) = '2025-10-08'
```

---

## 💡 Casos de Uso Reales

### Caso 1: Ver citas de hoy
```
1. Usuario abre "Gestión de Cola Diaria"
2. Por defecto muestra: 8 de octubre de 2025
3. Sistema muestra TODAS las citas programadas para HOY
4. Sin importar cuándo fueron creadas
```

### Caso 2: Ver citas de mañana
```
1. Usuario selecciona: 9 de octubre de 2025
2. Sistema muestra todas las citas programadas para el 9/10
3. Incluye citas creadas hace días o semanas
```

### Caso 3: Planificación semanal
```
1. Usuario revisa lunes 7/10 → Ve citas del lunes
2. Usuario revisa martes 8/10 → Ve citas del martes
3. Usuario revisa miércoles 9/10 → Ve citas del miércoles
4. Cada día muestra solo las citas programadas para ese día
```

---

## 📋 Qué se Muestra Ahora

### Para cada fecha seleccionada:

#### 🟡 **Lista de Espera** (En Cola):
- Pacientes con `status = 'pending'`
- Cuya cita está programada (`a.date`) para la fecha seleccionada
- Aún no han sido confirmados

#### 🟢 **Citas Agendadas** (Confirmadas):
- Citas con `scheduled_at` igual a la fecha seleccionada
- Ya fueron otorgadas/confirmadas
- Tienen doctor, ubicación y horario asignado

---

## 🎯 Estadísticas Actualizadas

Las estadísticas ahora reflejan:

```typescript
{
  total_waiting: // Pacientes en espera CON cita para esta fecha
  total_scheduled: // Citas confirmadas PARA esta fecha
  total_today: // Total de citas de esta fecha (waiting + scheduled)
  by_status: {
    pending: // Citas pendientes programadas para esta fecha
    confirmed: // Citas confirmadas para esta fecha
    completed: // Citas completadas de esta fecha
    cancelled: // Citas canceladas de esta fecha
  },
  by_priority: {
    urgente: // Prioridad urgente en esta fecha
    alta: // Prioridad alta en esta fecha
    normal: // Prioridad normal en esta fecha
    baja: // Prioridad baja en esta fecha
  }
}
```

---

## ✅ Beneficios del Cambio

1. **Visión clara del día**: Sabes exactamente qué citas hay programadas
2. **Planificación precisa**: Puedes ver la carga de trabajo de cada día
3. **Historial correcto**: Consultar citas pasadas muestra lo que realmente ocurrió ese día
4. **Futuro visible**: Ver citas futuras programadas para planificar
5. **Intuitividad**: El comportamiento es el esperado por el usuario

---

## 🔄 Orden de las Citas

### Lista de Espera:
```sql
ORDER BY wl.priority_level, wl.created_at
```
- Primero por prioridad (urgente → alta → normal → baja)
- Luego por orden de creación

### Citas Agendadas:
```sql
ORDER BY app.scheduled_at
```
- Por hora de la cita programada (cronológicamente)

---

## 🧪 Verificación del Cambio

### Prueba Manual:

1. **Crear una cita para mañana** (9 de octubre)
2. **Seleccionar fecha**: 8 de octubre (hoy)
   - ❌ NO debe aparecer la cita
3. **Seleccionar fecha**: 9 de octubre (mañana)
   - ✅ SÍ debe aparecer la cita
4. **Verificar**: La cita aparece en el día correcto

---

## 🚀 Estado del Despliegue

```bash
✅ Backend corregido: queries SQL actualizadas
✅ Frontend actualizado: textos más claros
✅ Backend reiniciado: PM2 (cita-central-backend)
✅ Frontend desplegado: /var/www/biosanarcall/html/
✅ Producción: https://biosanarcall.site/daily-queue
```

---

## 📝 Resumen de Cambios

| Componente | Campo Original | Campo Nuevo | Impacto |
|------------|----------------|-------------|---------|
| **Lista de Espera** | `DATE(wl.created_at)` | `DATE(a.date)` | Muestra citas programadas para la fecha |
| **Citas Otorgadas** | `DATE(app.created_at)` | `DATE(app.scheduled_at)` | Muestra citas programadas para la fecha |
| **Orden Citas** | `app.created_at` | `app.scheduled_at` | Orden cronológico por hora de cita |
| **Título Frontend** | "Asignación automática para" | "Citas programadas para" | Más claro y preciso |
| **Descripción** | "en espera de asignación para hoy" | "con citas programadas para la fecha seleccionada" | Más descriptivo |

---

## 🎓 Lección Aprendida

**Diferencia clave:**
- `created_at` = Cuándo se CREÓ el registro
- `scheduled_at` / `a.date` = Cuándo está PROGRAMADA la cita

**Para cola diaria**: Siempre filtrar por fecha de la cita programada, no por fecha de creación.

---

**Fecha de Corrección**: 2025-01-11  
**Versión**: 2.3.1 (Corrección Filtro por Fecha Programada)  
**Estado**: ✅ Desplegado en producción
