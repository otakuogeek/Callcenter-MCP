# Sistema de Roles con Super Admin

## Fecha de Implementación
21 de enero de 2026

## Descripción General

Se ha implementado un **sistema jerárquico de roles** con un nuevo nivel máximo de permisos llamado **Super Admin** (superadmin). Este rol tiene acceso completo a todas las funcionalidades del sistema, incluyendo el panel administrativo de soporte, y solo usuarios con este rol pueden gestionar a otros super administradores.

## Jerarquía de Roles

```
📊 Jerarquía de Permisos (de mayor a menor):

1. 🔴 Super Admin (superadmin)
   - Acceso total al sistema
   - Único con acceso al Panel de Soporte Independiente
   - Puede crear/editar/eliminar otros super admins
   - Puede gestionar todos los roles inferiores
   - Protegido contra modificaciones por roles inferiores

2. 🟠 Administrador (admin)
   - Acceso al panel principal
   - Gestión de usuarios (excepto super admins)
   - No puede acceder al Panel de Soporte Independiente
   - No puede modificar super admins

3. 🟡 Supervisor (supervisor)
   - Supervisión de operaciones
   - Permisos limitados de gestión

4. 🔵 Agente (agent)
   - Operaciones básicas del call center
   - Sin permisos administrativos

5. 🟢 Doctor (doctor)
   - Acceso a funcionalidades médicas
   - Gestión de consultas

6. 🟣 Recepción (reception)
   - Gestión de citas y pacientes
   - Funciones de recepción
```

## Cambios en Base de Datos

### Migración Ejecutada
**Archivo**: `/backend/migrations/add_superadmin_role.sql`

```sql
-- Modificación del ENUM en la tabla users
ALTER TABLE users 
MODIFY COLUMN role ENUM('superadmin', 'admin', 'supervisor', 'agent', 'doctor', 'reception') 
NOT NULL DEFAULT 'agent';

-- Índice para optimizar búsquedas por rol
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
```

### Usuario Super Admin Creado
```
ID: 5
Nombre: Dave Bastidas
Email: bastidasdaveusa@gmail.com
Rol: superadmin
Estado: Activo
Fecha: 21/01/2026
```

## Protecciones Implementadas

### 🛡️ Backend (Node.js + TypeScript)

#### 1. Creación de Usuarios (`POST /api/users`)
```typescript
// Solo superadmin puede crear otros superadmin
if (role === 'superadmin' && authUser?.role !== 'superadmin') {
  return res.status(403).json({ 
    message: 'Solo un Super Admin puede crear otro Super Admin' 
  });
}
```

#### 2. Edición de Usuarios (`PUT /api/users/:id`)
```typescript
// Solo superadmin puede modificar a otro superadmin
if (oldUser?.role === 'superadmin' && authUser?.role !== 'superadmin') {
  return res.status(403).json({ 
    message: 'Solo un Super Admin puede modificar a otro Super Admin' 
  });
}

// Solo superadmin puede asignar el rol superadmin
if (role === 'superadmin' && authUser?.role !== 'superadmin') {
  return res.status(403).json({ 
    message: 'Solo un Super Admin puede asignar el rol de Super Admin' 
  });
}
```

#### 3. Eliminación de Usuarios (`DELETE /api/users/:id`)
```typescript
// Solo superadmin puede eliminar a otro superadmin
if (deletedUser?.role === 'superadmin' && authUser?.role !== 'superadmin') {
  return res.status(403).json({ 
    message: 'Solo un Super Admin puede eliminar a otro Super Admin' 
  });
}
```

#### 4. Validación en Schema Zod
```typescript
const userSchema = z.object({
  // ...otros campos
  role: z.enum(['superadmin', 'admin', 'supervisor', 'agent', 'doctor', 'reception']).default('agent'),
});
```

### 🎨 Frontend (React + TypeScript)

#### 1. Panel de Soporte Independiente
**Archivo**: `/frontend/src/pages/SupportPanelLogin.tsx`

```typescript
// Validación exclusiva para superadmin
if (data.data.role !== 'superadmin') {
  setError('Acceso denegado. Solo Super Administradores pueden acceder a este panel.');
  return;
}
```

**Acceso**: `https://biosanarcall.site/support-panel-login`

#### 2. Modal de Agregar Usuario
**Archivo**: `/frontend/src/components/AddUserModal.tsx`

- **Selector de rol dinámico**: Solo muestra opción "Super Admin" si el usuario actual es superadmin
- **Advertencia visual**: Muestra mensaje de alerta cuando se selecciona el rol superadmin

