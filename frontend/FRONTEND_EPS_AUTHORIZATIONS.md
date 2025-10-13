# Módulo Frontend: EPS / Especialidades

## Descripción General

Nuevo módulo de gestión agregado a la interfaz de configuración del sistema Biosanarcall que permite administrar las autorizaciones de especialidades por EPS y ubicación.

## Ubicación

- **Componente Principal**: `/frontend/src/components/EPSAuthorizationsManagement.tsx`
- **Integración**: Agregado como nueva pestaña en `/frontend/src/components/ManagementModule.tsx`
- **Ruta de Acceso**: Settings → Gestión de Recursos → EPS/Especialidades

## Características Principales

### 1. Panel de Métricas (Dashboard)
Muestra un resumen visual con 4 métricas clave:
- **Autorizaciones Vigentes**: Total de autorizaciones activas actualmente
- **EPS con Autorizaciones**: Número de EPS que tienen convenios configurados
- **Especialidades Cubiertas**: Total de especialidades autorizadas en el sistema
- **Sedes con Convenios**: Cantidad de ubicaciones con autorizaciones

### 2. Formulario de Gestión de Autorizaciones

#### Flujo de Trabajo:
1. **Selección de EPS**: Dropdown con todas las EPS activas del sistema
2. **Selección de Ubicación**: Dropdown con todas las ubicaciones/sedes disponibles
3. **Checkboxes de Especialidades**: 
   - Muestra todas las especialidades del sistema
   - Permite selección múltiple mediante checkboxes
   - Pre-carga las especialidades ya autorizadas para esa combinación EPS-Ubicación
   - Actualiza automáticamente al cambiar EPS o ubicación

#### Funcionalidades del Formulario:
- **Carga Automática**: Al seleccionar EPS + Ubicación, carga las especialidades previamente autorizadas
- **Gestión Inteligente**: 
  - Agrega nuevas autorizaciones para especialidades marcadas
  - Elimina autorizaciones para especialidades desmarcadas
  - Operación transaccional en batch para múltiples cambios
- **Validación**: No permite guardar sin seleccionar EPS, ubicación y al menos una especialidad

### 3. Vista de Autorizaciones Registradas

#### Filtros Disponibles:
- **Por EPS**: Filtra las autorizaciones de una EPS específica
- **Por Ubicación**: Filtra las autorizaciones de una sede específica

#### Visualización:
- **Agrupación Inteligente**: Las autorizaciones se agrupan por combinación EPS-Ubicación
- **Tarjetas Informativas**: 
  - Muestra el nombre de la EPS y su código
  - Muestra la ubicación/sede
  - Lista todas las especialidades autorizadas para esa combinación
  - Badge con el conteo de especialidades
- **Estados Visuales**:
  - ✅ Verde: Autorización vigente
  - ⭕ Gris: Autorización no vigente
- **Eliminación Rápida**: Botón de eliminar en cada especialidad autorizada

### 4. Integración con Backend

#### Endpoints Utilizados:
```typescript
// Listar autorizaciones (con filtros opcionales)
GET /api/eps-authorizations
GET /api/eps-authorizations?eps_id=X&location_id=Y

// Obtener especialidades autorizadas para EPS-Ubicación
GET /api/eps-authorizations/eps/:eps_id/location/:location_id/specialties

// Crear autorizaciones en lote
POST /api/eps-authorizations/batch
Body: { authorizations: [{ eps_id, specialty_id, location_id, ... }] }

// Eliminar autorización específica
DELETE /api/eps-authorizations/:id
```

#### Servicios API Utilizados:
- `api.getEps()` - Cargar lista de EPS activas
- `api.getSpecialties()` - Cargar lista de especialidades
- `api.getLocations()` - Cargar lista de ubicaciones/sedes

## Componentes UI Utilizados (shadcn/ui)

- **Card, CardContent, CardDescription, CardHeader, CardTitle**: Estructura de tarjetas
- **Button**: Botones de acción
- **Dialog**: Modal para el formulario de gestión
- **Table**: Tablas de datos (si es necesario en futuras versiones)
- **Badge**: Etiquetas de estado y contadores
- **Checkbox**: Selección múltiple de especialidades
- **Select**: Dropdowns para EPS y Ubicaciones
- **Label**: Etiquetas de formulario
- **Toast**: Notificaciones de éxito/error

