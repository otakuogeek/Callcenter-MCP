# Sistema de Cita Doble para Odontología - Implementación Completa

## 📋 Resumen de la Implementación

Se ha implementado un sistema completo de **citas dobles opcionales** para la especialidad de Odontología en el portal de pacientes. Este sistema permite a los usuarios solicitar dos citas consecutivas de 20 minutos cada una (40 minutos en total) cuando sea necesario para procedimientos dentales más complejos.

## ✨ Características Implementadas

### 1. **Detección Automática de Especialidad**
- El checkbox de "Cita Doble" **solo aparece** cuando la especialidad seleccionada es **Odontología**
- Para otras especialidades, el flujo de agendamiento permanece igual (sin cambios)

### 2. **Validación de Horarios Consecutivos**
- El sistema verifica automáticamente si existe un horario consecutivo disponible
- **Validación en tiempo real**: Al seleccionar una hora, se muestra inmediatamente si hay horario consecutivo
- **Feedback visual**:
  - ✅ Verde con checkmark: "✓ Siguiente: [hora]" si hay horario consecutivo
  - ❌ Rojo con X: "✗ Sin horario consecutivo" si NO hay horario disponible

### 3. **Alertas Contextuales**
El sistema muestra alertas inteligentes según el estado:

#### Alerta de Error (Roja):
```
⚠️ No hay horarios consecutivos disponibles para la hora seleccionada.
Por favor, elige otra hora o desmarca esta opción.
```

#### Alerta de Confirmación (Verde):
```
✓ Se agendarán dos citas: 10:40 y 11:00
```

### 4. **Creación Automática de Dos Citas**
Cuando el usuario confirma una cita doble:
1. Se crea la **primera cita** con el motivo: `Consulta de Odontología - CITA DOBLE (1/2)`
2. Se crea la **segunda cita** con el motivo: `Consulta de Odontología - CITA DOBLE (2/2)`
3. Ambas citas quedan vinculadas por el mismo paciente, fecha, doctor y sede
4. **Toast de confirmación**: "¡Cita doble confirmada! Se han creado dos citas consecutivas: [hora1] y [hora2]"

### 5. **Manejo de Errores**
- Si la segunda cita falla al crearse, se muestra advertencia pero la primera queda agendada
- El usuario recibe instrucciones claras para contactar con la IPS
- Validación previa evita que se intente crear citas dobles sin horarios disponibles

## 🎨 Interfaz de Usuario

### Modal de Selección de Hora (Odontología)

```
┌─────────────────────────────────────────────────────┐
│  Seleccionar Hora de Cita                           │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Detalles de la agenda:                             │
│  • Fecha: 15/01/2025                                │
│  • Doctor: Dr. María González                       │
│  • Especialidad: Odontología                        │
│  • Sede: Sede Biosanar Centro                       │
│                                                      │
│  Horarios disponibles:                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  10:20   │ │  10:40   │ │  11:00   │           │
│  │Disponible│ │Disponible│ │Disponible│           │
│  │          │ │✓ Sig:11:00│ │          │           │
│  └──────────┘ └──────────┘ └──────────┘           │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ ☐ ¿Desea cita doble? (2 horas consecutivas)│   │
│  │                                              │   │
│  │ Se agendarán dos citas de 20 minutos       │   │
│  │ consecutivas para procedimientos que        │   │
│  │ requieran más tiempo.                       │   │
│  │                                              │   │
│  │ ┌─────────────────────────────────────────┐│   │
│  │ │ ✓ Se agendarán dos citas: 10:40 y 11:00││   │
│  │ └─────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  [ Cancelar ]    [ Confirmar Cita Doble ]          │
└─────────────────────────────────────────────────────┘
```

## 🔧 Detalles Técnicos

### Estados Agregados
```typescript
const [isDoubleAppointment, setIsDoubleAppointment] = useState(false);
const [consecutiveTimeAvailable, setConsecutiveTimeAvailable] = useState(false);
const [nextConsecutiveTime, setNextConsecutiveTime] = useState<string | null>(null);
```

### Función de Validación
```typescript
const checkConsecutiveTimeSlots = (selectedTime: string, availableSlots: string[]): 
  { available: boolean; nextTime: string | null } => {
  // Convierte la hora a minutos
  // Calcula la hora siguiente (+20 minutos)
  // Verifica si está disponible en los slots
  return { available, nextTime };
};
```

### Lógica de Creación
1. Se crea la primera cita con `POST /api/patients-v2/public/schedule-appointment`
2. Si es cita doble y la primera fue exitosa, se crea la segunda con:
   - Mismo `patient_id`, `doctor_id`, `specialty_id`, `availability_id`
   - `selected_time` = hora consecutiva calculada
   - `reason` diferenciado: "(1/2)" y "(2/2)"

## 📊 Flujo de Usuario

### Caso 1: Usuario solicita cita doble CON horarios consecutivos
1. Usuario selecciona Odontología → Sede → Fecha
2. Modal muestra horarios disponibles
3. Usuario marca checkbox "¿Desea cita doble?"
4. Usuario selecciona hora 10:40
5. Sistema valida → ✅ Encuentra 11:00 disponible
6. Alerta verde: "✓ Se agendarán dos citas: 10:40 y 11:00"
7. Botón cambia a "Confirmar Cita Doble"
8. Usuario confirma → Se crean 2 citas
9. Toast: "¡Cita doble confirmada!"

