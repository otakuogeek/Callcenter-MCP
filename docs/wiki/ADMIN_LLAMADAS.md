# 📞 Sistema de Llamadas Automáticas

## ¿Qué son las llamadas automáticas?

El sistema puede realizar **llamadas telefónicas con inteligencia artificial** para:
- 📅 Confirmar citas próximas
- 🔔 Recordar citas del día siguiente
- 📢 Ofrecer cupos disponibles a pacientes en lista de espera

---

## 🤖 ¿Cómo funciona?

1. El sistema llama al paciente
2. **Valeria** (asistente virtual con voz) saluda
3. Le informa sobre la cita o el cupo disponible
4. El paciente puede responder verbalmente
5. La llamada se registra automáticamente

### Ejemplo de llamada:
```
Valeria: Hola, le llamo de Fundación Biosanar IPS. 
         ¿Hablo con [Nombre del Paciente]?

Paciente: Sí, soy yo.

Valeria: Le llamo para confirmar su cita de mañana 
         a las 10:00 AM con el doctor García en 
         medicina general. ¿Puede asistir?

Paciente: Sí, confirmo.

Valeria: Perfecto, su cita está confirmada. 
         Recuerde llegar 15 minutos antes. 
         ¡Que tenga un buen día!
```

---

## 📞 Realizar una Llamada Manual

### Desde la cola de espera:
1. Busca al paciente
2. Haz clic en **"Llamar"** 📞
3. El sistema iniciará la llamada automática

### Desde una cita:
1. Abre el detalle de la cita
2. Haz clic en **"Llamar para confirmar"**

---

## 📋 Ver Historial de Llamadas

En el módulo **"Llamadas"** verás:

### Información de cada llamada:
- 📅 **Fecha y hora** de la llamada
- 👤 **Paciente** (nombre y teléfono)
- ⏱️ **Duración** de la llamada
- ✅ **Resultado** (Completada, No contestó, Buzón, etc.)
- 📝 **Resumen** de lo conversado

### Estados de llamada:
| Estado | Significado |
|--------|-------------|
| ✅ **Completada** | El paciente contestó y conversó |
| 📵 **No contestó** | El teléfono sonó pero no respondió |
| 📫 **Buzón de voz** | Fue a correo de voz |
| ❌ **Fallida** | Error técnico o número inválido |
| 🔄 **En curso** | Llamada activa en este momento |

---

## 🔍 Filtrar y Buscar Llamadas

### Filtros disponibles:
- 📅 **Por fecha** (rango)
- 📊 **Por estado** (completadas, fallidas, etc.)
- 👤 **Por paciente** (nombre o teléfono)

### Búsqueda en transcripciones:
Puedes buscar palabras dentro de las conversaciones grabadas.

---

## 📊 Estadísticas de Llamadas

El sistema muestra:
- 📞 **Total de llamadas** realizadas
- ✅ **Tasa de éxito** (contestadas vs total)
- ⏱️ **Duración promedio**
- 📈 **Llamadas por día** (gráfico)

---

## ⚙️ ¿Cuándo se hacen llamadas automáticas?

### Recordatorios programados:
- **Un día antes** de la cita (configurable)
- **El mismo día** por la mañana (opcional)

### Llamadas manuales:
- Cuando tú decides llamar a un paciente
- Cuando hay cupos disponibles para lista de espera

---

## 💡 Buenas Prácticas

1. **Revisa las llamadas fallidas** diariamente
2. **Actualiza teléfonos** de pacientes que no contestan
3. **Usa el historial** para ver qué acordaste con cada paciente
4. **Reintenta** a diferentes horas si no contestan

---

## ❓ Preguntas Frecuentes

### ¿El paciente ve un número conocido?
Sí, las llamadas salen desde el número oficial de la IPS.

### ¿Se graban las llamadas?
Se guarda una transcripción de texto, no el audio.

### ¿Qué pasa si el paciente quiere hablar con un humano?
Valeria le indica que puede llamar directamente a la IPS o escribir por WhatsApp.

### ¿Cuántos intentos se hacen si no contesta?
Por defecto 1, pero se puede configurar hasta 3 reintentos.

### ¿Funciona con teléfonos fijos?
Sí, funciona con celulares y fijos.

---

## 🔧 Solución de Problemas

### La llamada sale como "Fallida":
- Verifica que el número sea correcto
- Asegúrate que el número esté activo
- Prueba llamar manualmente para verificar

### El paciente dice que no recibió la llamada:
- Revisa el historial para ver el estado
- Verifica el número en el perfil del paciente
- Puede que el número esté bloqueando llamadas desconocidas

---

*El sistema de llamadas utiliza tecnología ElevenLabs para voz con IA.*