```tsx
{currentUserRole === 'superadmin' && (
  <SelectItem value="superadmin">Super Admin</SelectItem>
)}

{formData.role === 'superadmin' && (
  <p className="text-xs text-orange-600 mt-1">
    ⚠️ Este rol tiene acceso total al sistema
  </p>
)}
```

#### 3. Modal de Editar Usuario
**Archivo**: `/frontend/src/components/EditUserModal.tsx`

- **Bloqueo de campos**: Todos los campos deshabilitados si un admin intenta editar un superadmin
- **Alerta visual**: Mensaje de error prominente si no tiene permisos
- **Selector de rol protegido**: Solo superadmin puede ver/asignar el rol superadmin

```tsx
{user?.role === 'superadmin' && !isSuperAdmin && (
  <Alert variant="destructive">
    <ShieldAlert className="h-4 w-4" />
    <AlertDescription>
      No tienes permisos para editar un Super Administrador
    </AlertDescription>
  </Alert>
)}

<Input 
  disabled={user?.role === 'superadmin' && !isSuperAdmin}
  // ...
/>
```

#### 4. Tabla de Usuarios
**Archivo**: `/frontend/src/components/UserTable.tsx`

- **Icono distintivo**: Muestra escudo junto al nombre de super admins
- **Badge especial**: Gradiente naranja-rojo para el rol superadmin
- **Acciones deshabilitadas**: Editar/Eliminar deshabilitado para admins que no sean superadmin

```tsx
const isSuperAdmin = user.role === 'superadmin';
const canEdit = currentUserRole === 'superadmin' || !isSuperAdmin;

{isSuperAdmin && (
  <ShieldCheck className="h-4 w-4 text-orange-600" title="Super Administrador" />
)}

<Badge 
  variant={getRoleBadgeVariant(user.role)} 
  className={isSuperAdmin ? "bg-gradient-to-r from-orange-500 to-red-600" : ""}
>
  {getRoleLabel(user.role)}
</Badge>

<DropdownMenuItem disabled={!canEdit}>
  Editar / Eliminar
</DropdownMenuItem>
```

## Funcionalidades Exclusivas de Super Admin

### ✅ Acceso Completo

1. **Panel de Soporte Independiente**
   - URL: `/support-panel-login` → `/support-panel`
   - Gestión completa de tickets
   - Estadísticas en tiempo real
   - Cambio de estados
   - Respuestas a usuarios

2. **Gestión de Super Admins**
   - Crear nuevos super admins
   - Editar super admins existentes
   - Eliminar super admins
   - Ver todos los usuarios del sistema

3. **Gestión de Todos los Roles**
   - Crear/editar usuarios de cualquier rol
   - Cambiar roles (incluyendo asignar/quitar superadmin)
   - Eliminar cualquier usuario

### ❌ Restricciones para Roles Inferiores

1. **Admin y Roles Inferiores NO Pueden:**
   - Acceder al Panel de Soporte Independiente
   - Ver super admins en selectores de rol
   - Editar datos de super admins
   - Eliminar super admins
   - Asignar el rol superadmin a otros usuarios
   - Crear nuevos super admins

## Flujos de Usuario

### Flujo 1: Admin Intenta Editar Super Admin

```
1. Admin hace clic en "Editar" de un super admin
2. Modal se abre pero todos los campos están deshabilitados
3. Aparece alerta roja: "No tienes permisos para editar un Super Administrador"
4. Botón "Guardar Cambios" está deshabilitado
5. Solo puede cerrar el modal
```

### Flujo 2: Super Admin Gestiona Usuarios

```
1. Super Admin accede a Configuración → Usuarios
2. Ve TODOS los usuarios incluyendo otros super admins
3. Puede crear nuevo usuario con rol "Super Admin" disponible
4. Puede editar cualquier usuario (incluyendo super admins)
5. Puede eliminar cualquier usuario
6. Ve icono de escudo (🛡️) junto a nombres de super admins
```

### Flujo 3: Acceso al Panel de Soporte

```
Usuario Admin:
1. Navega a /support-panel-login
2. Ingresa credenciales correctas
3. Sistema valida: role !== 'superadmin'
4. Muestra error: "Acceso denegado. Solo Super Administradores..."
5. No puede acceder

Usuario Super Admin:
1. Navega a /support-panel-login
2. Ingresa credenciales correctas
3. Sistema valida: role === 'superadmin' ✓
4. Redirección a /support-panel
5. Acceso completo al dashboard de soporte
```

## Visualización en UI

