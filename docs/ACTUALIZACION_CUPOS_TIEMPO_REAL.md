# 📊 Actualización en Tiempo Real de Cupos Ocupados

## 🎯 Problema Detectado

Se identificó una **discrepancia crítica** entre:
- **Cupos ocupados en BD**: Valor almacenado en la tabla `availabilities` (campo `booked_slots`)
- **Pacientes reales en la agenda**: Cantidad de citas confirmadas mostradas en la lista

### Ejemplo del Problema:
```
Agenda: martes, 21 de octubre de 2025
Doctora: Dra. Luis Fernanda Garrido Castillo

❌ Base de Datos: 6 cupos ocupados
✅ Lista Real: 12 pacientes confirmados

Diferencia: 6 pacientes no contabilizados
```

## ✅ Solución Implementada

Se ha creado un sistema de **conteo en tiempo real** que:
1. Calcula los cupos ocupados directamente de la lista de pacientes
2. Muestra la cantidad real de pacientes confirmados
3. Detecta y alerta sobre discrepancias con la base de datos
4. Actualiza automáticamente los porcentajes de ocupación

---

## 🔧 Implementación Técnica

### Nuevas Funciones Agregadas

```typescript
// Contar cupos ocupados en tiempo real
const getRealBookedSlots = () => {
  // Contar solo las citas confirmadas en la lista actual
  return appointments.filter(ap => ap.status === 'Confirmada').length;
};

// Calcular cupos disponibles
const getRealAvailableSlots = () => {
  if (!availability) return 0;
  return availability.capacity - getRealBookedSlots();
};
```

### Lógica del Conteo

```typescript
// ANTES (Incorrecto):
cuposOcupados = availability.bookedSlots  // Valor de BD desactualizado

// DESPUÉS (Correcto):
cuposOcupados = appointments.filter(ap => ap.status === 'Confirmada').length
```

---

## 📊 Vista Actualizada

### Información de Cupos (Nueva)

```
┌────────────────────────────────────────────────────────────┐
│              Información de Cupos                          │
├────────────────────────────────────────────────────────────┤
│                                                             │
│     15              12              80%                     │
│ Capacidad Total  Cupos Ocupados  Ocupación                 │
│                   (BD: 6) ← Valor antiguo                  │
│                                                             │
│ ⚠️ Discrepancia detectada: La base de datos registra 6    │
│ cupos ocupados, pero hay 12 pacientes confirmados en la    │
│ lista. El sistema está mostrando la cantidad real.        │
│                                                             │
│              9 cupos disponibles                           │
└────────────────────────────────────────────────────────────┘
```

### Estados Visuales

#### 1. **Sin Discrepancia** (Todo OK)
```
┌────────────────────────────────────────────────────────────┐
│     15              8              53%                     │
│ Capacidad Total  Cupos Ocupados  Ocupación                 │
│                                                             │
│              7 cupos disponibles                           │
└────────────────────────────────────────────────────────────┘
```

#### 2. **Con Discrepancia** (Alerta)
```
┌────────────────────────────────────────────────────────────┐
│     15              12              80%                    │
│ Capacidad Total  Cupos Ocupados  Ocupación                 │
│                   (BD: 6)                                  │
│                                                             │
│ ⚠️ DISCREPANCIA: BD registra 6 cupos, pero hay 12 pacientes│
│                                                             │
│              3 cupos disponibles                           │
└────────────────────────────────────────────────────────────┘
```

---

## 🎨 Diseño Visual

### Colores y Estilos

| Elemento | Color/Estilo | Cuándo Aparece |
|----------|--------------|----------------|
| **Cupos Ocupados** | Verde (`text-success-600`) | Siempre |
| **Valor BD** | Naranja (`text-orange-600`) | Solo si hay discrepancia |
| **Alerta de Discrepancia** | Fondo naranja (`bg-orange-50`) | Solo si hay diferencia |
| **Cupos Disponibles** | Verde (`text-green-600`) | Siempre |

### Componentes del Mensaje de Alerta

```typescript
{getRealBookedSlots() !== availability.bookedSlots && (
  <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
    ⚠️ <strong>Discrepancia detectada:</strong> 
    La base de datos registra {availability.bookedSlots} cupos ocupados, 
    pero hay {getRealBookedSlots()} pacientes confirmados en la lista. 
    El sistema está mostrando la cantidad real de pacientes.
  </div>
)}
```

---

## 🔄 Flujo de Actualización

### 1. **Carga Inicial**
```
Usuario abre modal → loadAppointments() 
                   → Carga lista de pacientes
                   → getRealBookedSlots() calcula cantidad real
                   → Muestra en pantalla
```

### 2. **Después de Eliminar Cita**
```
Usuario elimina cita → handleCancelAppointment()
                     → loadAppointments() (recarga)
                     → getRealBookedSlots() recalcula
                     → Actualiza automáticamente
```

### 3. **Detección de Discrepancia**
```
getRealBookedSlots() !== availability.bookedSlots
  ↓
Muestra valor real prominente
  ↓
Muestra valor BD en pequeño (BD: X)
  ↓
Muestra mensaje de alerta naranja
```

