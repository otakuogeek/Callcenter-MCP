# 📋 Resumen: Función de Reasignación de Citas

## ✅ Funcionalidad Implementada

### Sistema de Reasignación de Citas entre Agendas

Permite **mover pacientes de una agenda a otra** de la misma especialidad que tenga cupos disponibles.

---

## 🎯 Características Principales

### 1. Búsqueda Inteligente de Agendas
- 🔍 Filtra por **misma especialidad**
- ✅ Solo agendas **activas**
- 📅 Solo agendas **futuras**
- 👥 Solo con **cupos disponibles**
- 📊 Ordenadas por fecha

### 2. Modal Visual de Selección
- 📋 Lista completa de agendas disponibles
- 👨‍⚕️ Muestra: Doctor, Sede, Fecha, Horario
- 🎨 Badge de cupos con colores:
  - 🟢 Verde: +5 cupos
  - 🟡 Amarillo: 3-5 cupos
  - 🟠 Naranja: 1-2 cupos
- ✅ Selección visual clara
- ⚠️ Confirmación antes de reasignar

### 3. Actualización Automática
- ⚡ Calcula primer slot disponible
- 🔄 Actualiza cupos de ambas agendas
- 📝 Actualiza datos de la cita:
  - Nuevo doctor
  - Nueva sede
  - Nueva fecha/hora
  - Nueva especialidad (si aplica)

---

## 🔧 Componentes Creados

### Backend
1. **GET** `/api/availabilities/:id/available-for-reassignment`
   - Retorna agendas disponibles de la misma especialidad

2. **POST** `/api/availabilities/reassign-appointment`
   - Reasigna una cita a otra agenda
   - Actualiza cupos automáticamente
   - Transacción atómica (todo o nada)

### Frontend
1. **`ReassignAppointmentModal.tsx`** (NUEVO)
   - Modal completo de reasignación
   - Lista de agendas disponibles
   - Selección y confirmación

2. **Botón "Reasignar"** en `ViewAvailabilityModal`
   - Junto a cada paciente confirmado
   - Abre modal de reasignación
   - Responsive (ícono en móvil)

---

## 📋 Cómo Usar

### Paso 1: Abrir Detalles de Agenda
```
📅 Ver detalles de cualquier agenda
👥 Aparece lista de pacientes confirmados
```

### Paso 2: Hacer Clic en "Reasignar"
```
[Confirmada] [Reasignar] ← Botón azul con flecha
```

### Paso 3: Seleccionar Agenda Destino
```
Se abre modal mostrando agendas disponibles:

┌─────────────────────────────────────┐
│ Dr. Ana Teresa Escobar              │
│ 📍 Sede biosanár san gil           │
│ 📅 Mar, 22 oct 2025  🕐 09:00     │
│                    [11 cupos] 🟢   │
└─────────────────────────────────────┘

→ Clic para seleccionar
```

### Paso 4: Confirmar
```
[Reasignar Cita] ← Botón se habilita

Aparece confirmación:
"¿Está seguro de reasignar a Pedro Alonso Rem?"
```

### Paso 5: Resultado
```
✅ "Pedro Alonso Rem ha sido reasignado/a exitosamente"

Cambios automáticos:
- Agenda original: Libera 1 cupo
- Agenda destino: Ocupa 1 cupo
- Cita actualizada con nuevos datos
```

---

## 🎨 Interfaz

### Botón "Reasignar"
```
Desktop: [→ Reasignar]
Móvil:   [→]
Color:   Azul outline
```

### Modal de Agendas
```
┌──────────────────────────────────────────────┐
│ 🔄 Reasignar Cita                            │
│ Seleccione agenda para Pedro Alonso Rem      │
├──────────────────────────────────────────────┤
│ Especialidad: Medicina General               │
├──────────────────────────────────────────────┤
│                                              │
│ [Lista de agendas disponibles - scrolleable] │
│                                              │
├──────────────────────────────────────────────┤
│          [Cancelar]  [Reasignar Cita]       │
└──────────────────────────────────────────────┘
```

---

## 🔄 Lógica de Asignación de Slot

El sistema calcula automáticamente el **primer slot libre**:

```
Agenda destino: 09:00 - 12:00 (15 min por cita)

Ocupados:
✓ 09:00 (Paciente A)
✓ 09:15 (Paciente B)
○ 09:30 ← AQUÍ SE ASIGNA
○ 09:45
✓ 10:00 (Paciente C)
```

---

## 🛡️ Validaciones

### ✅ Qué Acepta
- Citas confirmadas o pendientes
- Agendas activas
- Agendas con cupos disponibles
- Misma especialidad

### ❌ Qué Rechaza
- Citas canceladas o completadas
- Agendas inactivas
- Agendas sin cupos
- Agendas de diferente especialidad

---

## 🧪 Casos de Uso

### Caso 1: Agenda Completa
```
Problema: Agenda 100% ocupada
Solución: Reasignar 1-2 pacientes flexibles
Resultado: Libera cupos para urgencias
```

### Caso 2: Cambio de Sede
```
Problema: Paciente pide otra sede
Solución: Reasignar a agenda de sede preferida
Resultado: Mejor experiencia para el paciente
```

### Caso 3: Optimización
```
Problema: Varias agendas con pocos pacientes
Solución: Consolidar en menos agendas
Resultado: Mejor uso de recursos
```

---

## 🚀 Despliegue

✅ **Backend compilado** (PM2 restart #53)  
✅ **Frontend compilado** (15.41s)  
✅ **Endpoints funcionando**  
✅ **Modal operativo**  

---

## 🆘 Si Aparece "No hay agendas disponibles"

**Significa:**
- No hay agendas de esa especialidad con cupos
- Todas están completas
- No hay agendas futuras activas

**Solución:**
1. Crear nuevas agendas de esa especialidad
2. Verificar que estén marcadas como "Activa"
3. Verificar fechas futuras

---

## 💡 Próximos Pasos

1. **Refrescar página** (Ctrl + Shift + R)
2. **Abrir agenda** con pacientes confirmados
3. **Probar botón "Reasignar"** de cualquier paciente
4. **Seleccionar agenda destino** en el modal
5. **Confirmar reasignación**
6. **Verificar** que los cupos se actualizaron

---

**Documentación completa:** `/docs/FUNCION_REASIGNACION_CITAS.md`
