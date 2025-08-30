# Callcenter-MCP

Sistema de Call Center integrado con MCP (Model Context Protocol) para Biosanarcall Medical System.

## 🏥 Descripción

Sistema médico completo que incluye:
- **Backend**: Node.js + Express + TypeScript + MySQL
- **Frontend**: React 18 + TypeScript + Vite + shadcn/ui
- **MCP Servers**: Python y Node.js para integración con agentes AI

## 🚀 Características

- ✅ Gestión modular de pacientes (6 componentes especializados)
- ✅ Sistema de citas médicas
- ✅ Integración con ElevenLabs para llamadas
- ✅ Dashboard de análisis y métricas
- ✅ Autenticación JWT segura
- ✅ API REST completa
- ✅ Interfaz responsive moderna

## 📋 Tecnologías

### Backend
- Node.js + Express + TypeScript
- MySQL 8+ con migraciones
- JWT Authentication
- PM2 para producción
- Zod para validación

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- shadcn/ui + Radix UI
- Tailwind CSS
- TanStack Query
- React Hook Form

### MCP Integration
- Python MCP Server (24 herramientas médicas)
- Node.js MCP Server (alternativo)
- JSON-RPC 2.0 protocol

## 🛠️ Instalación

### Backend
```bash
cd backend
npm install
npm run db:init
npm run db:seed
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### MCP Servers
```bash
# Python MCP
cd mcp-server-python
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py

# Node.js MCP
cd mcp-server-node
npm install
npm run dev
```

## 🌐 Despliegue

- **Producción**: `https://biosanarcall.site`
- **Backend**: Puerto 4000 (PM2)
- **Frontend**: Nginx static files
- **MCP**: Endpoints separados

## 📚 Documentación

- `/backend/README.md` - Documentación del backend
- `/frontend/src/components/patient-management/README.md` - Sistema modular de pacientes
- `/mcp-server-*/` - Documentación de servidores MCP

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

Proyecto privado - Biosanarcall Medical System

---

*Desarrollado con ❤️ para mejorar la atención médica*
