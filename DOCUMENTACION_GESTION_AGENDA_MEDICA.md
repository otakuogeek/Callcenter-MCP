# Gestión de Agenda Médica - Documentación Completa

## URL del Sistema
**https://biosanarcall.site/admin/appointments**

## Descripción General

El módulo de **Gestión de Agenda Médica** es el corazón del sistema de administración de citas de Fundación Biosanar IPS. Este módulo permite gestionar de manera integral todas las agendas médicas, disponibilidades de doctores, programación de citas y la distribución eficiente de cupos entre pacientes.

## Características Principales

### 1. **Tres Modos de Visualización**

El sistema ofrece tres vistas diferentes para gestionar las agendas médicas:

#### 📅 Modo Calendario (Vista Principal)
- **Navegación por fechas**: Calendario interactivo para seleccionar fechas específicas
- **Resumen visual**: Indicadores de disponibilidad por día del mes
- **Tarjetas de navegación**: Vista rápida de días con actividad
- **Lista de agendas del día**: Visualización detallada de todas las agendas programadas

#### 📊 Modo Distribución
- **Distribución automática de cupos**: Visualización de cómo se distribuyen los cupos entre fechas
- **Gestión de preasignación**: Control de cupos bloqueados para pacientes específicos
- **Calendario de distribución**: Vista especializada para planificar la distribución de recursos

#### 📈 Modo Analytics
- **Estadísticas de citas**: Métricas detalladas sobre ocupación y rendimiento
- **Análisis de tendencias**: Identificación de patrones en el uso de agendas
- **Reportes visuales**: Gráficas y tablas con datos clave del sistema

---

## Funcionalidades Detalladas

### 🔍 **Sistema de Búsqueda y Filtros Avanzados**

#### Barra de Búsqueda
- **Búsqueda en tiempo real** por:
  - Nombre del doctor
  - Especialidad médica
  - Ubicación/Sede
- **Indicador visual** cuando hay búsqueda activa
- **Botón de limpieza rápida** para resetear la búsqueda

#### Filtros Múltiples
Los filtros se pueden combinar para obtener resultados precisos:

1. **Filtro por Sede/Ubicación**
   - Selección de sede específica o "Todas"
   - Útil para administrar agendas por zona geográfica

2. **Filtro por Especialidad**
   - Lista completa de especialidades médicas
   - Incluye: Psicología, Medicina General, Odontología, Ecografía, etc.

3. **Filtro por Estado de Agenda**
   - **Activa**: Agendas disponibles para agendar citas
   - **Completa**: Agendas con todos los cupos ocupados
   - **Cancelada**: Agendas canceladas por razones administrativas

4. **Filtro por Fecha**
   - Calendario interactivo para seleccionar día específico
   - Muestra resumen de actividad por día

5. **Filtros Adicionales**
   - **Mostrar agendas pasadas**: Toggle para incluir/excluir fechas anteriores
   - **Mostrar todos los estados**: Toggle para incluir agendas canceladas/completas

#### Chips de Filtros Activos
- **Visualización clara**: Cada filtro activo se muestra como una etiqueta (chip)
- **Eliminación rápida**: Click en la X para remover un filtro específico
- **Botón "Limpiar Todo"**: Resetea todos los filtros con un solo clic

---

### ➕ **Creación de Agendas Médicas**

El sistema permite crear agendas de manera flexible y eficiente:

#### Botón "Crear Agenda"
Ubicado en la barra superior, abre un modal con el formulario completo de creación.

#### Datos Obligatorios de una Agenda:
1. **Sede/Ubicación**: Dónde se llevará a cabo la consulta
2. **Especialidad**: Tipo de servicio médico
3. **Doctor**: Profesional que atenderá
4. **Fecha(s)**: 
   - **Una sola fecha**: Agenda individual
   - **Múltiples fechas**: Crear varias agendas idénticas en diferentes días
5. **Horario**:
   - **Hora de inicio**: Formato 24h (ej: 08:00)
   - **Hora de fin**: Formato 24h (ej: 12:00)
6. **Capacidad**: Número de cupos disponibles
7. **Duración por cita**: Tiempo estimado de cada consulta (ej: 15, 30, 45 minutos)

#### Opciones Avanzadas:

