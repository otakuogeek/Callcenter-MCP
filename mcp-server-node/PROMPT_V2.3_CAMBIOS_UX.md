# 🎭 Actualización Prompt v2.2 → v2.3: UX Optimizada
## NUNCA Mencionar "Lista de Espera" al Paciente

---

## 🎯 Objetivo del Cambio

**Problema Identificado**: El prompt v2.2 mencionaba términos técnicos como "lista de espera", "cola", "posición", "número de referencia", etc., cuando no había cupos disponibles.

**Solución v2.3**: Simplificar la comunicación. Cuando no hay cupos, solo decir que un operador se contactará para darle los detalles de su cita, sin mencionar ningún término técnico.

---

## 📝 Cambios Realizados

### **1. Nueva Regla 12 - Prohibición Explícita**

**AÑADIDO en v2.3**:
```markdown
12. NUNCA Menciones "Lista de Espera" al Paciente: 
    Si no hay cupos, NUNCA uses términos como:
    - "lista de espera"
    - "cola"
    - "posición"
    - "waiting list"
    - "número de referencia"
    - "tiempo de espera"
    
    Solo di que uno de los operadores se contactará para darle 
    los detalles de su cita. Esta información es SOLO para uso 
    interno del sistema.
```

---

### **2. PASO 6 - Confirmación SIN Cupos (REFACTORIZADO)**

#### **ANTES (v2.2)**:
```markdown
5. Confirmación de Lista de Espera: 
   "Su solicitud ha sido registrada exitosamente en nuestra 
   lista de espera para [especialidad]. Su número de referencia 
   es el [waiting_list_id] y su posición en la cola es la 
   número [queue_position] con prioridad [priority_level]."
   
   "Una de nuestras operadoras se comunicará con usted muy 
   pronto para confirmarle el día y la hora de su cita..."
```

❌ **Problemas**:
- Menciona "lista de espera" explícitamente
- Da detalles técnicos: waiting_list_id, queue_position
- Revela internals del sistema al paciente
- Puede generar ansiedad ("¿cuánto esperaré?")

---

#### **DESPUÉS (v2.3)**:
```markdown
5. Confirmación SIN Mencionar "Lista de Espera":
   "Su solicitud ha sido registrada exitosamente. Actualmente 
   no tenemos fecha de atención disponible, pero uno de nuestros 
   operadores se pondrá en contacto con usted muy pronto para 
   darle los detalles de su cita. Por favor, esté atento a su 
   teléfono."

   NUNCA menciones:
   - "lista de espera", "cola", "posición"
   - "número de referencia", "waiting_list_id", "queue_position"
   
   NUNCA digas:
   - Cuánto tiempo esperará
   - Qué posición tiene
   - Que está en una cola
```

✅ **Ventajas**:
- Lenguaje natural y amigable
- No revela complejidad técnica
- Enfocado en la solución ("operador contactará")
- Menos ansiedad para el paciente
- Experiencia profesional

---

### **3. Flujo de Consulta de Estado (ACTUALIZADO)**

#### **ANTES (v2.2)**:
```markdown
Flujo de Consulta de Lista de Espera

PASO III: Informar al Paciente
"Señor/a [nombre], veo su solicitud en la lista de espera 
para [especialidad]. Su posición actual es la número 
[queue_position] con prioridad [priority_level]. Una de 
nuestras operadoras estará contactándolo muy pronto..."
```

❌ **Problemas**: Menciona "lista de espera", "posición", "prioridad"

---

#### **DESPUÉS (v2.3)**:
```markdown
Flujo de Consulta de Estado de Solicitud

PASO III: Informar al Paciente (SIN mencionar "lista de espera")
"Señor/a [nombre], veo su solicitud para [especialidad] en 
el sistema. Estamos procesando su caso y uno de nuestros 
operadores se comunicará con usted muy pronto para confirmar 
los detalles de su cita."

NUNCA menciones:
- "lista de espera"
- "posición en la cola"
- "número de referencia"
- "tiempo de espera"
```