### Caso 2: Usuario solicita cita doble SIN horarios consecutivos
1. Usuario selecciona Odontología → Sede → Fecha
2. Modal muestra horarios disponibles
3. Usuario marca checkbox "¿Desea cita doble?"
4. Usuario selecciona hora 11:40
5. Sistema valida → ❌ NO encuentra 12:00 disponible
6. Alerta roja: "⚠️ No hay horarios consecutivos..."
7. Botón "Confirmar Cita Doble" queda **deshabilitado**
8. Usuario debe:
   - Opción A: Elegir otra hora con consecutivo disponible
   - Opción B: Desmarcar checkbox y tomar cita sencilla

### Caso 3: Usuario NO solicita cita doble
1. Usuario selecciona Odontología → Sede → Fecha
2. Modal muestra horarios disponibles
3. Checkbox "¿Desea cita doble?" permanece desmarcado
4. Usuario selecciona hora 10:40
5. Botón muestra "Confirmar Hora"
6. Usuario confirma → Se crea 1 cita normal
7. Flujo tradicional sin cambios

## 📁 Archivos Modificados

### `/frontend/src/pages/UserPortal.tsx`
- **Líneas 1-10**: Agregado import de `Checkbox` component
- **Líneas 235-243**: Agregados 3 estados nuevos para cita doble
- **Líneas 860-885**: Nueva función `checkConsecutiveTimeSlots()`
- **Líneas 905-933**: Modificada `confirmScheduleWithTime()` con validación
- **Líneas 935-1080**: Modificada `scheduleAppointmentDirectly()` con creación de segunda cita
- **Líneas 3670-3760**: Modificado modal de selección de hora con checkbox y validación visual
- **Líneas 3760-3780**: Modificados botones de acción con reseteo de estados

## 🎯 Ventajas del Sistema

1. **Flexibilidad**: No todas las citas odontológicas son dobles, el paciente elige
2. **Validación Preventiva**: Evita frustraciones al validar disponibilidad ANTES de confirmar
3. **Transparencia**: Usuario ve exactamente qué horas se agendarán
4. **Experiencia Mejorada**: Feedback visual inmediato en cada paso
5. **Integridad de Datos**: Las dos citas quedan correctamente identificadas como "(1/2)" y "(2/2)"
6. **Agrupación Visual**: Las citas dobles existentes ya se muestran agrupadas en un solo card morado

## 🔄 Visualización en Portal

Cuando el paciente revise sus citas, verá:

```
┌─────────────────────────────────────────────────┐
│ 🟣 CITA DOBLE                                   │
│                                                  │
│ Odontología                                     │
│ 🕐 10:40 AM y 11:00 AM                          │
│ Citas consecutivas                              │
│ #2501 y #2502                                   │
│                                                  │
│ ┌─────────────────────────────────────────────┐│
│ │ Primera cita (10:40 AM):                    ││
│ │ Consulta de Odontología - CITA DOBLE (1/2) ││
│ └─────────────────────────────────────────────┘│
│                                                  │
│ ┌─────────────────────────────────────────────┐│
│ │ Segunda cita (11:00 AM):                    ││
│ │ Consulta de Odontología - CITA DOBLE (2/2) ││
│ └─────────────────────────────────────────────┘│
│                                                  │
│ Dr. María González                              │
│ Sede Biosanar Centro                            │
│ 15 de enero de 2025                             │
│                                                  │
│ [ Cancelar Cita Doble ] [ Reagendar ]          │
└─────────────────────────────────────────────────┘
```

## ✅ Estado de Implementación

- ✅ Frontend: Estados y lógica de validación
- ✅ Frontend: Modal con checkbox y alertas visuales
- ✅ Frontend: Creación automática de dos citas
- ✅ Frontend: Manejo de errores y advertencias
- ✅ Frontend: Compilado y desplegado en producción
- ✅ Visual: Agrupación de citas dobles existentes en card único
- ✅ Visual: Ordenamiento cronológico de citas dobles

## 🚀 Despliegue

**Fecha**: 8 de enero de 2025  
**Build**: 42.05 segundos  
**Bundle**:
- `pages-IKWf5WKo.js`: 301.91 kB (incluye lógica de cita doble)
- `components-DLNRCjRR.js`: 688.39 kB
- `vendor-ZNp9VfOY.js`: 2,839.26 kB

**Servidor**: Nginx reiniciado exitosamente  
**Estado**: ✅ Desplegado en producción

## 📝 Notas Importantes

1. **Solo Odontología**: El checkbox SOLO aparece para Odontología, otras especialidades no se ven afectadas
2. **Intervalos de 20 minutos**: El sistema asume intervalos de 20 minutos entre citas
3. **Validación Obligatoria**: No se puede confirmar cita doble sin horarios consecutivos disponibles
4. **Cancelación Inteligente**: Al cancelar una cita doble, se cancelan ambas citas automáticamente
5. **Identificadores Claros**: Ambas citas incluyen "(1/2)" y "(2/2)" en el motivo para fácil identificación

## 🔮 Mejoras Futuras (Opcionales)

1. **Backend API**: Crear endpoint dedicado `/schedule-double-appointment` que maneje la lógica de forma atómica
2. **Transacciones**: Implementar rollback si la segunda cita falla (requiere cambios en backend)
3. **Configuración Dinámica**: Permitir configurar duración de citas desde admin panel
4. **Sugerencias Inteligentes**: Si no hay consecutivos, sugerir fechas alternativas con disponibilidad
5. **Prioridad**: Dar prioridad a citas dobles en el sistema de cupos

## 📞 Soporte

Para cualquier problema con el sistema de citas dobles:
- Verificar que la especialidad sea exactamente "Odontología" (case-insensitive)
- Revisar que hay al menos 2 horarios consecutivos disponibles en la agenda
- Confirmar que el intervalo entre citas sea de 20 minutos
- Verificar logs del navegador para errores de red o validación
