# Sistema de Filtro de EPS para Envío de SMS Masivo

## ✅ Funcionalidad Implementada

Se ha agregado la capacidad de **seleccionar qué EPS excluir** del envío de SMS masivos en la lista de espera.

## 🎯 Características

### Frontend (`BulkSMSModal.tsx`)

**Nueva sección agregada:**

1. **Card "EPS a Omitir"**
   - Muestra todas las EPS que tienen pacientes en lista de espera
   - Cada EPS muestra:
     - Nombre de la EPS
     - Cantidad de pacientes en lista de espera con esa EPS
   - Permite marcar/desmarcar EPS para excluir

2. **Estados agregados:**
   - `availableEPS`: Array con las EPS disponibles
   - `excludedEPS`: Set con los IDs de EPS excluidas
   - `loadingEPS`: Estado de carga

3. **Funciones agregadas:**
   - `loadAvailableEPS()`: Carga la lista de EPS desde el backend
   - `toggleEPSExclusion()`: Marca/desmarca una EPS para exclusión

**Interfaz Visual:**

```
┌────────────────────────────────────────────┐
│ 🛡️ EPS a Omitir (Opcional)                │
│ Marque las EPS que NO desea incluir        │
├────────────────────────────────────────────┤
│ ☐ NUEVA EPS            [42]                │
│ ☐ FAMISANAR           [123]                │
│ ☑ SANITAS             [18]  ← Excluida     │
│ ☐ SURA                [67]                 │
├────────────────────────────────────────────┤
│ 🟠 1 EPS excluida(s): No se enviarán SMS   │
│    a pacientes con estas EPS.              │
└────────────────────────────────────────────┘
```

**Indicadores Visuales:**

- ✅ **EPS incluida**: Fondo blanco, borde gris
- ❌ **EPS excluida**: Fondo rojo claro, borde rojo, texto tachado
- 📊 **Badge**: Muestra cantidad de pacientes
  - Gris: EPS incluida
  - Rojo: EPS excluida

### Backend (`sms.routes.ts`)

**Nuevo endpoint creado:**

```typescript
GET /api/sms/waiting-list/eps-list
```

**Funcionalidad:**
- Obtiene todas las EPS con pacientes en lista de espera
- Agrupa y cuenta pacientes por EPS
- Soporta filtrado por especialidad (opcional)

**Query params:**
- `specialty_id` (opcional): Filtrar EPS solo para una especialidad específica

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "NUEVA EPS",
      "patient_count": 42
    },
    {
      "id": 2,
      "name": "FAMISANAR",
      "patient_count": 123
    }
  ]
}
```

**Endpoint actualizado:**

```typescript
POST /api/sms/send-bulk-waiting-list
```

**Nuevo parámetro:**
```typescript
{
  specialty_id?: number,        // Filtrar por especialidad
  max_count: number,            // Cantidad máxima
  from_position?: number,       // Posición inicial
  to_position?: number,         // Posición final
  excluded_eps_ids?: number[]   // 🆕 IDs de EPS a excluir
}
```

**Lógica implementada:**

```sql
-- Excluir pacientes con EPS seleccionadas
AND p.insurance_eps_id NOT IN (?, ?, ?)
```

## 📋 Ejemplo de Uso

### Caso 1: Enviar solo a NUEVA EPS y FAMISANAR (excluyendo SANITAS)

1. Seleccionar especialidad: **Ginecología**
2. Desde posición: **1**
3. Hasta posición: **50**
4. Marcar para excluir: **☑ SANITAS**
5. Resultado: Se enviarán SMS solo a pacientes con NUEVA EPS o FAMISANAR

### Caso 2: Excluir múltiples EPS

1. Seleccionar: **Todas las especialidades**
2. Desde posición: **1**
3. Hasta posición: **100**
4. Marcar para excluir:
   - ☑ SANITAS
   - ☑ SURA
   - ☑ COMPENSAR
5. Resultado: Se excluyen 3 EPS del envío

### Caso 3: Sin exclusiones (comportamiento por defecto)

1. No marcar ninguna EPS
2. Resultado: Se envían SMS a todas las EPS

## 🔍 Flujo de Trabajo

### 1. Cargar Modal
```
Usuario abre modal
    ↓
Frontend carga conteo de pacientes (loadEligibleCount)
    ↓
Frontend carga lista de EPS (loadAvailableEPS)
    ↓
GET /api/sms/waiting-list/eps-list
    ↓
Muestra EPS con checkboxes
```

### 2. Seleccionar EPS a Excluir
```
Usuario marca checkbox de SANITAS
    ↓
toggleEPSExclusion(sanitas_id)
    ↓
