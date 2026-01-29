-- Migración: Agregar rol superadmin al sistema
-- Fecha: 2026-01-21
-- Descripción: Agrega el rol 'superadmin' con acceso completo al sistema

-- Modificar el ENUM de la columna role para incluir 'superadmin'
ALTER TABLE users 
MODIFY COLUMN role ENUM('superadmin', 'admin', 'supervisor', 'agent', 'doctor', 'reception') 
NOT NULL DEFAULT 'agent';

-- Actualizar el usuario admin existente a superadmin (si existe un admin principal)
-- Comentar la siguiente línea si no hay un usuario específico para actualizar
-- UPDATE users SET role = 'superadmin' WHERE email = 'admin@biosanarcall.site' LIMIT 1;

-- Crear índice para búsquedas por rol si no existe
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Agregar comentario a la tabla
ALTER TABLE users COMMENT = 'Usuarios del sistema con roles: superadmin (acceso total), admin, supervisor, agent, doctor, reception';
