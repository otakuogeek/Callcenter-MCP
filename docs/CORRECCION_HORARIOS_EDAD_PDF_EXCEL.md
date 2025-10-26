# Corrección de Horarios en PDF/Excel y Adición de Edad de Pacientes

## 📅 Fecha
**20 de Octubre de 2025**

---

## 🎯 Problemas Resueltos

### 1. ❌ Horarios Incorrectos en PDF y Excel

**Problema Original:**
- El sistema mostraba citas a las **9:00 AM** (correcto)
- El PDF mostraba las mismas citas a las **5:00 PM** (incorrecto)
- Diferencia de **8 horas** por conversión de zona horaria

**Ejemplo:**
```
Sistema:  09:00 AM ✅
PDF:      05:00 PM ❌  (desfase de 8 horas)
```

**Causa Raíz:**
JavaScript estaba convirtiendo las fechas del formato MySQL (`2025-10-21 09:00:00`) a objetos Date, los cuales asumen UTC y luego convierten a la zona horaria local, causando el desfase.

---

### 2. ❌ Edad de Pacientes No Aparecía en PDF/Excel

**Problema Original:**
- La columna "EDAD" aparecía vacía en el PDF
- El backend no estaba enviando el campo calculado

**Ejemplo:**
```
PACIENTE              EDAD
Pedro Alonso Rem      [vacío] ❌
```

---

## 🔧 Soluciones Implementadas

### 1. Corrección de Horarios en PDF

**Archivo:** `/frontend/src/utils/pdfGenerators.ts`

**Antes:**
```typescript
const time = format(new Date(apt.scheduled_at), 'HH:mm:ss');
// Problema: new Date() convierte a zona horaria local
```

**Después:**
```typescript
// Extraer la hora directamente del string sin conversión de zona horaria
// Format: "2025-10-21 09:00:00" o "2025-10-21T09:00:00"
const scheduledStr = String(apt.scheduled_at);
const timeMatch = scheduledStr.match(/(\d{2}):(\d{2}):(\d{2})/);
const time = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}` : scheduledStr.slice(11, 19);
```

**Beneficio:**
- ✅ Extrae la hora directamente del string
- ✅ NO usa conversión de zona horaria
- ✅ Muestra exactamente la hora almacenada en la BD

---

### 2. Corrección de Horarios en Excel

**Archivo:** `/frontend/src/utils/pdfGenerators.ts` (función `exportDailyAgendaToExcel`)

**Antes:**
```typescript
Hora: format(new Date(apt.scheduled_at), 'HH:mm:ss')
// Problema: new Date() convierte a zona horaria local
```

**Después:**
```typescript
// Extraer hora directamente sin conversión de zona horaria
const scheduledStr = String(apt.scheduled_at);
const timeMatch = scheduledStr.match(/(\d{2}):(\d{2}):(\d{2})/);
const time = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}` : scheduledStr.slice(11, 19);

// Usar la hora extraída
Hora: time
```

---

### 3. Cálculo de Edad en el Backend

**Archivo:** `/backend/src/routes/appointments.ts`

**Antes:**
```sql
SELECT a.*, 
       p.name AS patient_name, 
       p.document AS patient_document, 
       p.phone AS patient_phone, 
       p.email AS patient_email,
       d.name AS doctor_name, 
       s.name AS specialty_name, 
       l.name AS location_name
FROM appointments a
JOIN patients p ON p.id = a.patient_id
-- No incluía birth_date ni edad
```

**Después:**
```sql
SELECT a.*, 
       p.name AS patient_name, 
       p.document AS patient_document, 
       p.phone AS patient_phone, 
       p.email AS patient_email,
       p.birth_date AS patient_birth_date,
       TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) AS age,  -- ✅ CÁLCULO DE EDAD
       d.name AS doctor_name, 
       s.name AS specialty_name, 
       l.name AS location_name
FROM appointments a
JOIN patients p ON p.id = a.patient_id
```

**Beneficio:**
- ✅ La edad se calcula automáticamente en MySQL
- ✅ Se envía como campo `age` al frontend
- ✅ El PDF y Excel ahora muestran la edad correcta

---

## 📊 Comparación Antes vs. Después

### Horarios en PDF/Excel

| Paciente | Hora Sistema | Hora PDF (Antes) | Hora PDF (Ahora) |
|----------|-------------|------------------|------------------|
| Pedro Alonso | 09:00 | 17:00 ❌ | 09:00 ✅ |
| Cindy Joana | 09:15 | 17:15 ❌ | 09:15 ✅ |
| Ana Martín | 09:30 | 17:30 ❌ | 09:30 ✅ |

### Edad de Pacientes

| Paciente | Fecha Nacimiento | Edad (Antes) | Edad (Ahora) |
|----------|------------------|--------------|--------------|
| Pedro Alonso | 1980-05-15 | [vacío] ❌ | 45 ✅ |
| Cindy Joana | 1992-08-22 | [vacío] ❌ | 33 ✅ |
| Ana Martín | 1975-12-10 | [vacío] ❌ | 49 ✅ |

---

## 🧪 Pruebas Realizadas

### ✅ Exportación PDF
1. Abrir una agenda con citas confirmadas
2. Generar PDF
3. Verificar que:
   - ✅ Horarios coinciden con el sistema
   - ✅ Columna EDAD muestra valores correctos
   - ✅ No hay desfase de zona horaria

### ✅ Exportación Excel
1. Abrir una agenda con citas
2. Exportar a Excel
3. Verificar que:
   - ✅ Horarios correctos en columna "Hora"
   - ✅ Edad de pacientes visible
   - ✅ Ordenamiento por status funciona