Set excludedEPS actualizado
    ↓
UI actualiza: fondo rojo, texto tachado
```

### 3. Enviar SMS
```
Usuario hace clic en "Enviar SMS"
    ↓
Frontend construye payload
    ↓
{
  from_position: 1,
  to_position: 50,
  excluded_eps_ids: [3, 5, 7]  ← IDs excluidos
}
    ↓
POST /api/sms/send-bulk-waiting-list
    ↓
Backend aplica filtro NOT IN
    ↓
Solo selecciona pacientes con otras EPS
```

## 🎨 Integración con Otras Funcionalidades

### Compatible con:

✅ **Filtro de especialidad**
```
Especialidad: Ecografías
EPS disponibles: Solo las que tienen pacientes en Ecografías
```

✅ **Rango de posiciones**
```
Posiciones 1-50 → Se aplica después del filtro de EPS
Orden: Prioridad + FIFO (dentro de EPS permitidas)
```

✅ **Todas las especialidades**
```
Sin filtro de especialidad
EPS disponibles: Todas las que tienen pacientes en lista de espera
```

## 📊 Validaciones

### Frontend
- ✅ Carga automática al abrir modal
- ✅ Recarga al cambiar especialidad
- ✅ Indicador visual claro de exclusión
- ✅ Contador de EPS excluidas
- ✅ Limpieza al cerrar modal

### Backend
- ✅ Validación de array de IDs
- ✅ Construcción segura de query SQL (prepared statements)
- ✅ Filtro solo si hay EPS excluidas
- ✅ Compatible con otros filtros (especialidad, rango)

## 🚀 Estado del Sistema

- ✅ Backend compilado y reiniciado
- ✅ Frontend compilado (662.43 kB components)
- ✅ Nuevo endpoint `/api/sms/waiting-list/eps-list` activo
- ✅ Parámetro `excluded_eps_ids` detectado en bundle
- ✅ UI "EPS a Omitir" incluida en bundle

## 📝 Archivos Modificados

### Frontend
1. **`/frontend/src/components/BulkSMSModal.tsx`**
   - Agregada interfaz `EPSInfo`
   - Agregados estados: `availableEPS`, `excludedEPS`, `loadingEPS`
   - Agregada función `loadAvailableEPS()`
   - Agregada función `toggleEPSExclusion()`
   - Agregado import de `Checkbox` y `ShieldAlert`
   - Agregada Card con lista de EPS y checkboxes
   - Actualizado payload de envío con `excluded_eps_ids`
   - Actualizada función `handleClose()` para limpiar estados

### Backend
2. **`/backend/src/routes/sms.routes.ts`**
   - Agregado endpoint `GET /api/sms/waiting-list/eps-list`
   - Actualizada documentación de `POST /api/sms/send-bulk-waiting-list`
   - Agregado parámetro `excluded_eps_ids` en body
   - Agregado campo `p.insurance_eps_id` en SELECT
   - Agregada lógica de filtro `NOT IN` para EPS excluidas

## 🎯 Casos de Uso Reales

### Escenario 1: EPS con cobertura limitada
**Problema:** SANITAS tiene restricciones para cierta especialidad  
**Solución:** Marcar SANITAS como excluida antes de enviar SMS

### Escenario 2: Convenio vencido
**Problema:** Convenio con SURA está suspendido temporalmente  
**Solución:** Excluir SURA hasta renovar convenio

### Escenario 3: Campaña dirigida
**Problema:** Promoción solo para EPS específicas  
**Solución:** Excluir todas las EPS no participantes

## 📈 Beneficios

1. ✅ **Mayor control**: Decide exactamente a quién enviar
2. ✅ **Ahorro de SMS**: No envía a EPS no relevantes
3. ✅ **Mejor targeting**: Campañas más efectivas
4. ✅ **Flexibilidad**: Combina con otros filtros
5. ✅ **Transparencia**: Ve claramente cuántos pacientes por EPS
6. ✅ **Fácil de usar**: Interfaz visual intuitiva

## 🔮 Mejoras Futuras Sugeridas

- [ ] Guardar configuración de EPS excluidas por defecto
- [ ] Estadísticas de envíos por EPS
- [ ] Filtro inverso: seleccionar solo ciertas EPS (en vez de excluir)
- [ ] Histórico de qué EPS fueron excluidas en envíos anteriores
- [ ] Exportar lista de pacientes filtrados antes de enviar

---

**Fecha de implementación:** 1 de noviembre de 2025  
**Sistema:** Biosanarcall Medical System - SMS Masivo  
**Versión:** 2.0 (con filtros de EPS)
