# 📄 Actualización de Exportación PDF y Excel

## 🎯 Cambios Implementados

Se actualizaron las funciones de exportación para que:

1. **PDF**: Muestra **SOLO citas confirmadas** (activas)
2. **Excel**: Muestra **TODAS las citas con su estado** (Confirmada, Cancelada, Pendiente)

---

## 📋 Exportación a PDF

### ✅ Antes
```
PDF mostraba:
- Todas las citas (Confirmadas + Canceladas + Pendientes)
- Sin diferenciación de estado
- Lista mezclada
```

### ✅ Ahora
```
PDF muestra:
- SOLO citas confirmadas
- Filtrado automático
- Contador en el título: "CITAS CONFIRMADAS (7 de 12)"
```

---

## 📊 Vista del PDF Actualizado

### Encabezado de la Sección

```
┌────────────────────────────────────────────────────────┐
│                                                         │
│           CITAS CONFIRMADAS (7 de 12)                  │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**Explicación del contador:**
- `7` = Citas confirmadas (las que se mostrarán)
- `12` = Total de citas (confirmadas + canceladas + pendientes)

### Tabla de Citas (Solo Confirmadas)

```
┌─────────┬──────────────────────┬──────┬────────────┬──────────┬──────────┐
│  HORA   │      PACIENTE        │ EDAD │ IDENTIF.   │ TELÉFONO │ TELÉFONO │
├─────────┼──────────────────────┼──────┼────────────┼──────────┼──────────┤
│ 08:00   │ CARLOS VELÁZQUEZ     │  45  │ 91076965   │ 3219106  │    0     │
│ 08:15   │ JOSÉ VELASQUE        │  38  │ 91069407   │ 1181701  │    0     │
│ 08:30   │ BLAY REDA            │  52  │ 37895974   │ 3219490  │    0     │
│ 09:00   │ JOSÉ PH              │  33  │ 110126273  │ 3144634  │    0     │
│ 09:15   │ MARTA PIMIENTO       │  67  │ 31234567   │ 3124651  │    0     │
│ 09:30   │ MARÍA LÓPEZ          │  41  │ 12345678   │ 3001234  │    0     │
│ 10:00   │ JUAN PÉREZ           │  29  │ 87654321   │ 3009876  │    0     │
└─────────┴──────────────────────┴──────┴────────────┴──────────┴──────────┘

Total: 7 citas confirmadas
(5 citas canceladas no se muestran en el PDF)
```

---

## 📈 Exportación a Excel

### ✅ Antes
```
Excel mostraba:
- Todas las citas
- Columna "Estado" existía pero sin filtrado
- Sin resumen detallado
```

### ✅ Ahora
```
Excel muestra:
- TODAS las citas (Confirmadas, Canceladas, Pendientes)
- Ordenadas por estado (Confirmadas primero, luego Pendientes, luego Canceladas)
- Dentro de cada estado, ordenadas por hora
- Resumen detallado con contadores por estado
```

---

## 📊 Vista del Excel Actualizado

### Encabezado

```
FUNDACIÓN BIOSANAR IPS
AGENDA MÉDICA DIARIA

