# Importación de Códigos CUPS desde CSV

**Fecha:** 15 de octubre de 2025  
**Archivo fuente:** `Libro3.csv`  
**Script:** `/backend/scripts/import-cups-from-csv.ts`

## ✅ Resumen de la Importación

### Datos Procesados
- **Registros únicos en CSV:** 62 códigos CUPS
- **Total de registros en base de datos:** 76 códigos CUPS
- **Registros insertados en esta ejecución:** 30-31
- **Registros actualizados en esta ejecución:** 31-32
- **Errores:** 0

### Estadísticas de la Base de Datos

| Métrica | Valor |
|---------|-------|
| Total de códigos CUPS | 76 |
| Valor total de procedimientos | $9,419,904.00 |
| Precio promedio | $123,946.11 |
| Precio mínimo | $3,000.00 |
| Precio máximo | $547,300.00 |

## 📋 Tipos de Procedimientos Importados

### Ecografías (881xxx)
- Ecografía de mama
- Ecografía de abdomen (total, superior, vías urinarias)
- Ecografía de tiroides
- Ecografía pélvica (ginecológica, transvaginal, transabdominal)
- Ecografía obstétrica
- Ecografía articular (hombro, codo, rodilla, tobillo, cadera, etc.)
- Ecografía testicular
- Ecografía de tejidos blandos
- Y más...

### Ecografías Doppler (882xxx)
- Doppler de vasos del cuello
- Doppler arterial de miembros
- Doppler venoso de miembros
- Doppler transcraneal
- Doppler de vasos abdominales
- Doppler de aorta abdominal
- Y más...

### Odontología (231xxx)
- Exodoncia de incluidos

## 🔧 Proceso de Importación

### 1. Lectura del CSV
El script lee el archivo `Libro3.csv` que contiene:
- **Columnas:** `codigo cups`, `nombrecups`, `Monto`
- **Registros duplicados:** Algunos códigos aparecen múltiples veces con diferentes montos

### 2. Consolidación de Datos
- Los códigos duplicados se consolidan tomando el **monto más alto**
- Ejemplo: Código 881201 aparece con $120,000 y $33,738 → Se toma $120,000

### 3. Inserción en Base de Datos
- Se utiliza `INSERT ... ON DUPLICATE KEY UPDATE`
- Si el código existe, se actualiza el nombre y precio
- Si es nuevo, se inserta con:
  - `status`: 'Activo'
  - `category`: 'Ecografía' (por defecto)
  - `price`: El monto más alto encontrado

## 📊 Estructura de la Tabla CUPS

```sql
CREATE TABLE cups (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(500) NOT NULL,
  category VARCHAR(100),
  subcategory VARCHAR(100),
  description TEXT,
  specialty_id INT UNSIGNED,
  price DECIMAL(10,2) DEFAULT 0.00,
  requires_authorization BOOLEAN DEFAULT FALSE,
  complexity_level ENUM('Baja', 'Media', 'Alta') DEFAULT 'Media',
  estimated_duration_minutes INT DEFAULT 30,
  requires_anesthesia BOOLEAN DEFAULT FALSE,
  requires_hospitalization BOOLEAN DEFAULT FALSE,
  requires_previous_studies BOOLEAN DEFAULT FALSE,
  status ENUM('Activo', 'Inactivo', 'Descontinuado') DEFAULT 'Activo',
  is_surgical BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  updated_by INT
);
```

## 🚀 Cómo Ejecutar el Script

### Requisitos Previos
- Node.js y TypeScript instalados
- Acceso a la base de datos MySQL
- Credenciales correctas en el código del script

### Comando de Ejecución
```bash
cd /home/ubuntu/app/backend
npx ts-node scripts/import-cups-from-csv.ts
```

### Salida Esperada
```
📚 Iniciando importación de códigos CUPS...
🔌 Conectando a la base de datos...
✅ Conectado exitosamente
📄 Leyendo archivo CSV: /home/ubuntu/app/Libro3.csv
📊 Registros únicos encontrados: 62
💾 Insertando/actualizando registros en la base de datos...
✅ Insertado: 881201 - ECOGRAFIA DE MAMA...
...
============================================================
📊 RESUMEN DE IMPORTACIÓN:
============================================================
✅ Registros insertados: 30
🔄 Registros actualizados: 32
❌ Errores: 0
📝 Total procesado: 62
============================================================
🎯 Total de códigos CUPS activos en la base de datos: 76
💰 Valor total de procedimientos: $9,419,904.00
```

## 📝 Ejemplos de Datos Importados

### Códigos con Precios Más Altos
```sql
SELECT code, name, price 
FROM cups 
ORDER BY price DESC 
LIMIT 5;
```

| Código | Nombre | Precio |
|--------|--------|--------|
| 881305 | Ecografía de abdomen superior | $90,000.00 |
| 881601 | Ecografía de tejidos blandos superiores | $90,000.00 |
| 881620 | Ecografía articular de rodilla | $90,000.00 |

## 🔄 Mantenimiento

### Actualizar Precios
Para actualizar precios de códigos existentes:
1. Modificar el archivo CSV con los nuevos precios
2. Ejecutar el script nuevamente
3. El sistema actualizará automáticamente los registros existentes

### Agregar Nuevos Códigos
1. Agregar las nuevas filas al CSV
2. Ejecutar el script
3. Los nuevos códigos se insertarán automáticamente

## ⚠️ Consideraciones Importantes

1. **Duplicados en CSV:** El script maneja automáticamente duplicados, conservando el precio más alto
2. **Categorización:** Actualmente todos los códigos se categorizan como "Ecografía" por defecto
3. **Campos adicionales:** El script solo llena `code`, `name`, `price`, `status` y `category`. Otros campos quedan con valores por defecto
4. **Normalización de precios:** Algunos códigos tienen precio $0 en el CSV, estos se mantienen como están

## 🔍 Verificación de Datos

### Ver todos los códigos importados
```bash
mysql -u biosanar_user -p biosanar -e "SELECT code, name, price FROM cups ORDER BY code;"
```

### Ver estadísticas por categoría
```bash
mysql -u biosanar_user -p biosanar -e "
  SELECT 
    category, 
    COUNT(*) as total,
    AVG(price) as precio_promedio,
    MIN(price) as precio_min,
    MAX(price) as precio_max
  FROM cups 
  GROUP BY category;
"
```

## 📞 Soporte

Para modificaciones al script o ajustes en la estructura de la tabla CUPS, contactar al equipo de desarrollo.

---

**Última actualización:** 15 de octubre de 2025  
**Estado:** ✅ Completado exitosamente
