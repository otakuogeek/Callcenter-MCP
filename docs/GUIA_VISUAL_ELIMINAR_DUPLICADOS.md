# 📸 Guía Visual: Eliminar Citas Duplicadas

## 🎯 Objetivo
Esta guía muestra paso a paso cómo eliminar citas duplicadas en el sistema Biosanarcall.

---

## 🔍 PASO 1: Identificar Duplicados

### ¿Cómo se ve un paciente duplicado?

```
┌────────────────────────────────────────────────────────────┐
│ Pacientes en esta agenda                                   │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  🟡 FONDO AMARILLO = PACIENTE DUPLICADO                    │
│                                                             │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Marta Pimiento de Serra ⚠️ DUPLICADO           09:15   │ │
│ │ 37886617 • 3124651911                        Confirmada│ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Ricardo Alonso Cardoso Puerto ⚠️ DUPLICADO     15:00   │ │
│ │ 110099591 • 3142628600                       Confirmada│ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ⬜ FONDO BLANCO = PACIENTE SIN DUPLICADOS                  │
│                                                             │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Rodrigo Álex Forigua Borda                     11:30   │ │
│ │ 80724968 • 3188572422                        Confirmada│ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### ✅ Señales de Duplicado:
1. **Fondo amarillo claro** en toda la fila
2. **Borde amarillo más intenso**
3. **Etiqueta "⚠️ DUPLICADO"** junto al nombre
4. Sección expandible con **"Otras citas confirmadas"**

---

## 📋 PASO 2: Revisar Otras Citas del Paciente

### Click en el paciente duplicado para ver detalles:

```
┌────────────────────────────────────────────────────────────┐
│ Marta Pimiento de Serra ⚠️ DUPLICADO           09:15      │
│ 37886617 • 3124651911                        Confirmada   │
│                                                             │
│ ╔═══════════════════════════════════════════════════════╗ │
│ ║ 📋 Otras citas confirmadas:                           ║ │
│ ║                                                        ║ │
│ ║ ┌──────────────────────────────────────────────────┐  ║ │
│ ║ │ • Medicina General - 23 de oct a las 08:00       │  ║ │
│ ║ │   📍 Sede biosanarcall san gil                   │  ║ │
│ ║ │                                      [🗑️ Eliminar] │  ║ │
│ ║ └──────────────────────────────────────────────────┘  ║ │
│ ║                                                        ║ │
│ ║ ┌──────────────────────────────────────────────────┐  ║ │
│ ║ │ • Medicina General - 20 de oct a las 20:30       │  ║ │
│ ║ │   📍 Sede biosanarcall san gil                   │  ║ │
│ ║ │                                      [🗑️ Eliminar] │  ║ │
│ ║ └──────────────────────────────────────────────────┘  ║ │
│ ╚═══════════════════════════════════════════════════════╝ │
└────────────────────────────────────────────────────────────┘
```

### ℹ️ Información Mostrada de Cada Cita:
- **Especialidad**: Medicina General, Cardiología, etc.
- **Fecha**: Formato legible (23 de oct)
- **Hora**: Formato 24 horas (08:00, 20:30)
- **Sede**: Ubicación completa
- **Botón Eliminar**: Rojo con ícono 🗑️

---

## 🗑️ PASO 3: Eliminar Cita Duplicada

### 3.1 - Click en el Botón "Eliminar"

```
┌────────────────────────────────────────────────────────────┐
│ • Medicina General - 23 de oct a las 08:00                 │
│   📍 Sede biosanarcall san gil                             │
│                                                             │
│   [🗑️ Eliminar] ← HACER CLICK AQUÍ                        │
│    ▲                                                        │
│    │                                                        │
│   Botón ROJO con ícono de basura                          │
└────────────────────────────────────────────────────────────┘
```

### 3.2 - Confirmar la Eliminación

Aparece un diálogo del navegador:

```
┌───────────────────────────────────────────────────┐
│                                                   │
│  ⚠️  Esta página dice:                            │
│                                                   │
│  ¿Está seguro de que desea eliminar la cita de   │
│  Marta Pimiento de Serra?                         │
│                                                   │
│                                                   │
│              [ Cancelar ]    [ Aceptar ]          │
│                                   ▲               │
│                                   │               │
│                            HACER CLICK AQUÍ       │
└───────────────────────────────────────────────────┘
```

**⚠️ IMPORTANTE**: Lee el nombre completo del paciente para confirmar que es la cita correcta.

### 3.3 - Proceso de Eliminación

El botón cambia durante el proceso:

```
ANTES:
┌──────────────────┐
│ 🗑️ Eliminar      │  ← Botón normal (rojo)
└──────────────────┘

