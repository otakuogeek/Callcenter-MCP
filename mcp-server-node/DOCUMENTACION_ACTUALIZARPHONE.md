# 📱 Herramienta: actualizarPhone

## Descripción General

Herramienta MCP para consultar y actualizar los números telefónicos (principal y alternativo) de un paciente utilizando su número de documento de identificación.

## Características

- ✅ **Consulta de teléfonos actuales** sin modificar datos
- ✅ **Actualización selectiva** (uno o ambos teléfonos)
- ✅ **Validación de paciente activo**
- ✅ **Transacciones seguras** con rollback automático
- ✅ **Reporte detallado** de cambios realizados

---

## Parámetros de Entrada

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `document` | string | ✅ **SÍ** | Número de cédula o documento de identidad del paciente |
| `new_phone` | string | ❌ NO | Nuevo número de teléfono principal (solo si desea actualizarlo) |
| `new_phone_alt` | string | ❌ NO | Nuevo número de teléfono alternativo (solo si desea actualizarlo) |

---

## Casos de Uso

### 📋 **Caso 1: Solo Consultar Teléfonos**

**Entrada:**
```json
{
  "document": "1234567890"
}
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "action": "consultation",
  "message": "Consulta de teléfonos realizada exitosamente",
  "patient": {
    "id": 123,
    "name": "Juan Pérez",
    "document": "1234567890",
    "eps": "Sanitas"
  },
  "phones": {
    "phone_principal": "3001234567",
    "phone_alternativo": "3109876543"
  },
  "info": "Para actualizar, proporcione new_phone o new_phone_alt en la solicitud"
}
```

---

### 📞 **Caso 2: Actualizar Solo Teléfono Principal**

**Entrada:**
```json
{
  "document": "1234567890",
  "new_phone": "3205556789"
}
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "action": "update",
  "message": "Teléfonos actualizados exitosamente",
  "patient": {
    "id": 123,
    "name": "Juan Pérez",
    "document": "1234567890",
    "eps": "Sanitas"
  },
  "changes": {
    "phone_principal": {
      "anterior": "3001234567",
      "nuevo": "3205556789"
    }
  },
  "phones_updated": {
    "phone_principal": "3205556789",
    "phone_alternativo": "3109876543"
  }
}
```

---

### 📱 **Caso 3: Actualizar Solo Teléfono Alternativo**

**Entrada:**
```json
{
  "document": "1234567890",
  "new_phone_alt": "3157778899"
}
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "action": "update",
  "message": "Teléfonos actualizados exitosamente",
  "patient": {
    "id": 123,
    "name": "Juan Pérez",
    "document": "1234567890",
    "eps": "Sanitas"
  },
  "changes": {
    "phone_alternativo": {
      "anterior": "3109876543",
      "nuevo": "3157778899"
    }
  },
  "phones_updated": {
    "phone_principal": "3001234567",
    "phone_alternativo": "3157778899"
  }
}
```

---

### 📲 **Caso 4: Actualizar Ambos Teléfonos**

**Entrada:**
```json
{
  "document": "1234567890",
  "new_phone": "3205556789",
  "new_phone_alt": "3157778899"
}
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "action": "update",
  "message": "Teléfonos actualizados exitosamente",
  "patient": {
    "id": 123,
    "name": "Juan Pérez",
    "document": "1234567890",
    "eps": "Sanitas"
  },
  "changes": {
    "phone_principal": {
      "anterior": "3001234567",
      "nuevo": "3205556789"
    },
    "phone_alternativo": {
      "anterior": "3109876543",
      "nuevo": "3157778899"
    }
  },
  "phones_updated": {
    "phone_principal": "3205556789",
    "phone_alternativo": "3157778899"
  }
}
```

---

### 📱 **Caso 5: Agregar Teléfono Alternativo (cuando no existía)**

**Entrada:**
```json
{
  "document": "1234567890",
  "new_phone_alt": "3157778899"
}
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "action": "update",
  "message": "Teléfonos actualizados exitosamente",
  "patient": {
    "id": 123,
    "name": "Juan Pérez",
    "document": "1234567890",
    "eps": "Sanitas"
  },
  "changes": {
    "phone_alternativo": {
      "anterior": "No registrado",
      "nuevo": "3157778899"
    }
  },
  "phones_updated": {
    "phone_principal": "3001234567",
    "phone_alternativo": "3157778899"
  }
}
```

---

## Respuestas de Error

### ❌ **Error: Documento no proporcionado**

```json
{
  "success": false,
  "error": "El número de documento es obligatorio",
  "usage": "Proporcione el documento del paciente para consultar o actualizar sus teléfonos"
}
```

---

### ❌ **Error: Paciente no encontrado**

```json
{
  "success": false,
  "error": "Paciente no encontrado",
  "document": "9999999999",
  "suggestion": "Verifique el número de documento e intente nuevamente"
}
```

---

### ❌ **Error: Paciente inactivo**