### Badges de Rol

| Rol | Color | Clase CSS |
|-----|-------|-----------|
| Super Admin | Gradiente Naranja-Rojo | `bg-gradient-to-r from-orange-500 to-red-600` |
| Administrador | Rojo | `variant="destructive"` |
| Supervisor | Azul | `variant="default"` |
| Agente | Gris | `variant="secondary"` |
| Doctor | Azul | `variant="default"` |
| Recepción | Outline | `variant="outline"` |

### Iconos Especiales

- **ShieldCheck** (🛡️): Aparece junto al nombre de super admins en la tabla
- **ShieldAlert** (⚠️): Aparece en alertas de restricción de permisos

## Seguridad

### Validaciones en Múltiples Capas

1. **Base de Datos**: ENUM con valores permitidos
2. **Backend**: Validación Zod + lógica de permisos
3. **Frontend**: Decodificación de JWT + UI condicional
4. **API**: Respuestas HTTP 403 Forbidden

### Tokens JWT

El token incluye el campo `role`:
```json
{
  "id": 5,
  "email": "bastidasdaveusa@gmail.com",
  "role": "superadmin",
  "iat": 1737497123,
  "exp": 1737583523
}
```

Frontend decodifica con `jwt-decode`:
```typescript
const decoded: any = jwtDecode(token);
const currentUserRole = decoded.role;
const isSuperAdmin = currentUserRole === 'superadmin';
```

## Archivos Modificados

### Backend
```
/backend/migrations/add_superadmin_role.sql       - Migración SQL
/backend/src/routes/users.ts                      - Protecciones CRUD
/backend/src/routes/support.ts                    - Validación acceso (ya existía)
```

### Frontend
```
/frontend/src/pages/SupportPanelLogin.tsx         - Validación superadmin
/frontend/src/components/AddUserModal.tsx         - Selector rol condicional
/frontend/src/components/EditUserModal.tsx        - Protección edición
/frontend/src/components/UserTable.tsx            - UI distintiva + acciones
```

### Instalaciones
```bash
npm install jwt-decode    # Frontend - decodificación tokens
```

## Testing

### Casos de Prueba Validados

✅ **Super Admin puede:**
- Crear otro super admin
- Editar super admins existentes
- Eliminar super admins
- Acceder al panel de soporte

✅ **Admin NO puede:**
- Ver opción "Super Admin" en selector de rol
- Editar campos de un super admin (deshabilitados)
- Eliminar un super admin (acción deshabilitada)
- Acceder al panel de soporte (error en login)

✅ **Backend rechaza:**
- Creación de superadmin por admin (403)
- Edición de superadmin por admin (403)
- Eliminación de superadmin por admin (403)

## Comandos de Verificación

```bash
# Ver usuarios y sus roles
mysql -u root -p'Biosanar_IPS@2025' biosanar -e "SELECT id, name, email, role FROM users;"

# Ver estructura de la tabla users
mysql -u root -p'Biosanar_IPS@2025' biosanar -e "DESCRIBE users;"

# Contar usuarios por rol
mysql -u root -p'Biosanar_IPS@2025' biosanar -e "SELECT role, COUNT(*) as total FROM users GROUP BY role;"

# Ver solo super admins
mysql -u root -p'Biosanar_IPS@2025' biosanar -e "SELECT * FROM users WHERE role = 'superadmin';"
```

## Próximos Pasos Sugeridos

1. **Auditoría de Acciones**: Registrar en `audit_logs` cuando se intenta acceso no autorizado
2. **Notificaciones**: Alertar a super admins cuando se crea/modifica otro super admin
3. **Límite de Super Admins**: Considerar límite máximo (ej: 3 super admins)
4. **Doble Factor**: Implementar 2FA obligatorio para super admins
5. **Sesiones Específicas**: Timeout más corto para sesiones de super admin

## Notas Importantes

⚠️ **CRÍTICO**: El rol superadmin tiene acceso sin restricciones. Asignar solo a personal de máxima confianza.

🔒 **SEGURIDAD**: Las contraseñas de super admins deben ser extremadamente robustas (min 12 caracteres, mayúsculas, minúsculas, números, símbolos).

📝 **AUDITORÍA**: Todas las acciones de super admins quedan registradas en el sistema de auditoría.

🚫 **NO COMPARTIR**: Las credenciales de super admin no deben compartirse nunca.

---

**Implementado por**: GitHub Copilot  
**Fecha**: 21 de enero de 2026  
**Versión del sistema**: 1.0.0  
**Estado**: ✅ Producción