**🎯 Preasignación Automática**
- **Activación**: Checkbox "Preasignar automáticamente"
- **Fecha de publicación**: Define cuándo se publican los cupos preasignados
- **Uso**: Reservar cupos para pacientes específicos antes de la publicación general

**📋 Distribución Automática**
- **Activación**: Checkbox "Distribuir automáticamente"
- **Rango de fechas**: Define período de distribución
- **Excluir fines de semana**: Opción para omitir sábados y domingos
- **Uso**: Crear agendas recurrentes automáticamente en múltiples fechas

**📝 Notas**
- Campo de texto libre para información adicional
- Ejemplos: Consultorio, requisitos especiales, etc.

#### Mensaje de Confirmación Mejorado
Al crear agenda(s), el sistema muestra:
```
✅ [X] agendas creadas exitosamente
📋 Doctor: [Nombre del doctor]
🏥 Especialidad: [Especialidad]
📍 Sede: [Nombre de la sede]
📅 Fecha(s): [Detalle de fechas]
⏰ Horario: [HH:MM - HH:MM]
```

---

### 🗓️ **Tarjetas de Navegación por Fecha (DateNavigationCards)**

Sistema visual de navegación rápida por fechas con actividad:

#### Características:
- **Vista de 7 días**: Muestra la semana actual o período seleccionado
- **Indicadores de actividad**:
  - **Verde**: Día con agendas activas y cupos disponibles
  - **Rojo**: Día sin actividad programada
  - **Gris**: Día pasado
- **Contador de agendas**: Muestra número de agendas por día
- **Click rápido**: Al hacer click en un día, filtra las agendas de esa fecha
- **Botón "Crear Agenda"**: Acceso directo para crear agenda en el día seleccionado

---

### 📋 **Lista de Agendas (AvailabilityList)**

Vista principal donde se muestran todas las agendas con información detallada:

#### Tarjeta de Agenda - Información Mostrada:

**Encabezado de la Tarjeta:**
- **Banner verde** (solo agendas activas con cupos): 
  - "¡Cupos Disponibles!"
  - Contador: "X de Y cupos libres"
  - Botón: "Registrar Cita" (acción rápida)
  - Botón: "Pausar/Reanudar" (control de disponibilidad)

**Información Principal:**
1. **Doctor**: 
   - Icono de estetoscopio
   - Nombre completo del profesional
2. **Especialidad**: Tipo de servicio médico
3. **Estado**: Badge con color codificado
   - 🟢 Verde: Activa
   - 🔵 Azul: Completa
   - 🔴 Rojo: Cancelada
4. **Fecha**: 
   - Formato legible: "lun, 1 de abr"
   - Icono de calendario
5. **Horario**:
   - **Hora en UTC-5 (Colombia)**: Mostrada en formato 12h con AM/PM
   - **Hora BD (UTC-0)**: Hora cruda de la base de datos sin conversión
   - Ejemplo: 
     - `3:00 a. m. - 3:15 a. m.` (Hora Colombia)
     - `Hora BD: 08:00 - 08:15 (UTC-0)` (Hora almacenada)

**Métricas de Ocupación:**
- **Ubicación**: Nombre de la sede
- **Ocupación**: 
  - Contador: "X/Y cupos"
  - Barra de progreso visual con colores:
    - 🟢 Verde: < 80% ocupado
    - 🟡 Amarillo: 80-99% ocupado
    - 🔴 Rojo: 100% ocupado
- **Porcentaje**: Cálculo automático de ocupación

#### Acciones Disponibles (Panel Expandido):

Al hacer click en una tarjeta, se expande mostrando botones de acción:

1. **👁️ Ver Citas**: Abre modal con todas las citas programadas
2. **🖨️ Imprimir Agenda**: Genera PDF con la agenda del doctor
3. **📊 Exportar Excel**: Descarga archivo Excel con datos de citas
4. **✏️ Editar Agenda**: Modifica parámetros de la agenda
5. **📅 Transferir a otra fecha**: Mueve la agenda a un día diferente
6. **⏸️ Pausar** (o ▶️ **Reanudar**): 
   - Pausar: Bloquea cupos temporalmente
   - Reanudar: Libera cupos bloqueados
7. **👤 Registrar Cita**: Abre modal de agendamiento rápido
8. **📋 Registrar Cita Manual**: Crea cita sin restricciones de agenda

---

### ⚡ **Sistema de Agendamiento Inteligente**