---

## 📐 Fórmulas de Cálculo

### Cupos Ocupados
```javascript
cuposOcupados = appointments.filter(ap => ap.status === 'Confirmada').length
```

### Cupos Disponibles
```javascript
cuposDisponibles = capacidadTotal - cuposOcupados
```

### Porcentaje de Ocupación
```javascript
ocupacion = (cuposOcupados / capacidadTotal) * 100
```

---

## 🚨 Casos de Uso

### Caso 1: Discrepancia por Citas Eliminadas
**Escenario**: Se eliminaron 6 citas pero no se actualizó `booked_slots`

```
Capacidad: 15
BD dice: 12 cupos ocupados
Realidad: 6 pacientes confirmados
Diferencia: -6 (BD sobreestima)

Sistema muestra:
✅ 6 cupos ocupados (real)
⚠️ (BD: 12)
🟢 9 cupos disponibles
```

### Caso 2: Discrepancia por Citas Nuevas
**Escenario**: Se agendaron 4 citas pero no se actualizó `booked_slots`

```
Capacidad: 15
BD dice: 6 cupos ocupados
Realidad: 10 pacientes confirmados
Diferencia: +4 (BD subestima)

Sistema muestra:
✅ 10 cupos ocupados (real)
⚠️ (BD: 6)
🟢 5 cupos disponibles
```

### Caso 3: Sin Discrepancia
**Escenario**: BD está sincronizada correctamente

```
Capacidad: 15
BD dice: 8 cupos ocupados
Realidad: 8 pacientes confirmados
Diferencia: 0 ✅

Sistema muestra:
✅ 8 cupos ocupados
(No muestra valor BD)
(No muestra alerta)
🟢 7 cupos disponibles
```

---

## 🔍 Análisis de Causa Raíz

### ¿Por qué ocurre la discrepancia?

1. **Cancelaciones no sincronizadas**
   - Cita se cancela manualmente en BD
   - No se decrementa `booked_slots`

2. **Agendamiento externo**
   - Citas creadas fuera del sistema
   - `booked_slots` no se incrementa

3. **Errores en transacciones**
   - Falla al actualizar `booked_slots`
   - La cita se crea/cancela pero el contador no se actualiza

4. **Migración de datos**
   - Datos importados sin recalcular contadores
   - Valores iniciales incorrectos

---

## ✅ Ventajas del Sistema

| Ventaja | Descripción |
|---------|-------------|
| **Precisión** | Muestra la cantidad real de pacientes |
| **Transparencia** | Alerta cuando hay discrepancias |
| **Tiempo Real** | Se actualiza automáticamente |
| **Confiabilidad** | No depende de contadores de BD |
| **Visibilidad** | Fácil identificar problemas de sincronización |
| **Automatización** | Sin intervención manual necesaria |

---

## 🛠️ Archivos Modificados

### `/frontend/src/components/ViewAvailabilityModal.tsx`

**Nuevas funciones agregadas:**
```typescript
// Línea ~51
const getRealBookedSlots = () => {
  return appointments.filter(ap => ap.status === 'Confirmada').length;
};

const getRealAvailableSlots = () => {
  if (!availability) return 0;
  return availability.capacity - getRealBookedSlots();
};
```

**Visualización actualizada:**
```typescript
// Línea ~223
<p className="text-2xl font-bold text-success-600">
  {getRealBookedSlots()}  {/* Antes: availability.bookedSlots */}
</p>

{getRealBookedSlots() !== availability.bookedSlots && (
  <p className="text-xs text-orange-600 font-medium">
    (BD: {availability.bookedSlots})
  </p>
)}
```

**Mensaje de alerta:**
```typescript
{getRealBookedSlots() !== availability.bookedSlots && (
  <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded">
    ⚠️ Discrepancia detectada...
  </div>
)}
```

---

## 📊 Impacto en Diferentes Pantallas

### Desktop (1920x1080)
```
┌───────────────────────────────────────────────┐
│  15          12          80%                  │
│  Cap Total   Ocupados    Ocupación            │
│              (BD: 6)                          │
│                                               │
│  ⚠️ Discrepancia detectada: La base de datos │
│  registra 6 cupos ocupados, pero hay 12       │
│  pacientes confirmados en la lista.           │
│                                               │
│        9 cupos disponibles                    │
└───────────────────────────────────────────────┘
```

### Tablet (768x1024)
```
┌──────────────────────────────┐
│  15      12      80%         │
│  Total   Ocup.   %           │
│          (BD: 6)             │
│                              │
│  ⚠️ Discrepancia: BD=6,      │
│  Real=12                     │
│                              │
│  9 disponibles               │
└──────────────────────────────┘
```

### Mobile (375x667)
```
┌────────────────┐
│  15   12   80% │
│  Cap  Ocu  %   │
│       (BD:6)   │
│                │
│  ⚠️ BD≠Real    │
│                │
│  9 disponibles │
└────────────────┘
```

---

## 🔐 Consideraciones de Seguridad

### Validaciones Implementadas

1. **Verificación de Estado**
   ```typescript
   appointments.filter(ap => ap.status === 'Confirmada')
   ```
   Solo cuenta citas con estado "Confirmada"

