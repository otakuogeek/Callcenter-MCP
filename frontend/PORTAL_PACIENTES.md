# Portal de Autoservicio para Pacientes

## 📋 Descripción General

Portal público e independiente que permite a los pacientes acceder a su información médica y gestionar sus datos personales de manera segura usando solo su número de documento de identidad.

**URL de Acceso**: `https://biosanarcall.site/users`

---

## 🔐 Características de Seguridad

### Autenticación
- **Sin contraseña**: Acceso únicamente con número de documento
- **Validación en tiempo real**: Búsqueda inmediata en base de datos
- **Normalización automática**: Elimina puntos, comas y espacios
- **Sesión temporal**: Solo válida mientras el usuario permanezca en la página

### Restricciones
- ✅ **Puede VER**: Toda su información personal, médica, citas y datos demográficos
- ✅ **Puede EDITAR**: Información personal, contacto, dirección y seguro
- ❌ **NO puede BORRAR**: Ningún registro (protección total)
- ❌ **NO puede EDITAR**: Documento de identidad, información médica, notas clínicas
- ❌ **NO puede CANCELAR**: Citas confirmadas (debe llamar al centro)

---

## 🎨 Estructura de la Interfaz

### Pantalla de Login
```
┌─────────────────────────────────────────┐
│         PORTAL DE PACIENTES             │
│      Fundación Biosanar IPS             │
├─────────────────────────────────────────┤
│                                          │
│  ℹ️ Ingrese su número de documento      │
│     para acceder a su información       │
│                                          │
│  🔒 Número de Documento:                │
│     [_____________________]             │
│     Sin puntos ni comas. Solo números   │
│                                          │
│        [Ingresar]                       │
│                                          │
│  ¿Problemas para acceder?               │
│  Llame al: 321 123 4567                 │
└─────────────────────────────────────────┘
```

### Dashboard Principal (3 Tabs)

#### Tab 1: Mi Información 👤
- **Información Personal**: Nombre, documento, fecha nacimiento, género
- **Información de Contacto**: Teléfonos, email, dirección, municipio
- **Información de Seguro**: EPS, tipo de afiliación
- **Gestión de Embarazo**: Solo visible para pacientes femeninos
- **Botones**: Editar / Guardar / Cancelar

#### Tab 2: Mis Citas 📅
- **Próximas Citas**: Citas confirmadas y pendientes con todos los detalles
  - Fecha y hora
  - Especialidad y médico asignado
  - Sede de atención
  - Motivo de consulta
  - Estado (badge con color)
  
- **Historial**: Últimas 5 citas completadas o canceladas

#### Tab 3: Información Médica ❤️
- **Datos Médicos**:
  - Grupo sanguíneo
  - Discapacidad
  - Notas y observaciones (solo lectura)
  
- **Datos Demográficos**:
  - Nivel de educación
  - Estado civil
  - Grupo poblacional
  - Estrato socioeconómico

---

## 🚀 Implementación Técnica

### Archivos Creados

#### 1. `/frontend/src/pages/UserPortal.tsx` (113 líneas)
**Propósito**: Componente principal de autenticación y layout

**Funcionalidades**:
- Pantalla de login con validación de documento
- Normalización de cédula (4 pasos)
- Búsqueda de paciente vía API
- Manejo de sesión temporal
- Header con información del paciente
- Footer informativo
- Botón de cerrar sesión

**Estados**:
```typescript
const [document, setDocument] = useState('');
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [patientData, setPatientData] = useState<any>(null);
const [loading, setLoading] = useState(false);
```

#### 2. `/frontend/src/components/user-portal/UserDashboard.tsx` (584 líneas)
**Propósito**: Dashboard completo con tabs de información

**Componentes integrados**:
- Tabs de shadcn/ui
- Cards para cada sección
- Formularios editables
- Select dinámicos (zonas, municipios, EPS)
- Badge de estados
- Integración con PregnancyManagement
- Query de citas del paciente

**Queries de datos**:
```typescript
// Datos de referencia
const { data: municipalitiesData } = useQuery<Municipality[]>(['municipalities'])
const { data: zonesData } = useQuery<Zone[]>(['zones'])
const { data: epsData } = useQuery<EPS[]>(['eps'])

// Citas del paciente
const { data: appointmentsData } = useQuery(['patient-appointments', patient.id])
```