#### Botón "Nueva Cita" (SmartAppointmentModal)

Modal avanzado con múltiples funcionalidades:

**Paso 1: Búsqueda de Paciente**
- Búsqueda por:
  - Cédula
  - Nombre completo
  - Teléfono
- Autocompletado inteligente
- Carga automática de datos del paciente

**Paso 2: Selección de Servicio**
- Especialidad médica
- Código CUPS (si aplica)
- Verificación de autorización por EPS

**Paso 3: Búsqueda de Disponibilidad**
El sistema busca automáticamente:
- Agendas con cupos disponibles
- Compatibilidad con la EPS del paciente
- Fechas más cercanas disponibles
- Doctores con disponibilidad

**Paso 4: Asignación**
- **Opción A: Cita Inmediata**
  - Si hay cupos disponibles
  - Selección de fecha y hora específica
  - Confirmación instantánea
  
- **Opción B: Lista de Espera**
  - Si no hay cupos disponibles
  - El paciente queda en cola
  - Notificación automática cuando se libere cupo
  - Niveles de prioridad: Urgente, Alta, Normal, Baja

---

### 🖨️ **Impresión y Reportes**

#### Botón "Imprimir Agenda"
Genera PDF profesional con:
- **Encabezado**: Logo y datos de la IPS
- **Información del día**: Fecha completa
- **Agendas del día**: Agrupadas por doctor
- **Lista de pacientes**: 
  - Nombre completo
  - Documento de identidad
  - Hora de cita
  - EPS
  - Motivo de consulta
  - Edad del paciente
- **Información CUPS**: Código y descripción del procedimiento
- **Pie de página**: Información de contacto

#### Exportación a Excel
Cada agenda individual puede exportarse con:
- Datos del doctor y especialidad
- Información completa de cada paciente
- Horarios programados
- Estado de las citas
- Datos de contacto

---

### 🔄 **Sincronización de Horas**

#### Botón "Sincronizar Horas"
Funcionalidad avanzada que:
- **Actualiza horas de citas**: Ajusta scheduled_at de todas las citas
- **Recalcula horarios**: Basándose en la hora de inicio de la agenda
- **Distribución proporcional**: Asigna horas según capacidad y duración
- **Indicador visual**: Ícono girando durante el proceso
- **Confirmación**: Mensaje con número de citas actualizadas

#### Uso:
- Útil después de editar horarios de agenda
- Sincroniza citas con nuevos horarios
- Previene conflictos de horario

---

### ⏸️ **Sistema de Pausa de Agendas**

#### Funcionalidad:
Permite **bloquear temporalmente** una agenda sin cancelarla:

**Pausar Agenda:**
- ⏸️ Click en "Pausar"
- Bloquea X cupos disponibles
- Las citas existentes NO se cancelan
- Nuevas citas NO pueden agendarse
- Badge "⚠️ PAUSADA" visible en la tarjeta
- Botón "Registrar Cita" deshabilitado

**Reanudar Agenda:**
- ▶️ Click en "Reanudar"
- Libera X cupos bloqueados
- Cupos vuelven a estar disponibles
- Se pueden agendar nuevas citas

**Casos de Uso:**
- Emergencias del doctor
- Mantenimiento de equipos
- Ausencias temporales
- Restricciones por protocolo

---

### 🗑️ **Auto-cancelación de Agendas Vencidas**

#### Sistema Automático:
El sistema detecta agendas que **han vencido** (día posterior a su fecha asignada):

**Detección:**
- Se ejecuta al cargar la página
- Identifica agendas activas en fechas pasadas
- Compara fecha actual vs fecha de agenda

**Modal de Confirmación:**
- **Título**: "Cancelar agendas vencidas"
- **Lista**: Muestra agendas detectadas con:
  - Nombre del doctor
  - Horario
  - Sede
- **Opción**: "Cancelar también citas asociadas"
  - Si está activa: Cancela todas las citas de la agenda
  - Si está inactiva: Solo cancela la agenda

**Botones:**
- **"Omitir"**: Ignora las agendas vencidas (quedan en estado Activa)
- **"Cancelar ahora"**: Procesa la cancelación automática

**Registro:**
Muestra historial de auto-cancelaciones:
- Agenda cancelada
- Fecha y hora de cancelación
- Número de citas canceladas (si aplica)

