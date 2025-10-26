# 📱 Servicio de Envío de SMS - Zadarma

## Descripción General

Este servicio permite enviar notificaciones por SMS a los pacientes usando la API de Zadarma. Soporta envío de mensajes genéricos y mensajes específicos para confirmaciones, recordatorios y cancelaciones de citas.

## Configuración

### Credenciales Zadarma

- **API Key**: `95bedd9dbcc065b5ef54`
- **API Secret**: `66fc39c8dae8c5ad99f2`
- **Endpoint Base**: `https://api.zadarma.com`

Las credenciales están configuradas directamente en el servicio (`/backend/src/services/zadarma-sms.service.ts`).

### Autenticación

Zadarma utiliza un sistema de firma MD5 para autenticar las peticiones:

```typescript
MD5(method + path + params + secret)
```

El servicio maneja automáticamente la generación de firmas.

## Endpoints Disponibles

### 1. Enviar SMS Genérico

**POST** `/api/sms/send`

Envía un SMS personalizado a uno o varios números.

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body:**
```json
{
  "number": "573001234567",
  "message": "Tu mensaje aquí",
  "sender": "BiosanaR",
  "language": "es"
}
```

**Parámetros:**
- `number` (requerido): Número de teléfono en formato internacional (ej: 573001234567). Puede ser un array separado por comas.
- `message` (requerido): Texto del mensaje (máx. 160 caracteres por SMS estándar)
- `sender` (opcional): ID del remitente (número virtual o texto de hasta 11 caracteres)
- `language` (opcional): Código de idioma (por defecto: "es")

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": {
    "status": "success",
    "messages": 1,
    "cost": 0.24,
    "currency": "USD",
    "sms_detalization": [
      {
        "senderid": "BiosanaR",
        "number": "573001234567",
        "cost": 0.06
      }
    ]
  },
  "message": "SMS enviado exitosamente a 573001234567"
}
```

**Respuesta error:**
```json
{
  "success": false,
  "error": "Error al enviar SMS",
  "details": {
    "status": "error",
    "message": "Descripción del error"
  }
}
```

---

### 2. SMS de Confirmación de Cita

**POST** `/api/sms/appointment-confirmation`

Envía un SMS automático confirmando una cita médica.

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body:**
```json
{
  "phoneNumber": "573001234567",
  "patientName": "Juan Pérez",
  "appointmentDate": "2025-10-30",
  "appointmentTime": "10:00 AM",
  "doctorName": "Dr. García",
  "location": "Sede Principal"
}
```

**Plantilla del mensaje:**
```
Hola {patientName}, su cita ha sido confirmada con {doctorName} el {appointmentDate} a las {appointmentTime} en {location}. Fundación Biosanar IPS.
```

**Ejemplo:**
```
Hola Juan Pérez, su cita ha sido confirmada con Dr. García el 2025-10-30 a las 10:00 AM en Sede Principal. Fundación Biosanar IPS.
```

---

### 3. SMS de Recordatorio de Cita

**POST** `/api/sms/appointment-reminder`

Envía un recordatorio automático 24 horas antes de la cita.

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body:**
```json
{
  "phoneNumber": "573001234567",
  "patientName": "María González",
  "appointmentDate": "2025-10-26",
  "appointmentTime": "2:00 PM"
}
```

**Plantilla del mensaje:**
```
Recordatorio: {patientName}, tiene cita mañana {appointmentDate} a las {appointmentTime}. Fundación Biosanar IPS.
```

---

### 4. SMS de Cancelación de Cita

**POST** `/api/sms/appointment-cancellation`

Notifica al paciente sobre la cancelación de su cita.

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body:**
```json
{
  "phoneNumber": "573001234567",
  "patientName": "Pedro Rodríguez",
  "appointmentDate": "2025-10-28"
}
```

**Plantilla del mensaje:**
```
{patientName}, su cita del {appointmentDate} ha sido cancelada. Para reagendar comuníquese al (número). Fundación Biosanar IPS.
```

---

### 5. Obtener Sender IDs Disponibles

**GET** `/api/sms/sender-ids`

Lista los IDs de remitente configurados en la cuenta de Zadarma.

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "senderids": [
      "BiosanaR",
      "+573001234567"
    ]
  }
}
```

---

## Formato de Números de Teléfono