#### 3. `/frontend/src/App.tsx` (Modificado)
**Cambios**:
- Línea 29: Importación de `UserPortal`
- Línea 152: Ruta pública `/users` (sin ProtectedRoute)

```typescript
<Route path="/users" element={<UserPortal />} />
```

---

## 🔄 Flujo de Usuario

### 1. Acceso Inicial
```mermaid
Usuario → Ingresa https://biosanarcall.site/users
       → Ve pantalla de login
       → Ingresa cédula (Ej: 1.234.567-8)
       → Sistema normaliza: "12345678"
       → API busca paciente
       → Si existe: Acceso concedido
       → Si no existe: Mensaje de error
```

### 2. Visualización de Datos
```
Usuario autenticado → Dashboard carga automáticamente
                   → Tab "Mi Información" activo por defecto
                   → Todos los datos en modo LECTURA
                   → Botón "Editar" visible
```

### 3. Edición de Datos
```
Usuario → Click en "Editar"
       → Campos se habilitan
       → Modifica teléfono, email, dirección, etc.
       → Click en "Guardar Cambios"
       → API actualiza paciente
       → Toast de confirmación
       → Datos se actualizan en pantalla
       → Modo lectura activado nuevamente
```

### 4. Consulta de Citas
```
Usuario → Click en tab "Mis Citas"
       → Ve lista de citas futuras
       → Ve historial de citas pasadas
       → Puede ver todos los detalles
       → NO puede cancelar ni modificar
```

### 5. Gestión de Embarazo (Solo mujeres)
```
Paciente Femenino → Tab "Mi Información"
                  → Sección "Embarazo" visible
                  → Puede ver semanas de gestación
                  → Puede ver fecha probable de parto
                  → Puede ver controles prenatales
                  → NO puede eliminar embarazo
```

---

## 📊 Estados de Citas

| Estado | Color | Icono | Descripción |
|--------|-------|-------|-------------|
| Confirmada | Azul | ✓ | Cita confirmada y programada |
| Pendiente | Amarillo | ⏱ | Esperando confirmación |
| Completada | Verde | ✓ | Cita realizada |
| Cancelada | Rojo | ✕ | Cita cancelada |

---

## 🔧 APIs Utilizadas

### Autenticación
```typescript
GET /api/patients?search={documento_normalizado}
```

### Obtener datos del paciente
```typescript
GET /api/patients/{id}
```

### Actualizar información
```typescript
PUT /api/patients/{id}
Body: { name, phone, email, address, zone_id, municipality_id, eps_id, ... }
```

### Obtener citas
```typescript
GET /api/appointments?patient_id={id}
```

### Datos de referencia
```typescript
GET /api/lookups/municipalities
GET /api/lookups/zones
GET /api/lookups/eps
```

### Embarazo (solo mujeres)
```typescript
GET /api/pregnancies/patient/{id}/active
POST /api/pregnancies
PUT /api/pregnancies/{id}
```

---

## 🎯 Casos de Uso

### Caso 1: Paciente actualiza teléfono
```
1. Ingresa a https://biosanarcall.site/users
2. Escribe su cédula: 17265900
3. Sistema lo autentica como "Dave Bastidas"
4. Click en "Editar"
5. Cambia teléfono de 04263774021 a 04129999999
6. Click en "Guardar Cambios"
7. Toast: "Información actualizada"
8. Nuevo teléfono guardado en BD
```

### Caso 2: Mujer embarazada consulta semanas de gestación
```
1. Ingresa con su cédula
2. Sistema detecta género: Femenino
3. Ve sección "Gestión de Embarazo"
4. Embarazo activo muestra:
   - 24 semanas + 3 días
   - FPP: 20 de diciembre, 2025
   - 5 controles realizados
   - Alto riesgo: Diabetes gestacional
```

### Caso 3: Paciente consulta próxima cita
```
1. Autenticación exitosa
2. Click en tab "Mis Citas"
3. Ve su próxima cita:
   - Fecha: lunes, 20 de octubre de 2025
   - Hora: 03:00
   - Especialidad: Odontología
   - Médico: Dra. Laura Julia Podeva
   - Sede: Sede biosananar san gil
   - Estado: Confirmada ✓
```

---

## 🔒 Protecciones Implementadas

