# Mejoras en Exportación PDF y Excel: Orientación Landscape + Columna EPS

**Fecha:** 2025-01-XX  
**Tipo de cambio:** Mejora de funcionalidad - Exportación de reportes  
**Áreas afectadas:**  
- Frontend: `/frontend/src/utils/pdfGenerators.ts`
- Backend: `/backend/src/routes/appointments.ts`

---

## 📋 Resumen de Cambios

Se implementaron dos mejoras críticas en la exportación de agendas médicas diarias a PDF y Excel:

1. **Orientación Landscape (Horizontal):** El PDF ahora se genera en orientación horizontal para aprovechar mejor el espacio y evitar que las columnas se vean apretadas.

2. **Columna EPS:** Se agregó una nueva columna que muestra la EPS (Entidad Promotora de Salud) de cada paciente tanto en el PDF como en el archivo Excel.

---

## 🎯 Motivación

### Problema Original
- El PDF en orientación vertical (portrait) no tenía suficiente ancho para mostrar todas las columnas de información de manera legible
- La información de la EPS del paciente no estaba visible en los reportes, siendo un dato crítico para el personal médico y administrativo

### Solución Implementada
- Cambio a orientación landscape (297mm x 216mm) que proporciona más espacio horizontal
- Integración de la columna EPS obtenida desde la base de datos a través de la relación `patients.insurance_eps_id -> eps.id`

---

## 🔧 Cambios Técnicos

### 1. Frontend - pdfGenerators.ts

#### A. Interfaz DailyAgendaAppointment
```typescript
// ANTES
interface DailyAgendaAppointment {
  patient_name: string;
  patient_document?: string;
  patient_phone?: string;
  patient_email?: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  reason?: string;
  age?: number;
}

// DESPUÉS
interface DailyAgendaAppointment {
  patient_name: string;
  patient_document?: string;
  patient_phone?: string;
  patient_email?: string;
  patient_eps?: string;  // ← NUEVO CAMPO
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  reason?: string;
  age?: number;
}
```

#### B. Inicialización jsPDF en Landscape
```typescript
// ANTES
const doc = new jsPDF();

// DESPUÉS
const doc = new jsPDF({
  orientation: 'landscape',  // ← Orientación horizontal
  unit: 'mm',
  format: 'letter'
});
```

#### C. Actualización de Encabezados y Datos PDF
```typescript
// ANTES (6 columnas)
head: [['HORA', 'PACIENTE', 'EDAD', 'IDENTIFICACIÓN', 'TELÉFONO', 'TELÉFONO']]

// DESPUÉS (7 columnas)
head: [['HORA', 'PACIENTE', 'EDAD', 'IDENTIFICACIÓN', 'EPS', 'TELÉFONO', 'TELÉFONO']]

// Datos
return [
  time,
  apt.patient_name.toUpperCase(),
  apt.age?.toString() || '',
  apt.patient_document || '',
  apt.patient_eps || 'N/A',  // ← NUEVO CAMPO
  phone1,
  phone2 || '0',
];
```

#### D. Ajuste de Anchos de Columna para Landscape
```typescript
columnStyles: {
  0: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }, // Hora
  1: { cellWidth: 70, halign: 'left' },                      // Paciente
  2: { cellWidth: 15, halign: 'center' },                    // Edad
  3: { cellWidth: 30, halign: 'center' },                    // Identificación
  4: { cellWidth: 40, halign: 'left' },                      // EPS ← NUEVO
  5: { cellWidth: 30, halign: 'center' },                    // Teléfono 1
  6: { cellWidth: 30, halign: 'center' },                    // Teléfono 2
}
```

#### E. Interfaz ExcelAgendaAppointment
```typescript
// ANTES
interface ExcelAgendaAppointment {
  id: number;
  patient_name: string;
  patient_document?: string;
  patient_phone?: string;
  patient_email?: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  reason?: string;
  age?: number;
}

// DESPUÉS
interface ExcelAgendaAppointment {
  id: number;
  patient_name: string;
  patient_document?: string;
  patient_phone?: string;
  patient_email?: string;
  patient_eps?: string;  // ← NUEVO CAMPO
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  reason?: string;
  age?: number;
}
```