#### Configuración:
Se puede configurar en ajustes del sistema:
- Auto-cancelación sin confirmación
- Cancelar citas por defecto (sí/no)

---

### 📊 **Visualización de Distribución de Cupos**

#### DistributionCalendar (Pestaña Distribución)

Vista especializada para gestionar la **distribución automática** de cupos:

**Características:**
- **Calendario mensual**: Vista completa del mes
- **Indicadores por día**:
  - Total de cupos distribuidos
  - Cupos disponibles vs ocupados
  - Coloración según disponibilidad
- **Gestión de preasignación**:
  - Cupos bloqueados para pacientes específicos
  - Fecha de publicación de cupos
  - Liberación automática en fecha programada

**Uso:**
- Planificar distribución a largo plazo
- Visualizar patrones de demanda
- Optimizar asignación de recursos

---

### 📈 **Analytics de Citas (AppointmentAnalytics)**

#### Métricas Disponibles:

**1. Estadísticas Generales:**
- Total de citas en período
- Citas confirmadas vs canceladas
- Tasa de ocupación promedio
- Cupos disponibles totales

**2. Análisis por Especialidad:**
- Citas por especialidad médica
- Especialidades más demandadas
- Tendencias de solicitud

**3. Análisis por Doctor:**
- Rendimiento individual
- Citas atendidas
- Promedio de pacientes por sesión

**4. Análisis por Sede:**
- Distribución geográfica
- Sedes más utilizadas
- Capacidad vs demanda

**5. Tendencias Temporales:**
- Gráficas de evolución
- Días con mayor demanda
- Horas pico de atención

**6. Estado de Citas:**
- Confirmadas
- Pendientes
- Canceladas
- No presentadas (no-show)

---

## Flujo de Trabajo Típico

### 📋 Escenario 1: Crear Agenda Semanal para un Doctor

1. **Abrir creación de agenda**
   - Click en "Crear Agenda"

2. **Llenar formulario**
   - Sede: Sede Biosanar San Gil
   - Especialidad: Psicología
   - Doctor: Dra. Valentina Abaunza
   - Fechas: Seleccionar lunes a viernes
   - Horario: 08:00 - 12:00
   - Capacidad: 10 cupos
   - Duración: 30 minutos

3. **Activar distribución automática** (opcional)
   - Marcar "Distribuir automáticamente"
   - Excluir fines de semana: Sí

4. **Confirmar**
   - Click en "Crear Agenda"
   - Ver mensaje de confirmación con detalles

5. **Resultado**
   - 5 agendas creadas (lunes a viernes)
   - 10 cupos por día = 50 cupos totales
   - Visibles en calendario

---

### 👤 Escenario 2: Agendar Cita para Paciente

1. **Abrir agendamiento inteligente**
   - Click en "Nueva Cita"

2. **Buscar paciente**
   - Escribir cédula o nombre
   - Seleccionar de autocompletado
   - Sistema carga datos automáticamente

3. **Seleccionar especialidad**
   - Elegir especialidad médica
   - Sistema verifica EPS

4. **Ver disponibilidad**
   - Sistema muestra opciones disponibles
   - Agendas con cupos libres
   - Fechas más cercanas primero

5. **Asignar cita**
   - Seleccionar fecha y hora
   - Confirmar motivo de consulta
   - Click en "Agendar"

6. **Confirmación**
   - Mensaje de éxito
   - Detalles de la cita
   - Opción de enviar SMS/Email

---

### ⏸️ Escenario 3: Pausar Agenda por Emergencia

1. **Localizar agenda**
   - Buscar por fecha o doctor
   - Filtrar si es necesario

2. **Expandir tarjeta**
   - Click en la agenda

3. **Pausar**
   - Click en botón "Pausar"
   - Confirmación automática

4. **Resultado**
   - Cupos bloqueados
   - Badge "PAUSADA" visible
   - Nuevas citas bloqueadas
   - Citas existentes intactas

5. **Reanudar después**
   - Click en "Reanudar"
   - Cupos liberados inmediatamente

---

## Tecnología y Arquitectura

### Frontend
- **Framework**: React 18 + TypeScript
- **UI Components**: shadcn/ui + Radix UI
- **Estado**: React Hooks personalizados
- **Formularios**: React Hook Form + Zod validation
- **Fechas**: date-fns + date-fns-tz para manejo de zonas horarias
- **Animaciones**: Framer Motion
- **Iconos**: Lucide React

