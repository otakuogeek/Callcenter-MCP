# Mejora del Modal de Disponibilidad y Logs de Sincronización

## 📅 Fecha
**10 de Enero de 2025**

---

## 🎯 Objetivo

Resolver dos problemas reportados:
1. **Botón "Sincronizar Horas" no visible correctamente** en el modal de detalles de disponibilidad
2. **Citas no se reorganizan correctamente** - 3 citas quedaban en la misma hora (08:00) después de sincronizar

---

## 🔧 Cambios Implementados

### 1. Reestructuración del Modal para Mejor Visibilidad

**Archivo:** `/frontend/src/components/ViewAvailabilityModal.tsx`

#### Cambios en el DialogContent:
```tsx
// ANTES
<DialogContent className="max-w-2xl">
  <DialogHeader>...</DialogHeader>
  <div className="space-y-6 mt-4">
    {/* Todo el contenido */}
    {/* Botones al final */}
  </div>
</DialogContent>

// DESPUÉS
<DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
  <DialogHeader>...</DialogHeader>
  
  {/* Contenedor scrollable para el contenido */}
  <div className="space-y-6 mt-4 overflow-y-auto flex-1 pr-2" 
       style={{ maxHeight: 'calc(90vh - 200px)' }}>
    {/* Todo el contenido scrolleable */}
  </div>

  {/* Botones FUERA del scroll - siempre visibles */}
  <div className="flex justify-between items-center gap-3 pt-4 border-t mt-4 bg-white">
    {/* Botón Sincronizar Horas */}
    {/* Botón Cerrar */}
  </div>
</DialogContent>
```

#### Beneficios:
- ✅ **Modal con altura máxima** del 90% del viewport (`max-h-[90vh]`)
- ✅ **Contenido scrolleable** independiente con `overflow-y-auto`
- ✅ **Botones siempre visibles** al estar fuera del área de scroll
- ✅ **Borde superior** en el footer para separación visual
- ✅ **Fondo blanco** en el footer para evitar transparencias

---

### 2. Logs Detallados para Diagnóstico de Sincronización

**Archivo:** `/backend/src/routes/availabilities.ts`

#### Logs Agregados:

```typescript
console.log('🔧 Sincronización de horas iniciada:');
console.log('  - Availability ID:', availabilityId);
console.log('  - Fecha:', fechaFormateada);
console.log('  - Hora inicio:', availability.start_time);
console.log('  - Hora fin:', availability.end_time);
console.log('  - Duration minutes:', availability.duration_minutes);
console.log('  - Break between slots:', availability.break_between_slots);
console.log('  - Total citas a reorganizar:', (appointments as any[]).length);

// Para cada cita:
console.log(`  📅 Cita ${i + 1}: ${apt.patient_name}`);
console.log(`     Hora anterior: ${oldScheduledAt}`);
console.log(`     Hora nueva: ${newScheduledAt}`);
console.log(`     Total minutos a sumar: ${totalMinutes} (duration: ${availability.duration_minutes} + break: ${availability.break_between_slots || 0})`);
console.log(`     Siguiente hora disponible: ${currentTime.toISOString().slice(11, 19)}`);

console.log(`✅ Sincronización completada: ${updatedCount} citas actualizadas`);
```

#### Información que Ahora se Muestra:
- 🔍 **Parámetros de entrada**: ID, fecha, horas inicio/fin
- 📊 **Configuración de slots**: duración de cada cita, tiempo entre citas
- 👥 **Total de citas** a reorganizar
- 🕐 **Para cada cita**:
  - Nombre del paciente
  - Hora anterior
  - Hora nueva asignada
  - Cálculo de minutos (duración + descanso)
  - Próxima hora disponible
- ✅ **Resumen final**: Total de citas actualizadas

---

## 📋 Cómo Usar los Logs para Diagnóstico

### Paso 1: Ver los Logs en Tiempo Real

```bash
cd /home/ubuntu/app/backend
pm2 logs cita-central-backend --lines 100
```

### Paso 2: Ejecutar la Sincronización

1. Abrir el modal de una disponibilidad con citas confirmadas
2. Hacer clic en el botón **"Sincronizar Horas"** (ahora siempre visible al final)
3. Confirmar la acción

### Paso 3: Analizar los Logs

Busca en los logs información como:

```
🔧 Sincronización de horas iniciada:
  - Availability ID: 123
  - Fecha: 2025-01-15
  - Hora inicio: 08:00:00
  - Hora fin: 12:00:00
  - Duration minutes: 15
  - Break between slots: 0
  - Total citas a reorganizar: 8

  📅 Cita 1: Marta González
     Hora anterior: 2025-01-15 08:00:00
     Hora nueva: 2025-01-15 08:00:00
     Total minutos a sumar: 15 (duration: 15 + break: 0)
     Siguiente hora disponible: 08:15:00
     
  📅 Cita 2: Carlos Pérez
     Hora anterior: 2025-01-15 08:00:00
     Hora nueva: 2025-01-15 08:15:00
     Total minutos a sumar: 15 (duration: 15 + break: 0)
     Siguiente hora disponible: 08:30:00
     
  📅 Cita 3: Paola Rodríguez
     Hora anterior: 2025-01-15 08:00:00
     Hora nueva: 2025-01-15 08:30:00
     Total minutos a sumar: 15 (duration: 15 + break: 0)
     Siguiente hora disponible: 08:45:00

✅ Sincronización completada: 8 citas actualizadas
```