### Campos NO Editables
```typescript
// Documento
<Input value={formData.document} disabled className="bg-gray-100" />

// Información médica
<Alert variant="destructive">
  La información médica solo puede ser modificada por personal autorizado
</Alert>
```

### Sin opción de eliminar
- NO hay botón de "Eliminar paciente"
- NO hay opción de cancelar citas
- NO hay opción de borrar embarazo
- Solo actualización (UPDATE), nunca DELETE

### Validaciones
```typescript
// Normalización de documento
const normalizeDocument = (doc: string): string => {
  let normalized = doc.trim();
  normalized = normalized.replace(/[.,]/g, '');
  normalized = normalized.toUpperCase();
  normalized = normalized.replace(/[^0-9A-Z]/g, '');
  return normalized;
};
```

---

## 📱 Responsive Design

- ✅ Mobile-first approach
- ✅ Grid adaptativo (1 columna en móvil, 2 en desktop)
- ✅ Tabs con scroll horizontal en móvil
- ✅ Cards apilables
- ✅ Botones con tamaño táctil apropiado

---

## 🎨 Tema Visual

### Colores por Sección
- **Personal**: Azul (`text-blue-500`)
- **Contacto**: Verde (`text-green-500`)
- **Médica**: Rojo (`text-red-500`)
- **Seguro**: Púrpura (`text-purple-500`)
- **Demográfica**: Índigo (`text-indigo-500`)
- **Embarazo**: Rosa (`text-pink-500`)

### Gradiente de Fondo (Login)
```css
bg-gradient-to-br from-blue-50 to-indigo-100
```

---

## 🚀 Despliegue

### Build
```bash
cd /home/ubuntu/app/frontend
npm run build
```

### Configuración Nginx (ya configurada)
```nginx
# Ruta pública sin autenticación
location /users {
    try_files $uri $uri/ /index.html;
}
```

### URL Final
```
https://biosanarcall.site/users
```

---

## 📝 Notas Importantes

1. **No requiere login tradicional**: Solo número de documento
2. **Sin cookies ni tokens**: Sesión solo en memoria del navegador
3. **Acceso público**: Cualquiera con un documento válido puede ingresar
4. **Sin recuperación de contraseña**: No hay contraseñas que recuperar
5. **Privacidad**: Un paciente solo ve SU información, no la de otros
6. **Auditoría**: Las actualizaciones se registran con timestamp en BD

---

## 🔄 Integraciones

### Con Sistema de Embarazos
- Automática para pacientes femeninos
- Muestra componente `PregnancyManagement`
- Mismo comportamiento que en panel administrativo
- Cálculo automático de semanas y FPP

### Con Sistema de Citas
- Consulta en tiempo real
- Filtrado por estado (futuras vs historial)
- Formato de fecha en español
- Badges de estado con colores

---

## 📊 Métricas Sugeridas

### Para Implementar (futuro)
- Total de accesos al portal
- Pacientes únicos que acceden
- Campos más editados
- Tiempo promedio de sesión
- Tasa de actualización de datos

---

## 🐛 Troubleshooting

### "No se encontró paciente"
- Verificar que el documento esté correcto
- Intentar sin puntos ni comas
- Verificar en BD que el paciente existe
- Revisar logs de API: `/api/patients?search=`

### "No se pudo actualizar información"
- Verificar token de autenticación
- Revisar logs del backend
- Verificar campos requeridos
- Check permisos de API

### "No cargan las citas"
- Verificar endpoint `/api/appointments`
- Revisar patient_id correcto
- Check que existan citas en BD
- Validar formato de respuesta

---

## ✅ Testing Checklist

- [x] Login con documento válido
- [x] Login con documento inválido (debe fallar)
- [x] Edición de información personal
- [x] Guardado y persistencia de cambios
- [x] Cancelar edición (vuelve a valores anteriores)
- [x] Vista de citas futuras
- [x] Vista de historial
- [x] Gestión de embarazo (solo mujeres)
- [x] Campos protegidos (documento, médica)
- [x] Responsive design
- [x] Cerrar sesión

---

## 📞 Soporte

Para problemas o dudas:
- **Teléfono**: 321 123 4567
- **Email**: soporte@biosanarcall.site
- **Horario**: Lunes a Viernes, 8am - 6pm

---

**Última actualización**: 12 de octubre de 2025  
**Versión**: 1.0.0  
**Estado**: ✅ Producción
