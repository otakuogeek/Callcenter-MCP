# Guía de Testing y Configuración MCP Biosanarcall

## Scripts de Testing

### 1. Test de Conexión Básica
```bash
#!/bin/bash
# test-connection.sh

echo "=== Test de Conexión MCP Biosanarcall ==="

# Test local
echo "1. Testing Local Health Check..."
curl -s "http://localhost:8977/health" | jq '.'

# Test remoto
echo -e "\n2. Testing Remote Health Check..."
curl -s "https://biosanarcall.site/health" | jq '.'

# Test MCP tools/list
echo -e "\n3. Testing MCP Tools List..."
curl -s -X POST "https://biosanarcall.site/mcp-inspector" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mcp-key-biosanarcall-2025" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }' | jq '.result.tools | length'

echo "Tools available"
```

### 2. Test de Creación de Paciente
```bash
#!/bin/bash
# test-create-patient.sh

TIMESTAMP=$(date +%Y%m%d%H%M%S)
DOCUMENT="TEST$TIMESTAMP"

echo "=== Test Creación de Paciente ==="
echo "Documento: $DOCUMENT"

# Obtener tipos de documento
echo "1. Obteniendo tipos de documento..."
curl -s -X POST "https://biosanarcall.site/mcp-inspector" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mcp-key-biosanarcall-2025" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "getDocumentTypes",
      "arguments": {}
    }
  }' | jq '.result.content[0].text | fromjson'

# Crear paciente
echo -e "\n2. Creando paciente..."
RESPONSE=$(curl -s -X POST "https://biosanarcall.site/mcp-inspector" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mcp-key-biosanarcall-2025" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "createPatient",
      "arguments": {
        "document": "'$DOCUMENT'",
        "document_type_id": 1,
        "name": "Paciente Prueba MCP",
        "phone": "3001234567",
        "email": "prueba@test.com",
        "birth_date": "1990-01-01",
        "gender": "Masculino",
        "address": "Calle Prueba 123",
        "municipality_id": 14,
        "insurance_eps_id": 12,
        "insurance_affiliation_type": "Contributivo",
        "blood_group_id": 1,
        "population_group_id": 1,
        "education_level_id": 3,
        "marital_status_id": 1,
        "estrato": 3
      }
    }
  }')

echo $RESPONSE | jq '.'

# Extraer ID del paciente creado
PATIENT_ID=$(echo $RESPONSE | jq -r '.result.content[0].text | fromjson | .id')
echo -e "\nPaciente creado con ID: $PATIENT_ID"
```

### 3. Test de Flujo Completo
```bash
#!/bin/bash
# test-complete-flow.sh

echo "=== Test de Flujo Completo ==="

# 1. Buscar pacientes existentes
echo "1. Buscando pacientes..."
curl -s -X POST "https://biosanarcall.site/mcp-inspector" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mcp-key-biosanarcall-2025" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "searchPatients",
      "arguments": {
        "q": "Juan",
        "limit": 3
      }
    }
  }' | jq '.result.content[0].text | fromjson'

# 2. Obtener médicos disponibles
echo -e "\n2. Obteniendo médicos..."
curl -s -X POST "https://biosanarcall.site/mcp-inspector" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mcp-key-biosanarcall-2025" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "getDoctors",
      "arguments": {}
    }
  }' | jq '.result.content[0].text | fromjson'

# 3. Obtener citas del día
echo -e "\n3. Obteniendo citas de hoy..."
TODAY=$(date +%Y-%m-%d)
curl -s -X POST "https://biosanarcall.site/mcp-inspector" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mcp-key-biosanarcall-2025" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "getAppointments",
      "arguments": {
        "date": "'$TODAY'"
      }
    }
  }' | jq '.result.content[0].text | fromjson'
```

## Configuraciones de Cliente MCP

### 1. Claude Desktop (cline.json)
```json
{
  "mcpServers": {
    "biosanarcall-ips": {
      "command": "node",
      "args": ["-e", "
        const http = require('http');
        const url = 'https://biosanarcall.site/mcp-inspector';
        const apiKey = 'mcp-key-biosanarcall-2025';
        
        process.stdin.on('data', (data) => {
          const options = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': apiKey
            }
          };
          
          const req = http.request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => process.stdout.write(body));
          });
          
          req.write(data);
          req.end();
        });
      "],
      "env": {
        "MCP_SERVER_URL": "https://biosanarcall.site/mcp-inspector",
        "MCP_API_KEY": "mcp-key-biosanarcall-2025"
      }
    }
  }
}
```

### 2. VS Code MCP Extension
```json
{
  "mcp.servers": [
    {
      "name": "Biosanarcall IPS",
      "transport": {
        "type": "http",
        "url": "https://biosanarcall.site/mcp-inspector",
        "headers": {
          "Content-Type": "application/json",
          "X-API-Key": "mcp-key-biosanarcall-2025"
        }
      },
      "capabilities": {
        "tools": true,
        "resources": false,
        "prompts": false
      }
    }
  ]
}
```

