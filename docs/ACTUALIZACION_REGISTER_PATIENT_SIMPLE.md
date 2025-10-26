# Actualización de registerPatientSimple - EPS Opcional

**Fecha:** 13 de octubre de 2025  
**Cambio:** La herramienta `registerPatientSimple` ahora permite registrar pacientes sin EPS

---

## 📋 Resumen de Cambios

La herramienta `registerPatientSimple` ha sido actualizada para hacer el campo **EPS (insurance_eps_id)** completamente **OPCIONAL** en lugar de obligatorio.

### ✅ Campos Obligatorios (Reducidos de 4 a 3)
- `document` - Cédula o documento de identidad
- `name` - Nombre completo del paciente  
- `phone` - Teléfono principal

### 🔧 Campos Opcionales (EPS ahora incluida)
- `insurance_eps_id` - ID de la EPS (ahora opcional)
- `email` - Correo electrónico
- `birth_date` - Fecha de nacimiento (YYYY-MM-DD)
- `gender` - Género
- `address` - Dirección
- `municipality_id` - ID del municipio
- `notes` - Notas adicionales
- `check_duplicates` - Verificar duplicados (default: true)

---

## 🔄 Cambios Técnicos Implementados

### 1. Esquema de Entrada (inputSchema)

**ANTES:**
```typescript
required: ['document', 'name', 'phone', 'insurance_eps_id']
```

**DESPUÉS:**
```typescript
required: ['document', 'name', 'phone']
```

### 2. Descripción de la Herramienta

**ANTES:**
> "Registro simplificado de pacientes con datos mínimos requeridos: nombre, cédula, teléfono y EPS..."

**DESPUÉS:**
> "Registro simplificado de pacientes con datos mínimos requeridos: nombre, cédula y teléfono. La EPS es opcional y puede agregarse posteriormente."

### 3. Descripción del Campo EPS

**ANTES:**
```typescript
insurance_eps_id: { 
  type: 'number', 
  description: 'ID de la EPS (requerido)',
  minimum: 1
}
```

**DESPUÉS:**
```typescript
insurance_eps_id: { 
  type: 'number', 
  description: 'ID de la EPS (opcional). Use listActiveEPS para obtener IDs válidos',
  minimum: 1
}
```

### 4. Lógica de Validación

**ANTES:**
```typescript
// 2. Verificar que la EPS existe (SIEMPRE)
const [epsCheck] = await connection.execute(`
  SELECT id, name FROM eps WHERE id = ? AND status = 'active'
`, [args.insurance_eps_id]);

if ((epsCheck as any[]).length === 0) {
  // Error si no existe
}
```

**DESPUÉS:**
```typescript
// 2. Verificar que la EPS existe (solo si se proporciona)
if (args.insurance_eps_id) {
  const [epsCheck] = await connection.execute(`
    SELECT id, name FROM eps WHERE id = ? AND status = 'active'
  `, [args.insurance_eps_id]);
  
  if ((epsCheck as any[]).length === 0) {
    // Error solo si se proporciona pero es inválida
  }
}
```

### 5. Preparación de Datos

**ANTES:**
```typescript
insurance_eps_id: args.insurance_eps_id,
```

**DESPUÉS:**
```typescript
insurance_eps_id: args.insurance_eps_id || null,
```

### 6. Resumen de Registro

**ANTES:**
```typescript
registration_summary: {
  required_fields_completed: 4, // document, name, phone, eps
  optional_fields_completed: total - 4
}
```

**DESPUÉS:**
```typescript
registration_summary: {
  required_fields_completed: 3, // document, name, phone
  optional_fields_completed: total - 3,
  eps_provided: args.insurance_eps_id ? true : false
}
```

---

## 📁 Archivos Modificados

### 1. `/mcp-server-node/src/server-simple-register.ts`
- Actualizado esquema `inputSchema` de la herramienta
- Modificada lógica de validación de EPS (condicional)
- Ajustado manejo de valores NULL para EPS
- Actualizado resumen de registro

