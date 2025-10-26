# 🔄 Reorganización: Portal de Usuarios con Cola de Espera

## 📋 Cambios Realizados

### ✅ Eliminación del Menú Principal
- ❌ **Removido**: "📅 Mis Citas" del sidebar principal
- ✅ **Motivo**: Consolidar toda la funcionalidad en `/users`

### ✅ Mejoras en `/users` (Portal de Usuarios)

#### 🎯 Nueva Funcionalidad: Lista de Espera

El portal de usuarios (`https://biosanarcall.site/users`) ahora muestra:

**1. Citas Programadas** (existente - mejorado)
- Fecha y hora confirmadas
- Médico asignado
- Especialidad
- Sede
- Descargar QR

**2. Lista de Espera** (NUEVO ✨)
- Solicitudes pendientes de asignación
- Posición en cola
- Prioridad (Urgente, Alta, Normal, Baja)
- Tiempo de espera calculado
- Código CUPS (si está asignado)
- Especialidad solicitada
- Doctor preferido (si aplica)
- Sede preferida (si aplica)

## 🔧 Implementación Técnica

### Backend Endpoint Utilizado

**GET `/api/appointments/my-appointments`**
- Retorna citas + lista de espera del paciente autenticado
- Requiere JWT token válido

### Frontend: UserPortal.tsx

#### Estados Agregados
```typescript
const [waitingList, setWaitingList] = useState<any[]>([]);
```

#### Carga de Datos
```typescript
// Usa el nuevo endpoint si hay token
if (token) {
  const myAppointmentsResponse = await api.getMyAppointments();
  setAppointments(mappedAppointments);
  setWaitingList(myAppointmentsResponse.data.waiting_list || []);
}
```

#### Nueva Sección: Lista de Espera
- Se muestra **debajo** de las citas programadas
- Solo aparece si `waitingList.length > 0`
- Cards con información completa de cada solicitud

## 🎨 Diseño Visual

### Estructura del Portal `/users`

```
┌─────────────────────────────────────────────┐
│ Bienvenido(a), David Santiago García B.     │
│ Documento: 1186714607              [Salir]  │
├─────────────────────────────────────────────┤
│                                             │
│ [Mis Citas] [Información Personal] [Info Médica]
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ 📅 CITAS PROGRAMADAS                 │   │
│ │                                       │   │
│ │ ┌───────────────────────────────┐    │   │
│ │ │ 20 OCT  07:00  ✅ Confirmada  │    │   │
│ │ │ Odontología                   │    │   │
│ │ │ Dra. Laura Julia Podeva       │    │   │
│ │ │ [Descargar QR de Cita]        │    │   │
│ │ └───────────────────────────────┘    │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ ⏰ SOLICITUDES EN LISTA DE ESPERA    │   │
│ │ Tienes 1 solicitud pendiente         │   │
│ │                                       │   │
│ │ ┌───────────────────────────────┐    │   │
│ │ │ 🔵 Normal  Posición #36       │    │   │
│ │ │ Ecografía                     │    │   │
│ │ │ ⏰ En espera: 2 días          │    │   │
│ │ │ 📍 Sede biosánar san gil      │    │   │
│ │ │                               │    │   │
│ │ │ 881611 ECOGRAFIA ARTICULAR... │    │   │
│ │ │                               │    │   │
│ │ │ ℹ️ Te notificaremos cuando    │    │   │
│ │ │    se asigne tu cita          │    │   │
│ │ └───────────────────────────────┘    │   │
│ └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Card de Lista de Espera

Cada solicitud muestra:

1. **Header**
   - Badge de prioridad (color según urgencia)
   - Badge de posición (#36)
   - Badge especial si es reagendamiento (⚡)

2. **Información Principal**
   - 🏥 Especialidad
   - ⏰ Tiempo en espera ("2 días", "3 horas")
   - 👨‍⚕️ Doctor (si aplica)
   - 📍 Sede (si aplica)

3. **Detalles**
   - 📝 Motivo de consulta
   - 🏷️ Código CUPS + nombre del servicio

4. **Banner Informativo**
   - Mensaje: "Te notificaremos cuando se asigne tu cita según disponibilidad y prioridad"

### Colores de Prioridad

```typescript
const priorityColors = {
  'Urgente': 'bg-red-100 text-red-800 border-red-200',     // Rojo
  'Alta':    'bg-orange-100 text-orange-800 border-orange-200', // Naranja
  'Normal':  'bg-blue-100 text-blue-800 border-blue-200',   // Azul
  'Baja':    'bg-gray-100 text-gray-800 border-gray-200'    // Gris
};
```

### Borde Lateral

- **Color**: Amarillo (`border-l-4 border-l-yellow-500`)
- **Propósito**: Diferenciar visualmente de las citas confirmadas

## 🔄 Flujo de Usuario

```
1. Usuario accede a /users
   ↓
2. Ingresa número de documento
   ↓
3. Sistema busca paciente
   ↓
4. Si tiene token: Llama a /my-appointments
   ↓
5. Muestra Tab "Mis Citas"
   ↓
6. Sección 1: Citas Programadas (azul)
   ↓
7. Sección 2: Lista de Espera (amarillo)
   ↓
8. Usuario puede ver CUPS asignados
   ↓
