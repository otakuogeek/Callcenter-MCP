# 🏥 Sistema MCP Biosanarcall - Documentación Actualizada

## 📊 Resumen del Sistema

Sistema de servidor MCP (Model Context Protocol) con **2 herramientas** para consulta de EPS y registro de pacientes, optimizado para integración con ElevenLabs Agent Studio.

**Fecha de actualización:** Octubre 1, 2025  
**Versión:** 2.0.0  
**Estado:** ✅ Completamente funcional

---

## 🛠️ Herramientas Disponibles

### 1️⃣ `listActiveEPS`

Consulta las EPS (Entidades Promotoras de Salud) activas disponibles en el sistema.

**Entrada:** Ninguna (no requiere parámetros)

**Salida:**
```json
{
  "success": true,
  "count": 10,
  "eps_list": [
    {
      "id": 9,
      "name": "COOMEVA",
      "code": "2721",
      "has_agreement": true,
      "agreement_date": null,
      "notes": "Activa",
      "created_at": "2025-08-11T12:42:09.000Z"
    },
    // ... más EPS
  ],
  "message": "Se encontraron 10 EPS activas disponibles",
  "usage_note": "Use el campo 'id' para registrar pacientes"
}
```

**Uso en ElevenLabs:**
```
"Por favor, muéstrame las EPS disponibles"
"¿Qué EPS tienen convenio?"
"Lista las entidades de salud activas"
```

---

### 2️⃣ `registerPatientSimple`

Registro simplificado de pacientes con validación de EPS real.

**Entrada:**
```json
{
  "document": "1234567890",          // Requerido: Cédula del paciente
  "name": "Juan Pérez García",      // Requerido: Nombre completo
  "phone": "3101234567",             // Requerido: Teléfono 10 dígitos
  "insurance_eps_id": 14,            // Requerido: ID de EPS (usar listActiveEPS)
  "notes": "Primera consulta"        // Opcional: Notas adicionales
}
```

**Salida Exitosa:**
```json
{
  "success": true,
  "message": "Paciente registrado exitosamente",
  "patient_id": 1036,
  "patient": {
    "id": 1036,
    "document": "1234567890",
    "name": "Juan Pérez García",
    "phone": "3101234567",
    "eps": "NUEVA EPS",
    "eps_code": "2715",
    "status": "Activo",
    "created_at": "2025-10-01T15:03:08.000Z"
  }
}
```

**Salida con Error (EPS inválida):**
```json
{
  "success": false,
  "error": "EPS no válida",
  "available_eps": "Use IDs entre 1-17. Principales: 1=NUEVA EPS, 2=SANITAS, 3=SURA"
}
```

**Salida con Duplicado:**
```json
{
  "success": false,
  "error": "Paciente duplicado encontrado",
  "duplicate_patient": {
    "id": 500,
    "document": "1234567890",
    "name": "Juan Pérez",
    "phone": "3101234567"
  },
  "suggestion": "Ya existe un paciente activo con este documento"
}
```

**Uso en ElevenLabs:**
```
"Registrar un nuevo paciente con cédula 12345678"
"Crear paciente Juan Pérez, teléfono 3101234567, con NUEVA EPS"
"Agregar paciente con los siguientes datos..."
```

---

## 🌐 Endpoints Disponibles

### Endpoint Principal
```
URL: https://biosanarcall.site/mcp/
Servidor: mcp-unified
Puerto: 8977
Herramientas: 2
Uso: Integraciones generales MCP
```

### Endpoint ElevenLabs
```
URL: https://biosanarcall.site/mcp-elevenlabs/
Servidor: mcp-simple-register
Puerto: 8978
Herramientas: 2
Uso: Optimizado para ElevenLabs Agent Studio
```

**Ambos endpoints tienen las mismas 2 herramientas y funcionalidad idéntica.**

---

## 📋 Flujo de Trabajo Recomendado

### Para Registro Manual:
1. **Consultar EPS disponibles**
   ```bash
   curl -X POST https://biosanarcall.site/mcp/ \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"listActiveEPS","arguments":{}}}'
   ```

