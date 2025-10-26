# Actualización: Campo CUPS en API de Lista de Espera

## 📋 Cambios Realizados

Se agregó información del servicio CUPS (código, nombre, categoría, precio) a los endpoints de lista de espera y citas.

---

## 🔧 Endpoints Modificados

### 1. **GET /api/appointments/waiting-list**

**Nueva respuesta incluye:**
```json
{
  "success": true,
  "data": [
    {
      "specialty_id": 1,
      "specialty_name": "Ecografía",
      "total_waiting": 3,
      "patients": [
        {
          "id": 160,
          "patient_id": 1177,
          "patient_name": "Juan Pérez",
          "priority_level": "Alta",
          "status": "pending",
          // ✨ NUEVO: Información del servicio CUPS
          "cups_id": 325,
          "cups_code": "881201",
          "cups_name": "ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS",
          "cups_category": "Ecografía",
          "cups_price": 128030.00
        }
      ]
    }
  ]
}
```

### 2. **GET /api/appointments/daily-queue**

**Ambas secciones (waiting y appointments) incluyen campos CUPS:**
```json
{
  "success": true,
  "data": {
    "waiting": [
      {
        "type": "waiting",
        "id": 160,
        "patient_name": "Juan Pérez",
        // ✨ NUEVO
        "cups_id": 325,
        "cups_code": "881201",
        "cups_name": "ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS",
        "cups_category": "Ecografía",
        "cups_price": 128030.00
      }
    ],
    "appointments": [
      {
        "type": "appointment",
        "id": 135,
        "patient_name": "María García",
        // ✨ NUEVO
        "cups_id": 325,
        "cups_code": "881201",
        "cups_name": "ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS",
        "cups_category": "Ecografía",
        "cups_price": 128030.00
      }
    ]
  }
}
```

---

## 🗄️ Consultas SQL Modificadas

### Waiting List Query
```sql
SELECT 
  wl.*,
  c.code AS cups_code,
  c.name AS cups_name,
  c.category AS cups_category,
  c.price AS cups_price
FROM appointments_waiting_list wl
LEFT JOIN cups c ON wl.cups_id = c.id
```

### Appointments Query
```sql
SELECT 
  app.*,
  c.code AS cups_code,
  c.name AS cups_name,
  c.category AS cups_category,
  c.price AS cups_price
FROM appointments app
LEFT JOIN cups c ON app.cups_id = c.id
```

---

## 📊 Datos de Prueba

```sql
-- Se actualizaron 3 registros de lista de espera con CUPS de ejemplo
UPDATE appointments_waiting_list 
SET cups_id = 325  -- Ecografía de mama
WHERE id IN (160, 161, 162);
```

**Resultado verificado:**
```
+-----+------------+---------+-----------+--------------------------------------------------+------------+
| id  | patient_id | cups_id | cups_code | cups_name                                        | cups_price |
+-----+------------+---------+-----------+--------------------------------------------------+------------+
| 160 |       1177 |     325 | 881201    | ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS | $128,030   |
| 161 |       1128 |     325 | 881201    | ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS | $128,030   |
| 162 |       1128 |     325 | 881201    | ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS | $128,030   |
+-----+------------+---------+-----------+--------------------------------------------------+------------+
```

---

## ✅ Validación

### Backend Compilado y Reiniciado
```bash
✓ Backend compilado sin errores
✓ PM2 restart #40 exitoso
✓ JOIN con tabla cups funcional
```

### Campos Disponibles en Response
- ✅ `cups_id` - ID del servicio CUPS
- ✅ `cups_code` - Código CUPS (ej: "881201")
- ✅ `cups_name` - Nombre completo del servicio
- ✅ `cups_category` - Categoría (Ecografía, Odontología, etc.)
- ✅ `cups_price` - Precio del servicio (decimal)

---

## 🎯 Uso en Frontend

### Ejemplo: Mostrar servicio en lista de espera

```tsx
{patient.cups_name && (
  <div className="flex items-center gap-2">
    <Badge variant="outline">
      {patient.cups_code}
    </Badge>
    <span className="text-sm">{patient.cups_name}</span>
    <span className="text-sm font-semibold text-green-600">
      ${patient.cups_price?.toLocaleString('es-CO')}
    </span>
  </div>
)}
```

### Ejemplo: Filtrar por categoría CUPS

```tsx
const filteredPatients = patients.filter(p => 
  !categoryFilter || p.cups_category === categoryFilter
);
```

---

## 📝 Próximos Pasos Frontend

1. **Mostrar información CUPS en tarjetas de paciente**
   - Código CUPS como badge
   - Nombre del servicio
   - Precio del servicio

2. **Agregar filtros**
   - Filtrar por categoría CUPS
   - Filtrar por rango de precios

3. **Estadísticas mejoradas**
   - Total de ingresos proyectados en lista de espera
   - Servicios más solicitados

4. **Selector de CUPS en formularios**
   - Al crear solicitud de lista de espera
   - Autocomplete por código o nombre

---

**Fecha**: 16 de Octubre, 2025  
**Estado**: ✅ Backend completado y probado  
**Archivo modificado**: `/backend/src/routes/appointments.ts`  
**Restart**: PM2 #40
