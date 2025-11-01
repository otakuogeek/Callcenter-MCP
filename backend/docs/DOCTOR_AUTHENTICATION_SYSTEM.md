# Sistema de Autenticación para Doctores - Biosan Arcall

## 🎯 Resumen

Se ha implementado un sistema completo de autenticación para doctores con las siguientes características:

### ✅ Funcionalidades Implementadas

1. **Autenticación segura con JWT**
   - Login con email y contraseña
   - Tokens JWT con expiración de 2 días
   - Sesiones almacenadas en base de datos

2. **Seguridad**
   - Contraseñas hasheadas con bcrypt (10 salt rounds)
   - Bloqueo automático después de 5 intentos fallidos (30 minutos)
   - Auditoría completa de todos los intentos de login
   - Validación de sesiones activas

3. **Gestión de Contraseñas**
   - Generación automática de contraseñas seguras
   - Cambio de contraseña desde el dashboard
   - Reset de contraseñas por administradores
   - Validación de complejidad (mínimo 8 caracteres)

4. **Administración**
   - Panel de gestión de doctores (solo admin)
   - Historial de logins
   - Visualización de sesiones activas
   - Cierre forzado de sesiones

---

## 📋 Credenciales de Acceso

### Portal de Login: https://biosanarcall.site/doctor-login

| # | Doctor | Email | Contraseña Temporal |
|---|--------|-------|---------------------|
| 1 | Oscar Calderon | oscarandrescalderon19@gmail.com | `B9rj&53S7bFZ` |
| 2 | Dra. Yesika Andrea fiallo | yesika.fiallo@biosanarcall.site | `wjj5z9dUK&!E` |
| 3 | Ana Teresa Escobar | ana.escobar@biosanarcall.site | `Rg@DIql7*AYG` |
| 4 | Dra. Valentina Abaunza Ballesteros | valentina.abaunza@biosanarcall.site | `GVcMF@I87cD3` |
| 5 | Dr. Carlos Rafael Almira | carlos.almira@biosanarcall.site | `#Xvqgu4Mp&$f` |
| 6 | Dra. Claudia Sierra | claudia.sierra@biosanarcall.site | `4clEXx&3ccEX` |
| 7 | Dr. Andres Romero | andres.romero@biosanarcall.site | `kU%&M!J29Tgt` |
| 8 | Dra. Gina Cristina Castillo Gonzalez | gina.castillo@biosanarcall.site | `Tg&8R8wQMi9v` |
| 9 | Dr. Alexander Rugeles | alexander.rugeles@biosanarcall.site | `e5DaEi7&66gA` |
| 10 | Dr. Erwin Alirio Vargas Ariza | erwin.vargas@biosanarcall.site | `l71ZH6VmQDe!` |
| 11 | Dr. Calixto Escorcia Angulo | calixto.escorcia@biosanarcall.site | `oR*cgy1o0iaU` |
| 12 | Dr. Nestor Motta | nestor.motta@biosanarcall.site | `uEA%T$YmglV0` |
| 13 | Dra. Laura Julia Podeva | laura.podeva@biosanarcall.site | `3gea$yAW*qcm` |
| 14 | Dra. Luis Fernada Garrido Castillo | luis.garrido@biosanarcall.site | `1Oi9%sm!0hoI` |
| 15 | Demo Cardiologo | demo.cardiologo@biosanarcall.site | `WFd5GEk0HBZ#` |

---

## 🔌 API Endpoints

### Autenticación de Doctores

#### 1. Login
```http
POST /api/doctor-auth/login
Content-Type: application/json

{
  "email": "doctor@biosanarcall.site",
  "password": "su_contraseña"
}
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "doctor": {
      "id": 5,
      "name": "Dra. Yesika Andrea fiallo",
      "email": "yesika.fiallo@biosanarcall.site",
      "phone": "3145464569",
      "license_number": "m000"
    }
  }
}
```

#### 2. Obtener Información del Doctor Autenticado
```http
GET /api/doctor-auth/me
Authorization: Bearer {token}
```

#### 3. Cambiar Contraseña
```http
POST /api/doctor-auth/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPassword": "contraseña_actual",
  "newPassword": "nueva_contraseña_segura"
}
```

