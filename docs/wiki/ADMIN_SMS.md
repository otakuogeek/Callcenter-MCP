# 📱 Sistema de SMS

## ¿Para qué sirve el módulo de SMS?

El sistema envía mensajes de texto automáticamente para:
- ✅ Confirmar citas agendadas
- 🔔 Recordar citas próximas
- 📢 Notificar cambios o cancelaciones
- 💬 Comunicaciones personalizadas

---

## 📤 Enviar SMS Individual

### Paso a paso:

1. Ve al módulo **"SMS"**
2. Haz clic en **"Nuevo SMS"**
3. Busca al paciente por nombre o cédula
4. Escribe tu mensaje
5. Haz clic en **"Enviar"**

### Longitud del mensaje:
- ✅ Hasta **160 caracteres** = 1 SMS
- ⚠️ Más de 160 caracteres = múltiples SMS (mayor costo)

---

## 📤 Enviar SMS Masivo

### Desde una agenda:

1. Abre la agenda del día
2. Haz clic en **"Enviar SMS a Todos"**
3. El sistema enviará a todos los pacientes con cita ese día

### Desde la cola de espera:

1. Ve a **"Cola de Espera"**
2. Selecciona una especialidad
3. Haz clic en **"SMS Masivo"**
4. Escribe el mensaje
5. Confirma el envío

### SMS Personalizado:
Usa el botón **"SMS Personalizado"** para escribir un mensaje único que se enviará a todos los pacientes seleccionados.

---

## 📋 Ver Historial de SMS

### Información disponible:
- 📅 **Fecha y hora** del envío
- 👤 **Destinatario** (nombre y teléfono)
- 💬 **Contenido** del mensaje
- ✅ **Estado**: Enviado / Fallido / Pendiente

### Filtros:
- Por **fecha** (rango de fechas)
- Por **estado** (enviados, fallidos, todos)
- Por **paciente** (búsqueda)

---

## 📝 Plantillas de Mensajes

### Mensajes automáticos del sistema:

#### Confirmación de Cita:
```
Hola [Nombre]! Tu cita ha sido CONFIRMADA.
Fecha: [día], [fecha]
Hora: [hora]
Doctor: [nombre doctor]
Sede: [nombre sede]
- Fundación Biosanar IPS
```

#### Recordatorio de Cita:
```
Hola [Nombre]! 📅 Recordatorio de su cita:
🏥 Especialidad: [especialidad]
👨‍⚕️ Doctor: [nombre]
📍 Sede: [sede]
📆 Fecha: [fecha]
🕐 Hora: [hora]
Por favor asista puntualmente. ¡Le esperamos!
- Fundación Biosanar IPS
```

#### Cancelación de Cita:
```
Hola [Nombre]. Lamentamos informarle que su cita ha sido cancelada.
Motivo: [motivo]
Por favor comuníquese para reagendar.
- Fundación Biosanar IPS
```

---

## ⚠️ Errores Comunes de Envío

### El SMS no se envía:

| Error | Causa | Solución |
|-------|-------|----------|
| **Número inválido** | Teléfono mal registrado | Corregir en el perfil del paciente |
| **Sin saldo** | Créditos agotados | Contactar administrador |
| **Número no existe** | El número fue dado de baja | Actualizar teléfono del paciente |

### Formato correcto del teléfono:
- ✅ `3001234567` (10 dígitos)
- ✅ `573001234567` (con código país)
- ❌ `+57 300 123 4567` (no usar espacios)

---

## 📊 Estadísticas de SMS

En el panel puedes ver:
- 📤 **Total enviados** (mes actual)
- ✅ **Exitosos**
- ❌ **Fallidos**
- 💰 **Créditos restantes**

---

## 💡 Buenas Prácticas

1. **Verifica el teléfono** antes de enviar
2. **Mensajes cortos**: Menos de 160 caracteres cuando sea posible
3. **Información clara**: Incluye fecha, hora y sede
4. **Horario apropiado**: Evita enviar muy temprano o muy tarde
5. **No abuses**: Solo mensajes importantes y relevantes

---

## ❓ Preguntas Frecuentes

### ¿Cuánto cuesta cada SMS?
El costo depende del plan contratado con LabsMobile. Consulta al administrador.

### ¿Puedo enviar SMS a números de otros países?
Sí, el sistema soporta números de Colombia (+57) y otros países.

### ¿El paciente puede responder al SMS?
No, los SMS son solo de salida. Para comunicación bidireccional usa WhatsApp.

### ¿Cómo sé si el paciente recibió el SMS?
En el historial verás el estado "Enviado". Sin embargo, esto indica que se envió al operador, no que el paciente lo leyó.

### ¿Puedo programar SMS para enviar después?
Actualmente no. Los SMS se envían inmediatamente.

---

*Para más información sobre configuración técnica, contacta al administrador.*
