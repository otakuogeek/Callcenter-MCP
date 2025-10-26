# 🤖 Guía para Actualizar el Prompt del Agente - Registro de Pacientes v1.1

## 📋 Cambios en el Flujo de Registro

### **PASO 4 ACTUALIZADO: Solicitar Datos Completos del Paciente**

El agente ahora debe recopilar **7 campos obligatorios** en lugar de 3:

---

## 🔄 Nuevo Flujo de Registro (v1.1)

### **PASO 4.1: Presentar Zonas Disponibles**

**Acción del Agente:**
```
"Para completar su registro, necesito algunos datos. Primero, ¿en qué zona 
se encuentra? Tenemos disponible:
- Zona de Socorro
- Zona San Gil
¿Cuál le queda más cerca?"
```

**Herramienta a llamar:**
```json
{
  "name": "listZones",
  "arguments": {}
}
```

**Respuesta del sistema:**
```json
{
  "zones_list": [
    {"id": 3, "name": "Zona de Socorro", "description": "..."},
    {"id": 4, "name": "Zona San Gil", "description": "..."}
  ]
}
```

---

### **PASO 4.2: Solicitar Cédula**

**Agente:**
```
"Perfecto, Zona de Socorro. Ahora, ¿me regala su número de cédula?"
```

**Normalizar:** Aplicar proceso de limpieza (eliminar puntos, espacios, guiones)

---

### **PASO 4.3: Solicitar Nombre Completo**

**Agente:**
```
"Gracias. ¿Me puede indicar su nombre completo, por favor?"
```

---

### **PASO 4.4: Solicitar Teléfono**

**Agente:**
```
"Perfecto. ¿Y su número de teléfono de contacto?"
```

**Normalizar:** Eliminar espacios, guiones, paréntesis

---

### **PASO 4.5: Solicitar Fecha de Nacimiento**

**Agente:**
```
"Necesito su fecha de nacimiento. ¿Me puede indicar el día, mes y año?"
```

**Ejemplos de conversación:**
- Paciente: "15 de mayo de 1985"
- Agente: "Perfecto, 15 de mayo de 1985. Confirmo entonces 1985-05-15."

**Validación:**
- Formato YYYY-MM-DD
- Ejemplo: 1985-05-15

**Si el formato es incorrecto:**
```
"Disculpe, necesito la fecha en formato día-mes-año. Por ejemplo: 15 de mayo de 1985."
```

---

### **PASO 4.6: Solicitar Género**

**Agente:**
```
"Para completar los datos, ¿con qué género se identifica: masculino, 
femenino, u otro?"
```

**Opciones válidas:**
- Masculino
- Femenino
- Otro
- No especificado (si el paciente prefiere no responder)

**Si el paciente pregunta:**
```
"Es un dato requerido para su registro. Puede indicar: masculino, femenino, 
otro, o si prefiere no especificarlo también es válido."
```

---

### **PASO 4.7: Presentar EPS Disponibles**

**Agente:**
```
"Muy bien. ¿Con qué EPS está afiliado(a)? Atendemos:
- FAMISANAR
- NUEVA EPS
- ALIANSALUD
- COOSALUD

¿Cuál es la suya?"
```

**Herramienta a llamar:**
```json
{
  "name": "listActiveEPS",
  "arguments": {}
}
```

**Mapeo de respuestas:**
- Si dice "Famisanar" → insurance_eps_id: 12
- Si dice "Nueva EPS" → insurance_eps_id: 14
- Si dice "Aliansalud" → insurance_eps_id: 56
- Si dice "Coosalud" → insurance_eps_id: 60

---

### **PASO 4.8: Confirmar Datos**

**Agente:**
```
"Perfecto, deje confirmo sus datos:
- Nombre: [nombre]
- Cédula: [documento]
- Teléfono: [teléfono]
- Fecha de nacimiento: [fecha en formato conversacional]
- Género: [género]
- Zona: [zona]
- EPS: [eps]

¿Está todo correcto?"
```

---

### **PASO 4.9: Registrar Paciente**

**Herramienta a llamar:**
```json
{
  "name": "registerPatientSimple",
  "arguments": {
    "document": "1234567890",
    "name": "María José Pérez García",
    "phone": "3157894561",
    "birth_date": "1985-05-15",
    "gender": "Femenino",
    "zone_id": 3,
    "insurance_eps_id": 12,
    "notes": "Registro para cita de [especialidad]"
  }
}
```

---

## ⚠️ Manejo de Errores

### **Error: Campos Faltantes**
```
Sistema: "Campos obligatorios faltantes: birth_date, gender"

Agente: "Disculpe, necesito completar algunos datos. ¿Me puede indicar 
su fecha de nacimiento?"
```

### **Error: Formato de Fecha Inválido**
```
Sistema: "Formato de fecha inválido"

Agente: "Disculpe, necesito la fecha en formato correcto. Por ejemplo, 
si nació el 15 de mayo de 1985, sería: 15/05/1985. ¿Me puede repetir 
su fecha de nacimiento?"
```

### **Error: Género Inválido**
```
Sistema: "Género inválido. Opciones: Masculino, Femenino, Otro, No especificado"

Agente: "Disculpe, necesito que indique: masculino, femenino, u otro. 
¿Cuál sería?"
```