DURANTE:
┌──────────────────┐
│     ...          │  ← Botón procesando (gris)
└──────────────────┘

DESPUÉS:
(El botón desaparece porque la cita fue eliminada)
```

---

## ✅ PASO 4: Verificar el Resultado

### 4.1 - Notificación de Éxito

Aparece un mensaje verde en la esquina:

```
┌────────────────────────────────────────┐
│ ✅ Cita eliminada                      │
│                                        │
│ La cita de Marta Pimiento de Serra    │
│ ha sido cancelada exitosamente.       │
└────────────────────────────────────────┘
```

### 4.2 - Lista Actualizada

La lista se actualiza automáticamente:

```
ANTES (2 citas):
┌────────────────────────────────────────────────────────────┐
│ Otras citas confirmadas:                                   │
│ • Medicina General - 23 de oct a las 08:00 [Eliminar]      │
│ • Medicina General - 20 de oct a las 20:30 [Eliminar]      │
└────────────────────────────────────────────────────────────┘

DESPUÉS (1 cita):
┌────────────────────────────────────────────────────────────┐
│ Otras citas confirmadas:                                   │
│ • Medicina General - 20 de oct a las 20:30 [Eliminar]      │
└────────────────────────────────────────────────────────────┘
```

### 4.3 - Ya No Aparece Como Duplicado

Si era la única cita duplicada, el paciente ya no tiene fondo amarillo:

```
ANTES:
┌────────────────────────────────────────────────────────────┐
│ Marta Pimiento de Serra ⚠️ DUPLICADO           09:15      │
│ 37886617 • 3124651911                        Confirmada   │
└────────────────────────────────────────────────────────────┘

DESPUÉS:
┌────────────────────────────────────────────────────────────┐
│ Marta Pimiento de Serra                        09:15      │
│ 37886617 • 3124651911                        Confirmada   │
└────────────────────────────────────────────────────────────┘
```

---

## ❌ PASO 5: Manejo de Errores

### Si algo sale mal, verás un mensaje rojo:

```
┌────────────────────────────────────────┐
│ ❌ Error al eliminar                   │
│                                        │
│ No se pudo cancelar la cita.          │
│ Por favor, intente nuevamente.        │
└────────────────────────────────────────┘
```

### ¿Qué hacer si hay un error?

1. **Verificar conexión a internet**
2. **Intentar nuevamente** (click en "Eliminar")
3. **Refrescar la página** (F5)
4. **Contactar soporte** si persiste

---

## 📝 Ejemplo Completo: Caso Real

### Situación Inicial
**Paciente**: Ricardo Alonso Cardoso Puerto  
**Problema**: Agendado 2 veces en Medicina General el mismo día

```
┌────────────────────────────────────────────────────────────┐
│ Ricardo Alonso Cardoso Puerto ⚠️ DUPLICADO     15:00      │
│ 110099591 • 3142628600                       Confirmada   │
│                                                             │
│ Otras citas confirmadas:                                   │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ • Medicina General - 21 de oct a las 14:30           │  │
│ │   📍 Sede biosanarcall san gil          [🗑️ Eliminar] │  │
│ └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Acción
1. ✅ Identifico que la cita de las 14:30 es la duplicada
2. ✅ Click en "Eliminar" de esa cita
3. ✅ Confirmo en el diálogo
4. ✅ Espero 2 segundos

### Resultado
```
┌────────────────────────────────────────────────────────────┐
│ Ricardo Alonso Cardoso Puerto                  15:00      │
│ 110099591 • 3142628600                       Confirmada   │
│                                                             │
│ (Sin otras citas confirmadas - ya no hay duplicados)      │
└────────────────────────────────────────────────────────────┘
```

✅ **Problema resuelto**: Solo queda 1 cita (la correcta)

---

## 🎓 Tips y Mejores Prácticas

### ✅ DO's (Hacer)

1. **Verificar Siempre**
   - Lee el nombre del paciente en la confirmación
   - Verifica que es la cita correcta antes de eliminar

