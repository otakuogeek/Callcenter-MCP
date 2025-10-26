# 📅 Portal del Paciente - Mis Citas

## 🎯 Descripción

Vista exclusiva para pacientes autenticados donde pueden consultar sus citas programadas y solicitudes pendientes en lista de espera. **Solo lectura** - sin opciones de modificación.

## ✨ Características Principales

### 📋 Visualización de Información

#### 1. **Información Personal**
- Nombre completo
- Número de documento
- Teléfono de contacto

#### 2. **Citas Programadas**
Para cada cita confirmada/pendiente muestra:
- ✅ Estado (Pendiente, Confirmada)
- 📅 Fecha y hora exacta
- ⏱️ Duración en minutos
- 👨‍⚕️ Nombre del médico
- 🏥 Especialidad
- 📍 Sede y dirección
- 🚪 Número de consultorio (si aplica)
- 💻 Modalidad (Presencial/Telemedicina)
- 📝 Motivo de consulta
- 🏷️ Código CUPS (si está asignado)

#### 3. **Lista de Espera**
Para cada solicitud pendiente muestra:
- 🔢 Posición en la cola
- ⚡ Prioridad (Urgente, Alta, Normal, Baja)
- ⏰ Tiempo de espera
- 🏥 Especialidad solicitada
- 👨‍⚕️ Médico asignado (si aplica)
- 📍 Sede preferida (si aplica)
- 📝 Motivo
- 🏷️ Código CUPS (si está asignado)
- ⚡ Badge especial si es reagendamiento

### 🔄 Actualización Automática

- **Auto-refresh cada 60 segundos**
- Sin necesidad de recargar manualmente
- Notificaciones visuales de cambios

## 🖥️ Interfaz Visual

### Layout Principal

```
┌─────────────────────────────────────────────┐
│  📅 Mis Citas                               │
│  Consulta tus citas programadas y...       │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 👤 Información Personal              │   │
│  │ Nombre: David Santiago García B.     │   │
│  │ Documento: 1186714607                │   │
│  │ Teléfono: 3144750594                 │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ 📅 Citas     │  │ ⏰ En Espera │        │
│  │ Programadas  │  │              │        │
│  │      2       │  │      1       │        │
│  └──────────────┘  └──────────────┘        │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 📅 Citas Programadas                 │   │
│  │                                       │   │
│  │ ┌───────────────────────────────┐    │   │
│  │ │ ✅ Confirmada    Cita #135     │    │   │
│  │ │ Odontología                    │    │   │
│  │ │                                │    │   │
│  │ │ 📅 Domingo, 20 de octubre...   │    │   │
│  │ │ ⏰ 07:00 (30 min)              │    │   │
│  │ │ 👨‍⚕️ Dra. Laura Julia Podeva   │    │   │
│  │ │                                │    │   │
│  │ │ 📍 Sede biosánar san gil       │    │   │
│  │ │    Carrera 10 # 12-34          │    │   │
│  │ │                                │    │   │
│  │ │ Motivo: Chequeo general        │    │   │
│  │ └───────────────────────────────┘    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ ⏰ Solicitudes en Lista de Espera    │   │
│  │                                       │   │
│  │ ┌───────────────────────────────┐    │   │
│  │ │ 🔴 Normal    Posición #36      │    │   │
│  │ │ Ecografía articular de CODOM   │    │   │
│  │ │                                │    │   │
│  │ │ ⏰ En espera desde hace 2 días │    │   │
│  │ │ 📍 Sede biosánar san gil       │    │   │
│  │ │                                │    │   │
│  │ │ 🏷️ 881611                      │    │   │
│  │ │    ECOGRAFIA ARTICULAR DE CODO │    │   │
│  │ └───────────────────────────────┘    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ℹ️ Información importante:                │
│  • Las citas se actualizan cada minuto     │
│  • Recibirás notificaciones de cambios    │
│  • Para cancelar, contacta call center    │
└─────────────────────────────────────────────┘
```

## 🔧 Implementación Técnica

### Backend Endpoint

**GET `/api/appointments/my-appointments`**

