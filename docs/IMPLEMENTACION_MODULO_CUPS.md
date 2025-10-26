# Implementación del Módulo de Gestión de CUPS

## Resumen de Implementación

Se ha implementado exitosamente un módulo completo de gestión de códigos CUPS (Clasificación Única de Procedimientos en Salud) en el sistema Biosanarcall.

## Componentes Creados

### Backend

#### 1. **Rutas API - `/backend/src/routes/cups.ts`**

Se creó un conjunto completo de endpoints RESTful para la gestión de códigos CUPS:

**Endpoints implementados:**
- `GET /api/cups` - Lista de códigos CUPS con paginación, búsqueda y filtros
  - Parámetros: `page`, `limit`, `search`, `category`, `status`
  - Respuesta paginada con total de registros

- `GET /api/cups/categories` - Lista de categorías únicas disponibles
  - Útil para poblar filtros y dropdowns

- `GET /api/cups/stats/summary` - Estadísticas generales
  - Total de códigos, activos, inactivos, número de categorías

- `GET /api/cups/:id` - Obtener un código CUPS específico

- `POST /api/cups` - Crear nuevo código CUPS (solo admin)
  - Validaciones: código único, nombre requerido, precio válido

- `PUT /api/cups/:id` - Actualizar código CUPS existente (solo admin)
  - Permite actualizar todos los campos excepto el ID

- `DELETE /api/cups/:id` - Soft delete de código CUPS (solo admin)
  - Marca como `status: 'inactive'` en lugar de eliminar

**Características de seguridad:**
- Todos los endpoints requieren autenticación (`requireAuth`)
- Endpoints de creación, actualización y eliminación requieren rol de administrador
- Validación de datos en todas las operaciones

#### 2. **Registro de Rutas - `/backend/src/routes/index.ts`**

Se agregó el import y registro de las rutas CUPS:
```typescript
import cups from './cups';
router.use('/cups', cups);
```

### Frontend

#### 1. **Cliente API - `/frontend/src/lib/api.ts`**

Se agregaron los siguientes métodos al cliente API:

```typescript
getCups(params?)          // Lista con paginación y filtros
getCupsCategories()       // Categorías disponibles
getCupsById(id)           // CUPS individual
createCups(data)          // Crear nuevo
updateCups(id, data)      // Actualizar
deleteCups(id)            // Eliminar
getCupsStats()            // Estadísticas
```

#### 2. **Componente de Gestión - `/frontend/src/components/CupsManagement.tsx`**

Componente completo con las siguientes características:

**Funcionalidades principales:**
- ✅ Listado paginado de códigos CUPS (20 por página)
- ✅ Búsqueda en tiempo real por código o nombre
- ✅ Filtros por categoría y estado (activo/inactivo)
- ✅ Creación de nuevos códigos CUPS
- ✅ Edición de códigos existentes
- ✅ Eliminación con confirmación
- ✅ Activación/desactivación con switch toggle
- ✅ Formato de precios en pesos colombianos (COP)
- ✅ Indicadores visuales de estado y requisitos

**Campos del formulario:**
1. Código CUPS (obligatorio, deshabilitado en edición)
2. Categoría (opcional)
3. Nombre del procedimiento (obligatorio)
4. Descripción (opcional, textarea)
5. Precio en COP (obligatorio, tipo numérico)
6. Requiere autorización (switch boolean)

**UI/UX:**
- Diseño consistente con el resto del sistema (shadcn/ui)
- Badges para código, categoría, estado y autorización requerida
- Iconos descriptivos (FileText, DollarSign, Edit, Trash2)
- Validaciones en tiempo real
- Mensajes toast para feedback de operaciones
- Paginación intuitiva con información de resultados

#### 3. **Integración en Módulo de Gestión - `/frontend/src/components/ManagementModule.tsx`**

Se agregó una nueva pestaña "CUPS" en el módulo de gestión de recursos:

```typescript
<TabsTrigger value="cups" className="flex items-center gap-2">
  <FileText className="w-4 h-4" />
  CUPS
</TabsTrigger>

<TabsContent value="cups">
  <CupsManagement />
</TabsContent>
```

La pestaña se encuentra entre "Ubicaciones" y "EPS" en el layout de 7 columnas.

## Acceso al Módulo

**Ruta de navegación:**
1. Iniciar sesión en el sistema
2. Ir a "Configuración" en el menú lateral
3. Seleccionar pestaña "Gestión"
4. Seleccionar pestaña "CUPS"