2. **Registrar paciente con ID de EPS correcto**
   ```bash
   curl -X POST https://biosanarcall.site/mcp/ \
     -H "Content-Type: application/json" \
     -d '{
       "jsonrpc":"2.0",
       "id":2,
       "method":"tools/call",
       "params":{
         "name":"registerPatientSimple",
         "arguments":{
           "document":"1234567890",
           "name":"Juan Pérez",
           "phone":"3101234567",
           "insurance_eps_id":14,
           "notes":"Consulta general"
         }
       }
     }'
   ```

### Para ElevenLabs Agent Studio:

**Prompt del Agente:**
```
Eres un asistente de registro médico para Biosanarcall.

Cuando un usuario quiera registrarse:
1. Primero pregunta: nombre completo, cédula y teléfono
2. Luego usa la herramienta listActiveEPS para mostrar las EPS disponibles
3. Pregunta cuál EPS tiene el paciente
4. Usa registerPatientSimple con el ID de la EPS seleccionada
5. Confirma el registro exitoso con los datos del paciente

Sé amable, claro y verifica siempre los datos antes de registrar.
```

**Ejemplo de Conversación:**
```
Agente: "¡Hola! Soy el asistente de Biosanarcall. ¿En qué puedo ayudarte?"

Usuario: "Quiero registrarme como paciente"

Agente: "Perfecto. Necesito algunos datos:
         - Tu nombre completo
         - Número de cédula
         - Teléfono de contacto"

Usuario: "Juan Pérez García, cédula 12345678, teléfono 3101234567"

Agente: [Llama listActiveEPS]
        "Entendido. Estas son las EPS con las que tenemos convenio:
         - COOMEVA
         - NUEVA EPS
         - SANITAS
         - FAMISANAR
         ¿Cuál es tu EPS?"

Usuario: "NUEVA EPS"

Agente: [Llama registerPatientSimple con insurance_eps_id=14]
        "¡Perfecto! Te he registrado exitosamente:
         - Nombre: Juan Pérez García
         - Cédula: 12345678
         - Teléfono: 3101234567
         - EPS: NUEVA EPS
         - Número de registro: 1036
         
         ¿Necesitas algo más?"
```

---

## 🏥 EPS Disponibles (IDs)

Estos son los IDs reales de la base de datos `biosanar` que debe usar `registerPatientSimple`:

| ID | Nombre | Código | Estado |
|----|--------|--------|--------|
| 9 | COOMEVA | 2721 | Activo |
| 10 | SINTRAVID | 2720 | Activo |
| 11 | FUNDACION AVANZAR FOS | 2719 | Activo |
| 12 | FAMISANAR | 2718 | Activo |
| 13 | FOMAG FIDUPREVISORA S.A | 2717 | Activo |
| 14 | NUEVA EPS | 2715 | Activo |
| 15 | SOUL MEDICAL | 2714 | Activo |
| 16 | SALUD COOSALUD | 2713 | Activo |
| 17 | FAMISANAR | 2706 | Activo |
| 18 | FUNDACION AVANZAR FOS | 2702 | Activo |

**Total:** 10 EPS activas

---

## 🧪 Testing

### Test Rápido
```bash
# Ejecutar test completo de ambos endpoints
/home/ubuntu/app/mcp-server-node/test-final-both-endpoints.sh
```

### Test Manual de Herramientas

**1. Listar Herramientas:**
```bash
curl -s -X POST https://biosanarcall.site/mcp/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq
```

**2. Consultar EPS:**
```bash
curl -s -X POST https://biosanarcall.site/mcp/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"listActiveEPS","arguments":{}}}' | jq
```

**3. Registrar Paciente:**
```bash
curl -s -X POST https://biosanarcall.site/mcp/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":3,
    "method":"tools/call",
    "params":{
      "name":"registerPatientSimple",
      "arguments":{
        "document":"TEST12345",
        "name":"Test Usuario",
        "phone":"3100000000",
        "insurance_eps_id":14,
        "notes":"Prueba del sistema"
      }
    }
  }' | jq
```

---

## 🔧 Configuración en ElevenLabs Agent Studio

### Paso 1: Agregar Servidor MCP

1. Ve a **Agent Studio** → **Integrations**
2. Clic en **"+ Nueva integración"**
3. Selecciona **"Custom MCP Server"**