**Autenticación**: ✅ Requerida (JWT)

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "patient": {
      "id": 78,
      "name": "David Santiago García Ballesteros",
      "document": "1186714607",
      "phone": "3144750594",
      "email": "david@email.com"
    },
    "appointments": [
      {
        "id": 135,
        "scheduled_at": "2025-10-20T07:00:00.000Z",
        "status": "Confirmada",
        "appointment_type": "Presencial",
        "reason": "Chequeo general",
        "duration_minutes": 30,
        "doctor_name": "Laura Julia Podeva",
        "specialty_name": "Odontología",
        "location_name": "Sede biosánar san gil",
        "location_address": "Carrera 10 # 12-34",
        "room_name": "Consultorio 3",
        "cups_code": null,
        "cups_name": null,
        "cups_category": null
      }
    ],
    "waiting_list": [
      {
        "id": 159,
        "created_at": "2025-10-14T15:30:00.000Z",
        "priority_level": "Normal",
        "reason": "Ecografía articular de CODOM",
        "status": "pending",
        "queue_position": 36,
        "call_type": null,
        "specialty_name": "Ecografía",
        "doctor_name": "Dr. Carlos Méndez",
        "location_name": "Sede biosánar san gil",
        "cups_code": "881611",
        "cups_name": "ECOGRAFIA ARTICULAR DE CODO",
        "cups_category": "Ecografía"
      }
    ],
    "summary": {
      "total_appointments": 1,
      "total_waiting": 1
    }
  }
}
```

### Lógica Backend

```typescript
// 1. Obtener user_id del JWT
const userId = (req as any).user?.id;

// 2. Buscar patient_id asociado
const [userPatient] = await pool.query(
  'SELECT id FROM patients WHERE user_id = ?',
  [userId]
);

// 3. Consultar citas programadas (futuras)
SELECT a.*, d.name AS doctor_name, s.name AS specialty_name...
FROM appointments a
WHERE a.patient_id = ? 
  AND a.status IN ('Pendiente', 'Confirmada')
  AND a.scheduled_at >= CURDATE()
ORDER BY a.scheduled_at ASC

// 4. Consultar lista de espera
SELECT awl.*, s.name AS specialty_name...
FROM appointments_waiting_list awl
WHERE awl.patient_id = ?
  AND awl.status = 'pending'
ORDER BY awl.queue_position ASC
```

### Frontend Component

**Archivo**: `/frontend/src/pages/MyAppointments.tsx`

**Características**:
- ✅ Auto-refresh cada 60 segundos
- ✅ Loading states con spinner
- ✅ Error handling con mensajes informativos
- ✅ Formato de fechas en español (date-fns)
- ✅ Cálculo de tiempo de espera
- ✅ Badges de prioridad con colores
- ✅ Responsive design (grid adaptativo)
- ✅ Iconografía intuitiva (lucide-react)

**Estados React**:
```typescript
const [data, setData] = useState<any>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

**Auto-refresh**:
```typescript
useEffect(() => {
  loadData();
  const interval = setInterval(loadData, 60000); // 60 segundos
  return () => clearInterval(interval);
}, []);
```

## 🎨 Estilos y Variantes

### Badges de Prioridad
```typescript
switch (priority.toLowerCase()) {
  case 'urgente': return 'destructive';  // Rojo
  case 'alta':    return 'destructive';  // Rojo
  case 'normal':  return 'default';      // Azul
  case 'baja':    return 'secondary';    // Gris
}
```

### Badges de Estado
```typescript
switch (status.toLowerCase()) {
  case 'confirmada': return 'default';   // Azul
  case 'pendiente':  return 'secondary'; // Gris
  case 'completada': return 'default';   // Azul
}
```

### Gradientes
- Citas programadas: `from-blue-50 to-white`
- Lista de espera: `from-yellow-50 to-white`
- Información personal: `from-medical-50 to-white`

## 📱 Responsive Design

### Mobile (< 768px)
- Grid 1 columna
- Cards apiladas verticalmente
- Iconos más grandes para touch

### Tablet/Desktop (≥ 768px)
- Grid 2 columnas para resumen
- Grid 2 columnas para detalles de citas
- Mejor aprovechamiento del espacio

## 🔐 Seguridad

### Autenticación
- ✅ Requiere JWT válido
- ✅ Solo muestra datos del usuario autenticado
- ✅ Verifica asociación user_id → patient_id

### Validaciones Backend
```typescript
// 1. Usuario autenticado
if (!userId) {
  return res.status(401).json({ message: 'No autenticado' });
}

// 2. Paciente existe
if (!userPatient || userPatient.length === 0) {
  return res.status(404).json({ 
    message: 'No se encontró un paciente asociado' 
  });
}
```

### Protección de Datos
- ❌ No muestra datos de otros pacientes
- ❌ No permite modificaciones (solo lectura)
- ❌ No expone IDs internos sensibles