## Estructura de Datos CUPS

```typescript
interface Cups {
  id: number;
  code: string;                    // Código único CUPS
  name: string;                    // Nombre del procedimiento
  description?: string;            // Descripción detallada
  category?: string;               // Categoría (ej: Consulta, Procedimiento)
  price: number;                   // Precio en COP
  status: 'active' | 'inactive';  // Estado del código
  requires_authorization?: number; // 0 o 1, si requiere autorización
  created_at?: string;
  updated_at?: string;
}
```

## Datos Importados

Se importaron **62 códigos CUPS únicos** desde el archivo `Libro3.csv`:
- Total de registros originales en CSV: 256
- Códigos únicos importados: 62
- Valor total: $9,003,904 COP
- Precio promedio: $145,224.26 COP

**Lógica de consolidación:**
Cuando un código CUPS aparecía múltiples veces en el CSV con diferentes precios, se mantuvo el precio más alto. Por ejemplo:
- Código 881201: apareció 8 veces ($10,000 - $128,030) → se guardó $128,030
- Código 881431: apareció 11 veces → se guardó el precio más alto

## Estado de Compilación

### Backend
- ✅ Compilación exitosa con TypeScript
- ✅ Servicio PM2 reiniciado correctamente
- ✅ Rutas CUPS registradas y disponibles en `/api/cups`

### Frontend
- ✅ Compilación exitosa con Vite
- ✅ Bundle generado sin errores
- ✅ Componente integrado en el módulo de gestión

## Pruebas Sugeridas

1. **Listar CUPS:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
        http://localhost:4000/api/cups?limit=10&page=1
   ```

2. **Buscar CUPS:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
        http://localhost:4000/api/cups?search=consulta
   ```

3. **Filtrar por categoría:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
        http://localhost:4000/api/cups?category=Consulta
   ```

4. **Obtener categorías:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
        http://localhost:4000/api/cups/categories
   ```

5. **Crear nuevo CUPS (requiere rol admin):**
   ```bash
   curl -X POST -H "Authorization: Bearer <token>" \
        -H "Content-Type: application/json" \
        -d '{"code":"999999","name":"Test","price":50000}' \
        http://localhost:4000/api/cups
   ```

## Archivos Modificados

### Backend (3 archivos)
1. `/backend/src/routes/cups.ts` - **CREADO** - Endpoints CRUD completos
2. `/backend/src/routes/index.ts` - Registro de rutas CUPS
3. Compilado y reiniciado servicio PM2

### Frontend (3 archivos)
1. `/frontend/src/lib/api.ts` - Métodos de API para CUPS
2. `/frontend/src/components/CupsManagement.tsx` - **CREADO** - Componente de gestión
3. `/frontend/src/components/ManagementModule.tsx` - Integración de pestaña CUPS

## Próximos Pasos Recomendados

1. **Relación con Citas:**
   - Asociar códigos CUPS a las citas médicas
   - Permitir seleccionar múltiples códigos CUPS por cita
   - Calcular costos totales basados en CUPS seleccionados

2. **Facturación:**
   - Integrar CUPS en el módulo de facturación
   - Generar reportes por códigos CUPS
   - Validar autorizaciones requeridas antes de facturar

3. **Reportes y Estadísticas:**
   - Dashboard de códigos CUPS más utilizados
   - Reportes de ingresos por categoría de CUPS
   - Análisis de procedimientos que requieren autorización

4. **Exportación/Importación:**
   - Exportar listado de CUPS a Excel/CSV
   - Importación masiva desde archivos
   - Plantillas para carga de datos

## Notas Técnicas

- El componente sigue el mismo patrón de diseño que `SpecialtyManagement.tsx`
- Se utiliza paginación del lado del servidor para mejor rendimiento
- Los filtros son acumulativos (búsqueda + categoría + estado)
- El soft delete mantiene integridad referencial con otras tablas
- El switch de estado permite activar/desactivar sin eliminar
- El código CUPS no es editable una vez creado (integridad de datos)

## Credenciales de Acceso

**Base de datos:**
- Host: 127.0.0.1:3306
- Usuario: biosanar_user
- Base de datos: biosanar
- Tabla: cups

**Acceso admin requerido para:**
- Crear nuevos códigos CUPS
- Actualizar códigos existentes
- Eliminar códigos CUPS

---

**Fecha de implementación:** Diciembre 2024  
**Estado:** ✅ Completado y funcional