### Paso 2: Configurar Endpoint

```yaml
Nombre: Biosanarcall Medical System
URL: https://biosanarcall.site/mcp-elevenlabs/
Protocolo: MCP (Model Context Protocol)
Autenticación: Ninguna (público)
```

### Paso 3: Verificar Herramientas

Deberías ver:
- ✅ `listActiveEPS`
- ✅ `registerPatientSimple`

### Paso 4: Configurar Prompt del Agente

Usa el prompt de ejemplo de la sección "Flujo de Trabajo" arriba.

---

## 🗄️ Base de Datos

**Conexión:**
```
Host: 127.0.0.1
Puerto: 3306
Base de datos: biosanar
Usuario: biosanar_user
```

**Tablas Principales:**
- `patients` - Pacientes registrados
- `eps` - Entidades Promotoras de Salud
- `appointments` - Citas médicas

**Queries Útiles:**
```sql
-- Ver EPS activas
SELECT id, name, code FROM eps WHERE status = 'active' ORDER BY name;

-- Ver pacientes recientes
SELECT id, document, name, phone, created_at 
FROM patients 
ORDER BY created_at DESC 
LIMIT 10;

-- Contar pacientes por EPS
SELECT e.name, COUNT(p.id) as total
FROM eps e
LEFT JOIN patients p ON e.id = p.insurance_eps_id
WHERE e.status = 'active'
GROUP BY e.id, e.name
ORDER BY total DESC;
```

---

## 📊 Monitoreo

### Estado de Servidores PM2
```bash
pm2 status | grep mcp
```

### Logs en Tiempo Real
```bash
# Servidor unificado
pm2 logs mcp-unified --lines 50

# Servidor simplificado
pm2 logs mcp-simple-register --lines 50
```

### Reiniciar Servidores
```bash
# Reiniciar ambos
pm2 restart mcp-unified mcp-simple-register

# Reiniciar solo uno
pm2 restart mcp-unified
```

---

## 🐛 Troubleshooting

### Problema: "EPS no válida"
**Causa:** ID de EPS incorrecto o EPS inactiva  
**Solución:** Llamar `listActiveEPS` para obtener IDs válidos

### Problema: "Paciente duplicado"
**Causa:** Ya existe un paciente con ese documento  
**Solución:** Verificar documento o actualizar paciente existente

### Problema: ElevenLabs no ve las herramientas
**Solución:**
1. Verificar endpoint: `curl https://biosanarcall.site/mcp-elevenlabs/`
2. Revisar logs: `pm2 logs mcp-simple-register`
3. Recargar integración en ElevenLabs

### Problema: Error 502 Bad Gateway
**Solución:**
1. Verificar servidores: `pm2 status`
2. Reiniciar: `pm2 restart mcp-unified mcp-simple-register`
3. Revisar Nginx: `sudo systemctl status nginx`

---

## 📞 Soporte

**Sistema:** Biosanarcall Medical Management  
**Repositorio:** otakuogeek/Callcenter-MCP  
**Branch:** main-clean  
**Documentación actualizada:** Octubre 1, 2025

---

## ✅ Checklist de Verificación

- [x] 2 herramientas implementadas (listActiveEPS, registerPatientSimple)
- [x] Ambos endpoints (/mcp/ y /mcp-elevenlabs/) funcionando
- [x] Base de datos MySQL conectada
- [x] 10 EPS activas disponibles
- [x] Validación de duplicados funcionando
- [x] IDs de EPS reales desde tabla `eps`
- [x] Servidor unificado (8977) activo
- [x] Servidor simplificado (8978) activo
- [x] CORS configurado para ElevenLabs
- [x] Tests pasando correctamente

---

## 🎯 Próximos Pasos

1. ✅ Configurar integración en ElevenLabs Agent Studio
2. ✅ Probar flujo completo con agente de voz
3. ✅ Monitorear logs durante primeros registros
4. ✅ Ajustar prompts según feedback de usuarios
5. ✅ Documentar casos de uso comunes

---

**Última verificación:** ✅ Octubre 1, 2025 - Todos los sistemas operacionales