✅ **Ventajas**: Información clara sin detalles técnicos

---

### **4. Header y Novedades (ACTUALIZADO)**

```diff
- # Prompt Agente Valeria v2.2 - Specialty-Centric
+ # Prompt Agente Valeria v2.3 - UX Optimizada

## ⚡ Novedades en v2.3 (UX OPTIMIZADA - SIN MENCIONAR LISTA DE ESPERA)
...
- Si NO hay cupos → Registra en lista de espera (pregunta prioridad)
+ Si NO hay cupos → Registra solicitud (operador contactará después)
...
+ 🚫 NUNCA menciones "Lista de Espera": Solo di que un operador 
+ se contactará. NO uses términos técnicos.
```

---

## 📊 Comparativa de Experiencia del Usuario

### **Escenario: NO hay cupos disponibles**

#### **v2.2 (Antes)**:
```
Valeria: "Para procesar su solicitud correctamente, ¿su consulta 
         es de carácter 'Urgente', 'Alta', 'Normal' o 'Baja'?"

Paciente: "Normal"

Valeria: "Perfecto. ¿Cuál es el motivo de la consulta?"

Paciente: "Control de dermatología"

Valeria: "Su solicitud ha sido registrada exitosamente en nuestra 
         lista de espera para Dermatología. Su número de referencia 
         es el 45 y su posición en la cola es la número 3 con 
         prioridad Normal."

Paciente: [¿Lista de espera? ¿Posición 3? ¿Cuánto tiempo esperaré?]
```

❌ **Problemas**:
- Revela que hay una "lista de espera"
- Da detalles técnicos que generan preguntas
- Paciente se pregunta: "¿Cuándo me llamarán?"
- Experiencia técnica, no humana

---

#### **v2.3 (Ahora)**:
```
Valeria: "Para procesar su solicitud correctamente, ¿su consulta 
         es de carácter 'Urgente', 'Alta', 'Normal' o 'Baja'?"

Paciente: "Normal"

Valeria: "Perfecto. ¿Cuál es el motivo de la consulta?"

Paciente: "Control de dermatología"

Valeria: "Su solicitud ha sido registrada exitosamente. Actualmente 
         no tenemos fecha de atención disponible, pero uno de 
         nuestros operadores se pondrá en contacto con usted muy 
         pronto para darle los detalles de su cita. Por favor, 
         esté atento a su teléfono."

Paciente: [Ok, me llamarán pronto. Claro y simple.]
```

✅ **Ventajas**:
- No menciona complejidad técnica
- Mensaje claro: "te llamaremos"
- Enfocado en la solución
- Experiencia profesional y humana
- Menos preguntas de seguimiento

---

### **Escenario: SÍ hay cupos disponibles**

#### **Sin Cambios** (funciona igual en v2.2 y v2.3):
```
Valeria: "Para finalizar, ¿cuál es el motivo de la consulta?"

Paciente: "Control de dermatología"

Valeria: "¡Perfecto! Su cita ha sido confirmada. Le confirmo los 
         detalles: es con la doctora Ana María Gómez el día 
         10 de octubre a las 8 de la mañana, en la sede 
         Biosanar San Gil. El número de su cita es el 1234."
```

✅ **Sigue igual**: Cuando hay cupos, se entregan TODOS los detalles (día, hora, doctor, número de cita).

---

## 🎭 Palabras y Frases Prohibidas

### **NUNCA usar cuando NO hay cupos**:

| ❌ Prohibido | ✅ Alternativa |
|-------------|---------------|
| "lista de espera" | "su solicitud ha sido registrada" |
| "cola" | (no mencionar) |
| "posición" | (no mencionar) |
| "número de referencia" | (no mencionar) |
| "waiting list" | (no mencionar) |
| "queue position" | (no mencionar) |
| "tiempo de espera" | "muy pronto" |
| "estará en la lista" | "operador se contactará" |
| "lo agregaremos a la cola" | "procesaremos su solicitud" |