## Iconos Lucide React

- `Shield`: Ícono principal del módulo
- `ShieldCheck`: Ícono de la pestaña
- `CheckCircle2`: Autorización vigente
- `XCircle`: Autorización no vigente
- `MapPin`: Ubicaciones
- `Building2`: Sedes
- `Plus`: Agregar nueva autorización
- `Trash2`: Eliminar autorización

## Estados del Componente

```typescript
// Datos del sistema
epsList: EPSRow[]              // Lista de EPS activas
specialtiesList: SpecialtyRow[] // Lista de especialidades
locationsList: LocationRow[]    // Lista de ubicaciones
authorizations: Authorization[] // Autorizaciones registradas

// Estado del formulario
isDialogOpen: boolean          // Control del modal
selectedEPS: string            // EPS seleccionada (ID)
selectedLocation: string       // Ubicación seleccionada (ID)
selectedSpecialties: Set<number> // IDs de especialidades seleccionadas

// Filtros de vista
filterEPS: string              // Filtro por EPS ("all" o ID)
filterLocation: string         // Filtro por ubicación ("all" o ID)

// UI
loading: boolean               // Estado de carga
```

## Flujo de Datos

### 1. Carga Inicial:
```
useEffect → loadData() → Promise.all([
  api.getEps(),
  api.getSpecialties(),
  api.getLocations(),
  fetch('/api/eps-authorizations')
]) → Actualiza estados
```

### 2. Selección de EPS/Ubicación:
```
Usuario selecciona EPS → handleEPSChange()
Usuario selecciona Ubicación → handleLocationChange()
→ loadExistingAuthorizations(epsId, locationId)
→ GET /api/eps-authorizations/eps/{id}/location/{id}/specialties
→ Marca checkboxes de especialidades ya autorizadas
```

### 3. Guardado de Autorizaciones:
```
Usuario marca/desmarca especialidades
Usuario hace clic en "Guardar"
→ handleSaveAuthorizations()
→ Calcula diferencias (toAdd, toRemove)
→ POST /api/eps-authorizations/batch (nuevas)
→ DELETE /api/eps-authorizations/{id} (eliminadas)
→ Recarga datos
→ Muestra notificación de éxito
```

### 4. Eliminación Individual:
```
Usuario hace clic en botón de eliminar
→ handleDeleteAuthorization(authId)
→ DELETE /api/eps-authorizations/{id}
→ Recarga datos
→ Muestra notificación
```

## Responsive Design

- **Grid de Métricas**: 
  - Mobile: 1 columna
  - Desktop: 4 columnas (md:grid-cols-4)

- **Grid de Especialidades Autorizadas**:
  - Mobile: 1 columna
  - Tablet: 2 columnas (md:grid-cols-2)
  - Desktop: 3 columnas (lg:grid-cols-3)

- **Pestañas**:
  - Ajuste automático en 6 columnas (grid-cols-6)
  - Responsive con scroll horizontal si es necesario

## Validaciones

1. **No se puede guardar sin EPS seleccionada**
2. **No se puede guardar sin ubicación seleccionada**
3. **No se puede guardar sin al menos una especialidad seleccionada**
4. **Solo se muestran EPS con status 'active'**
5. **Las especialidades pre-cargadas se marcan automáticamente**

## Mensajes al Usuario

### Éxito:
- "Autorizaciones actualizadas correctamente"
- "Autorización eliminada correctamente"

### Error:
- "Debe seleccionar una EPS y una ubicación"
- "No se pudieron cargar los datos"
- "No se pudieron guardar las autorizaciones"
- "No se pudo eliminar la autorización"

### Estados Vacíos:
- "No hay autorizaciones registradas - Haga clic en 'Nueva Autorización' para comenzar"
- "Seleccione una EPS y una ubicación para gestionar las especialidades"

## Mejoras Futuras Sugeridas