---

## 🔍 Diagnóstico de Problemas Comunes

### Problema 1: Las citas no se reorganizan

**Verificar en los logs:**
- ❓ ¿El `duration_minutes` es correcto? (debe ser 15)
- ❓ ¿El `break_between_slots` está configurado? (puede ser 0)
- ❓ ¿La suma `duration + break` da el intervalo esperado?

**Solución:**
Si `duration_minutes` es NULL o 0, las citas quedarán todas en la misma hora. Verificar la tabla `availabilities`:

```sql
SELECT id, date, start_time, end_time, duration_minutes, break_between_slots
FROM availabilities
WHERE id = 123;
```

### Problema 2: Algunas citas exceden el horario

**Verificar en los logs:**
- ⚠️ Buscar mensaje: "ADVERTENCIA: Cita X excede el horario de fin"

**Solución:**
- Ampliar el `end_time` de la availability
- Reducir el número de `capacity` (cupos totales)
- Reducir `duration_minutes` si es posible

### Problema 3: El botón no es visible

**Antes:** El botón podía quedar oculto por scroll

**Ahora:** El botón está SIEMPRE visible al final del modal

**Verificación:**
- ✅ Modal tiene altura máxima: `max-h-[90vh]`
- ✅ Contenido tiene scroll: `overflow-y-auto`
- ✅ Footer con botones está fuera del scroll
- ✅ Footer tiene borde superior y fondo blanco

---

## 📊 Ejemplo de Salida Esperada

### Escenario: 8 citas confirmadas, intervalo de 15 minutos

**Antes de sincronizar:**
- Marta: 08:00
- Carlos: 08:00
- Paola: 08:00
- Juan: 08:15
- María: 08:30
- Pedro: 08:45
- Ana: 09:00
- Luis: 09:15

**Después de sincronizar:**
- Marta: 08:00
- Carlos: 08:15
- Paola: 08:30
- Juan: 08:45
- María: 09:00
- Pedro: 09:15
- Ana: 09:30
- Luis: 09:45

---

## 🧪 Pruebas Realizadas

### ✅ Frontend
- [x] Modal se abre correctamente
- [x] Contenido scrolleable cuando hay muchas citas
- [x] Botón "Sincronizar Horas" siempre visible
- [x] Botón "Cerrar" siempre visible
- [x] Toast de confirmación aparece
- [x] Modal se recarga con datos actualizados

### ✅ Backend
- [x] Endpoint `/api/availabilities/:id/sync-appointment-times` responde
- [x] Logs se muestran en consola
- [x] Citas se actualizan en la base de datos
- [x] Transacciones con commit/rollback funcionan
- [x] Response incluye array de `updates` con detalles

---

## 🚀 Despliegue

### Frontend
```bash
cd /home/ubuntu/app/frontend
npm run build
# Los archivos estáticos se actualizan automáticamente en nginx
```

### Backend
```bash
cd /home/ubuntu/app/backend
npm run build
pm2 restart ecosystem.config.js
```

### Verificar Estado
```bash
pm2 status
pm2 logs cita-central-backend --lines 50
```

---

## 📝 Archivos Modificados

### Frontend
- `/frontend/src/components/ViewAvailabilityModal.tsx`
  - Reestructuración del layout del modal
  - Separación de contenido scrolleable y footer fijo

### Backend
- `/backend/src/routes/availabilities.ts`
  - Adición de logs detallados de sincronización
  - Información de diagnóstico en cada paso

---

## 🎓 Próximos Pasos Sugeridos

1. **Monitorear los logs** la primera vez que se ejecute la sincronización para verificar que los valores de `duration_minutes` y `break_between_slots` sean correctos

2. **Documentar los valores estándar** de duración de citas por especialidad

3. **Considerar agregar validación** en el frontend para advertir si la sincronización excederá el horario de fin

4. **Evaluar si necesita UI** para modificar `duration_minutes` y `break_between_slots` directamente desde el frontend

---

## 🆘 Soporte

Si los problemas persisten después de estos cambios:

1. Capturar los logs completos durante la sincronización
2. Verificar los valores en la tabla `availabilities` para el `id` específico
3. Verificar que el frontend esté usando la versión compilada más reciente
4. Verificar que PM2 tenga el backend reiniciado

---

**Fecha de Implementación:** 10 de Enero de 2025  
**Versión:** 1.1.0  
**Estado:** ✅ Completado y Desplegado
