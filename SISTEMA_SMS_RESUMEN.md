# 📱 Sistema de SMS

## Descripción General

El sistema de SMS permite enviar notificaciones y recordatorios a los pacientes a través de la API de **LabsMobile**. Soporta envío individual, masivo y personalizado.

---

## 🚀 Funcionalidades

### 1. Recordatorios de Cita Automáticos
Envía recordatorios estandarizados a todos los pacientes confirmados en una agenda:

```
Hola [NOMBRE]! 📅 Recordatorio de su cita:
🏥 Especialidad: Medicina General
👨‍⚕️ Doctor: Dr. Juan Pérez
📍 Sede: Sede Principal
📆 Fecha: Lunes 3 de febrero de 2026
🕐 Hora: 09:00 a.m.

Por favor asista puntualmente. ¡Le esperamos!
- Fundación Biosanar IPS
```

**Cómo usar:**
1. Ir a **Gestión de Agenda** → Ver disponibilidad
2. Click en botón verde **"Notificar SMS"**
3. Confirmar el envío

### 2. SMS Personalizado Masivo
Permite escribir cualquier mensaje y enviarlo a todos los pacientes de una agenda:

**Cómo usar:**
1. Ir a **Gestión de Agenda** → Ver disponibilidad
2. Click en botón morado **"SMS Personalizado"**
3. Escribir el mensaje (máx. 400 caracteres)
4. Click en **"Enviar SMS"**

### 3. SMS Individual
Envío de mensajes a pacientes específicos desde su ficha.

---

## 📊 Historial de SMS

### Visualización
- Ir a **Gestión** → **SMS** en el menú lateral
- Filtrar por fecha, estado o paciente
- Ver costo y estado de entrega de cada mensaje

### Datos Registrados
| Campo | Descripción |
|-------|-------------|
| `recipient_number` | Número de teléfono destino |
| `recipient_name` | Nombre del paciente |
| `message` | Contenido del mensaje |
| `status` | success / failed |
| `cost` | Costo en USD |
| `sent_at` | Fecha y hora de envío |
| `patient_id` | ID del paciente (si aplica) |

### Números Compartidos
Cuando varios pacientes comparten el mismo número de teléfono, el sistema crea un registro de SMS para **cada paciente**, permitiendo que todos vean el mensaje en su historial.

---

## ⚙️ Configuración Técnica

### Variables de Entorno
```env
LABSMOBILE_USERNAME=contacto@biosanarcall.site
LABSMOBILE_PASSWORD=your_api_key
```

### Endpoints API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/sms/send` | Enviar SMS individual |
| POST | `/api/sms/notify-availability-patients` | Recordatorio a agenda |
| POST | `/api/sms/send-custom-bulk` | SMS personalizado masivo |
| GET | `/api/sms/history` | Historial de SMS |
| GET | `/api/sms/balance` | Saldo disponible |

### Costos
- **Colombia (57x)**: ~$0.043 USD por SMS
- **Venezuela (58x)**: ~$2.046 USD por SMS
- **Internacional**: Varía por país

---

## 🔄 Sincronización con LabsMobile

El sistema puede sincronizar el historial de SMS desde un archivo CSV exportado de LabsMobile:

```bash
# Formato CSV esperado
"ID";"Sender";"Phone";"Message";"SentAt";"Cost";"Status";"DeliveredAt";"Extra"
```

---

## 📈 Estadísticas

### Resumen Actual
- **+4,000** SMS enviados
- **93%** tasa de entrega exitosa
- **2,793** pacientes únicos notificados

### Por Mes (Ejemplo)
| Mes | Total SMS | Con Paciente | Exitosos | Costo |
|-----|-----------|--------------|----------|-------|
| Dic 2025 | 718 | 665 | 659 | $178.57 |
| Ene 2026 | 3,392 | 3,174 | 3,070 | $588.38 |

---

## ⚠️ Notas Importantes

1. **Validación de números**: Solo se envían SMS a números válidos (10+ dígitos)
2. **Rate limiting**: 500ms de pausa entre envíos masivos
3. **Firma automática**: Todos los mensajes incluyen "- Fundación Biosanar IPS"
4. **Logs**: Todos los envíos se registran en `sms_logs`

---

*Última actualización: Enero 2026*