1. **Búsqueda de Especialidades**: Agregar campo de búsqueda en el listado de checkboxes
2. **Selección Rápida**: Botones "Seleccionar Todas" / "Deseleccionar Todas"
3. **Exportación**: Botón para exportar autorizaciones a Excel/PDF
4. **Historial**: Ver cambios históricos de autorizaciones (usando la tabla de auditoría)
5. **Validación de Duplicados**: Prevenir duplicados antes de enviar al servidor
6. **Edición Inline**: Permitir editar autorizaciones directamente desde la vista de tarjetas
7. **Copiar Configuración**: Opción para copiar autorizaciones de una ubicación a otra

## Testing

### Pruebas Manuales Recomendadas:

1. ✅ **Carga Inicial**: Verificar que carguen EPS, especialidades, ubicaciones y autorizaciones
2. ✅ **Creación**: Crear nueva autorización con múltiples especialidades
3. ✅ **Edición**: Modificar autorizaciones existentes (agregar/quitar especialidades)
4. ✅ **Eliminación**: Eliminar una especialidad autorizada
5. ✅ **Filtros**: Probar filtros por EPS y ubicación
6. ✅ **Validaciones**: Intentar guardar sin datos requeridos
7. ✅ **Responsive**: Verificar en diferentes tamaños de pantalla

### Casos de Prueba Adicionales:

```bash
# 1. Verificar que existan datos base
curl http://localhost:4000/api/eps
curl http://localhost:4000/api/specialties
curl http://localhost:4000/api/locations

# 2. Verificar autorizaciones existentes
curl http://localhost:4000/api/eps-authorizations

# 3. Verificar especialidades para una EPS-Ubicación específica
curl http://localhost:4000/api/eps-authorizations/eps/12/location/1/specialties
```

## Cambios en Archivos Existentes

### `/frontend/src/components/ManagementModule.tsx`

**Cambios realizados:**

1. **Importación del nuevo componente**:
```tsx
import EPSAuthorizationsManagement from "./EPSAuthorizationsManagement";
```

2. **Importación del nuevo ícono**:
```tsx
import { ..., ShieldCheck } from "lucide-react";
```

3. **Modificación del grid de pestañas**:
```tsx
// Antes: grid-cols-5
// Después: grid-cols-6
<TabsList className="grid w-full grid-cols-6">
```

4. **Nueva pestaña agregada**:
```tsx
<TabsTrigger value="eps-authorizations" className="flex items-center gap-2">
  <ShieldCheck className="w-4 h-4" />
  EPS/Especialidades
</TabsTrigger>
```

5. **Nuevo contenido de pestaña**:
```tsx
<TabsContent value="eps-authorizations">
  <EPSAuthorizationsManagement />
</TabsContent>
```

## Estructura de Archivos

```
frontend/
├── src/
│   ├── components/
│   │   ├── ManagementModule.tsx              [MODIFICADO]
│   │   ├── EPSAuthorizationsManagement.tsx   [NUEVO]
│   │   └── ui/
│   │       ├── checkbox.tsx                  [EXISTENTE]
│   │       ├── card.tsx                      [EXISTENTE]
│   │       ├── dialog.tsx                    [EXISTENTE]
│   │       ├── select.tsx                    [EXISTENTE]
│   │       └── ...
│   └── ...
└── FRONTEND_EPS_AUTHORIZATIONS.md            [NUEVO - Esta documentación]
```

## Compatibilidad

- **React**: 18+
- **TypeScript**: 5+
- **Vite**: 5+
- **shadcn/ui**: Última versión
- **Lucide React**: Última versión
- **Navegadores**: Chrome, Firefox, Safari, Edge (últimas versiones)

## Compilación

```bash
# Desarrollo
cd frontend
npm run dev

# Producción
npm run build
# Resultado: dist/

# Preview de producción
npm run preview
```

## Despliegue

Después de compilar (`npm run build`), los archivos en `dist/` deben copiarse al directorio público del servidor web (nginx):

```bash
# Ejemplo de despliegue
sudo rm -rf /var/www/biosanarcall/html/*
sudo cp -r dist/* /var/www/biosanarcall/html/
sudo systemctl reload nginx
```

---

**Última actualización**: 2025-01-11  
**Autor**: Sistema de IA - GitHub Copilot  
**Versión**: 1.0