### **Frases aprobadas**:

✅ "Su solicitud ha sido registrada exitosamente"  
✅ "Actualmente no tenemos fecha de atención disponible"  
✅ "Uno de nuestros operadores se pondrá en contacto con usted"  
✅ "Le darán los detalles de su cita"  
✅ "Esté atento a su teléfono"  
✅ "Estamos procesando su caso"  

---

## 🔄 Flujo Técnico (Interno) vs Mensaje al Paciente

### **Interno (Sistema)**:
```json
{
  "waiting_list": true,
  "waiting_list_id": 45,
  "queue_position": 3,
  "priority_level": "Normal",
  "status": "pending"
}
```

### **Mensaje al Paciente (v2.3)**:
```
"Su solicitud ha sido registrada exitosamente. 
Actualmente no tenemos fecha de atención disponible, 
pero uno de nuestros operadores se pondrá en contacto 
con usted muy pronto para darle los detalles de su cita."
```

**Separación clara**: Los datos técnicos son para el sistema, el mensaje es para humanos.

---

## 📋 Checklist de Validación

### ✅ Reglas
- [x] Regla 12 añadida: Prohibición explícita de mencionar "lista de espera"

### ✅ PASO 6
- [x] Flujo AGENDA_DIRECTA: Sin cambios (sigue entregando todos los detalles)
- [x] Flujo LISTA_ESPERA: Confirmación simplificada sin términos técnicos
- [x] Lista de palabras prohibidas añadida

### ✅ Flujos Adicionales
- [x] "Flujo de Consulta de Lista de Espera" → "Flujo de Consulta de Estado"
- [x] Mensaje simplificado sin mencionar posición o referencia

### ✅ Header y Novedades
- [x] Versión actualizada: v2.2 → v2.3
- [x] Subtítulo: "UX Optimizada"
- [x] Nueva bala: "NUNCA menciones 'Lista de Espera'"

---

## 🎯 Impacto Esperado

### **Experiencia del Usuario**:
- ✅ Conversaciones más naturales
- ✅ Menos ansiedad sobre tiempos de espera
- ✅ Enfoque en la solución ("te llamaremos")
- ✅ Experiencia profesional y humana

### **Beneficios Operativos**:
- ✅ Menos preguntas de seguimiento
- ✅ Menos llamadas preguntando "¿cuándo me llaman?"
- ✅ Sistema interno sigue funcionando igual
- ✅ Información técnica protegida

### **Consistencia**:
- ✅ Alineado con mejores prácticas de UX
- ✅ Lenguaje amigable y accesible
- ✅ Separación clara: interno vs externo

---

## 📚 Archivos Modificados

- **Prompt**: `/mcp-server-node/newprompt.md` (v2.3)
- **Backend**: Sin cambios (sigue siendo v3.5)
- **Documentación**: Este archivo (PROMPT_V2.3_CAMBIOS_UX.md)

---

## ✅ Estado

- **Prompt**: v2.3 ✅
- **Backend**: v3.5 ✅
- **Compatibilidad**: 100% ✅
- **UX**: Optimizada ✅

---

## 🚀 Resumen Ejecutivo

**Cambio Principal**: Valeria ya NO menciona "lista de espera" cuando no hay cupos. Solo dice que un operador se contactará para darle los detalles de su cita.

**Cuándo aplicar**:
- ✅ Cuando HAY cupos: Entrega día, hora, doctor, número de cita
- ✅ Cuando NO hay cupos: "Operador se contactará muy pronto"

**Palabras prohibidas**: "lista de espera", "cola", "posición", "número de referencia"

**Versión**: v2.3 (UX Optimizada)

---

**Fecha**: 2025-10-02  
**Versión**: Prompt v2.3  
**Estado**: ✅ Actualizado y Listo