Los números deben estar en **formato internacional** sin espacios ni caracteres especiales:

✅ **Correcto:**
- `573001234567` (Colombia)
- `14155551234` (USA)
- `5491123456789` (Argentina)

❌ **Incorrecto:**
- `300 123 4567`
- `+57 300 1234567`
- `(300) 123-4567`

## Límites y Restricciones

- **Longitud máxima por SMS**: 160 caracteres (GSM-7)
- **Mensajes largos**: Se dividen automáticamente en múltiples SMS
- **Rate limiting**: Configurado en el backend (100 requests/15min por IP)
- **Costo**: Varía según destino (consultar panel de Zadarma)

## Códigos de Error Comunes

| Código | Descripción | Solución |
|--------|-------------|----------|
| 400 | Parámetros faltantes | Verificar que todos los campos requeridos estén presentes |
| 401 | Autenticación fallida | Verificar credenciales de Zadarma |
| 403 | Saldo insuficiente | Recargar saldo en cuenta Zadarma |
| 500 | Error del servidor | Revisar logs del backend |

## Ejemplos de Uso

### Desde cURL

```bash
# Enviar SMS genérico
curl -X POST "http://127.0.0.1:4000/api/sms/send" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "573001234567",
    "message": "Hola, este es un mensaje de prueba",
    "language": "es"
  }'
```

### Desde Frontend (React/TypeScript)

```typescript
import axios from 'axios';

const sendSMSConfirmation = async (appointmentData: any) => {
  try {
    const response = await axios.post('/api/sms/appointment-confirmation', {
      phoneNumber: appointmentData.phone,
      patientName: appointmentData.patientName,
      appointmentDate: appointmentData.date,
      appointmentTime: appointmentData.time,
      doctorName: appointmentData.doctor,
      location: appointmentData.location
    }, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    console.log('SMS enviado:', response.data);
  } catch (error) {
    console.error('Error al enviar SMS:', error);
  }
};
```

### Desde MCP Server (Python)

```python
import requests

def send_appointment_sms(phone, patient_name, date, time, doctor, location):
    url = "http://127.0.0.1:4000/api/sms/appointment-confirmation"
    headers = {
        "Authorization": f"Bearer {os.getenv('BACKEND_TOKEN')}",
        "Content-Type": "application/json"
    }
    payload = {
        "phoneNumber": phone,
        "patientName": patient_name,
        "appointmentDate": date,
        "appointmentTime": time,
        "doctorName": doctor,
        "location": location
    }
    
    response = requests.post(url, json=payload, headers=headers)
    return response.json()
```

## Pruebas

Ejecutar el script de pruebas:

```bash
cd /home/ubuntu/app
./test_sms_service.sh
```

El script probará todos los endpoints disponibles.

## Logs y Monitoreo

Los logs del servicio se encuentran en:

```bash
# Ver logs en tiempo real
pm2 logs cita-central-backend --lines 100

# Buscar logs de SMS
pm2 logs cita-central-backend | grep "SMS"
```

**Ejemplos de logs:**

```
✅ SMS enviado exitosamente: { numbers: '573001234567', messages: 1, cost: 0.24, currency: 'USD' }
❌ Error enviando SMS Zadarma: { error: 'Insufficient balance', params: {...} }
```

## Integración con Sistema de Citas

El servicio está listo para integrarse con el flujo de agendamiento:

1. **Al crear cita**: Llamar a `/appointment-confirmation`
2. **24h antes**: Cronjob llama a `/appointment-reminder`
3. **Al cancelar**: Llamar a `/appointment-cancellation`

## Archivos del Servicio

- **Servicio principal**: `/backend/src/services/zadarma-sms.service.ts`
- **Rutas API**: `/backend/src/routes/sms.routes.ts`
- **Registro de rutas**: `/backend/src/routes/index.ts`
- **Script de prueba**: `/test_sms_service.sh`

## Próximos Pasos

1. ✅ Servicio implementado y funcionando
2. ⏳ Integrar con creación de citas
3. ⏳ Crear cronjob para recordatorios automáticos
4. ⏳ Agregar panel de estadísticas de SMS enviados
5. ⏳ Implementar sistema de plantillas personalizables

## Soporte

Para reportar problemas o solicitar nuevas funcionalidades, contactar al equipo de desarrollo.

---

**Última actualización**: 25 de octubre de 2025
