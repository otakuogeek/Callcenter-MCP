# Biosanarcall MCP Server Python

Servidor MCP (Model Context Protocol) en Python para integración con agentes de IA y herramientas de voz como ElevenLabs.

## 🚀 Configuración Rápida

### Instalación Local
```bash
# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install fastapi uvicorn pydantic==2.5.0 httpx

# Configurar variables de entorno (opcional)
export BACKEND_BASE="http://127.0.0.1:4000/api"
export BACKEND_TOKEN="tu_jwt_token_aqui"
export MCP_API_KEY="clave_secreta_opcional"

# Ejecutar servidor
python main.py
```

### URLs de Producción
- **Completo**: `https://biosanarcall.site/mcp-py` (24 herramientas)
- **Simplificado**: `https://biosanarcall.site/mcp-py-simple` (9 herramientas)
- **ElevenLabs**: `https://biosanarcall.site/elevenlabs` (2 herramientas)
- **Health Check**: `https://biosanarcall.site/mcp-py-health`

## 📋 Configuración para Clientes MCP

### ElevenLabs Agent Configuration
```yaml
name: "Biosanarcall MCP Simple"
description: "Conjunto reducido optimizado para voz (citas, pacientes, resumen diario)"
server_type: "Streamable HTTP"
server_url: "https://biosanarcall.site/mcp-py-simple"
secret_token: ""  # Opcional si usas MCP_API_KEY
```

## 🔧 Códigos de Prueba JSON-RPC

### 1. Inicialización
```bash
curl -X POST https://biosanarcall.site/mcp-py-simple \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize"
  }'
```

### 2. Listar Herramientas
```bash
curl -X POST https://biosanarcall.site/mcp-py-simple \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'
```

### 3. Resumen de Citas del Día (Optimizado para Voz)
```bash
curl -X POST https://biosanarcall.site/mcp-py-simple \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "summarizeDayAppointments",
      "arguments": {
        "date": "2025-08-19"
      }
    }
  }'
```

### Local (testing)
- **Health**: `http://127.0.0.1:8975/health`
- **MCP Full**: `http://127.0.0.1:8975/mcp`
- **MCP Simple**: `http://127.0.0.1:8975/mcp-simple`

## Herramientas Disponibles

### Versión Completa (20+ herramientas)
- Gestión de Pacientes (4 herramientas)
- Gestión de Doctores (3 herramientas)
- Especialidades Médicas (2 herramientas)
- Gestión de Citas (4 herramientas)
- Disponibilidades (2 herramientas)
- Gestión de Sedes (2 herramientas)
- Analytics y Reportes (3 herramientas)

### Versión Simple (4 herramientas)
- `searchPatients` - Buscar pacientes
- `getSpecialties` - Listar especialidades
- `getDoctors` - Listar doctores
- `getAppointments` - Listar citas

## Configuración en ElevenLabs

### Para versión completa:
```
Name: Biosanarcall Medical Python
Server type: Streamable HTTP
Server URL: https://biosanarcall.site/mcp-py
Secret Token: [VACÍO]
```

### Para versión simple (testing):
```
Name: Biosanarcall Medical Python Simple
Server type: Streamable HTTP
Server URL: https://biosanarcall.site/mcp-py-simple
Secret Token: [VACÍO]
```

## Ventajas sobre Node.js

1. **Más rápido**: FastAPI es más eficiente que Express
2. **Menos dependencias**: Código más limpio
3. **Mejor documentación**: FastAPI genera docs automáticas
4. **Menor consumo de memoria**: Python suele ser más eficiente para APIs simples
5. **Respuestas más rápidas**: Menos overhead de procesamiento

## Testing

```bash
# Test básico
curl http://127.0.0.1:8975/health

# Test MCP initialize
curl -X POST http://127.0.0.1:8975/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"Test","version":"1.0.0"}}}'

# Test tools list (versión simple)
curl -X POST http://127.0.0.1:8975/mcp-simple \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

## PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'mcp-server-python',
    script: 'main.py',
    interpreter: 'python3',
    cwd: '/home/ubuntu/app/mcp-server-python',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      PORT: '8975'
    }
  }]
}
```

## Logs y Debugging

```bash
# Si usa PM2
pm2 logs mcp-server-python

# Si ejecuta directamente
python main.py
```