## 🚀 Acceso

### URL
```
https://biosanarcall.site/my-appointments
```

### Navegación
Desde el menú lateral:
```
Menú Principal
  └─ 📅 Mis Citas
```

### Ruta React
```typescript
<Route path="/my-appointments" element={
  <ProtectedRoute>
    <MyAppointments />
  </ProtectedRoute>
} />
```

## 📊 Casos de Uso

### Caso 1: Paciente con cita programada
```
Paciente: David Santiago García
Citas: 1 programada
Espera: 1 solicitud

Vista muestra:
  ✅ Cita Odontología - 20 oct 07:00
  ⏰ Solicitud Ecografía - Posición #36
```

### Caso 2: Paciente sin citas
```
Paciente: María del Rosario
Citas: 0
Espera: 0

Vista muestra:
  📅 "No tienes citas programadas en este momento"
  ⏰ "No tienes solicitudes en lista de espera"
```

### Caso 3: Múltiples citas y solicitudes
```
Paciente: Isabel Estupiñán
Citas: 3 programadas
Espera: 2 solicitudes

Vista muestra lista completa ordenada:
  📅 Citas por fecha ascendente
  ⏰ Solicitudes por posición en cola
```

## 🔄 Flujo de Usuario

```
1. Usuario inicia sesión
   ↓
2. Click en "📅 Mis Citas" en sidebar
   ↓
3. Sistema carga datos del paciente
   ↓
4. Muestra resumen (2 tarjetas)
   ↓
5. Lista citas programadas
   ↓
6. Lista solicitudes en espera
   ↓
7. Auto-refresh cada 60 segundos
   ↓
8. Usuario puede ver cambios en tiempo real
```

## ⏱️ Formato de Tiempo

### Fechas
```typescript
format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
// Resultado: "Domingo, 20 de octubre de 2025"
```

### Horas
```typescript
format(date, "HH:mm", { locale: es })
// Resultado: "07:00"
```

### Tiempo de Espera
```typescript
const diffDays = Math.floor(diffHours / 24);
if (diffDays > 0) return `${diffDays} días`;
if (diffHours > 0) return `${diffHours} horas`;
return `${diffMins} minutos`;
// Resultado: "2 días", "3 horas", "45 minutos"
```

## 📝 Mensajes Informativos

### Banner de Ayuda
```
ℹ️ Información importante:
  • Las citas se actualizan automáticamente cada minuto
  • Recibirás notificaciones cuando se confirme o cambie una cita
  • Las solicitudes en espera se asignarán según disponibilidad y prioridad
  • Para cancelar o reprogramar, contacta a nuestro call center
```

## 🐛 Manejo de Errores

### Error de Carga
```tsx
<Card className="border-red-200 bg-red-50">
  <AlertCircle /> Error al cargar tus citas
</Card>
```

### Sin Paciente Asociado
```json
{
  "success": false,
  "message": "No se encontró un paciente asociado a este usuario"
}
```

### Token Inválido
```json
{
  "success": false,
  "message": "No autenticado"
}
```

## 📦 Dependencias

### Backend
- `express` - Framework HTTP
- `mysql2` - Conexión a base de datos
- `jsonwebtoken` - Autenticación JWT

### Frontend
- `react` - UI framework
- `date-fns` - Formateo de fechas
- `lucide-react` - Iconografía
- `shadcn/ui` - Componentes UI

## 🧪 Testing

### Endpoint Backend
```bash
curl -X GET https://biosanarcall.site/api/appointments/my-appointments \
  -H "Authorization: Bearer TOKEN_PACIENTE"
```

### Casos de Prueba
1. ✅ Usuario con citas y solicitudes
2. ✅ Usuario sin citas
3. ✅ Token inválido (401)
4. ✅ Usuario sin paciente asociado (404)
5. ✅ Auto-refresh funcional

## 📈 Mejoras Futuras

1. **Filtros**: Por fecha, especialidad, estado
2. **Búsqueda**: Buscar citas por palabra clave
3. **Exportar**: Descargar lista en PDF
4. **Recordatorios**: Configurar notificaciones
5. **Historial**: Ver citas pasadas completadas
6. **Cancelación**: Permitir cancelar con anticipación
7. **Reprogramación**: Solicitar cambio de fecha

---

**Fecha**: 2025-10-17  
**Versión**: 1.0  
**Estado**: ✅ Implementado y funcional  
**Build**: `pages-BxzzGNrN.js` (119.18 kB)
