# Panel de Soporte Independiente

## Descripción

Sistema de administración de soporte técnico completamente independiente del panel principal de administración. Diseñado para super administradores que necesitan gestionar tickets de soporte sin navegar por el sistema principal.

## Características

### 🎯 Sistema Independiente
- **Acceso separado**: URL dedicada sin interferencia con el panel principal
- **Login propio**: Autenticación específica para administradores
- **Sin sidebar**: Interfaz limpia enfocada solo en soporte
- **Navegación directa**: Volver al sistema principal o cerrar sesión

### 📊 Dashboard Completo
- **Estadísticas en tiempo real**:
  - Total de tickets
  - Tickets activos (abiertos + en progreso)
  - Tickets urgentes
  - Tickets completados (resueltos + cerrados)

- **Filtros avanzados**:
  - Por estado (Abierto, En Progreso, Resuelto, Cerrado, Reabierto)
  - Por prioridad (Urgente, Alta, Normal, Baja)
  - Por categoría (Técnico, Agendamiento, Facturación, Otro)

- **Visualización de tickets**:
  - Listado con códigos únicos (#TKT-XXXXX)
  - Badges de estado y prioridad
  - Contador de mensajes
  - Indicador de tickets reabiertos
  - Información del usuario creador
  - Timestamp de creación

### 💬 Gestión de Conversaciones
- **Vista detallada del ticket**:
  - Historial completo de mensajes
  - Distinción visual entre mensajes de usuarios y admins
  - Timestamps en zona horaria UTC-0
  - Respuesta rápida desde el panel

- **Gestión de estados**:
  - Cambio inmediato de estado
  - Tracking de veces reabierto
  - Actualización automática de estadísticas

### 👥 Información del Usuario
- Nombre completo
- Email de contacto
- Fecha de creación del ticket
- Última actualización
- Historial de reaperturas

## Acceso al Sistema

### URL de Acceso
```
https://biosanarcall.site/support-panel-login
```

### Credenciales
Solo usuarios con rol `admin` o `superadmin` pueden acceder.

```
Email: [email de administrador]
Contraseña: [contraseña del administrador]
```

## Flujo de Uso

### 1. Login
1. Navegar a `/support-panel-login`
2. Ingresar credenciales de administrador
3. El sistema valida que sea admin/superadmin
4. Redirección automática a `/support-panel`

### 2. Dashboard Principal
- Ver estadísticas generales
- Aplicar filtros según necesidad
- Click en cualquier ticket para ver detalles

### 3. Gestión de Ticket
- Leer historial de mensajes
- Responder al usuario
- Cambiar estado del ticket
- Ver información completa

### 4. Navegación
- **Volver al Sistema**: Regresa al panel principal (`/admin`)
- **Salir**: Cierra sesión completamente

## Diferencias con el Panel Integrado

| Característica | Panel Integrado | Panel Independiente |
|----------------|-----------------|---------------------|
| Acceso | Desde sidebar del admin | URL dedicada con login |
| Navegación | Sidebar completo | Header minimalista |
| Enfoque | Multi-propósito | Solo soporte |
| Distracción | Múltiples opciones | Cero distracciones |
| Ideal para | Uso general | Soporte exclusivo |

## API Endpoints Utilizados

```typescript
GET  /api/support/stats                    // Estadísticas
GET  /api/support/tickets?filters          // Lista de tickets
GET  /api/support/tickets/:id              // Detalle + mensajes
POST /api/support/tickets/:id/messages     // Enviar mensaje
PATCH /api/support/tickets/:id/status      // Actualizar estado
```

## Estructura de Archivos

```
frontend/src/pages/
├── SupportPanelLogin.tsx    # Login independiente
└── SupportPanel.tsx         # Dashboard principal

frontend/src/App.tsx         # Rutas configuradas
```

## Rutas Configuradas

```tsx
// Login del panel
/support-panel-login → SupportPanelLogin

// Dashboard del panel
/support-panel → SupportPanel (requiere auth)
```

## Ventajas

✅ **Cero interferencia**: No afecta el sistema principal  
✅ **Especializado**: Diseñado solo para soporte  
✅ **Rápido**: Carga solo lo necesario  
✅ **Seguro**: Validación de rol en login  
✅ **Independiente**: Puede usarse sin acceder al admin principal  

## Notas Técnicas

- **Autenticación**: Usa el mismo sistema JWT que el panel principal
- **Validación**: Verifica rol admin/superadmin en login
- **Estado**: Usa React state local (no redux/zustand)
- **Tiempo**: Todas las fechas en UTC-0 con date-fns-tz
- **Responsive**: Diseño adaptable a móviles y tablets

## Próximas Mejoras Sugeridas

- [ ] Notificaciones push de nuevos tickets
- [ ] Asignación de tickets a agentes específicos
- [ ] Prioridad automática basada en palabras clave
- [ ] Plantillas de respuesta rápida
- [ ] Exportación de reportes en PDF
- [ ] Métricas de tiempo de resolución
- [ ] Sistema de etiquetas/tags
- [ ] Búsqueda full-text en mensajes

## Soporte

Para problemas o sugerencias sobre este panel, crear un ticket en el sistema principal con categoría "Técnico".

---

**Última actualización**: 21 de enero de 2026  
**Versión**: 1.0.0  
**Desarrollado para**: Fundación Biosanar IPS
