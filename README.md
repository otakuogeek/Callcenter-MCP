# Sistema Médico Biosanarcall

## 🏥 Descripción General

**Biosanarcall** es un sistema integral de gestión médica desarrollado para la **Fundación Biosanar IPS**. Permite la administración completa de citas médicas, pacientes, comunicaciones y gestión de agendas médicas.

## 🚀 Características Principales

### Gestión de Citas
- Agendamiento de citas por especialidad, médico y sede
- Cola de espera inteligente con prioridades
- Recordatorios automáticos por SMS
- Sistema de citas dobles para procedimientos extensos
- Cancelación y reasignación automática

### Comunicación
- **SMS Masivos**: Notificaciones de recordatorio a pacientes
- **SMS Personalizados**: Envío de mensajes personalizados a grupos
- **WhatsApp Bot**: Atención automatizada 24/7
- **Llamadas Automatizadas**: Integración con ElevenLabs para confirmaciones

### Portal de Pacientes
- Consulta de citas programadas
- Historial de atenciones
- Acceso a lista de espera
- Autogestión de datos personales

### Portal de Doctores
- Gestión de agenda personal
- Visualización de pacientes del día
- Sistema de pausas para agendas
- Historias clínicas integradas

### Administración
- Dashboard de analytics
- Gestión de especialidades y sedes
- Auditoría completa de acciones
- Reportes de distribución de citas

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **UI** | shadcn/ui + Tailwind CSS |
| **Backend** | Node.js + Express + TypeScript |
| **Base de Datos** | MySQL 8.0 |
| **SMS** | LabsMobile API |
| **Llamadas** | ElevenLabs Conversational AI |
| **WhatsApp** | whatsapp-web.js |
| **MCP Server** | Python + Node.js (AI Integration) |

## 📁 Estructura del Proyecto

```
/home/ubuntu/app/
├── frontend/           # Aplicación React
│   ├── src/
│   │   ├── components/ # Componentes reutilizables
│   │   ├── pages/      # Páginas de la aplicación
│   │   ├── hooks/      # Custom hooks
│   │   └── lib/        # Utilidades y API client
│   └── dist/           # Build de producción
│
├── backend/            # API REST Node.js
│   ├── src/
│   │   ├── routes/     # Endpoints de la API
│   │   ├── services/   # Lógica de negocio
│   │   └── db/         # Conexión a base de datos
│   └── docs/           # Documentación técnica
│
├── mcp-server-node/    # Servidor MCP para agentes AI
└── docs/               # Documentación general
```

## 🔧 Configuración

### Variables de Entorno Backend
```env
DB_HOST=localhost
DB_USER=biosanar_user
DB_NAME=biosanar
JWT_SECRET=your_secret
CORS_ORIGINS=https://biosanarcall.site
LABSMOBILE_USERNAME=contacto@biosanarcall.site
LABSMOBILE_PASSWORD=your_api_key
ELEVENLABS_API_KEY=your_key
```

### Comandos Principales

```bash
# Backend
cd backend && npm run dev      # Desarrollo
cd backend && npm run build    # Compilar
pm2 restart cita-central-backend  # Reiniciar producción

# Frontend
cd frontend && npm run dev     # Desarrollo (puerto 8080)
cd frontend && npm run build   # Build producción
```

## 📊 Estadísticas del Sistema

- **+39,000** pacientes registrados
- **+4,000** SMS enviados
- **6,000+** números compartidos entre pacientes
- **Múltiples sedes** y especialidades

## 🔐 Seguridad

- Autenticación JWT con tokens seguros
- CORS configurado por dominio
- Rate limiting en endpoints críticos
- Helmet.js para headers de seguridad
- Auditoría de todas las acciones

## 📞 Soporte

**Fundación Biosanar IPS**
- Web: https://biosanarcall.site
- Sistema de soporte integrado en la aplicación

---

*Última actualización: Enero 2026*