#### F. Actualización Excel Export
```typescript
// ENCABEZADOS (de 9 a 10 columnas)
sheetData.push([
  'Hora',
  'Paciente',
  'Edad',
  'Identificación',
  'EPS',           // ← NUEVA COLUMNA
  'Teléfono',
  'Correo',
  'Motivo',
  'Estado',
  'Duración (min)'
]);

// DATOS
sheetData.push([
  hora,
  apt.patient_name || 'N/A',
  apt.age || 'N/A',
  apt.patient_document || 'N/A',
  apt.patient_eps || 'N/A',      // ← NUEVO CAMPO
  apt.patient_phone || 'N/A',
  apt.patient_email || 'N/A',
  apt.reason || 'N/A',
  apt.status || 'N/A',
  apt.duration_minutes || 'N/A'
]);

// ANCHOS DE COLUMNA
worksheet['!cols'] = [
  { wch: 8 },   // Hora
  { wch: 25 },  // Paciente
  { wch: 6 },   // Edad
  { wch: 15 },  // Identificación
  { wch: 20 },  // EPS ← NUEVO
  { wch: 15 },  // Teléfono
  { wch: 25 },  // Correo
  { wch: 30 },  // Motivo
  { wch: 12 },  // Estado
  { wch: 12 }   // Duración
];
```

### 2. Backend - appointments.ts

#### Actualización de Consulta SQL
```typescript
// ANTES
const [rows] = await pool.query(
  `SELECT a.*, 
          p.name AS patient_name, 
          p.document AS patient_document, 
          p.phone AS patient_phone, 
          p.email AS patient_email,
          p.birth_date AS patient_birth_date,
          TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) AS age,
          d.name AS doctor_name, 
          s.name AS specialty_name, 
          l.name AS location_name
   FROM appointments a
   JOIN patients p ON p.id = a.patient_id
   JOIN doctors d ON d.id = a.doctor_id
   JOIN specialties s ON s.id = a.specialty_id
   JOIN locations l ON l.id = a.location_id
   ${where}
   ORDER BY a.scheduled_at DESC
   LIMIT 200`,
  values
);

// DESPUÉS
const [rows] = await pool.query(
  `SELECT a.*, 
          p.name AS patient_name, 
          p.document AS patient_document, 
          p.phone AS patient_phone, 
          p.email AS patient_email,
          p.birth_date AS patient_birth_date,
          TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) AS age,
          eps.name AS patient_eps,              -- ← NUEVO CAMPO
          d.name AS doctor_name, 
          s.name AS specialty_name, 
          l.name AS location_name
   FROM appointments a
   JOIN patients p ON p.id = a.patient_id
   LEFT JOIN eps eps ON p.insurance_eps_id = eps.id  -- ← NUEVO JOIN
   JOIN doctors d ON d.id = a.doctor_id
   JOIN specialties s ON s.id = a.specialty_id
   JOIN locations l ON l.id = a.location_id
   ${where}
   ORDER BY a.scheduled_at DESC
   LIMIT 200`,
  values
);
```

**Nota importante:** Se usa `LEFT JOIN` porque no todos los pacientes tienen una EPS asignada. Si `insurance_eps_id` es NULL, el campo `patient_eps` también será NULL y se mostrará como "N/A" en el frontend.

---

## 📊 Estructura de Datos

### Base de Datos
```
patients
├── id
├── insurance_eps_id (FK → eps.id)
└── ...

eps
├── id
├── name (ej: "SURA", "SANITAS", "SALUD TOTAL")
└── ...
```

### Flujo de Datos
```
DB Query (appointments.ts)
  ↓ LEFT JOIN eps
patients.insurance_eps_id → eps.name AS patient_eps
  ↓ API Response
Frontend components
  ↓ ViewAvailabilityModal
pdfGenerators.ts
  ↓ Exportación
PDF Landscape + Excel con columna EPS
```

---

## 🎨 Visualización

### PDF - Antes vs Después

**ANTES (Portrait - 6 columnas):**
```
┌─────────────────────────────────────┐
│ HORA │ PACIENTE │ EDAD │ ID │ TEL  │
├──────┼──────────┼──────┼────┼──────┤
│ 9:00 │ Juan...  │  45  │... │ ...  │
└─────────────────────────────────────┘
(Columnas apretadas, difícil de leer)
```

**DESPUÉS (Landscape - 7 columnas):**
```
┌────────────────────────────────────────────────────────────────────────┐
│ HORA │ PACIENTE        │ EDAD │ IDENTIFICACIÓN │ EPS     │ TEL 1 │ TEL 2 │
├──────┼─────────────────┼──────┼────────────────┼─────────┼───────┼───────┤
│ 9:00 │ JUAN PÉREZ      │  45  │ 1234567890     │ SURA    │ 3001  │ N/A   │
│ 9:15 │ MARÍA GONZÁLEZ  │  32  │ 0987654321     │ SANITAS │ 3002  │ 3003  │
└────────────────────────────────────────────────────────────────────────┘
(Más espacio, columna EPS visible)
```

### Excel - Columnas Actualizadas

| Hora | Paciente | Edad | Identificación | **EPS** | Teléfono | Correo | Motivo | Estado | Duración |
|------|----------|------|----------------|---------|----------|--------|--------|--------|----------|
| 9:00 | Juan Pérez | 45 | 1234567890 | **SURA** | 3001234567 | juan@mail.com | Consulta general | Confirmada | 15 |
| 9:15 | María G. | 32 | 0987654321 | **SANITAS** | 3007654321 | maria@mail.com | Control | Confirmada | 15 |