Doctor:        Dra. Luis Fernanda Garrido Castillo
Especialidad:  Medicina General
Sede:          Sede Principal
Fecha:         21/10/2025
Horario:       08:00 - 12:00
```

### Tabla de Citas (Todas, Ordenadas por Estado)

```
┌──────┬────────────────┬──────┬─────────┬──────────┬──────────┬─────────┬───────────┬──────────┐
│ Hora │ Paciente       │ Edad │ Identif │ Teléfono │ Correo   │ Motivo  │  Estado   │ Duración │
├──────┼────────────────┼──────┼─────────┼──────────┼──────────┼─────────┼───────────┼──────────┤
│      │                │      │         │          │          │         │           │          │
│ CONFIRMADAS (ordenadas por hora)                                                              │
│      │                │      │         │          │          │         │           │          │
│ 08:00│ Carlos V.      │  45  │ 9107696 │ 3219106  │ email@   │ Control │Confirmada │    15    │
│ 08:15│ José V.        │  38  │ 9106940 │ 1181701  │ N/A      │ Consulta│Confirmada │    15    │
│ 08:30│ Blay R.        │  52  │ 3789597 │ 3219490  │ N/A      │ Revisión│Confirmada │    15    │
│ 09:00│ José PH        │  33  │ 1101262 │ 3144634  │ N/A      │ Control │Confirmada │    15    │
│ 09:15│ Marta P.       │  67  │ 3123456 │ 3124651  │ N/A      │ Consulta│Confirmada │    15    │
│ 09:30│ María L.       │  41  │ 1234567 │ 3001234  │ N/A      │ Control │Confirmada │    15    │
│ 10:00│ Juan P.        │  29  │ 8765432 │ 3009876  │ N/A      │ Revisión│Confirmada │    15    │
│      │                │      │         │          │          │         │           │          │
│ CANCELADAS (ordenadas por hora)                                                               │
│      │                │      │         │          │          │         │           │          │
│ 08:45│ Ricardo M.     │  55  │ 1234567 │ 3001234  │ N/A      │ Control │Cancelada  │    15    │
│ 09:45│ Belkis R.      │  48  │ 8765432 │ 3009876  │ N/A      │ Consulta│Cancelada  │    15    │
│ 10:15│ Jorge S.       │  61  │ 5555555 │ 3115555  │ N/A      │ Revisión│Cancelada  │    15    │
│ 10:30│ Marta G.       │  39  │ 6666666 │ 3126666  │ N/A      │ Control │Cancelada  │    15    │
│ 11:00│ Daniel C.      │  44  │ 7777777 │ 3137777  │ N/A      │ Consulta│Cancelada  │    15    │
└──────┴────────────────┴──────┴─────────┴──────────┴──────────┴─────────┴───────────┴──────────┘
```

### Resumen Detallado

```
RESUMEN DE CITAS
Total de citas:    12
Confirmadas:        7
Canceladas:         5
Pendientes:         0

Generado:          20/10/2025 14:30
```

---

## 🔍 Lógica de Filtrado

### PDF - Solo Confirmadas

```typescript
// En generateDailyAgendaPDF
const tableData = agenda.appointments
  .filter((apt) => apt.status === 'Confirmada') // ✅ FILTRO AQUÍ
  .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  .map((apt) => {
    // ... formateo de datos
  });
```

**Resultado:**
- ✅ Solo citas con `status === 'Confirmada'`
- ❌ Excluye `status === 'Cancelada'`
- ❌ Excluye `status === 'Pendiente'`

### Excel - Todas con Estado

```typescript
// En exportDailyAgendaToExcel
const sortedAppointments = agenda.appointments.sort((a, b) => {
  // Prioridad de estados: Confirmada > Pendiente > Cancelada
  const statusOrder: { [key: string]: number } = {
    'Confirmada': 1,
    'Pendiente': 2,
    'Cancelada': 3
  };
  const statusA = statusOrder[a.status] || 4;
  const statusB = statusOrder[b.status] || 4;
  
  if (statusA !== statusB) {
    return statusA - statusB; // Ordenar por estado
  }
  
  // Si el estado es igual, ordenar por hora
  return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
});
```

**Resultado:**
- ✅ Muestra todas las citas
- ✅ Ordenadas por estado (Confirmadas primero)
- ✅ Dentro de cada estado, ordenadas por hora
- ✅ Columna "Estado" visible para todas

---

## 📊 Contador en PDF

### Cálculo del Contador

```typescript
// Contar citas confirmadas
const citasConfirmadas = agenda.appointments
  .filter((apt) => apt.status === 'Confirmada')
  .length;
  
const totalCitas = agenda.appointments.length;

// Título: "CITAS CONFIRMADAS (7 de 12)"
doc.text(
  `CITAS CONFIRMADAS (${citasConfirmadas} de ${totalCitas})`, 
  pageWidth / 2, 
  yPosition + 7, 
  { align: 'center' }
);
```

**Ejemplos:**
- `CITAS CONFIRMADAS (7 de 12)` → 7 confirmadas de 12 totales
- `CITAS CONFIRMADAS (10 de 10)` → Todas confirmadas
- `CITAS CONFIRMADAS (0 de 5)` → Todas canceladas
- `CITAS CONFIRMADAS (15 de 20)` → 15 confirmadas, 5 canceladas/pendientes

---

## 📋 Resumen de Excel

### Cálculo del Resumen

```typescript
const confirmadas = agenda.appointments
  ?.filter(apt => apt.status === 'Confirmada').length || 0;
  
