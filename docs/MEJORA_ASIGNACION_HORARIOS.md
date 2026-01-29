# Mejora del Sistema de Asignación de Citas desde Cola de Espera

## Fecha
14 de Enero de 2025

## Objetivo
Mejorar el modal de asignación de citas desde la cola de espera en el panel administrativo (`/admin/queue`) para que muestre horarios específicos disponibles de manera similar al portal de usuarios (`/users`).

## Cambios Realizados

### 1. Frontend - AssignFromQueueModal.tsx

#### Nuevos Estados
Se agregaron estados para manejar la selección de horarios específicos:
```typescript
const [selectedTime, setSelectedTime] = useState<string>('');
const [showTimeSelector, setShowTimeSelector] = useState(false);
```

#### Nueva Función: handleSelectAgenda
Reemplaza la selección directa para evaluar si la agenda tiene horarios específicos:
```typescript
const handleSelectAgenda = (agendaId: number) => {
  setSelectedAgendaId(agendaId);
  const agenda = availableAgendas.find(a => a.id === agendaId);
  
  // Si la agenda tiene horarios específicos disponibles, mostrar selector
  if (agenda && agenda.available_time_slots && agenda.available_time_slots.length > 0) {
    setShowTimeSelector(true);
    setSelectedTime(''); // Resetear hora seleccionada
  } else {
    setShowTimeSelector(false);
    setSelectedTime(''); // No hay horarios específicos
  }
};
```

#### Validación de Horario Seleccionado
Se agregó validación para asegurar que se seleccione un horario si la agenda tiene slots específicos:
```typescript
// Validar que si hay horarios específicos, se haya seleccionado uno
if (selectedAgenda.available_time_slots && selectedAgenda.available_time_slots.length > 0 && !selectedTime) {
  toast({
    title: "Seleccione un horario",
    description: "Debe seleccionar un horario específico para esta agenda",
    variant: "destructive",
  });
  return;
}
```

#### Envío de Hora Específica al Backend
Se modificó el request para incluir el horario seleccionado:
```typescript
const requestData: any = {
  waiting_list_id: waitingListId,
  availability_id: selectedAgendaId,
  patient_id: patientId,
  reason: reason || 'Asignado desde cola de espera',
  priority_level: priority,
  cups_id: cupsId
};

// Agregar hora específica si fue seleccionada
if (selectedTime) {
  requestData.selected_time = selectedTime;
}

const response = await api.assignFromWaitingList(requestData);
```

#### Visualización de Horarios en las Agendas
Se agregó una vista previa de los horarios disponibles en cada tarjeta de agenda:
```typescript
{/* Horarios específicos disponibles */}
{agenda.available_time_slots && agenda.available_time_slots.length > 0 && (
  <div className="mt-3 pt-3 border-t border-gray-200">
    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
      <Clock className="w-3 h-3" />
      Horarios específicos disponibles:
    </p>
    <div className="flex flex-wrap gap-1">
      {agenda.available_time_slots.slice(0, 6).map((time, index) => (
        <span key={index} className="text-xs px-2 py-1 rounded-md bg-green-100 text-green-700 font-medium">
          {time}
        </span>
      ))}
      {agenda.available_time_slots.length > 6 && (
        <span className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600">
          +{agenda.available_time_slots.length - 6} más
        </span>
      )}
    </div>
  </div>
)}
```