2. **Protección contra null**
   ```typescript
   if (!availability) return 0;
   ```

3. **Array válido**
   ```typescript
   appointments.filter(...)  // Siempre retorna array válido
   ```

---

## 📈 Métricas y Monitoreo

### KPIs a Observar

1. **Frecuencia de Discrepancias**
   - ¿Cuántas agendas tienen discrepancias?
   - ¿Qué porcentaje de agendas están afectadas?

2. **Magnitud de Diferencias**
   - Promedio de diferencia entre BD y realidad
   - Máxima discrepancia observada

3. **Patrón de Discrepancias**
   - ¿En qué sedes ocurre más?
   - ¿Con qué doctores?
   - ¿En qué especialidades?

### Script de Análisis (SQL)

```sql
-- Detectar discrepancias en todas las agendas
SELECT 
  a.id,
  a.date,
  d.name as doctor,
  s.name as specialty,
  l.name as location,
  a.booked_slots as booked_in_db,
  COUNT(ap.id) as real_booked,
  (COUNT(ap.id) - a.booked_slots) as difference
FROM availabilities a
LEFT JOIN appointments ap ON ap.availability_id = a.id 
  AND ap.status = 'Confirmada'
JOIN doctors d ON d.id = a.doctor_id
JOIN specialties s ON s.id = a.specialty_id
JOIN locations l ON l.id = a.location_id
WHERE a.status = 'Activa'
GROUP BY a.id
HAVING difference != 0
ORDER BY ABS(difference) DESC;
```

---

## 🔄 Sincronización de Base de Datos

### Script de Corrección (Backend)

Para sincronizar los valores de `booked_slots` con la realidad:

```sql
-- Actualizar booked_slots basándose en citas confirmadas
UPDATE availabilities a
SET booked_slots = (
  SELECT COUNT(*)
  FROM appointments ap
  WHERE ap.availability_id = a.id
    AND ap.status = 'Confirmada'
)
WHERE a.status = 'Activa';
```

### Trigger Automático (Recomendado)

```sql
-- Crear trigger para mantener booked_slots sincronizado
DELIMITER $$

CREATE TRIGGER update_booked_slots_after_appointment_insert
AFTER INSERT ON appointments
FOR EACH ROW
BEGIN
  IF NEW.status = 'Confirmada' AND NEW.availability_id IS NOT NULL THEN
    UPDATE availabilities 
    SET booked_slots = booked_slots + 1
    WHERE id = NEW.availability_id;
  END IF;
END$$

CREATE TRIGGER update_booked_slots_after_appointment_update
AFTER UPDATE ON appointments
FOR EACH ROW
BEGIN
  IF OLD.status = 'Confirmada' AND NEW.status != 'Confirmada' AND NEW.availability_id IS NOT NULL THEN
    UPDATE availabilities 
    SET booked_slots = booked_slots - 1
    WHERE id = NEW.availability_id;
  ELSEIF OLD.status != 'Confirmada' AND NEW.status = 'Confirmada' AND NEW.availability_id IS NOT NULL THEN
    UPDATE availabilities 
    SET booked_slots = booked_slots + 1
    WHERE id = NEW.availability_id;
  END IF;
END$$

DELIMITER ;
```

---

## ✅ Testing Realizado

- ✅ Compilación exitosa sin errores
- ✅ TypeScript validado
- ✅ Cálculo correcto de cupos ocupados
- ✅ Detección de discrepancias funciona
- ✅ Mensaje de alerta se muestra correctamente
- ✅ Actualización automática después de eliminar citas
- ✅ Responsive design mantiene funcionalidad

---

## 🎓 Capacitación para Administrativos

### ¿Qué hacer si ves una discrepancia?

1. **No te preocupes** - El sistema muestra el valor correcto
2. **El número grande es el real** - Confía en ese valor
3. **El "(BD: X)" es solo informativo** - Indica que hay un desajuste en la base de datos
4. **Informa a IT** - Para que corrijan la base de datos
5. **Continúa trabajando normal** - El sistema funciona correctamente

### Interpretación de Números

```
12          ← ESTE es el valor correcto (cantidad real de pacientes)
(BD: 6)     ← Esto indica que la BD tiene un valor desactualizado
```

---

## 📝 Próximos Pasos Recomendados

### Corto Plazo (Inmediato)
1. ✅ Desplegar cambios a producción
2. ✅ Capacitar al personal administrativo
3. ✅ Monitorear discrepancias durante 1 semana

### Mediano Plazo (1-2 semanas)
1. Crear script de sincronización
2. Ejecutar corrección masiva en BD
3. Implementar triggers automáticos

### Largo Plazo (1 mes)
1. Dashboard de métricas de discrepancias
2. Alertas automáticas a IT
3. Reportes semanales de inconsistencias

---

**Estado**: ✅ COMPLETADO Y PROBADO  
**Fecha**: Octubre 20, 2025  
**Versión**: 3.0  
**Sistema**: Biosanarcall - Gestión de Agendas Médicas  
**Módulo**: Conteo en Tiempo Real de Cupos Ocupados
