# Biosanarcall MCP Simple Patient Register

## Descripción

Servidor MCP (Model Context Protocol) simplificado diseñado específicamente para el registro de pacientes con datos mínimos requeridos. Esta implementación se enfoca en la eficiencia y simplicidad, manteniendo solo la funcionalidad esencial de registro de pacientes.

## Características

### ✅ Funcionalidades Implementadas

- **Registro simplificado de pacientes** con datos mínimos obligatorios
- **Validación de duplicados** por documento de identidad
- **Verificación de EPS** y municipios existentes
- **Detección automática de edad** basada en fecha de nacimiento
- **Manejo robusto de errores** con mensajes descriptivos
- **Logging completo** de operaciones
- **Health check endpoint** para monitoreo

### 🎯 Herramienta Única Disponible

#### `registerPatientSimple`
Registra un nuevo paciente con validaciones básicas y datos mínimos requeridos.

**Campos Obligatorios:**
- `document` (string): Documento de identidad (5-20 caracteres)
- `name` (string): Nombre completo (3-150 caracteres)  
- `phone` (string): Teléfono principal (7-15 caracteres)
- `insurance_eps_id` (number): ID de la EPS (debe existir y estar activa)

**Campos Opcionales:**
- `email` (string): Correo electrónico (formato válido)
- `birth_date` (string): Fecha de nacimiento (formato YYYY-MM-DD)
- `gender` (enum): Masculino, Femenino, Otro, No especificado
- `address` (string): Dirección (máximo 200 caracteres)
- `municipality_id` (number): ID del municipio (debe existir)
- `notes` (string): Notas adicionales (máximo 500 caracteres)
- `check_duplicates` (boolean): Verificar duplicados (default: true)

## Configuración

### Variables de Entorno

```env
# Base de datos
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=biosanar_user
DB_PASS=/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU
DB_NAME=biosanar

# Servidor
NODE_ENV=production
PORT=8978
HOST=0.0.0.0
```

### Estructura de Base de Datos

El servidor utiliza la tabla `patients` con la siguiente estructura simplificada:

```sql
-- Campos utilizados por el servidor simple
- id (auto increment)
- document (unique, requerido)
- name (requerido)
- phone (requerido)
- insurance_eps_id (requerido, FK a eps)
- email (opcional)
- birth_date (opcional)
- gender (opcional, default: 'No especificado')
- address (opcional)
- municipality_id (opcional, FK a municipalities)
- notes (opcional)
- status (default: 'Activo')
- created_at (timestamp automático)
```

## Instalación y Uso

### 1. Instalación de Dependencias

```bash
cd /home/ubuntu/app/mcp-server-node
npm install
```

### 2. Compilación

```bash
npm run build
```

### 3. Inicio del Servidor

#### Opción A: Script Automático (Recomendado)
```bash
./start-simple-register.sh
```

#### Opción B: PM2 Manual
```bash
pm2 start ecosystem-simple-register.config.json
```

#### Opción C: Node.js Directo
```bash
node dist/server-simple-register.js
```

### 4. Verificación

```bash
# Health check
curl http://localhost:8978/health

# Listar herramientas
curl -X POST http://localhost:8978/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

## Ejemplos de Uso

### Registro con Datos Mínimos

```bash
curl -X POST http://localhost:8978/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "registerPatientSimple",
      "arguments": {
        "document": "12345678",
        "name": "Juan Pérez González",
        "phone": "3201234567",
        "insurance_eps_id": 14
      }
    }
  }'
```

### Registro con Datos Completos

```bash
curl -X POST http://localhost:8978/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "registerPatientSimple",
      "arguments": {
        "document": "87654321",
        "name": "María García López",
        "phone": "3157894561",
        "insurance_eps_id": 9,
        "email": "maria@example.com",
        "birth_date": "1985-06-15",
        "gender": "Femenino",
        "address": "Calle 123 #45-67",
        "municipality_id": 25,
        "notes": "Paciente referida desde consulta externa"
      }
    }
  }'
```

## Respuestas del Servidor

### Registro Exitoso

```json
{
  "success": true,
  "message": "Paciente registrado exitosamente",
  "patient_id": 1029,
  "patient": {
    "id": 1029,
    "document": "12345678",
    "name": "Juan Pérez González",
    "phone": "3201234567",
    "email": null,
    "birth_date": null,
    "age": null,
    "gender": "No especificado",
    "address": null,
    "municipality": null,
    "eps": "NUEVA EPS",
    "eps_code": "2715",
    "status": "Activo",
    "created_at": "2025-10-01T13:29:14.000Z"
  },
  "registration_summary": {
    "total_fields_completed": 7,
    "required_fields_completed": 4,
    "optional_fields_completed": 3
  }
}
```

### Error por Duplicado

```json
{
  "success": false,
  "error": "Paciente duplicado encontrado",
  "duplicate_patient": {
    "id": 1029,
    "document": "12345678",
    "name": "Juan Pérez González",
    "phone": "3201234567",
    "status": "Activo"
  },
  "suggestion": "Ya existe un paciente activo con este documento"
}
```

### Error de Validación

```json
{
  "success": false,
  "error": "EPS no válida",
  "suggestion": "Verificar que el ID de EPS exista y esté activa"
}
```

## Monitoreo y Mantenimiento

### Comandos PM2

```bash
# Ver estado
pm2 list

# Ver logs en tiempo real
pm2 logs mcp-simple-register

# Reiniciar
pm2 restart mcp-simple-register

# Detener
pm2 stop mcp-simple-register

# Eliminar del PM2
pm2 delete mcp-simple-register
```

### Health Check

```bash
curl http://localhost:8978/health
```

Respuesta esperada:
```json
{
  "status": "healthy",
  "database": "connected",
  "active_patients": 17,
  "active_eps": 10,
  "timestamp": "2025-10-01T13:28:39.908Z"
}
```

## Validaciones Implementadas

1. **Duplicados**: Verifica que no exista otro paciente activo con el mismo documento
2. **EPS**: Confirma que la EPS existe y está activa
3. **Municipio**: Si se proporciona, verifica que el municipio existe
4. **Formatos**: Valida longitudes y formatos de campos
5. **Integridad**: Verificación de tipos de datos y restricciones

## Logs y Debugging

Los logs se almacenan en:
- `/home/ubuntu/app/mcp-server-node/logs/simple-register-combined.log`
- `/home/ubuntu/app/mcp-server-node/logs/simple-register-out.log`
- `/home/ubuntu/app/mcp-server-node/logs/simple-register-error.log`

Para debugging en tiempo real:
```bash
pm2 logs mcp-simple-register --lines 100
```

## Diferencias con el Servidor Completo

| Característica | Servidor Simple | Servidor Completo |
|---|---|---|
| Herramientas | 1 (registro) | 24+ (registro, búsqueda, actualización, etc.) |
| Campos obligatorios | 4 básicos | Variables según herramienta |
| Validaciones | Básicas | Avanzadas con machine learning |
| Rendimiento | Optimizado | Completo pero más pesado |
| Memoria | ~45MB | ~75MB |
| Casos de uso | Registro simple | Gestión completa de pacientes |

## Casos de Uso Ideales

- **Registro rápido** en recepción
- **Integración con ElevenLabs** para asistentes de voz
- **API simple** para aplicaciones móviles
- **Sistemas de cola** para asignación de citas
- **Registro de emergencia** con datos mínimos

## Soporte

Para más información o soporte técnico, consultar la documentación completa del sistema Biosanarcall o contactar al equipo de desarrollo.