#### Selector de Horarios Específicos
Se agregó un nuevo componente visual para seleccionar horarios específicos:
```typescript
{/* Selector de hora específica */}
{showTimeSelector && selectedAgenda && selectedAgenda.available_time_slots && selectedAgenda.available_time_slots.length > 0 && (
  <div className="border-t pt-4 mt-4 bg-gradient-to-br from-green-50 to-emerald-50 -mx-6 px-6 py-4">
    <div className="flex items-center gap-2 mb-3">
      <Clock className="w-5 h-5 text-green-600" />
      <h4 className="font-semibold text-gray-900">Seleccione la hora específica:</h4>
    </div>
    <p className="text-sm text-gray-600 mb-3">
      Fecha: {safeFormatDate(selectedAgenda.date, "d 'de' MMMM 'de' yyyy", { locale: es })} - Dr. {selectedAgenda.doctor_name}
    </p>
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-48 overflow-y-auto">
      {selectedAgenda.available_time_slots.map((time) => (
        <button
          key={time}
          type="button"
          className={`p-3 text-center rounded-lg border-2 transition-all duration-200 ${
            selectedTime === time
              ? 'border-green-500 bg-green-600 text-white shadow-lg'
              : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50 text-gray-700'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTime(time);
          }}
        >
          <div className="font-semibold text-sm">{time}</div>
          <div className="text-xs mt-1 opacity-80">
            {selectedTime === time ? '✓' : 'Disponible'}
          </div>
        </button>
      ))}
    </div>
  </div>
)}
```

#### Actualización del Botón de Asignación
El botón ahora muestra el horario seleccionado y se deshabilita hasta que se elija uno (si es necesario):
```typescript
<Button
  onClick={handleAssign}
  disabled={!selectedAgendaId || assigning || loading || (showTimeSelector && !selectedTime)}
  className="bg-green-600 hover:bg-green-700 text-white"
>
  {assigning ? (
    <>
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
      Asignando...
    </>
  ) : (
    <>
      <CheckCircle className="w-4 h-4 mr-2" />
      {selectedTime ? `Asignar a las ${selectedTime}` : 'Asignar Cita'}
    </>
  )}
