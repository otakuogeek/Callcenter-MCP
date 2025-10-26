# Tabla CUPS - Clasificación Única de Procedimientos en Salud

## Fecha de Creación: 15 de octubre de 2025

## 📋 Descripción

Se ha creado exitosamente la tabla `cups` y sus tablas relacionadas para gestionar los códigos CUPS (Clasificación Única de Procedimientos en Salud) del sistema médico.

## ✅ Tablas Creadas

### 1. Tabla Principal: `cups`

**Estructura:**
```sql
CREATE TABLE cups (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  
  -- Información básica
  code VARCHAR(20) NOT NULL UNIQUE,           -- Código CUPS único
  name VARCHAR(500) NOT NULL,                 -- Nombre del procedimiento
  
  -- Clasificación
  category VARCHAR(100),                       -- Categoría principal
  subcategory VARCHAR(100),                    -- Subcategoría
  description TEXT,                            -- Descripción detallada
  
  -- Relación
  specialty_id INT UNSIGNED,                   -- FK a specialties
  
  -- Facturación
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,   -- Precio único del procedimiento
  requires_authorization BOOLEAN DEFAULT FALSE, -- Requiere autorización
  
  -- Complejidad
  complexity_level ENUM('Baja', 'Media', 'Alta') DEFAULT 'Media',
  estimated_duration_minutes INT DEFAULT 30,
  
  -- Requisitos médicos
  requires_anesthesia BOOLEAN DEFAULT FALSE,
  requires_hospitalization BOOLEAN DEFAULT FALSE,
  requires_previous_studies BOOLEAN DEFAULT FALSE,
  
  -- Estado
  status ENUM('Activo', 'Inactivo', 'Descontinuado') DEFAULT 'Activo',
  is_surgical BOOLEAN DEFAULT FALSE,
  notes TEXT,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED,
  updated_by INT UNSIGNED
);
```

### 2. Tabla Relacional: `cups_services`

Relaciona códigos CUPS con servicios del sistema.

```sql
CREATE TABLE cups_services (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cups_id INT UNSIGNED NOT NULL,
  service_id INT UNSIGNED NOT NULL,
  is_primary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE (cups_id, service_id),
  FOREIGN KEY (cups_id) REFERENCES cups(id),
  FOREIGN KEY (service_id) REFERENCES services(id)
);
```

### 3. Tabla de Configuración: `cups_eps_config` ❌ ELIMINADA

**Nota:** Esta tabla se eliminó para mantener un precio único por procedimiento según el PDF oficial. No se permiten precios personalizados por EPS.

~~Configuración específica de CUPS por EPS (autorizaciones, copagos, etc.)~~

```sql
-- TABLA ELIMINADA - Se mantiene un solo precio por procedimiento
```

## 📊 Datos de Ejemplo Insertados

Se insertaron **14 códigos CUPS de ejemplo** en las siguientes categorías:

| Categoría | Cantidad | Ejemplos |
|-----------|----------|----------|
| Consultas | 4 | 890201, 890202, 890301, 890302 |
| Procedimientos | 5 | 871101, 871102, 872101, 931101, 931102, 932101 |
| Imágenes | 2 | 876101, 876201 |
| Laboratorio | 2 | 901109, 902210 |

### Ejemplos de Registros

```
890201 - Consulta de primera vez por medicina general ($35,000)
890301 - Consulta de primera vez por medicina especializada ($50,000)
876201 - Ecografía abdominal ($80,000)
901109 - Hemograma completo ($25,000)
```

## 🔧 Próximos Pasos

### 1. Backend - API Routes

Crear archivo `/home/ubuntu/app/backend/src/routes/cups.ts`:

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import pool from '../db/pool';

const router = Router();

// GET /api/cups - Listar todos los códigos CUPS
router.get('/', requireAuth, async (req, res) => {
  const { 
    category, 
    status = 'Activo',
    search,
    page = 1,
    limit = 50 
  } = req.query;
  
  // Implementar búsqueda y filtros
});

// GET /api/cups/:id - Obtener un código CUPS por ID
router.get('/:id', requireAuth, async (req, res) => {
  // Implementar
});

// POST /api/cups - Crear nuevo código CUPS
router.post('/', requireAuth, async (req, res) => {
  // Implementar validación y creación
});

// PUT /api/cups/:id - Actualizar código CUPS
router.put('/:id', requireAuth, async (req, res) => {
  // Implementar actualización
});

// DELETE /api/cups/:id - Desactivar código CUPS
router.delete('/:id', requireAuth, async (req, res) => {
  // Cambiar status a 'Inactivo' en lugar de eliminar
});

// GET /api/cups/category/:category - Filtrar por categoría
router.get('/category/:category', requireAuth, async (req, res) => {
  // Implementar
});

export default router;
```

### 2. Registrar Rutas en Backend

En `/home/ubuntu/app/backend/src/routes/index.ts`:

```typescript
import cups from './cups';