2. **Revisar Información**
   - Mira la especialidad
   - Confirma la fecha y hora
   - Verifica la sede

3. **Esperar Confirmación**
   - No cierres el modal hasta ver el toast verde
   - Verifica que la lista se actualizó

4. **Documentar**
   - Si eliminas muchas citas, lleva un registro
   - Útil para reportes posteriores

### ❌ DON'Ts (Evitar)

1. **No Eliminar sin Verificar**
   - Siempre lee la información completa
   - No asumas cuál es la cita duplicada

2. **No Hacer Clicks Múltiples**
   - El sistema previene esto, pero evítalo
   - Espera a que termine el proceso

3. **No Ignorar Errores**
   - Si ves mensaje rojo, reporta
   - No dejes el problema sin resolver

4. **No Cerrar sin Verificar**
   - Espera a ver el toast de confirmación
   - Verifica que el duplicado desapareció

---

## ⚡ Atajos y Trucos

### Para Ser Más Eficiente:

1. **Orden de Revisión**
   - Revisa todos los duplicados de arriba a abajo
   - Elimina los más antiguos primero (usualmente)

2. **Verificación Rápida**
   - Si las citas son el mismo día → Probablemente error
   - Si son días diferentes → Verificar con paciente

3. **Batching**
   - Si hay muchos duplicados, trabaja por bloques
   - 5-10 pacientes a la vez

4. **Comunicación**
   - Si eliminas una cita, considera llamar al paciente
   - Confirma que sabe cuál cita quedó activa

---

## 📊 Checklist de Eliminación

Usa esta lista cada vez que elimines una cita:

```
□ 1. Identificar paciente duplicado (fondo amarillo)
□ 2. Abrir "Otras citas confirmadas"
□ 3. Leer información de cada cita
□ 4. Decidir cuál cita eliminar
□ 5. Click en "Eliminar"
□ 6. Leer nombre en confirmación
□ 7. Click en "Aceptar"
□ 8. Esperar toast verde
□ 9. Verificar que se actualizó la lista
□ 10. Cerrar modal o continuar con otros
```

---

## 🆘 Preguntas Frecuentes (FAQ)

### ❓ ¿Puedo deshacer una eliminación?
**R**: No directamente. Si eliminaste por error, contacta a soporte técnico. Ellos pueden revertir el cambio en la base de datos.

### ❓ ¿Qué pasa con el cupo?
**R**: Se libera automáticamente. Otro paciente puede agendar en ese horario.

### ❓ ¿El paciente recibe notificación?
**R**: Actualmente no. Debes llamar al paciente si es necesario.

### ❓ ¿Puedo ver un historial de citas eliminadas?
**R**: Actualmente no hay vista, pero está registrado en la base de datos.

### ❓ ¿Qué pasa si elimino la cita actual?
**R**: El botón solo aparece en "Otras citas". No puedes eliminar la cita que estás viendo.

### ❓ ¿Puedo eliminar múltiples citas a la vez?
**R**: No, debes eliminar una por una para evitar errores.

---

## 🎯 Ejercicios de Práctica

### Ejercicio 1: Duplicado Simple
**Escenario**: Paciente con 2 citas de Medicina General el mismo día  
**Tarea**: Identificar y eliminar la cita duplicada  
**Tiempo**: 1 minuto

### Ejercicio 2: Múltiples Especialidades
**Escenario**: Paciente con citas en 3 especialidades diferentes  
**Tarea**: Verificar si son duplicados o citas legítimas  
**Tiempo**: 2 minutos

### Ejercicio 3: Error de Eliminación
**Escenario**: Intentar eliminar y recibir error  
**Tarea**: Manejar el error y reportar  
**Tiempo**: 2 minutos

---

## ✅ Certificación

Una vez que domines este proceso, serás capaz de:

- ✅ Identificar duplicados rápidamente
- ✅ Revisar información de citas
- ✅ Eliminar citas con confianza
- ✅ Manejar errores apropiadamente
- ✅ Verificar resultados correctamente

**¡Felicidades!** Ahora eres experto en eliminar citas duplicadas. 🎉

---

**Guía Creada**: Octubre 20, 2025  
**Versión**: 1.0  
**Sistema**: Biosanarcall Medical System  
**Para**: Personal Administrativo
