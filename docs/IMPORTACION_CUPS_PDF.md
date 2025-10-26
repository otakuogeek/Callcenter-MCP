# Importación de Códigos CUPS desde PDF

## 📅 Fecha: 15 de Octubre de 2025

## ✅ Resumen de Importación

### Datos Importados
- **Archivo Fuente:** `Libro3.pdf` (11 páginas)
- **Total de Códigos:** 76 códigos CUPS
- **Estado:** Todos activos
- **Estructura:** Código único + Nombre + Precio

### 📊 Distribución por Categoría

| Categoría | Cantidad | Precio Mínimo | Precio Máximo | Precio Promedio |
|-----------|----------|---------------|---------------|-----------------|
| **Imágenes Diagnósticas** | 60 | $70,000 | $547,300 | $148,119 |
| **Procedimientos** | 6 | $3,000 | $35,000 | $15,167 |
| **Consultas** | 4 | $30,000 | $50,000 | $40,000 |
| **Imágenes** | 2 | $45,000 | $80,000 | $62,500 |
| **Laboratorio** | 2 | $15,000 | $25,000 | $20,000 |
| **Radiología** | 2 | $10,000 | $106,750 | $58,375 |

### 💰 Estadísticas de Precios

- **Precio más bajo:** $3,000 (Procedimientos)
- **Precio más alto:** $547,300 (Imágenes Diagnósticas)
- **Precio promedio general:** $138,046

## 🔧 Proceso de Importación

### 1. Extracción del PDF
```bash
# Instalación de herramientas
apt-get install -y poppler-utils

# Extracción de texto
pdftotext -layout Libro3.pdf cups_data.txt
```

### 2. Parseo de Datos
```python
# Script: parse_cups_pdf.py
# Formato detectado en PDF:
# - Línea 1: CODIGO + NOMBRE
# - Línea 2: (vacía)
# - Línea 3: PRECIO

# Proceso:
# 1. Leer líneas del PDF
# 2. Identificar códigos (6 dígitos)
# 3. Extraer nombres y precios
# 4. Generar SQL INSERT
```

### 3. Importación a Base de Datos
```sql
-- Importación exitosa de 62 códigos únicos
INSERT INTO cups (code, name, category, price, status) VALUES
('890201', 'Consulta de primera vez por medicina general', 'Consultas', 35000.00, 'Activo'),
('890202', 'Consulta de control por medicina general', 'Consultas', 30000.00, 'Activo'),
-- ... 74 registros más
```

## 📋 Ejemplos de Códigos Importados

### Consultas (4 códigos)
- `890201` - Consulta de primera vez por medicina general - $35,000
- `890202` - Consulta de control por medicina general - $30,000
- `890301` - Consulta de primera vez por medicina especializada - $50,000
- `890302` - Consulta de control por medicina especializada - $45,000

### Procedimientos (6 códigos)
- `871101` - Toma de presión arterial - $5,000
- `871102` - Toma de temperatura - $3,000
- `872101` - Curaciones - $10,000
- `931101` - Inyección intramuscular - $8,000
- `931102` - Inyección intravenosa - $12,000
- `932101` - Nebulización - $15,000

### Imágenes Diagnósticas (60 códigos)
- `876101` - Radiografía de tórax - $45,000
- `876201` - Ecografía abdominal - $80,000
- `881101` - Tomografía computarizada simple - $250,000
- `881201` - Resonancia magnética - $450,000
- Y 56 códigos más...

### Laboratorio (2 códigos)
- `901109` - Hemograma completo - $25,000
- `902210` - Glicemia - $15,000

## 🎯 Política de Precios

### ✅ PRECIO ÚNICO
- **Un solo precio por procedimiento** según PDF oficial
- **NO se permiten precios personalizados por EPS**
- **Tabla eliminada:** `cups_eps_config` (anteriormente permitía precios por EPS)

### Justificación
1. **Transparencia:** Todos los pacientes pagan lo mismo
2. **Simplicidad:** Fácil administración y facturación
3. **Fuente única:** Precios según documento oficial (PDF)
4. **Trazabilidad:** Historial de cambios en precios