### ✅ API de Appointments
1. Consultar `/api/appointments?availability_id=X`
2. Verificar que la respuesta incluye:
   - ✅ Campo `age` con valor numérico
   - ✅ Campo `patient_birth_date` con fecha
   - ✅ Campo `scheduled_at` con formato correcto

---

## 📋 Ejemplos de Uso

### Consulta API
```javascript
GET /api/appointments?availability_id=144

Response:
[
  {
    id: 1234,
    patient_name: "Pedro Alonso Rem",
    patient_document: "91068487",
    patient_birth_date: "1980-05-15",
    age: 45,  // ✅ Nuevo campo
    scheduled_at: "2025-10-21 09:00:00",  // Hora correcta
    status: "Confirmada",
    ...
  }
]
```

### Generación de PDF
```typescript
// La hora se extrae correctamente
const scheduledStr = "2025-10-21 09:00:00";
const timeMatch = scheduledStr.match(/(\d{2}):(\d{2}):(\d{2})/);
const time = "09:00:00";  // ✅ Hora exacta sin conversión

// La edad se obtiene del API
const edad = apt.age;  // ✅ 45
```

---

## 🚀 Despliegue

### Backend
```bash
cd /home/ubuntu/app/backend
npm run build
pm2 restart ecosystem.config.js
# Backend online (restart #52)
```

### Frontend
```bash
cd /home/ubuntu/app/frontend
npm run build
# Build completado (16.89s)
```

---

## 📝 Archivos Modificados

### Frontend
- `/frontend/src/utils/pdfGenerators.ts`
  - Línea ~750: Corrección de extracción de hora en PDF (función `generateDailyAgendaPDF`)
  - Línea ~880: Corrección de extracción de hora en Excel (función `exportDailyAgendaToExcel`)

### Backend
- `/backend/src/routes/appointments.ts`
  - Línea ~76-86: Agregado de campos `patient_birth_date` y cálculo de `age`

---

## 🔍 Detalles Técnicos

### Regex de Extracción de Hora
```typescript
const timeMatch = scheduledStr.match(/(\d{2}):(\d{2}):(\d{2})/);
```

**Explicación:**
- Busca el patrón `HH:MM:SS` en el string
- `\d{2}` = exactamente 2 dígitos
- Captura las horas, minutos y segundos por separado
- No depende de zona horaria ni del objeto Date de JavaScript

### Cálculo de Edad en MySQL
```sql
TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) AS age
```

**Explicación:**
- `TIMESTAMPDIFF(YEAR, fecha1, fecha2)`: Diferencia en años
- `p.birth_date`: Fecha de nacimiento del paciente
- `CURDATE()`: Fecha actual del servidor
- Retorna la edad como número entero

---

## 🎓 Lecciones Aprendidas

### 1. Zona Horaria en JavaScript
**Problema:** El objeto `Date` de JavaScript siempre asume UTC y convierte a local.

**Solución:** 
- Para mostrar, extraer la hora directamente del string
- NO usar `new Date()` para fechas/horas que no deben convertirse
- Usar regex o `.slice()` para extracción exacta

### 2. Cálculos en el Backend
**Problema:** Calcular la edad en el frontend es ineficiente y propenso a errores.

**Solución:**
- Calcular en MySQL usando `TIMESTAMPDIFF()`
- El backend siempre tiene la fecha/hora correcta del servidor
- El frontend solo muestra el valor recibido

### 3. Consistencia de Datos
**Problema:** El PDF mostraba datos diferentes al sistema.

**Solución:**
- Verificar que PDF/Excel usen los mismos datos que la UI
- NO aplicar transformaciones adicionales
- Mostrar exactamente lo que está en la base de datos

---

## 🆘 Troubleshooting

### Si los horarios siguen incorrectos:

1. **Verificar formato de `scheduled_at` en la BD:**
```sql
SELECT id, scheduled_at 
FROM appointments 
WHERE id = 1234;
-- Debe ser: 2025-10-21 09:00:00 (sin 'T' ni 'Z')
```

2. **Verificar que el regex funcione:**
```javascript
const scheduledStr = "2025-10-21 09:00:00";
const timeMatch = scheduledStr.match(/(\d{2}):(\d{2}):(\d{2})/);
console.log(timeMatch);
// Debe retornar: ["09:00:00", "09", "00", "00"]
```

### Si la edad no aparece:

1. **Verificar que el paciente tenga `birth_date`:**
```sql
SELECT id, name, birth_date 
FROM patients 
WHERE id = 1234;
-- birth_date no debe ser NULL
```

2. **Verificar la respuesta del API:**
```javascript
GET /api/appointments?availability_id=144

// Debe incluir:
{
  age: 45,
  patient_birth_date: "1980-05-15"
}
```

---

## ✅ Checklist de Verificación

- [x] Backend compilado sin errores
- [x] PM2 reiniciado (restart #52)
- [x] Frontend compilado (16.89s)
- [x] API retorna campo `age`
- [x] API retorna campo `patient_birth_date`
- [x] PDF muestra horarios correctos (sin desfase)
- [x] PDF muestra edad de pacientes
- [x] Excel muestra horarios correctos
- [x] Excel muestra edad de pacientes
- [x] Regex de extracción de hora funciona
- [x] Cálculo TIMESTAMPDIFF funciona
- [x] Documentación creada

---

**Estado:** ✅ Completado  
**Versión:** 1.3.0  
**Fecha de Implementación:** 20 de Octubre de 2025