9. Usuario puede descargar QR de citas confirmadas
```

## 📊 Cálculo de Tiempo de Espera

```typescript
const calculateWaitTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays} días`;
  if (diffHours > 0) return `${diffHours} horas`;
  return `${diffMins} minutos`;
};
```

**Ejemplos**:
- 2 días → "2 días"
- 5 horas → "5 horas"
- 45 minutos → "45 minutos"

## 🔐 Autenticación

### Flujo con Token
```typescript
const token = localStorage.getItem('token');
if (token) {
  // Usa endpoint /my-appointments
  const response = await api.getMyAppointments();
  // Mapea datos al formato del componente
}
```

### Fallback sin Token
```typescript
else {
  // Usa endpoint anterior
  const response = await fetch(`/patients-v2/${patient_id}/appointments`);
  setAppointments(data);
  setWaitingList([]); // No hay lista de espera
}
```

## ✨ Características Nuevas

### 1. Badges de Prioridad
- **Urgente**: Rojo intenso
- **Alta**: Naranja
- **Normal**: Azul
- **Baja**: Gris

### 2. Indicador de Posición
```
Posición #36
```
- Badge amarillo con número de cola

### 3. Tiempo Real
```
En espera desde hace 2 días
```
- Cálculo automático desde created_at

### 4. CUPS Completo
```
[881611] ECOGRAFIA ARTICULAR DE CODO
```
- Código + nombre completo del servicio

### 5. Reagendamiento
```
⚡ Reagendar
```
- Badge especial para solicitudes de reagendamiento

## 🚫 Cambios Removidos

### AppSidebar.tsx

**ANTES**:
```typescript
const mainItems = [
  {
    title: "Pacientes",
    url: "/patients",
    icon: Users,
  },
  {
    title: "Mis Citas",      // ← REMOVIDO
    url: "/my-appointments",
    icon: Calendar,
  },
];
```

**DESPUÉS**:
```typescript
const mainItems = [
  {
    title: "Pacientes",
    url: "/patients",
    icon: Users,
  },
  // Mis Citas fue removido - ahora está en /users
];
```

## 📱 Responsive Design

### Mobile
- Cards apiladas verticalmente
- Información compacta
- Botones de ancho completo

### Desktop
- Grid 2 columnas para detalles
- Información espaciada
- Botones de ancho automático

## 🎯 URLs Actualizadas

| Funcionalidad | URL | Descripción |
|--------------|-----|-------------|
| Portal Usuarios | `/users` | Login + Citas + Lista de Espera |
| Mis Citas (Admin) | `/my-appointments` | Mantiene funcionalidad para staff |

## 📝 Mensajes al Usuario

### Sin Lista de Espera
- No muestra la sección si `waitingList.length === 0`

### Con Lista de Espera
```
⏰ Solicitudes en Lista de Espera
Tienes 1 solicitud pendiente de asignación
```

### Banner Informativo
```
ℹ️ Te notificaremos cuando se asigne tu cita 
   según disponibilidad y prioridad
```

## 🔄 Compatibilidad

### Backward Compatible
- ✅ Usuarios sin token: Funciona con endpoint anterior
- ✅ Usuarios con token: Usa nuevo endpoint mejorado
- ✅ Datos existentes: Se mapean correctamente

### Mapeo de Datos

```typescript
// Mapeo de formato nuevo → formato antiguo
const mappedAppointments = myAppointmentsResponse.data.appointments.map(apt => ({
  appointment_id: apt.id,
  scheduled_date: apt.scheduled_at.split('T')[0],
  scheduled_time: apt.scheduled_at.split('T')[1]?.substring(0, 5),
  status: apt.status,
  doctor_name: apt.doctor_name,
  specialty_name: apt.specialty_name,
  location_name: apt.location_name,
  reason: apt.reason
}));
```

## 🧪 Testing

### Casos de Prueba

1. **Usuario con citas y lista de espera**
   - ✅ Muestra ambas secciones
   - ✅ Calcula tiempos correctamente
   - ✅ Badges de prioridad correctos

2. **Usuario solo con citas**
   - ✅ Muestra citas
   - ✅ No muestra sección de lista de espera

3. **Usuario solo con lista de espera**
   - ✅ Muestra "No tienes citas programadas"
   - ✅ Muestra lista de espera

4. **Usuario sin nada**
   - ✅ Mensajes vacíos en ambas secciones

## 📚 Archivos Modificados

1. `/frontend/src/components/AppSidebar.tsx`
   - Removido "Mis Citas" del menú principal

2. `/frontend/src/pages/UserPortal.tsx`
   - Agregado estado `waitingList`
   - Integrado endpoint `/my-appointments`
   - Nueva sección de lista de espera
   - Mapeo de datos para compatibilidad

## 🚀 Deployment

**Build completado**: `pages-Cjjk1gjI.js` (125.43 kB)

### Verificación Post-Deploy

1. ✅ Sidebar no muestra "Mis Citas"
2. ✅ `/users` carga correctamente
3. ✅ Login con documento funciona
4. ✅ Sección de citas muestra datos
5. ✅ Sección de lista de espera aparece si hay datos
6. ✅ CUPS se muestran correctamente
7. ✅ Tiempos de espera se calculan bien

---

**Fecha**: 2025-10-17  
**Versión**: 2.0  
**Estado**: ✅ Implementado  
**Impacto**: Portal de usuarios consolidado con lista de espera visible