const canceladas = agenda.appointments
  ?.filter(apt => apt.status === 'Cancelada').length || 0;
  
const pendientes = agenda.appointments
  ?.filter(apt => apt.status === 'Pendiente').length || 0;
  
const totalCitas = agenda.appointments?.length || 0;

sheetData.push(['RESUMEN DE CITAS']);
sheetData.push(['Total de citas:', totalCitas]);
sheetData.push(['Confirmadas:', confirmadas]);
sheetData.push(['Canceladas:', canceladas]);
sheetData.push(['Pendientes:', pendientes]);
```

**Beneficios:**
- ✅ Vista rápida del estado de la agenda
- ✅ Identificar rápidamente cancelaciones
- ✅ Verificar pendientes por confirmar
- ✅ Validar total de citas programadas

---

## 🎨 Ordenamiento en Excel

### Orden de Prioridad

| Prioridad | Estado      | Color sugerido (manual) |
|-----------|-------------|-------------------------|
| 1️⃣       | Confirmada  | Verde                   |
| 2️⃣       | Pendiente   | Amarillo                |
| 3️⃣       | Cancelada   | Rojo                    |

### Ejemplo de Ordenamiento

**Citas originales:**
```
10:00 - Cancelada
08:00 - Confirmada
09:00 - Pendiente
08:30 - Confirmada
11:00 - Cancelada
```

**Después del ordenamiento:**
```
08:00 - Confirmada  ← Primero confirmadas por hora
08:30 - Confirmada
09:00 - Pendiente   ← Luego pendientes
10:00 - Cancelada   ← Finalmente canceladas por hora
11:00 - Cancelada
```

---

## 📱 Casos de Uso

### Caso 1: Agenda con Confirmadas y Canceladas

**Estado:**
- 7 confirmadas
- 5 canceladas
- 0 pendientes
- Total: 12

**PDF:**
```
Título: CITAS CONFIRMADAS (7 de 12)
Tabla: 7 filas (solo confirmadas)
```

**Excel:**
```
Tabla: 12 filas (7 confirmadas + 5 canceladas)
Resumen:
  Total: 12
  Confirmadas: 7
  Canceladas: 5
  Pendientes: 0
```

### Caso 2: Todas Confirmadas

**Estado:**
- 15 confirmadas
- 0 canceladas
- 0 pendientes
- Total: 15

**PDF:**
```
Título: CITAS CONFIRMADAS (15 de 15)
Tabla: 15 filas
```

**Excel:**
```
Tabla: 15 filas
Resumen:
  Total: 15
  Confirmadas: 15
  Canceladas: 0
  Pendientes: 0
```

### Caso 3: Todas Canceladas

**Estado:**
- 0 confirmadas
- 8 canceladas
- 0 pendientes
- Total: 8

**PDF:**
```
Título: CITAS CONFIRMADAS (0 de 8)
Tabla: Vacía (sin filas)
```

**Excel:**
```
Tabla: 8 filas (todas canceladas)
Resumen:
  Total: 8
  Confirmadas: 0
  Canceladas: 8
  Pendientes: 0
```

### Caso 4: Mezcla Completa

**Estado:**
- 10 confirmadas
- 3 canceladas
- 2 pendientes
- Total: 15

**PDF:**
```
Título: CITAS CONFIRMADAS (10 de 15)
Tabla: 10 filas (solo confirmadas)
```

**Excel:**
```
Tabla: 15 filas (10 confirmadas + 2 pendientes + 3 canceladas)
Resumen:
  Total: 15
  Confirmadas: 10
  Canceladas: 3
  Pendientes: 2