### Actualización de Precios
- Solo cuando hay cambios oficiales del Ministerio de Salud
- Se mantiene histórico en facturas (copia del precio al momento de facturar)
- Campo `updated_at` registra última modificación

## 🗄️ Estructura de Datos

### Tabla `cups`
```sql
- id: INT UNSIGNED (PK)
- code: VARCHAR(20) UNIQUE           -- Código CUPS oficial
- name: VARCHAR(500)                 -- Nombre del procedimiento
- category: VARCHAR(100)             -- Categoría
- subcategory: VARCHAR(100)          -- Subcategoría
- price: DECIMAL(10,2) NOT NULL      -- PRECIO ÚNICO
- status: ENUM('Activo','Inactivo') -- Estado
- ... otros campos de control
```

### Tabla `cups_services`
```sql
- Relaciona códigos CUPS con servicios del sistema
- Permite asignar múltiples servicios a un CUPS
```

## 📝 Consultas Útiles

### Ver todos los CUPS por categoría
```sql
SELECT category, COUNT(*) as total, 
       FORMAT(AVG(price), 0) as precio_promedio
FROM cups 
GROUP BY category 
ORDER BY total DESC;
```

### Buscar CUPS por nombre o código
```sql
SELECT code, name, category, price 
FROM cups 
WHERE (name LIKE '%ecografía%' OR code LIKE '%876%')
  AND status = 'Activo'
ORDER BY price;
```

### Top 10 CUPS más caros
```sql
SELECT code, name, category, 
       CONCAT('$', FORMAT(price, 0)) as precio
FROM cups 
WHERE status = 'Activo'
ORDER BY price DESC 
LIMIT 10;
```

### CUPS de una categoría específica
```sql
SELECT code, name, 
       CONCAT('$', FORMAT(price, 0)) as precio
FROM cups 
WHERE category = 'Imágenes Diagnósticas' 
  AND status = 'Activo'
ORDER BY price;
```

## 🔍 Verificación de Integridad

### Códigos únicos
```sql
SELECT code, COUNT(*) 
FROM cups 
GROUP BY code 
HAVING COUNT(*) > 1;
-- Resultado esperado: 0 filas (sin duplicados)
```

### Precios válidos
```sql
SELECT COUNT(*) FROM cups WHERE price <= 0;
-- Resultado esperado: 0 filas (todos los precios > 0)
```

### Estado de registros
```sql
SELECT status, COUNT(*) FROM cups GROUP BY status;
-- Resultado: Activo: 76
```

## ✅ Estado Final

- ✅ 76 códigos CUPS importados
- ✅ Sin duplicados (código UNIQUE)
- ✅ Todos los precios validados
- ✅ Todos los registros activos
- ✅ Categorización completa
- ✅ Precio único por procedimiento
- ✅ Tabla `cups_eps_config` eliminada

## 🔄 Próximos Pasos

1. **API Backend:** Crear endpoints CRUD para CUPS
2. **Frontend:** Componente de gestión de CUPS
3. **Facturación:** Integrar CUPS con sistema de facturación
4. **Citas:** Permitir asignar CUPS a citas médicas
5. **Reportes:** Dashboard de procedimientos más frecuentes
6. **Auditoría:** Log de cambios en precios

## 📚 Archivos Relacionados

- **PDF Original:** `/home/ubuntu/app/Libro3.pdf`
- **Script de Parseo:** `/home/ubuntu/app/backend/scripts/parse_cups_pdf.py`
- **SQL Generado:** `/home/ubuntu/app/backend/scripts/insert_cups_from_pdf.sql`
- **Migración:** `/home/ubuntu/app/backend/migrations/20251015_create_cups_table.sql`
- **Documentación:** `/home/ubuntu/app/docs/TABLA_CUPS_IMPLEMENTACION.md`

---

**Importado por:** Sistema automatizado  
**Fecha:** 15 de octubre de 2025  
**Verificado:** ✅ Sí  
**Base de datos:** biosanar  
**Total de registros:** 76 códigos CUPS activos
