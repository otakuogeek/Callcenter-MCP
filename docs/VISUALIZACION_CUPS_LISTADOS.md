# Visualización de Información CUPS en Listados

## Fecha
13 de Noviembre de 2025

## Objetivo
Mostrar la información del procedimiento CUPS (código y descripción) en:
1. **Listado de citas/órdenes** (appointments)
2. **Cola de espera** (waiting list)

## Cambios Realizados

### 1. Backend - appointments.ts

#### Endpoint GET `/api/appointments`
Se agregó el JOIN con la tabla `cups` y se incluyeron los campos CUPS en el SELECT:

```typescript
const [rows] = await pool.query(
  `SELECT a.*, 
          p.name AS patient_name, 
          p.document AS patient_document, 
          p.phone AS patient_phone, 
          p.email AS patient_email,
          p.birth_date AS patient_birth_date,
          TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) AS age,
          eps.name AS patient_eps,
          d.name AS doctor_name, 
          s.name AS specialty_name, 
          l.name AS location_name,
          c.code AS cups_code,              -- ✨ NUEVO
          c.name AS cups_name,              -- ✨ NUEVO
          c.description AS cups_description,-- ✨ NUEVO
          c.category AS cups_category,      -- ✨ NUEVO
          c.price AS cups_price             -- ✨ NUEVO
   FROM appointments a
   JOIN patients p ON p.id = a.patient_id
   LEFT JOIN eps eps ON p.insurance_eps_id = eps.id
   JOIN doctors d ON d.id = a.doctor_id
   JOIN specialties s ON s.id = a.specialty_id
   JOIN locations l ON l.id = a.location_id
   LEFT JOIN cups c ON a.cups_id = c.id  -- ✨ NUEVO JOIN
   ${where}
   ORDER BY a.scheduled_at DESC
   LIMIT 200`,
  values
);
```

**Campos agregados:**
- `cups_code` - Código CUPS (ej: "881620", "881432")
- `cups_name` - Nombre del procedimiento (ej: "ECOGRAFIA ARTICULAR DE RODILLA")
- `cups_description` - Descripción detallada del procedimiento
- `cups_category` - Categoría (ej: "Ecografía", "Odontología")
- `cups_price` - Precio del procedimiento

#### Endpoints de Cola de Espera
Los siguientes endpoints YA TENÍAN la información CUPS implementada:

1. **GET `/api/appointments/waiting-list`** - Cola de espera general
2. **GET `/api/appointments/waiting-list/specialty/:id`** - Cola por especialidad

Ambos endpoints ya incluían:
```sql
LEFT JOIN cups c ON wl.cups_id = c.id
```

Y retornaban:
- `cups_id`
- `cups_code`
- `cups_name`
- `cups_category`
- `cups_price`

### 2. Frontend - Ya Implementado

#### VirtualizedPatientList.tsx (Cola de Espera)
El componente **ya mostraba** la información CUPS desde líneas 171-179:

```tsx
{/* Información del servicio CUPS */}
{item.cups_code && (
  <div className="flex items-center gap-2 mt-2">
    <Badge variant="outline" className="text-xs font-mono">
      {item.cups_code}
    </Badge>
    <span className="text-xs text-medical-700 font-medium">
      {item.cups_name}
    </span>
  </div>
)}
```

**Visualización:**
- Badge con código CUPS en formato monoespaciado
- Nombre del procedimiento en texto verde médico
- Solo se muestra si `cups_code` existe

## Estado de Implementación

### ✅ Completado
1. **Backend - Appointments**: JOIN con tabla cups agregado
2. **Backend - Waiting List**: Ya implementado previamente
3. **Frontend - Queue**: Ya mostrando información CUPS
4. **Compilación**: Sin errores
5. **Despliegue**: Backend reiniciado con PM2

### 📋 Datos Retornados

Cada cita/orden ahora incluye (si tiene CUPS asignado):

```json
{
  "id": 123,
  "patient_name": "Ana Juliette Ciendua Garcia",
  "specialty_name": "Ecografías",
  "cups_id": 15,
  "cups_code": "881620",
  "cups_name": "ECOGRAFIA ARTICULAR DE RODILLA",
  "cups_description": "Procedimiento diagnóstico...",
  "cups_category": "Ecografía",
  "cups_price": 85000.00
}
```

## Visualización Final

### Cola de Espera
Cuando un paciente tiene un procedimiento CUPS asignado, se muestra:

```
┌─────────────────────────────────────────────────────┐
│ [1] Ana Juliette Ciendua Garcia  [Alta] [⚡ Reagendar] │
│ 📞 +573114857001 • Doc: 63545368                    │
│ EPS: NUEVA EPS                                      │
│ Ecografía articular de rodilla                      │
│ ┌────────┐                                          │
│ │ 881620 │ ECOGRAFIA ARTICULAR DE RODILLA          │
│ └────────┘                                          │
│                                   [Llamar] [Asignar]│
└─────────────────────────────────────────────────────┘
```

### Listado de Citas/Órdenes
Ahora las APIs retornan la información CUPS que el frontend puede consumir para mostrar:
- Código CUPS
- Nombre del procedimiento
- Categoría
- Precio (si se requiere)

## Testing

Para verificar la implementación:

1. **Consultar citas con CUPS:**
```bash
curl -H "Authorization: Bearer <token>" \
  "https://biosanarcall.site/api/appointments?status=Pendiente"
```

2. **Consultar cola de espera:**
```bash
curl -H "Authorization: Bearer <token>" \
  "https://biosanarcall.site/api/appointments/waiting-list?status=pending"
```

3. **Verificar en UI:**
   - Ir a `/admin/queue`
   - Buscar pacientes en la especialidad "Ecografías"
   - Verificar que se muestre el código y nombre CUPS

## Archivos Modificados

1. `/home/ubuntu/app/backend/src/routes/appointments.ts` - Líneas 93-117
2. `/home/ubuntu/app/docs/VISUALIZACION_CUPS_LISTADOS.md` - Esta documentación

## Notas Técnicas

- El `LEFT JOIN` con cups asegura que citas sin CUPS asignado no se excluyan
- La información CUPS solo se muestra si `cups_code` existe
- El backend ya estaba preparado para la cola de espera
- Solo fue necesario agregar el JOIN en el endpoint de appointments
- Retrocompatible con citas antiguas sin CUPS

## Base de Datos

### Estructura cups
```sql
CREATE TABLE cups (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(500) NOT NULL,
  category VARCHAR(100),
  subcategory VARCHAR(100),
  description TEXT,
  specialty_id INT UNSIGNED,
  price DECIMAL(10,2) DEFAULT 0.00,
  status ENUM('Activo','Inactivo','Descontinuado') DEFAULT 'Activo',
  ...
)
```

### Relación con appointments
```sql
ALTER TABLE appointments 
ADD COLUMN cups_id INT UNSIGNED,
ADD FOREIGN KEY (cups_id) REFERENCES cups(id);
```

## Estado
✅ **COMPLETADO Y DESPLEGADO**

La información CUPS ahora es visible en todos los listados donde sea relevante (citas y cola de espera).
