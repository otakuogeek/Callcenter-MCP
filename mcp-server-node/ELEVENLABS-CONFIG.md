# Configuración MCP para ElevenLabs

## Servidor MCP Simple Patient Register - Configuración ElevenLabs

### Información del Servidor

- **Nombre**: Biosanarcall MCP Simple Patient Register
- **URL**: `https://biosanarcall.site/mcp-simple-register`
- **Puerto local**: 8978
- **Protocolo**: JSON-RPC 2.0

### Configuración para Agent Studio

```json
{
  "name": "Biosanarcall Patient Register",
  "description": "Registro simplificado de pacientes con datos mínimos",
  "server_url": "https://biosanarcall.site/mcp-simple-register",
  "tools": [
    {
      "name": "registerPatientSimple",
      "description": "Registra un nuevo paciente con nombre, cédula, teléfono y EPS"
    }
  ],
  "capabilities": [
    "patient_registration",
    "duplicate_detection",
    "eps_validation"
  ]
}
```

### Ejemplo de Uso en Conversación

**Usuario**: "Necesito registrar un paciente nuevo"

**Agent**: "¡Por supuesto! Voy a ayudarte a registrar el paciente. Necesito algunos datos básicos:

1. **Documento de identidad** (cédula)
2. **Nombre completo**
3. **Teléfono principal**
4. **EPS** (puedes darme el nombre y yo busco el ID)

¿Podrías proporcionarme estos datos?"

**Usuario**: "Juan Carlos Pérez, cédula 12345678, teléfono 3201234567, EPS Nueva EPS"

**Agent**: [Llama a registerPatientSimple con insurance_eps_id: 14]

### EPS Disponibles

| ID | Nombre | Código |
|---|---|---|
| 9 | COOMEVA | 2721 |
| 10 | SINTRAVID | - |
| 11 | FUNDACION AVANZAR FOS | - |
| 12 | FAMISANAR | - |
| 13 | FOMAG FIDUPREVISORA S.A | - |
| 14 | NUEVA EPS | 2715 |
| 15 | SOUL MEDICAL | - |
| 16 | SALUD COOSALUD | - |

### Prompts Sugeridos para el Agent

```
You are a medical receptionist assistant for Biosanarcall IPS. You help register new patients with minimal required information.

When a user wants to register a patient, ask for:
1. Document ID (cédula)
2. Full name
3. Phone number
4. EPS (health insurance)

You can also ask for optional information like:
- Email
- Birth date
- Gender
- Address

Use the registerPatientSimple tool to create the patient record. Always check for duplicates and handle errors gracefully.

Available EPS options:
- COOMEVA (ID: 9)
- NUEVA EPS (ID: 14)
- FAMISANAR (ID: 12)
- SALUD COOSALUD (ID: 16)
- Others available

Be friendly and efficient in Spanish.
```

### Configuración Nginx (Opcional)

```nginx
# Agregar al archivo de configuración de Nginx
location /mcp-simple-register {
    proxy_pass http://localhost:8978/mcp;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

### Test de Conectividad

```bash
# Desde ElevenLabs o externamente
curl -X POST https://biosanarcall.site/mcp-simple-register \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### Ventajas para ElevenLabs

1. **Latencia baja**: Solo una herramienta, respuesta rápida
2. **Datos mínimos**: Perfecto para conversaciones de voz
3. **Validaciones automáticas**: Evita errores comunes
4. **Respuestas claras**: Ideal para feedback de voz
5. **Tolerante a errores**: Manejo robusto de problemas

### Limitaciones

- Solo registro de pacientes (no búsqueda ni actualización)
- Campos limitados a lo esencial
- No incluye historiales médicos complejos

### Uso Recomendado

Este servidor MCP es ideal para:
- Recepción de pacientes nuevos
- Registro rápido en consultas
- Sistemas de voz automatizados
- Aplicaciones móviles simples