```

---

## 🔧 Funciones Modificadas

### `/frontend/src/utils/pdfGenerators.ts`

**Función 1: `generateDailyAgendaPDF`**

**Cambios:**
1. ✅ Agregado filtro `.filter((apt) => apt.status === 'Confirmada')` (línea ~741)
2. ✅ Agregado contador de confirmadas vs totales (línea ~733)
3. ✅ Actualizado título a `CITAS CONFIRMADAS (X de Y)` (línea ~739)

**Función 2: `exportDailyAgendaToExcel`**

**Cambios:**
1. ✅ Agregado ordenamiento por estado y hora (línea ~893)
2. ✅ Agregado resumen detallado con contadores (línea ~928)
3. ✅ Columna "Estado" ya existente, mantenida

---

## ✅ Beneficios

### Para Administrativos

| Beneficio | PDF | Excel |
|-----------|-----|-------|
| **Ver solo activas** | ✅ | ❌ |
| **Ver todas con estado** | ❌ | ✅ |
| **Imprimir para consulta** | ✅ | ❌ |
| **Análisis detallado** | ❌ | ✅ |
| **Verificar cancelaciones** | ❌ | ✅ |
| **Lista limpia** | ✅ | ❌ |

### Para el Doctor

**PDF:**
- ✅ Lista limpia de pacientes que SÍ vendrán
- ✅ Sin confusión con cancelados
- ✅ Fácil de imprimir y llevar al consultorio
- ✅ Contador muestra capacidad real utilizada

**Excel:**
- ✅ Registro completo de toda la agenda
- ✅ Identificar patrones de cancelación
- ✅ Auditoría completa
- ✅ Resumen para reportes administrativos

---

## 🎓 Para Usuarios

### ¿Cuándo usar PDF?

- ✅ **Imprimir agenda diaria** para el doctor
- ✅ **Consulta rápida** de pacientes confirmados
- ✅ **Llevar al consultorio** (lista limpia)
- ✅ **Verificar carga de trabajo real**

### ¿Cuándo usar Excel?

- ✅ **Análisis detallado** de la agenda
- ✅ **Verificar cancelaciones**
- ✅ **Reportes administrativos**
- ✅ **Auditoría completa**
- ✅ **Seguimiento de estados**

---

## 📊 Ejemplo Comparativo

### Agenda del 21 de Octubre

**Datos:**
- Doctor: Dra. Luis Fernanda Garrido Castillo
- Especialidad: Medicina General
- Total programadas: 12 citas
- Confirmadas: 7
- Canceladas: 5

### Exportar a PDF

**Resultado:**
```
📄 Archivo: Agenda_Medicina_General_Dra_Garrido_20251021.pdf

┌────────────────────────────────────────────┐
│  CITAS CONFIRMADAS (7 de 12)               │
├────────────────────────────────────────────┤
│ 08:00 - Carlos Velázquez                   │
│ 08:15 - José Velasque                      │
│ 08:30 - Blay Reda                          │
│ 09:00 - José PH                            │
│ 09:15 - Marta Pimiento                     │
│ 09:30 - María López                        │
│ 10:00 - Juan Pérez                         │
└────────────────────────────────────────────┘

(5 citas canceladas NO aparecen)
```

### Exportar a Excel

**Resultado:**
```
📊 Archivo: Agenda_Medicina_General_Dra_Garrido_20251021.xlsx

CONFIRMADAS (7):
08:00 - Carlos Velázquez - Confirmada
08:15 - José Velasque - Confirmada
08:30 - Blay Reda - Confirmada
09:00 - José PH - Confirmada
09:15 - Marta Pimiento - Confirmada
09:30 - María López - Confirmada
10:00 - Juan Pérez - Confirmada

CANCELADAS (5):
08:45 - Ricardo Martínez - Cancelada
09:45 - Belkis Rodríguez - Cancelada
10:15 - Jorge Santos - Cancelada
10:30 - Marta González - Cancelada
11:00 - Daniel Castro - Cancelada

RESUMEN:
Total: 12
Confirmadas: 7
Canceladas: 5
Pendientes: 0
```

---

## ✅ Testing

- ✅ Compilación exitosa
- ✅ Filtrado de PDF correcto (solo confirmadas)
- ✅ Excel muestra todas las citas
- ✅ Contador en PDF preciso
- ✅ Resumen en Excel detallado
- ✅ Ordenamiento por estado funcionando
- ✅ Listo para producción

---

**Estado**: ✅ COMPLETADO  
**Fecha**: Octubre 20, 2025  
**Versión**: 6.0  
**Sistema**: Biosanarcall - Exportación PDF/Excel  
**Mejora**: Filtrado Inteligente por Estado