### Backend
- **API REST**: Node.js + Express + TypeScript
- **Base de Datos**: MySQL con connection pooling
- **Zona Horaria**: 
  - BD almacena en UTC-0
  - Conversión automática a UTC-5 (Colombia) en frontend
  - Doble visualización: hora local y hora BD

### Características Técnicas

#### Manejo de Zonas Horarias
```
BD (UTC-0): 13:00:00
↓ Conversión
Colombia (UTC-5): 08:00 (8:00 a.m.)
```

**Visualización:**
- Verde: Hora convertida a UTC-5 (lo que ve el paciente)
- Gris: Hora cruda de BD en UTC-0 (para depuración)

#### Optimización de Rendimiento
- **Carga perezosa**: Componentes cargados solo cuando se necesitan
- **Caching**: Resumen de calendario en memoria
- **Filtrado en cliente**: Respuesta instantánea
- **Paginación**: Para listas grandes de datos

#### Validaciones
- **Formularios**: Validación en tiempo real con Zod
- **Fechas**: No permite agendas en fechas pasadas
- **Horarios**: Valida que hora fin > hora inicio
- **Capacidad**: Mínimo 1 cupo
- **EPS**: Verifica autorización antes de agendar

---

## Permisos y Roles

### Administrador
- ✅ Crear/editar/eliminar agendas
- ✅ Ver todas las citas
- ✅ Acceso a analytics completo
- ✅ Gestionar distribución de cupos
- ✅ Configurar auto-cancelación
- ✅ Sincronizar horas globalmente
- ✅ Pausar/reanudar agendas

### Recepcionista
- ✅ Ver agendas
- ✅ Crear citas
- ✅ Ver citas del día
- ✅ Imprimir agendas
- ❌ No puede editar/eliminar agendas
- ❌ No accede a analytics

### Doctor
- ✅ Ver sus propias agendas
- ✅ Ver sus citas
- ✅ Marcar estado de citas
- ❌ No puede crear agendas
- ❌ No puede ver agendas de otros doctores

---

## Integración con Otros Módulos

### 🔗 Con Módulo de Pacientes
- Búsqueda automática de pacientes
- Carga de datos demográficos
- Verificación de EPS
- Historial médico disponible

### 🔗 Con Módulo de Cola de Espera
- Agregar paciente a lista de espera
- Notificación cuando se libera cupo
- Asignación automática según prioridad

### 🔗 Con Módulo de Notificaciones
- SMS/Email de confirmación
- Recordatorios 24h antes
- Notificación de cambios
- Alertas de cancelación

### 🔗 Con Sistema de Reportes
- Exportación de datos
- Generación de PDFs
- Analytics integrado
- Auditoría de acciones

---

## Mensajes y Notificaciones del Sistema

### ✅ Mensajes de Éxito
```
✅ X agendas creadas exitosamente
📋 Doctor: [Nombre]
🏥 Especialidad: [Especialidad]
📍 Sede: [Sede]
📅 Fecha(s): [Detalle]
⏰ Horario: [HH:MM - HH:MM]
```

```
✅ Cita creada exitosamente
Programada para [fecha] con [doctor]
```

```
✅ Agenda pausada
Se bloquearon X cupos
```

```
✅ Agenda reanudada
Se liberaron X cupos
```

### ⚠️ Mensajes de Advertencia
```
⚠️ No hay cupos disponibles
¿Desea agregar al paciente a la lista de espera?
```

```
⚠️ Agenda pausada
No se pueden registrar citas en esta agenda
```

### ❌ Mensajes de Error
```
❌ Error al crear agenda
[Detalle del error]
```

```
❌ No se pudo agendar cita
Verifique la disponibilidad
```

---

## Mejores Prácticas

### Para Administradores

1. **Crear agendas con anticipación**
   - Planificar al menos 1 semana antes
   - Usar distribución automática para rutinas

2. **Revisar ocupación diariamente**
   - Verificar cupos disponibles
   - Identificar cuellos de botella

3. **Usar filtros efectivamente**
   - Combinar múltiples filtros
   - Guardar búsquedas frecuentes mentalmente

4. **Monitorear analytics**
   - Revisar métricas semanalmente
   - Identificar patrones de demanda

5. **Gestionar lista de espera**
   - Priorizar casos urgentes
   - Notificar a pacientes oportunamente