```json
{
  "success": false,
  "error": "Paciente inactivo",
  "patient": {
    "id": 123,
    "name": "Juan Pérez",
    "document": "1234567890",
    "status": "Inactivo"
  },
  "suggestion": "Este paciente está marcado como inactivo. Contacte al administrador."
}
```

---

### ❌ **Error: Error de base de datos**

```json
{
  "success": false,
  "error": "Error al actualizar teléfonos del paciente",
  "details": "Mensaje de error técnico de MySQL"
}
```

---

## Flujo de Funcionamiento

```
┌─────────────────────────────────────────┐
│  INICIO: actualizarPhone(args)          │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  1. Validar documento obligatorio       │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  2. Buscar paciente en BD               │
│     - SELECT por document               │
│     - JOIN con EPS                      │
└────────────────┬────────────────────────┘
                 │
                 ▼
         ┌───────┴────────┐
         │                │
    ❌ No existe      ✅ Existe
         │                │
         ▼                ▼
   Return error   ┌──────────────────┐
                  │ 3. Verificar     │
                  │    status        │
                  └────┬─────────────┘
                       │
                ┌──────┴──────┐
                │             │
          ✅ Activo      ❌ Inactivo
                │             │
                │             ▼
                │       Return error
                │
                ▼
   ┌────────────────────────────────┐
   │ 4. ¿Hay new_phone o           │
   │    new_phone_alt?             │
   └────────┬───────────────────────┘
            │
      ┌─────┴──────┐
      │            │
   ❌ NO         ✅ SÍ
      │            │
      ▼            ▼
┌──────────┐  ┌─────────────────────┐
│ CONSULTA │  │ 5. BEGIN TRANSACTION│
│          │  │                     │
│ Return   │  │ 6. UPDATE phones    │
│ current  │  │    SET phone/alt    │
│ phones   │  │                     │
└──────────┘  │ 7. COMMIT           │
              │                     │
              │ 8. Return cambios   │
              │    (antes/después)  │
              └─────────────────────┘
```

---

## Validaciones Implementadas

| Validación | Descripción |
|------------|-------------|
| ✅ **Documento obligatorio** | Verifica que se proporcione el parámetro `document` |
| ✅ **Paciente existe** | Busca el paciente en la tabla `patients` |
| ✅ **Paciente activo** | Verifica que `status != 'Inactivo'` |
| ✅ **Transacción segura** | Usa BEGIN/COMMIT/ROLLBACK para integridad |
| ✅ **Rollback automático** | En caso de error, revierte cambios |

---

## Integración con Otras Herramientas

### 🔗 Relación con `registerPatientSimple`
- `registerPatientSimple` crea pacientes con phone y phone_alt
- `actualizarPhone` permite modificarlos después del registro

### 🔗 Relación con `searchPatient`
- `searchPatient` busca por nombre/documento y muestra teléfonos
- `actualizarPhone` usa el documento para actualizar teléfonos

### 🔗 Relación con `scheduleAppointment`
- `scheduleAppointment` requiere documento del paciente
- `actualizarPhone` mantiene contacto actualizado para notificaciones

---

## Información Técnica

| Aspecto | Detalle |
|---------|---------|
| **Archivo** | `/src/server-unified.ts` |
| **Función** | `actualizarPhone(args)` |
| **Líneas** | ~5843-5989 |
| **Base de datos** | MySQL `biosanar` |
| **Tabla** | `patients` |
| **Campos actualizados** | `phone`, `phone_alt` |
| **Tipo de operación** | SELECT + UPDATE (transaccional) |
| **Manejo de errores** | Try/Catch con rollback |

---

## Código de Implementación