### 2. `/mcp-server-node/src/server-unified.ts`
- Mismos cambios aplicados para mantener consistencia
- Actualizada descripción y esquema
- Modificada lógica de validación

### 3. Herramienta `listActiveEPS`
- Actualizada nota de uso para indicar que EPS es opcional

**ANTES:**
> "Use el campo 'id' para registrar pacientes con registerPatientSimple"

**DESPUÉS:**
> "Use el campo 'id' como insurance_eps_id para registrar pacientes con registerPatientSimple (opcional)"

---

## 🧪 Casos de Uso

### Caso 1: Registro sin EPS (NUEVO - Ahora Permitido)
```json
{
  "document": "1234567890",
  "name": "Juan Pérez",
  "phone": "3001234567"
}
```
**Resultado:** ✅ Paciente registrado con `insurance_eps_id = NULL`

### Caso 2: Registro con EPS (Funcionamiento Normal)
```json
{
  "document": "1234567890",
  "name": "Juan Pérez",
  "phone": "3001234567",
  "insurance_eps_id": 1
}
```
**Resultado:** ✅ Paciente registrado con EPS asignada

### Caso 3: Registro con EPS Inválida
```json
{
  "document": "1234567890",
  "name": "Juan Pérez",
  "phone": "3001234567",
  "insurance_eps_id": 999
}
```
**Resultado:** ❌ Error: "EPS no válida"

---

## 🔍 Validaciones Mantenidas

Las siguientes validaciones se mantienen intactas:

✅ Verificación de documentos duplicados  
✅ Validación de EPS (solo si se proporciona)  
✅ Verificación de municipio (si se proporciona)  
✅ Transacciones de base de datos  
✅ Rollback automático en errores  
✅ Respuesta con datos completos del paciente creado

---

## 🚀 Despliegue

Los cambios fueron compilados y desplegados:

```bash
cd /home/ubuntu/app/mcp-server-node
npm run build              # Compilación exitosa
pm2 restart mcp-unified    # Servidor reiniciado
```

**Estado del Servidor:**
- ✅ Servidor `mcp-unified` reiniciado correctamente
- ✅ Puerto 8977 activo
- ✅ 8 herramientas MCP disponibles
- ✅ Sin errores en logs

---

## 📊 Impacto

### Beneficios
- ✅ Mayor flexibilidad en el registro de pacientes
- ✅ Permite flujos de trabajo donde la EPS se asigna posteriormente
- ✅ Reduce fricción en casos de urgencia
- ✅ Mantiene retrocompatibilidad (registros con EPS siguen funcionando)

### Compatibilidad
- ✅ **Retrocompatible:** Los registros con EPS funcionan igual
- ✅ **Base de datos:** Columna `insurance_eps_id` ya permite NULL
- ✅ **Frontend:** No requiere cambios obligatorios
- ✅ **Validaciones:** Se mantienen cuando se proporciona EPS

---

## 🎯 Flujo de Trabajo Recomendado

### Para Agentes de Voz (ElevenLabs/Twilio)
1. Solicitar datos mínimos: cédula, nombre, teléfono
2. Registrar paciente con `registerPatientSimple` (sin EPS)
3. Opcionalmente, solicitar EPS y actualizar después

### Para Interfaces Web
- Mantener EPS como campo opcional en formularios
- Permitir "Registrar sin EPS" o "Especificar después"
- Mostrar indicador visual si falta EPS en perfil

---

## 📝 Notas Adicionales

- La base de datos ya permitía `insurance_eps_id = NULL` en la tabla `patients`
- Este cambio solo expone esa capacidad a través de la API MCP
- El campo EPS puede actualizarse posteriormente usando herramientas de edición de pacientes
- La documentación de la herramienta fue actualizada en ambos servidores (simple-register y unified)

---

**Autor:** GitHub Copilot  
**Revisado por:** Sistema MCP Biosanarcall  
**Estado:** ✅ Implementado y Desplegado
