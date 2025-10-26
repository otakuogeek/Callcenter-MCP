# Detección Global de Pacientes Duplicados en Agendas

## 📋 Descripción

Se ha implementado un sistema avanzado de detección de pacientes duplicados que verifica no solo la agenda actual, sino **TODAS las agendas del sistema** para identificar si un paciente tiene múltiples citas confirmadas.

## 🎯 Funcionalidades

### 1. Detección en la Agenda Actual
- Identifica pacientes con múltiples citas en la misma agenda
- Resalta las filas con fondo amarillo (`bg-yellow-100`)
- Muestra etiqueta "⚠️ DUPLICADO" junto al nombre del paciente

### 2. Detección Global en Todas las Agendas ⭐ NUEVO
- Busca todas las citas confirmadas del paciente en el sistema
- Compara por número de documento (cédula)
- Muestra información detallada de otras citas:
  - **Especialidad** de la otra cita
  - **Fecha y hora** de la otra cita
  - **Ubicación** (sede) de la otra cita

## 🔍 Cómo Funciona

### Algoritmo de Detección

```typescript
// 1. Cargar todas las citas confirmadas del sistema
const allRows = await api.getAppointments({ status: 'Confirmada' });

// 2. Agrupar por número de documento
const documentAppointmentsMap = new Map<string, AllAppointmentRow[]>();
allAppointments.forEach(ap => {
  if (ap.patient_document && ap.status === 'Confirmada') {
    const existing = documentAppointmentsMap.get(ap.patient_document) || [];
    documentAppointmentsMap.set(ap.patient_document, [...existing, ap]);
  }
});

// 3. Detectar duplicados (más de 1 cita)
const isDuplicate = patientAppointments.length > 1;

// 4. Filtrar otras citas (diferentes agendas)
const otherAppointments = patientAppointments.filter(other => 
  other.id !== ap.id && 
  other.availability_id !== availability?.id
);
```

## 📱 Interfaz de Usuario

### Vista Normal (Sin Duplicados)
```
┌─────────────────────────────────────────────┐
│ Juan Pérez Gómez                            │
│ 123456789 • 3001234567              11:30   │
└─────────────────────────────────────────────┘
```

### Vista con Duplicado en la Misma Agenda
```
┌─────────────────────────────────────────────┐
│ Ricardo Alonso ⚠️ DUPLICADO                 │
│ 110099591 • 3142628600              15:00   │
│                                             │
│ Otras citas confirmadas:                    │
│ • Medicina General - 21 de Oct a las 14:30  │
│   (Sede biosanarcall san gil)               │
└─────────────────────────────────────────────┘
```

### Vista con Duplicado en Otra Agenda
```
┌─────────────────────────────────────────────┐
│ María López ⚠️ DUPLICADO                    │
│ 987654321 • 3009876543              09:00   │
│                                             │
│ Otras citas confirmadas:                    │
│ • Cardiología - 23 de Oct a las 14:00       │
│   (Sede principal)                          │
│ • Neurología - 25 de Oct a las 16:30        │
│   (Sede norte)                              │
└─────────────────────────────────────────────┘
```

## 🎨 Diseño Visual

### Colores y Estilos
- **Fondo**: `bg-yellow-100` (amarillo claro)
- **Borde**: `border-yellow-400` (amarillo más intenso)
- **Etiqueta**: `text-yellow-700 font-semibold` (texto amarillo oscuro)
- **Sección de otras citas**: 
  - Fondo: `bg-yellow-50`
  - Borde izquierdo: `border-l-2 border-yellow-500`

## 📊 Información Mostrada

Para cada cita duplicada se muestra:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **Nombre del Paciente** | Nombre completo | Ricardo Alonso Cardoso Puerto |
| **Documento** | Cédula del paciente | 110099591 |
| **Teléfono** | Número de contacto | 3142628600 |
| **Hora en Agenda Actual** | Hora de la cita actual | 15:00 |
| **Estado** | Estado de la cita | Confirmada |
| **Especialidad (otras citas)** | Especialidad de otras citas | Medicina General |
| **Fecha (otras citas)** | Fecha formateada | 21 de Oct |
| **Hora (otras citas)** | Hora de otras citas | 14:30 |
| **Ubicación (otras citas)** | Sede de otras citas | Sede biosanarcall san gil |

## 🔧 Implementación Técnica

### Archivos Modificados

**`/frontend/src/components/ViewAvailabilityModal.tsx`**