### Para Recepcionistas

1. **Verificar EPS antes de agendar**
   - Evita rechazos posteriores
   - Informa al paciente sobre cobertura

2. **Usar agendamiento inteligente**
   - Encuentra automáticamente disponibilidad
   - Sugiere alternativas si no hay cupos

3. **Confirmar datos del paciente**
   - Verificar teléfono actualizado
   - Confirmar datos de contacto

4. **Imprimir agendas del día**
   - Entregar a doctores al inicio del día
   - Tener respaldo físico

---

## Solución de Problemas Comunes

### Problema: "No aparecen agendas"
**Solución:**
- Verificar filtros activos (especialmente fecha)
- Activar toggle "Mostrar agendas pasadas"
- Limpiar todos los filtros con "Limpiar Todo"

### Problema: "No puedo crear agenda"
**Solución:**
- Verificar que todos los campos obligatorios estén llenos
- Confirmar que la fecha no sea pasada
- Verificar que hora fin > hora inicio
- Revisar permisos de usuario

### Problema: "La hora mostrada no coincide con la BD"
**Solución:**
- La hora verde es UTC-5 (Colombia)
- La "Hora BD" es UTC-0 (almacenada)
- Diferencia de 5 horas es normal
- Ejemplo: BD 13:00 = Colombia 8:00 AM

### Problema: "No se puede agendar cita"
**Solución:**
- Verificar que la agenda no esté pausada
- Confirmar que hay cupos disponibles
- Revisar que la EPS tenga autorización
- Verificar que la fecha no sea pasada

### Problema: "Auto-cancelación no funciona"
**Solución:**
- Verificar configuración en ajustes
- Confirmar que la agenda está efectivamente vencida
- Revisar registro de auto-cancelaciones

---

## Glosario de Términos

- **Agenda**: Bloque de tiempo donde un doctor atiende pacientes
- **Cupo**: Espacio disponible en una agenda para agendar una cita
- **Disponibilidad**: Sinónimo de agenda o cupo disponible
- **Preasignación**: Bloqueo temporal de cupos para pacientes específicos
- **Distribución**: Asignación automática de cupos en múltiples fechas
- **Lista de espera**: Cola de pacientes esperando disponibilidad
- **UTC-0**: Hora universal coordinada (hora de la base de datos)
- **UTC-5**: Hora de Colombia (hora local mostrada a usuarios)
- **CUPS**: Código único de procedimientos en salud
- **EPS**: Entidad promotora de salud (aseguradora médica)
- **Pausa**: Bloqueo temporal de una agenda sin cancelarla
- **Sincronización**: Actualización masiva de horarios de citas

---

## Actualizaciones y Versiones

### Última Actualización: Enero 2026

**Nuevas Características:**
- ✨ Mensaje de confirmación mejorado con detalles completos
- ✨ Visualización dual de horas (UTC-5 y UTC-0)
- ✨ Sistema de pausa/reanudación de agendas
- ✨ Auto-cancelación inteligente de agendas vencidas
- ✨ Sincronización global de horas
- ✨ Filtros avanzados con chips visuales
- ✨ Modal de agendamiento inteligente mejorado
- ✨ Exportación a Excel por agenda individual
- ✨ Analytics con gráficas interactivas

**Mejoras de Rendimiento:**
- ⚡ Filtrado más rápido en cliente
- ⚡ Carga optimizada de datos
- ⚡ Animaciones fluidas con Framer Motion

---

## Soporte y Contacto

Para soporte técnico o consultas sobre el sistema:
- **Email**: soporte@biosanarcall.site
- **Teléfono**: [Número de contacto]
- **Documentación técnica**: [URL de docs]

---

## Conclusión

El módulo de **Gestión de Agenda Médica** es una herramienta completa y poderosa diseñada para optimizar la administración de citas médicas en Fundación Biosanar IPS. Con sus múltiples vistas, filtros avanzados, agendamiento inteligente y sistema de auto-gestión, permite a administradores y recepcionistas trabajar de manera eficiente, reduciendo tiempos de espera y mejorando la experiencia tanto del personal como de los pacientes.

La integración con otros módulos del sistema y las constantes actualizaciones aseguran que el sistema evoluciona según las necesidades de la institución, manteniéndose siempre a la vanguardia en gestión médica digital.