### 3. MCP Inspector Direct Config
```json
{
  "servers": [
    {
      "name": "Biosanarcall",
      "url": "https://biosanarcall.site/mcp-inspector",
      "headers": {
        "X-API-Key": "mcp-key-biosanarcall-2025"
      },
      "description": "Sistema médico Biosanarcall IPS con 26 herramientas"
    }
  ]
}
```

## Comandos de Administración

### PM2 Management
```bash
# Ver estado detallado
pm2 show mcp-server-node

# Reiniciar con nuevas variables
pm2 restart mcp-server-node --update-env

# Ver métricas en tiempo real
pm2 monit

# Guardar configuración actual
pm2 save

# Configurar inicio automático
pm2 startup
pm2 save
```

### Nginx Management
```bash
# Verificar configuración
nginx -t

# Recargar configuración
nginx -s reload

# Ver logs de acceso
tail -f /var/log/nginx/access.log | grep mcp-inspector

# Ver logs de error
tail -f /var/log/nginx/error.log
```

### Database Maintenance
```bash
# Backup
mysqldump -u biosanar_user -p biosanar > backup_$(date +%Y%m%d).sql

# Ver estadísticas de tablas
mysql -u biosanar_user -p -e "
SELECT 
  table_name,
  table_rows,
  ROUND(data_length/1024/1024, 2) as 'Size (MB)'
FROM information_schema.tables 
WHERE table_schema = 'biosanar'
ORDER BY data_length DESC;"

# Verificar integridad de datos
mysql -u biosanar_user -p biosanar -e "
SELECT 
  (SELECT COUNT(*) FROM patients) as total_patients,
  (SELECT COUNT(*) FROM appointments) as total_appointments,
  (SELECT COUNT(*) FROM doctors) as total_doctors;"
```

## Monitoreo y Alertas

### Health Check Script
```bash
#!/bin/bash
# health-monitor.sh

LOG_FILE="/var/log/mcp-health.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Test local server
LOCAL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8977/health")

# Test remote server
REMOTE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://biosanarcall.site/health")

# Test MCP endpoint
MCP_RESPONSE=$(curl -s -X POST "https://biosanarcall.site/mcp-inspector" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mcp-key-biosanarcall-2025" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')

MCP_TOOLS=$(echo $MCP_RESPONSE | jq -r '.result.tools | length' 2>/dev/null)

# Log results
echo "[$TIMESTAMP] Local: $LOCAL_STATUS, Remote: $REMOTE_STATUS, MCP Tools: $MCP_TOOLS" >> $LOG_FILE

# Alert if problems
if [ "$LOCAL_STATUS" != "200" ] || [ "$REMOTE_STATUS" != "200" ] || [ "$MCP_TOOLS" != "26" ]; then
    echo "[$TIMESTAMP] ALERT: MCP Server issues detected!" >> $LOG_FILE
    # Aquí puedes añadir notificaciones (email, Slack, etc.)
fi
```

### Log Rotation
```bash
# /etc/logrotate.d/mcp-server
/home/ubuntu/app/mcp-server-node/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
    postrotate
        pm2 reloadLogs
    endscript
}
```

## Troubleshooting Common Issues

### 1. Servidor no responde
```bash
# Verificar proceso
pm2 list | grep mcp-server-node

# Ver logs recientes
pm2 logs mcp-server-node --lines 50

# Reiniciar si es necesario
pm2 restart mcp-server-node
```

### 2. Error de conexión a BD
```bash
# Test manual de conexión
mysql -u biosanar_user -p -h 127.0.0.1 biosanar -e "SELECT 1;"

# Verificar variables de entorno
pm2 env 0  # donde 0 es el ID del proceso
```

### 3. Error 502 Bad Gateway
```bash
# Verificar puerto del servidor
netstat -tulpn | grep 8977

# Verificar configuración Nginx
nginx -t

# Ver logs de Nginx
tail -f /var/log/nginx/error.log
```

### 4. Herramientas no funcionan
```bash
# Test directo de herramienta
curl -X POST "http://localhost:8977/mcp-unified" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.'

# Verificar estructura de BD
mysql -u biosanar_user -p biosanar -e "DESCRIBE patients;"
```

## Performance Tuning

### 1. Optimización de MySQL
```sql
-- Ver queries lentas
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';

-- Índices recomendados
CREATE INDEX idx_patients_search ON patients(name, document, phone);
CREATE INDEX idx_appointments_date ON appointments(scheduled_at);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
```

### 2. Configuración PM2
```json
{
  "apps": [{
    "name": "mcp-server-node",
    "script": "npm",
    "args": "run dev",
    "instances": 1,
    "exec_mode": "fork",
    "max_memory_restart": "500M",
    "node_args": "--max-old-space-size=512",
    "env": {
      "NODE_ENV": "production",
      "UV_THREADPOOL_SIZE": "4"
    }
  }]
}
```

### 3. Nginx Optimization
```nginx
location /mcp-inspector {
    proxy_pass http://localhost:8977;
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;
    proxy_cache_bypass $http_upgrade;
    proxy_connect_timeout 30s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
}
```

---

**Autor**: Sistema Biosanarcall IPS  
**Fecha**: 21 de Agosto, 2025  
**Versión**: 1.0.0
