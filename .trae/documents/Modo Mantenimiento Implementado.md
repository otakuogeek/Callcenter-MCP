# Implementación de Modo Mantenimiento

He implementado la funcionalidad completa de "Modo Mantenimiento" solicitada.

## 1. Backend
*   **Base de Datos:** Se agregó la columna `maintenance_mode` (TINYINT) a la tabla `system_settings`.
*   **API Privada:** Se actualizó el endpoint `PUT /settings` para permitir a los administradores activar/desactivar este modo.
*   **API Pública:** Se creó un nuevo endpoint `GET /public/maintenance-status` accesible sin autenticación, para que el portal de pacientes pueda verificar el estado antes de cargar.

## 2. Frontend (Administración)
*   **Sidebar:** Se agregó un interruptor (Switch) en la parte inferior del menú lateral (Sidebar).
    *   Este control permite activar/desactivar el modo mantenimiento en tiempo real.
    *   Muestra notificaciones visuales (Toast) al cambiar el estado.

## 3. Frontend (Portal de Pacientes)
*   **Bloqueo de Acceso:** Se creó un componente `UserPortalWrapper` en `App.tsx`.
    *   Este wrapper verifica el estado de mantenimiento al cargar la página raíz (`/`).
    *   Si el modo mantenimiento está **activo**, redirige a una nueva pantalla de bloqueo.
*   **Página de Mantenimiento:** Se creó el componente `MaintenancePage.tsx` con un diseño amigable, informando a los usuarios que el sistema está en mejoras y sugiriendo alternativas de contacto.

El sistema ya está actualizado y listo para usar. Puede encontrar el interruptor "Mantenimiento" en la barra lateral de su panel administrativo.