```typescript
async function actualizarPhone(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const { document, new_phone, new_phone_alt } = args;
    
    // 1. Validar que se proporcionó el documento
    if (!document) {
      return {
        success: false,
        error: 'El número de documento es obligatorio',
        usage: 'Proporcione el documento del paciente para consultar o actualizar sus teléfonos'
      };
    }
    
    // 2. Buscar paciente por documento
    const [patientCheck] = await connection.execute(`
      SELECT 
        p.id, 
        p.document, 
        p.name, 
        p.phone, 
        p.phone_alt,
        p.status,
        eps.name as eps_name
      FROM patients p
      LEFT JOIN eps ON p.insurance_eps_id = eps.id
      WHERE p.document = ?
      LIMIT 1
    `, [document]);
    
    if ((patientCheck as any[]).length === 0) {
      return {
        success: false,
        error: 'Paciente no encontrado',
        document: document,
        suggestion: 'Verifique el número de documento e intente nuevamente'
      };
    }
    
    const patient = (patientCheck as any[])[0];
    
    // 3. Si el paciente está inactivo, informar
    if (patient.status === 'Inactivo') {
      return {
        success: false,
        error: 'Paciente inactivo',
        patient: {
          id: patient.id,
          name: patient.name,
          document: patient.document,
          status: patient.status
        },
        suggestion: 'Este paciente está marcado como inactivo. Contacte al administrador.'
      };
    }
    
    // 4. Obtener teléfonos actuales
    const currentPhones = {
      phone: patient.phone,
      phone_alt: patient.phone_alt
    };
    
    // 5. Si NO se proporcionan teléfonos nuevos, solo consultar
    if (!new_phone && !new_phone_alt) {
      return {
        success: true,
        action: 'consultation',
        message: 'Consulta de teléfonos realizada exitosamente',
        patient: {
          id: patient.id,
          name: patient.name,
          document: patient.document,
          eps: patient.eps_name
        },
        phones: {
          phone_principal: currentPhones.phone || 'No registrado',
          phone_alternativo: currentPhones.phone_alt || 'No registrado'
        },
        info: 'Para actualizar, proporcione new_phone o new_phone_alt en la solicitud'
      };
    }
    
    // 6. Actualizar teléfonos
    await connection.beginTransaction();
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (new_phone) {
      updates.push('phone = ?');
      params.push(new_phone);
    }
    
    if (new_phone_alt) {
      updates.push('phone_alt = ?');
      params.push(new_phone_alt);
    }
    
    // Agregar documento al final de params
    params.push(document);
    
    const updateQuery = `
      UPDATE patients 
      SET ${updates.join(', ')}
      WHERE document = ?
    `;
    
    await connection.execute(updateQuery, params);
    await connection.commit();
    
    // 7. Preparar respuesta con cambios realizados
    const changes: any = {};
    
    if (new_phone) {
      changes.phone_principal = {
        anterior: currentPhones.phone || 'No registrado',
        nuevo: new_phone
      };
    }
    
    if (new_phone_alt) {
      changes.phone_alternativo = {
        anterior: currentPhones.phone_alt || 'No registrado',
        nuevo: new_phone_alt
      };
    }
    
    return {
      success: true,
      action: 'update',
      message: 'Teléfonos actualizados exitosamente',
      patient: {
        id: patient.id,
        name: patient.name,
        document: patient.document,
        eps: patient.eps_name
      },
      changes: changes,
      phones_updated: {
        phone_principal: new_phone || currentPhones.phone || 'No registrado',
        phone_alternativo: new_phone_alt || currentPhones.phone_alt || 'No registrado'
      }
    };
    
  } catch (error: any) {
    await connection.rollback();
    console.error('Error actualizando teléfonos:', error);
    return {
      success: false,
      error: 'Error al actualizar teléfonos del paciente',
      details: error.message
    };
  } finally {
    connection.release();
  }
}
```

---

## Estado del Sistema

- ✅ **Herramienta activa** desde: 25 de octubre de 2025
- ✅ **Compilación**: Sin errores
- ✅ **Servidor**: PM2 restart #37
- ✅ **Memoria**: 15.5 MB
- ✅ **Total herramientas MCP**: 23

---

## Notas Importantes

1. 📌 Si no se proporcionan `new_phone` ni `new_phone_alt`, la herramienta solo **consulta** sin modificar
2. 📌 Puede actualizar **solo uno** de los teléfonos o **ambos** simultáneamente
3. 📌 Si un teléfono alternativo no existe, muestra "No registrado"
4. 📌 Las actualizaciones usan **transacciones** para garantizar integridad
5. 📌 El reporte de cambios muestra valores **anteriores y nuevos** para trazabilidad
6. 📌 La herramienta verifica que el paciente esté **activo** antes de permitir actualizaciones
7. 📌 Incluye información de la **EPS** del paciente en la respuesta para contexto completo

---

## Ejemplos de Integración con ElevenLabs

### Consulta de teléfono
```
Usuario: "¿Cuál es el teléfono del paciente con cédula 1234567890?"
Sistema: [Llama actualizarPhone con solo document]
Respuesta: "El paciente Juan Pérez tiene teléfono principal 3001234567 y teléfono alternativo 3109876543"
```

### Actualización de teléfono
```
Usuario: "Necesito actualizar el teléfono del paciente 1234567890 a 3205556789"
Sistema: [Llama actualizarPhone con document y new_phone]
Respuesta: "El teléfono principal se actualizó de 3001234567 a 3205556789"
```

### Agregar teléfono alternativo
```
Usuario: "Quiero agregar un teléfono alternativo para el paciente 1234567890, es el 3157778899"
Sistema: [Llama actualizarPhone con document y new_phone_alt]
Respuesta: "Se agregó el teléfono alternativo 3157778899 al paciente Juan Pérez"
```

---

## Changelog

### Versión 1.0 - 25 de octubre de 2025
- ✅ Implementación inicial
- ✅ Consulta de teléfonos actuales
- ✅ Actualización de teléfono principal
- ✅ Actualización de teléfono alternativo
- ✅ Validación de paciente activo
- ✅ Manejo de transacciones
- ✅ Reportes detallados de cambios

---

## Soporte

Para consultas o reportes de errores relacionados con esta herramienta, contacte al equipo de desarrollo del sistema MCP Biosanar.