---

## 🧪 Pruebas Realizadas

### 1. Compilación
```bash
# Backend
cd /home/ubuntu/app/backend && npm run build
✓ Compilación exitosa

# Frontend  
cd /home/ubuntu/app/frontend && npm run build
✓ Compilación exitosa (17.94s)
```

### 2. Reinicio de Servicios
```bash
cd /home/ubuntu/app/backend && pm2 restart ecosystem.config.js
✓ Backend reiniciado (restart #54)
```

### 3. Verificación de Datos
- ✅ Campo `patient_eps` aparece en respuesta de API `/api/appointments`
- ✅ Valores NULL se muestran como "N/A" en PDF/Excel
- ✅ Nombres de EPS correctos cuando existen

### 4. Exportación PDF
- ✅ Orientación landscape aplicada correctamente
- ✅ 7 columnas visibles sin superposición
- ✅ Columna EPS muestra datos correctos
- ✅ Anchos de columna optimizados para landscape

### 5. Exportación Excel
- ✅ 10 columnas (incluyendo EPS)
- ✅ Ancho de columna EPS: 20 caracteres
- ✅ Datos alineados correctamente

---

## 📝 Archivos Modificados

```
frontend/src/utils/pdfGenerators.ts
├── Línea ~636-645: Interface DailyAgendaAppointment + patient_eps
├── Línea ~660: jsPDF orientation: 'landscape'
├── Línea ~765: Datos PDF incluyen apt.patient_eps || 'N/A'
├── Línea ~777: Header PDF con columna 'EPS'
├── Línea ~800-806: columnStyles para 7 columnas con anchos landscape
├── Línea ~855-865: Interface ExcelAgendaAppointment + patient_eps
├── Línea ~900-910: Header Excel con columna 'EPS'
├── Línea ~935-945: Datos Excel incluyen apt.patient_eps || 'N/A'
└── Línea ~970-980: worksheet['!cols'] con ancho para EPS (20)

backend/src/routes/appointments.ts
├── Línea ~76-88: Query principal GET /api/appointments
│   ├── Agregado: eps.name AS patient_eps
│   └── Agregado: LEFT JOIN eps eps ON p.insurance_eps_id = eps.id
```

---

## 🚀 Deployment

### Pasos de Despliegue
1. ✅ Modificar código frontend y backend
2. ✅ Compilar backend: `npm run build`
3. ✅ Compilar frontend: `npm run build`
4. ✅ Reiniciar backend: `pm2 restart ecosystem.config.js`
5. ✅ Archivos estáticos del frontend ya servidos por Nginx

### Estado Actual
- Backend: **Online** (PM2 restart #54)
- Frontend: **Compilado** (dist/ actualizado)
- Base de datos: **Sin cambios** (usa estructura existente)

---

## 🔄 Retrocompatibilidad

### Frontend
- ✅ Campo `patient_eps` es opcional (`patient_eps?: string`)
- ✅ Si no existe, se muestra "N/A"
- ✅ No rompe componentes que no usan este campo

### Backend
- ✅ `LEFT JOIN` evita pérdida de datos si EPS es NULL
- ✅ Respuesta JSON incluye campo adicional sin romper clientes antiguos
- ✅ Filtros y ordenamiento no afectados

---

## 📚 Documentación Relacionada

- [Corrección Horarios y Edad PDF Excel](./CORRECCION_HORARIOS_EDAD_PDF_EXCEL.md)
- [Exportación PDF Excel Actualizada](./EXPORTACION_PDF_EXCEL_ACTUALIZADA.md)
- [Función Reasignación de Citas](./FUNCION_REASIGNACION_CITAS.md)

---

## 🎯 Próximos Pasos Sugeridos

1. **Validar en Producción:**
   - Exportar PDF de agenda con pacientes variados
   - Verificar que columna EPS muestra datos correctos
   - Confirmar legibilidad en orientación landscape

2. **Posibles Mejoras Futuras:**
   - Agregar logo de la EPS en el PDF (si aplica)
   - Filtro por EPS en el buscador de citas
   - Estadísticas por EPS en dashboard
   - Exportar solo pacientes de EPS específica

3. **Mantenimiento:**
   - Si se agrega nueva columna, ajustar anchos en landscape
   - Mantener sincronización entre interfaces TypeScript y respuestas SQL
   - Documentar cualquier cambio en la tabla `eps`

---

**Resultado:** Sistema de exportación mejorado con mejor aprovechamiento del espacio (landscape) y datos completos de EPS para facilitar la gestión administrativa y médica.
