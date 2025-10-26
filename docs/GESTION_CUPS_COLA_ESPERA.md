# Gestión de CUPS en Cola de Espera

## Resumen

Se ha implementado un sistema completo para gestionar códigos CUPS directamente desde la página de **Cola de Espera** (`/queue`), permitiendo a los usuarios asignar, cambiar y eliminar códigos CUPS de las solicitudes en espera.

## Funcionalidades Implementadas

### 1. **Backend - Nuevo Endpoint PATCH**

**Ruta:** `PATCH /api/appointments/waiting-list/:id/cups`

**Descripción:** Actualiza el `cups_id` de una solicitud en lista de espera.

**Parámetros:**
- `id` (URL): ID de la solicitud en lista de espera
- `cups_id` (body): Número del ID del CUPS o `null` para eliminar

**Validaciones:**
- ✅ Verifica que el registro existe en `appointments_waiting_list`
- ✅ Si `cups_id` no es `null`, verifica que existe en `cups` con `status = 'Activo'`
- ✅ Retorna error 404 si el código CUPS no existe o está inactivo

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "CUPS asignado exitosamente",
  "data": {
    "id": 65,
    "patient_id": 123,
    "cups_id": 325,
    "cups_code": "881201",
    "cups_name": "ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS",
    "cups_category": "Ecografía"
  }
}
```

**Archivo:** `/backend/src/routes/appointments.ts` (líneas ~1198-1285)

---

### 2. **Frontend - API Client**

**Función:** `updateWaitingListCups(id: number, cups_id: number | null)`

**Ubicación:** `/frontend/src/lib/api.ts` (líneas ~1047-1066)

**Uso:**
```typescript
// Asignar CUPS
await api.updateWaitingListCups(65, 325);

// Eliminar CUPS
await api.updateWaitingListCups(65, null);
```

**Tipo Method:** Agregado `'PATCH'` al tipo `Method` en línea 22.

---

### 3. **Frontend - UI en Cola de Espera**

#### Nuevo Botón de Gestión CUPS

Se agregó un botón con icono de documento (`FileText`) junto a los botones de "Agendar" y "Eliminar":

```tsx
<Button
  size="sm"
  variant="outline"
  onClick={() => handleOpenCupsDialog(item)}
  title={item.cups_code ? "Cambiar CUPS" : "Asignar CUPS"}
>
  <FileText className="w-4 h-4" />
</Button>
```

**Ubicación en UI:** Fila de cada paciente → Columna de acciones (3 botones totales)

---

#### Modal de Gestión de CUPS

**Componente:** `Dialog` de shadcn/ui

**Características:**
- 📋 **Muestra CUPS actual** (si existe) en badge azul con código y nombre
- 🔽 **Selector desplegable** con todos los CUPS activos organizados por categoría
- ❌ **Opción "Eliminar CUPS"** (solo si ya tiene uno asignado)
- 💾 **Validación:** Botón "Guardar" se deshabilita si no hay cambios

**Vista del Selector:**
```
[881201] [Ecografía]
ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS...