// ... otras rutas ...
router.use('/cups', cups);
```

### 3. Frontend - Componentes React

Crear los siguientes componentes:

- `CupsManagement.tsx` - Gestión principal de CUPS
- `CupsForm.tsx` - Formulario para crear/editar
- `CupsTable.tsx` - Tabla con listado
- `CupsFilter.tsx` - Filtros de búsqueda
- `CupsImport.tsx` - Importación masiva desde CSV/Excel

### 4. Frontend - API Client

En `/home/ubuntu/app/frontend/src/lib/api.ts`:

```typescript
// CUPS Management
export const cups = {
  list: (filters?: CupsFilters) => 
    request<CupsResponse>('/cups', 'GET', undefined, filters),
  
  get: (id: number) => 
    request<Cup>(`/cups/${id}`, 'GET'),
  
  create: (data: CreateCupData) => 
    request<Cup>('/cups', 'POST', data),
  
  update: (id: number, data: UpdateCupData) => 
    request<Cup>(`/cups/${id}`, 'PUT', data),
  
  delete: (id: number) => 
    request(`/cups/${id}`, 'DELETE'),
  
  getByCategory: (category: string) => 
    request<Cup[]>(`/cups/category/${category}`, 'GET'),
};
```

### 5. Importación Masiva desde PDF

Para importar los códigos CUPS completos desde el PDF:

1. Convertir PDF a CSV/Excel
2. Crear script de importación:
   ```bash
   /home/ubuntu/app/backend/scripts/import-cups-from-csv.ts
   ```
3. Ejecutar importación:
   ```bash
   npm run cups:import -- --file=cups_data.csv
   ```

## 📝 Consultas Útiles

### Buscar CUPS por código o nombre
```sql
SELECT * FROM cups 
WHERE code LIKE '%890%' 
   OR name LIKE '%consulta%';
```

### Ver CUPS por categoría con estadísticas de precio
```sql
SELECT category, COUNT(*) as total, 
       MIN(price) as precio_minimo,
       MAX(price) as precio_maximo,
       AVG(price) as precio_promedio
FROM cups 
WHERE status = 'Activo'
GROUP BY category;
```

### Ver CUPS que requieren autorización
```sql
SELECT code, name, price 
FROM cups 
WHERE requires_authorization = TRUE 
  AND status = 'Activo';
```

### Ver CUPS quirúrgicos
```sql
SELECT code, name, complexity_level, estimated_duration_minutes
FROM cups 
WHERE is_surgical = TRUE 
  AND status = 'Activo'
ORDER BY complexity_level DESC;
```

## 🎯 Casos de Uso

### 1. Asignación de CUPS a Citas
```sql
ALTER TABLE appointments 
ADD COLUMN cups_id INT UNSIGNED,
ADD CONSTRAINT fk_appointments_cups 
  FOREIGN KEY (cups_id) REFERENCES cups(id);
```

### 2. Facturación por CUPS
```sql
CREATE TABLE appointment_billing_detail (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  billing_id INT UNSIGNED NOT NULL,
  cups_id INT UNSIGNED NOT NULL,
  quantity INT DEFAULT 1,
  unit_price DECIMAL(10,2),  -- Se copia del cups.price al momento de facturar
  total_price DECIMAL(10,2),
  
  FOREIGN KEY (billing_id) REFERENCES appointment_billing(id),
  FOREIGN KEY (cups_id) REFERENCES cups(id)
);
```

**Nota:** El `unit_price` se copia del campo `price` de la tabla CUPS al momento de crear la factura, permitiendo mantener el precio histórico aunque el precio en CUPS cambie posteriormente.

### 3. Reportes de Procedimientos
```sql
SELECT 
  c.code,
  c.name,
  c.price,
  COUNT(a.id) as total_appointments,
  SUM(c.price * 1) as revenue_estimado
FROM cups c
LEFT JOIN appointments a ON a.cups_id = c.id
WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
  AND a.status = 'Completada'
GROUP BY c.id
ORDER BY total_appointments DESC;
```

## 📚 Referencias

- **Migración:** `/home/ubuntu/app/backend/migrations/20251015_create_cups_table.sql`
- **Script de aplicación:** `/home/ubuntu/app/backend/scripts/apply-cups-migration.sh`
- **Documentación:** Este archivo

## ⚠️ Notas Importantes

1. ✅ Los códigos CUPS deben ser únicos
2. ✅ El campo `status` permite desactivar códigos sin eliminarlos
3. ✅ **PRECIO ÚNICO:** Se maneja un solo precio por procedimiento (campo `price`) según el PDF oficial
4. ❌ **NO se permiten precios personalizados por EPS** - Se eliminó la tabla `cups_eps_config`
5. ✅ El precio es el mismo para todas las EPS según el PDF oficial
6. ✅ Al facturar, se copia el precio actual a la tabla de facturación para mantener histórico
7. ✅ Se recomienda actualizar precios solo cuando haya cambios oficiales del Ministerio de Salud

## 🔄 Estado Actual

- ✅ Tabla `cups` creada con precio único
- ✅ Tabla `cups_services` creada
- ❌ Tabla `cups_eps_config` eliminada (precio único para todas las EPS)
- ✅ **76 registros importados desde el PDF oficial**
- ✅ Índices y llaves foráneas configurados
- ✅ Campo `price` renombrado para claridad
- ⏳ Pendiente: API Routes
- ⏳ Pendiente: Frontend Components
- ⏳ Pendiente: Integración con sistema de facturación

---

**Creado por:** GitHub Copilot  
**Fecha:** 15 de octubre de 2025  
**Base de datos:** biosanar  
**Estado:** ✅ Operacional