#### Nuevos Estados
```typescript
const [allAppointments, setAllAppointments] = useState<AllAppointmentRow[]>([]);
```

#### Nuevo Tipo de Datos
```typescript
type AllAppointmentRow = AppointmentRow & {
  specialty_name?: string;
  doctor_name?: string;
  location_name?: string;
  availability_id?: number;
};
```

#### Carga de Datos
```typescript
useEffect(() => {
  const load = async () => {
    // Cargar citas de esta agenda
    const rows = await api.getAppointments({ availability_id: availability.id });
    setAppointments(rows as AppointmentRow[]);
    
    // Cargar TODAS las citas confirmadas del sistema
    const allRows = await api.getAppointments({ status: 'Confirmada' });
    setAllAppointments(allRows as AllAppointmentRow[]);
  };
  load();
}, [isOpen, availability?.id]);
```

## 🚀 Ventajas del Sistema

1. **Prevención de Errores**: Identifica duplicados antes de que causen conflictos
2. **Visibilidad Total**: Muestra todas las citas del paciente en el sistema
3. **Información Contextual**: Indica especialidad, fecha y ubicación de otras citas
4. **Interfaz Clara**: Resaltado visual inmediato con colores y etiquetas
5. **Verificación Rápida**: Los administrativos pueden verificar y corregir duplicados fácilmente

## 📝 Casos de Uso

### Caso 1: Paciente con Múltiples Citas el Mismo Día
El sistema alertará con el resaltado amarillo y mostrará todas las citas del día, permitiendo:
- Verificar si son citas diferentes (distintas especialidades)
- Detectar errores de agendamiento
- Confirmar con el paciente sus citas

### Caso 2: Paciente con Seguimiento Programado
Si el paciente tiene citas de seguimiento en diferentes especialidades:
- Se verán todas sus citas confirmadas
- Se puede coordinar horarios para evitar superposiciones
- Se puede informar al paciente sobre todas sus citas próximas

### Caso 3: Error de Agendamiento Duplicado
Si por error se agendó dos veces la misma cita:
- Se detectará inmediatamente con el resaltado
- Se puede cancelar la cita duplicada
- Se evita confusión en la atención médica

## 🔐 Consideraciones de Seguridad

- Solo se muestran citas con estado "Confirmada"
- La validación se basa en el número de documento único
- No se muestran datos sensibles adicionales
- Respeta el flujo de autenticación del sistema

## 📈 Rendimiento

### Optimizaciones Implementadas
- Carga única al abrir el modal
- Uso de `Map` para búsquedas O(1)
- Filtrado eficiente con operaciones de array
- Límite de 200 citas en el endpoint (ver `appointments.ts`)

### Impacto en el Usuario
- ⚡ Carga instantánea del resaltado
- 🎯 Sin delays perceptibles
- 💾 Cache automático mientras el modal esté abierto

## 🐛 Manejo de Errores

El sistema maneja gracefully los siguientes casos:
- Pacientes sin documento registrado (no se marcan como duplicados)
- Errores en la carga de datos (muestra mensaje de error)
- Citas sin información completa (usa "N/A" como fallback)
- Problemas de conexión (mantiene la interfaz estable)

## 📅 Próximas Mejoras Sugeridas

1. **Filtro de Rango de Fechas**: Mostrar solo duplicados en un rango de tiempo
2. **Acción Rápida**: Botón para cancelar cita duplicada directamente
3. **Notificación Automática**: Alertar al administrativo cuando se crea un duplicado
4. **Estadísticas**: Dashboard con métricas de duplicados por sede/doctor
5. **Exportación**: Generar reporte de pacientes con múltiples citas

## 🎓 Guía para Administrativos

### ¿Qué hacer cuando veo un paciente duplicado?

1. **Verificar Información**: Revisar si las citas son diferentes (especialidades distintas)
2. **Contactar al Paciente**: Confirmar si ambas citas son necesarias
3. **Cancelar si es Error**: Si es un duplicado accidental, cancelar una de las citas
4. **Coordinar Horarios**: Si son citas diferentes, verificar que los horarios sean compatibles
5. **Documentar**: Agregar notas en la cita si hay consideraciones especiales

---

**Versión**: 1.0  
**Fecha de Implementación**: Octubre 2025  
**Desarrollado para**: Fundación Biosanar IPS  
**Módulo**: Gestión de Agendas - ViewAvailabilityModal