#### 4. Logout
```http
POST /api/doctor-auth/logout
Authorization: Bearer {token}
```

### Gestión de Doctores (Solo Admin)

#### 1. Listar Doctores
```http
GET /api/doctor-management
Authorization: Bearer {admin_token}
```

#### 2. Establecer Contraseña
```http
POST /api/doctor-management/:id/set-password
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "password": "nueva_contraseña"
}
```

#### 3. Generar Contraseña Aleatoria
```http
POST /api/doctor-management/:id/generate-password
Authorization: Bearer {admin_token}
```

#### 4. Resetear Contraseña y Desbloquear Cuenta
```http
POST /api/doctor-management/:id/reset-password
Authorization: Bearer {admin_token}
```

#### 5. Ver Historial de Login
```http
GET /api/doctor-management/:id/login-history?limit=50
Authorization: Bearer {admin_token}
```

#### 6. Ver Sesiones Activas
```http
GET /api/doctor-management/:id/active-sessions
Authorization: Bearer {admin_token}
```

#### 7. Cerrar Todas las Sesiones
```http
DELETE /api/doctor-management/:id/sessions
Authorization: Bearer {admin_token}
```

---

## 🗄️ Estructura de Base de Datos

### Tabla: `doctors` (modificada)
```sql
ALTER TABLE `doctors` ADD (
  `password_hash` VARCHAR(255) NULL,
  `last_login` TIMESTAMP NULL,
  `reset_token` VARCHAR(255) NULL,
  `reset_token_expires` TIMESTAMP NULL,
  `login_attempts` INT DEFAULT 0,
  `locked_until` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Tabla: `doctor_sessions` (nueva)
```sql
CREATE TABLE `doctor_sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `doctor_id` BIGINT UNSIGNED NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_session_token` (`token`),
  KEY `idx_doctor_id` (`doctor_id`),
  CONSTRAINT `fk_doctor_sessions_doctor` 
    FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE CASCADE
);
```

### Tabla: `doctor_login_audit` (nueva)
```sql
CREATE TABLE `doctor_login_audit` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `doctor_id` BIGINT UNSIGNED NULL,
  `email` VARCHAR(150) NOT NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 0,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `failure_reason` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_doctor_id` (`doctor_id`),
  KEY `idx_email` (`email`),
  KEY `idx_created_at` (`created_at`)
);
```

---

## 📝 Notas Importantes

1. **Primer Login**: Cada doctor debe cambiar su contraseña temporal en el primer acceso
2. **Bloqueo de Cuenta**: Después de 5 intentos fallidos, la cuenta se bloquea por 30 minutos
3. **Expiración de Sesión**: Las sesiones expiran después de 2 días de inactividad
4. **Seguridad**: Todas las contraseñas se almacenan hasheadas con bcrypt (10 rounds)
5. **Auditoría**: Todos los intentos de login (exitosos y fallidos) se registran en `doctor_login_audit`

---

## 🚀 Próximos Pasos

### Frontend (Pendiente de Implementación)

1. **Página de Login para Doctores** (`/doctor-login`)
   - Formulario de login con email y contraseña
   - Manejo de errores y bloqueo de cuenta
   - Redirección al dashboard después del login

2. **Dashboard de Doctores** (`/doctor-dashboard`)
   - Vista de citas asignadas
   - Calendario de disponibilidad
   - Estadísticas personales
   - Cambio de contraseña

3. **Panel de Administración** (en dashboard admin existente)
   - Gestión de contraseñas de doctores
   - Visualización de sesiones activas
   - Historial de accesos
   - Bloqueo/desbloqueo de cuentas

---

## 🔧 Comandos Útiles

```bash
# Generar nuevas contraseñas para doctores
cd /home/ubuntu/app/backend
npm run doctors:init-passwords

# Reiniciar backend
pm2 restart cita-central-backend

# Ver logs del backend
pm2 logs cita-central-backend

# Verificar estado del backend
pm2 status
```

---

## 📞 Soporte

Para cualquier problema con el sistema de autenticación de doctores, contactar al administrador del sistema.

**Fecha de Implementación**: 26 de Octubre, 2025  
**Versión**: 1.0.0