### **Error: Zona Inválida**
```
Sistema: "Zona no válida"

Agente: "Disculpe, tenemos disponible Zona de Socorro o Zona San Gil. 
¿Cuál le queda más cerca?"
```

### **Error: EPS Inválida**
```
Sistema: "EPS no válida"

Agente: "Disculpe, no atendemos esa EPS directamente. Las que atendemos 
son: FAMISANAR, NUEVA EPS, ALIANSALUD y COOSALUD. ¿Es alguna de estas?"
```

### **Error: Paciente Duplicado**
```
Sistema: "Paciente duplicado encontrado"

Agente: "Veo que ya está registrado en nuestro sistema con el documento 
[documento]. Vamos a continuar con su cita."
```

---

## 📊 Response Exitoso

```json
{
  "success": true,
  "patient_id": 1074,
  "patient": {
    "id": 1074,
    "document": "1234567890",
    "name": "María José Pérez García",
    "age": 40,
    "gender": "Femenino",
    "zone": {
      "name": "Zona de Socorro"
    },
    "eps": {
      "name": "FAMISANAR"
    }
  }
}
```

**Agente debe decir:**
```
"¡Perfecto! Su registro se completó exitosamente. Tiene 40 años, está 
afiliado(a) a FAMISANAR, y está en la Zona de Socorro. Ahora vamos a 
proceder con su cita."
```

---

## 🎯 Flujo Especial: Paciente Femenino + Embarazo

Si el paciente es **Femenino** y la cita es de:
- Ginecología
- Obstetricia
- Control prenatal

**El agente debe preguntar:**
```
"¿Se encuentra actualmente embarazada?"
```

**Si dice SÍ:**
```
"Perfecto, para llevar un mejor control, ¿me puede indicar la fecha de 
su última menstruación? Es decir, el primer día de su último periodo."
```

**Herramienta a llamar:**
```json
{
  "name": "registerPregnancy",
  "arguments": {
    "patient_id": 1074,
    "start_date": "2025-02-01",
    "high_risk": false
  }
}
```

**El sistema calculará automáticamente:**
- Fecha probable de parto
- Semanas y días de gestación
- Días hasta el parto

---

## 📝 Ejemplo de Conversación Completa

```
👤 Paciente: "Quiero agendar una cita de medicina general"

🤖 Valeria: "Hola, bienvenido a Fundación Biosanar IPS. Con gusto le ayudo 
              a agendar su cita de medicina general. Para comenzar, ¿en qué 
              zona se encuentra: Zona de Socorro o Zona San Gil?"

👤 Paciente: "Zona de Socorro"

🤖 Valeria: "Perfecto. ¿Me regala su número de cédula, por favor?"

👤 Paciente: "1234567890"

🤖 Valeria: "Gracias. ¿Me puede indicar su nombre completo?"

👤 Paciente: "María José Pérez García"

🤖 Valeria: "Muy bien, María José. ¿Y su número de teléfono de contacto?"

👤 Paciente: "315 789 4561"

🤖 Valeria: "Perfecto. Necesito su fecha de nacimiento, ¿me puede indicar 
              el día, mes y año?"

👤 Paciente: "20 de marzo de 1985"

🤖 Valeria: "Gracias, 20 de marzo de 1985. ¿Con qué género se identifica: 
              masculino, femenino, u otro?"

👤 Paciente: "Femenino"

🤖 Valeria: "Muy bien. ¿Con qué EPS está afiliada? Atendemos FAMISANAR, 
              NUEVA EPS, ALIANSALUD y COOSALUD."

👤 Paciente: "FAMISANAR"

🤖 Valeria: "Perfecto. Deje confirmo sus datos:
              - Nombre: María José Pérez García
              - Cédula: 1234567890
              - Teléfono: 3157894561
              - Fecha de nacimiento: 20 de marzo de 1985
              - Género: Femenino
              - Zona: Zona de Socorro
              - EPS: FAMISANAR
              ¿Está todo correcto?"

👤 Paciente: "Sí, todo correcto"

🤖 Valeria: "¡Excelente! Su registro se completó exitosamente. Tiene 40 años 
              y está en nuestro sistema. Ahora vamos a buscar disponibilidad 
              para su cita de medicina general..."
```

---

## 🔑 Puntos Clave para el Agente

1. ✅ **Siempre** llamar a `listZones` antes de solicitar la zona
2. ✅ **Siempre** llamar a `listActiveEPS` antes de solicitar la EPS
3. ✅ **Validar** formato de fecha de nacimiento (YYYY-MM-DD)
4. ✅ **Confirmar** todos los datos antes de registrar
5. ✅ **Calcular** y mencionar la edad del paciente después del registro
6. ✅ **Manejar** errores de forma amigable sin revelar detalles técnicos
7. ✅ **Preguntar** sobre embarazo si es paciente femenino + especialidad gineco/obstétrica

---

## 📚 Herramientas Relacionadas

| Herramienta | Cuándo Usar |
|-------------|-------------|
| `listZones` | Antes de solicitar zona al paciente |
| `listActiveEPS` | Antes de solicitar EPS al paciente |
| `registerPatientSimple` | Después de recopilar los 7 campos obligatorios |
| `registerPregnancy` | Si paciente femenino confirma embarazo |

---

**Actualizado:** 2025-10-13  
**Versión:** 1.1.0  
**Estado:** ✅ Listo para implementar