[881302] [Ecografía Doppler]
ECOGRAFIA DE ABDOMEN TOTAL (HIGADO PANCREAS VESICULA...
```

**Archivo:** `/frontend/src/pages/Queue.tsx` (líneas ~377-466)

---

## Estados del Sistema

### Estados de React Agregados

```typescript
const [isCupsDialogOpen, setIsCupsDialogOpen] = useState(false);
const [cupsDialogItem, setCupsDialogItem] = useState<any | null>(null);
const [availableCups, setAvailableCups] = useState<any[]>([]);
const [selectedCupsId, setSelectedCupsId] = useState<string>('');
const [loadingCups, setLoadingCups] = useState(false);
```

### Funciones Principales

1. **`loadCupsList()`** - Carga lista de CUPS activos (límite 500)
2. **`handleOpenCupsDialog(item)`** - Abre modal y carga CUPS si es necesario
3. **`handleSaveCups()`** - Guarda cambios y refresca la cola

---

## Flujo de Usuario

### Escenario 1: Asignar CUPS a solicitud sin CUPS

1. Usuario hace clic en botón 📄 (FileText) en fila del paciente
2. Se abre modal "Asignar CUPS"
3. Usuario selecciona un código CUPS del desplegable
4. Usuario hace clic en "Guardar"
5. Sistema actualiza el registro y muestra badge con código CUPS

### Escenario 2: Cambiar CUPS existente

1. Usuario hace clic en botón 📄 en fila del paciente (ya tiene CUPS asignado)
2. Se abre modal "Cambiar CUPS" mostrando CUPS actual
3. Usuario selecciona un nuevo código CUPS
4. Usuario hace clic en "Guardar"
5. Sistema actualiza y muestra el nuevo badge

### Escenario 3: Eliminar CUPS

1. Usuario hace clic en botón 📄 en fila del paciente con CUPS
2. Se abre modal mostrando CUPS actual
3. Usuario selecciona "❌ Eliminar CUPS" del desplegable
4. Usuario hace clic en "Guardar"
5. Badge de CUPS desaparece de la fila

---

## Validaciones y Seguridad

### Backend
- ✅ Requiere autenticación (`requireAuth` middleware)
- ✅ Valida que `cups_id` sea número válido o `null`
- ✅ Verifica existencia del registro en lista de espera
- ✅ Verifica que CUPS existe y está activo antes de asignar
- ✅ Retorna error 404 con mensaje descriptivo si falla validación

### Frontend
- ✅ Solo muestra CUPS con `status = 'Activo'`
- ✅ Deshabilita botón "Guardar" si no hay cambios
- ✅ Muestra indicadores de carga durante operaciones
- ✅ Refresca automáticamente la cola después de guardar cambios

---

## Estructura de Datos

### Campo en Base de Datos

**Tabla:** `appointments_waiting_list`
**Campo:** `cups_id` (INT UNSIGNED NULL)
**Foreign Key:** `fk_waiting_list_cups` → `cups.id`
**Comportamiento:** `ON DELETE SET NULL`, `ON UPDATE CASCADE`

### Respuesta de API GET /waiting-list

Cada ítem incluye campos CUPS mediante LEFT JOIN:

```json
{
  "id": 65,
  "patient_name": "María del Rosario Rangel Sanabria",
  "cups_id": 325,
  "cups_code": "881201",
  "cups_name": "ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS",
  "cups_category": "Ecografía"
}
```

---

## Archivos Modificados

### Backend
1. `/backend/src/routes/appointments.ts`
   - Líneas ~1198-1285: Nuevo endpoint PATCH

### Frontend
1. `/frontend/src/lib/api.ts`
   - Línea 22: Agregado `'PATCH'` a tipo `Method`
   - Líneas ~1047-1066: Nueva función `updateWaitingListCups`

2. `/frontend/src/pages/Queue.tsx`
   - Líneas 1-24: Importaciones (Dialog, Select, iconos)
   - Líneas 27-40: Nuevos estados de React
   - Líneas 70-110: Funciones de gestión de CUPS
   - Líneas ~313-324: Botón de CUPS en UI
   - Líneas ~377-466: Modal de gestión de CUPS

---

## Compilación y Despliegue

### Backend
```bash
cd /home/ubuntu/app/backend
npm run build
pm2 restart ecosystem.config.js --only cita-central-backend
```
**PM2 Restart:** #41 ✅

### Frontend
```bash
cd /home/ubuntu/app/frontend
npm run build
```
**Bundle generado:** `pages-D3cvEfD9.js` (106.77 kB) ✅

---

## Testing Manual

### Casos de Prueba

1. ✅ **Asignar CUPS a solicitud sin CUPS**
   - ID 66-69 tienen CUPS asignados manualmente

2. ✅ **Verificar display de CUPS en UI**
   - Badge muestra código (ej: `881201`)
   - Texto muestra nombre completo del servicio

3. ⏳ **Cambiar CUPS existente** (pendiente de testing en UI)

4. ⏳ **Eliminar CUPS** (pendiente de testing en UI)

### Datos de Prueba

```sql
-- 5 solicitudes con CUPS variados
ID 65: CUPS 325 - ECOGRAFIA DE MAMA ($128,030)
ID 66: CUPS 326 - ABDOMEN TOTAL ($202,020)
ID 67: CUPS 327 - VIAS URINARIAS ($160,000)
ID 68: CUPS 329 - TEJIDOS BLANDOS ($127,400)
ID 69: CUPS 331 - ECOGRAFIA DE CUELLO ($121,310)
ID 159: CUPS 340 - ECOGRAFIA ARTICULAR DE CODO ($97,070)
```

---

## Próximos Pasos

### Mejoras Sugeridas

1. **Filtro por categoría en selector**
   - Agregar tabs o filtro para categorías (Ecografía, Doppler, Odontología)

2. **Búsqueda de CUPS**
   - Input de búsqueda por código o nombre

3. **Historial de cambios**
   - Log de cambios de CUPS en auditoría

4. **Asignación masiva**
   - Seleccionar múltiples solicitudes y asignar mismo CUPS

5. **Sugerencias inteligentes**
   - Sugerir CUPS basado en especialidad o motivo de consulta

---

## Notas Técnicas

- **Límite de CUPS:** 500 activos cargados en memoria (ajustable)
- **Actualización automática:** Cola se refresca cada 30 segundos
- **Compatibilidad:** React 18, shadcn/ui, TypeScript
- **Método HTTP:** PATCH (actualización parcial RESTful)

---

## Fecha de Implementación

**Fecha:** 16 de octubre de 2025
**Versión Backend:** PM2 restart #41
**Versión Frontend:** Build pages-D3cvEfD9.js

---

## Autores y Créditos

Implementado en el sistema **Biosanarcall Medical System** (Fundación Biosanar IPS).