</Button>
```

#### Mensaje de Confirmación Mejorado
El mensaje de confirmación ahora incluye la hora específica si fue seleccionada:
```typescript
const timeInfo = selectedTime ? `\n• Hora específica: ${selectedTime}` : '';
const confirmMessage = `¿Está seguro de asignar a ${patientName} desde la cola de espera?\n\nAgenda seleccionada:\n• Doctor: ${selectedAgenda.doctor_name}\n• Sede: ${selectedAgenda.location_name}\n• Fecha: ${format(new Date(selectedAgenda.date + 'T12:00:00'), "d 'de' MMMM 'de' yyyy", { locale: es })}${timeInfo}\n• Horario: ${selectedAgenda.start_time} - ${selectedAgenda.end_time}\n\nEsto eliminará al paciente de la cola de espera y creará una cita confirmada.`;
```

#### Toast Mejorado
El mensaje de éxito ahora muestra la hora específica asignada:
```typescript
const timeAssigned = selectedTime || selectedAgenda.start_time;
toast({
  title: "✅ Asignación exitosa",
  description: `${patientName} ha sido asignado/a para el ${format(new Date(selectedAgenda.date + 'T12:00:00'), "d 'de' MMMM", { locale: es })} a las ${timeAssigned} con Dr. ${selectedAgenda.doctor_name}`,
  variant: "default",
});
```

### 2. Backend - Sistema Ya Existente

El backend ya estaba preparado para manejar horarios específicos:

#### Endpoint `/api/availabilities/public`
- Ya calcula y retorna `available_time_slots` para cada agenda
- Usa la función `calculateAvailableTimeSlots()` que:
  - Genera slots basados en `duration_minutes` (por defecto 15 min)
  - Consulta citas ya agendadas para filtrar horarios ocupados
  - Retorna array con horarios disponibles en formato HH:mm

#### Función calculateAvailableTimeSlots
```typescript
async function calculateAvailableTimeSlots(availability: any): Promise<string[]> {
  // Genera todos los slots posibles en el rango de horario
  const allSlots: string[] = [];
  for (let time = startMinutes; time + duration <= endMinutes; time += duration) {
    allSlots.push(formatMinutesToTime(time));
  }
  
  // Filtra los slots ya ocupados
  const availableSlots = allSlots.filter(slot => !bookedTimes.has(slot));
  return availableSlots;
}
```

#### Endpoint `/api/appointments/assign-from-waiting-list`
- Ya acepta el parámetro `selected_time` (opcional)
- Si se proporciona `selected_time`, lo usa para programar la cita
- Si no, usa el `start_time` de la agenda

## Resultado

### Antes
- El modal solo mostraba agendas con rango horario general (ej: "08:00 - 12:00")
- No se podía seleccionar una hora específica
- El administrador tenía que aceptar la primera hora disponible automáticamente

### Después
- El modal muestra agendas con un preview de los primeros 6 horarios disponibles
- Al seleccionar una agenda con slots disponibles, se despliega un selector visual
- El selector muestra TODOS los horarios disponibles en formato de cuadrícula (4-8 columnas según pantalla)
- Cada horario es un botón seleccionable con:
  - Hora en formato HH:mm
  - Etiqueta "Disponible" o "✓" si está seleccionado
  - Estilo visual distintivo cuando está seleccionado (verde con sombra)
- El botón de asignación muestra "Asignar a las HH:mm" cuando se selecciona un horario
- El mensaje de confirmación incluye la hora específica seleccionada
- El toast de éxito confirma la hora exacta de la cita asignada

## Experiencia de Usuario

1. **Administrador abre el modal de asignación** desde la cola de espera
2. **Ve las agendas disponibles** con un preview de horarios (muestra hasta 6 horarios + contador de más)
3. **Selecciona una agenda** haciendo clic en la tarjeta
4. **Se despliega el selector de horarios** si la agenda tiene slots específicos disponibles
5. **Selecciona un horario específico** haciendo clic en el botón del horario deseado
6. **El botón de asignación se actualiza** mostrando "Asignar a las HH:mm"
7. **Confirma la asignación** y recibe feedback visual con la hora exacta

## Ventajas

### Precisión
- Asignación exacta del horario, evitando conflictos
- Visibilidad completa de todos los horarios disponibles

### Eficiencia
- Preview de horarios en las agendas ahorra clics
- Selector de horarios permite elegir el mejor momento sin tener que navegar entre agendas

### Consistencia
- Experiencia similar entre portal de usuarios y panel administrativo
- Mismo flujo de selección de horarios en ambos contextos

### Control
- Administrador tiene control total sobre la hora específica
- Puede elegir horarios estratégicos según prioridades o preferencias del paciente

## Compilación y Despliegue

```bash
cd /home/ubuntu/app/frontend
npm run build
# ✓ built in 57.31s

sudo systemctl reload nginx
```

## Archivos Modificados

1. `/home/ubuntu/app/frontend/src/components/AssignFromQueueModal.tsx` - Component principal con mejoras
2. `/home/ubuntu/app/docs/MEJORA_ASIGNACION_HORARIOS.md` - Esta documentación

## Notas Técnicas

- El backend ya tenía soporte para `available_time_slots` desde antes
- Solo fue necesario modificar el frontend para aprovechar esta funcionalidad
- El sistema maneja casos donde no hay horarios específicos (agendas antiguas o sin configurar)
- La validación asegura que se seleccione un horario si está disponible
- Los cambios son retrocompatibles con agendas que no tengan slots específicos

## Testing Recomendado

1. ✅ Verificar que se muestren los horarios disponibles en las tarjetas de agenda
2. ✅ Comprobar que el selector se despliegue al seleccionar una agenda con slots
3. ✅ Validar que el botón se deshabilite hasta seleccionar un horario
4. ✅ Confirmar que el mensaje de asignación muestre la hora correcta
5. ✅ Verificar que la cita se cree con la hora seleccionada en la base de datos
6. ✅ Probar con agendas sin horarios específicos para verificar retrocompatibilidad

## Estado
✅ **COMPLETADO Y DESPLEGADO**

El sistema está activo en producción en https://biosanarcall.site/admin/queue
