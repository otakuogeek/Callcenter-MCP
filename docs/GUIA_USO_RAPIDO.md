# 🚀 Guía Rápida de Uso - Nuevas Funcionalidades

## 📱 Para Pacientes (Portal de Usuario)

### Descargar Código QR de tu Cita

1. Ingresa al **Portal de Usuario** en https://biosanarcall.site/user-portal
2. Ingresa tu número de documento
3. Busca tu cita en la lista de citas programadas
4. Haz clic en el botón **"Descargar QR"** 📱
5. Se descargará automáticamente un archivo PNG con:
   - Tus datos personales
   - Información completa de la cita
   - Código QR escaneable

### Usar el Código QR

1. **Imprime** el código QR o **llévalo en tu celular**
2. **Presenta** el código en la recepción el día de tu cita
3. El recepcionista **escaneará** el código para validar tu asistencia

---

## 👨‍💼 Para Administradores

### Ver Fechas Correctamente

✅ Todas las fechas ahora se muestran **correctamente** sin el error de -1 día:
- Fechas de nacimiento de pacientes
- Fechas de citas médicas
- Fechas en reportes

**No requiere ninguna acción**, el sistema ya está corregido.

### Redistribuir Cupos de Días Pasados

#### Opción 1: Desde Postman o Terminal

**Redistribuir una disponibilidad específica:**
```bash
POST https://biosanarcall.site/api/availabilities/143/redistribute
Authorization: Bearer {tu_token_admin}
Content-Type: application/json
```

**Redistribuir TODAS las disponibilidades:**
```bash
POST https://biosanarcall.site/api/availabilities/redistribute/all
Authorization: Bearer {tu_token_admin}
Content-Type: application/json
```

#### Opción 2: Configurar Redistribución Automática Diaria

**Crear archivo de script:**
```bash
# /home/ubuntu/scripts/redistribuir-cupos.sh
#!/bin/bash

# Obtener token de admin
TOKEN=$(curl -s -X POST "http://localhost:4000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"ChangeMe123!"}' | jq -r '.token')

# Ejecutar redistribución global
curl -s -X POST "http://localhost:4000/api/availabilities/redistribute/all" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"
```

**Configurar cron job (ejecutar todos los días a las 2:00 AM):**
```bash
# Editar crontab
crontab -e

# Agregar línea:
0 2 * * * /home/ubuntu/scripts/redistribuir-cupos.sh >> /var/log/redistribucion.log 2>&1
```

### Consultar Cupos Sin Asignar

```bash
GET https://biosanarcall.site/api/availabilities/143/unassigned-summary
Authorization: Bearer {tu_token_admin}
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "day_date": "2025-10-13",
      "quota": 6,
      "assigned": 0,
      "unassigned": 6,
      "occupancy_rate": "0.00"
    }
  ],
  "total_unassigned": 6
}
```

---

## 👨‍⚕️ Para Recepcionistas

### Validar Códigos QR de Pacientes

**Método 1: Visual**
- Verifica que el código QR tenga el logo de Biosanarcall
- Verifica el nombre del paciente
- Verifica fecha y hora de la cita
- Verifica el ID de la cita en la parte inferior

**Método 2: Escanear (futuro)**
- Usa una app de escaneo de QR
- Lee los datos JSON del código
- Verifica que coincidan con el sistema

### Información en el Código QR

Cada QR contiene:
```json
{
  "tipo": "CITA_MEDICA",
  "paciente": {
    "nombre": "Nombre completo",
    "documento": "12345678",
    "telefono": "3001234567"
  },
  "cita": {
    "id": 123,
    "fecha": "2025-10-20",
    "hora": "07:00",
    "doctor": "Dr. Nombre",
    "especialidad": "Medicina General",
    "sede": "Sede Principal",
    "motivo": "Consulta",
    "estado": "confirmada"
  }
}
```

---

## 🔧 Para Desarrolladores

### Archivos Modificados en Esta Sesión

**Backend:**
- `/backend/src/routes/patients-updated.ts` - Corrección de fechas
- `/backend/src/utils/redistribution.ts` - **NUEVO** - Lógica de redistribución
- `/backend/src/routes/availabilities.ts` - Endpoints de redistribución

**Frontend:**
- `/frontend/src/pages/UserPortal.tsx` - QR + fechas corregidas
- `/frontend/src/components/patient-management/PatientDetailsModal.tsx` - QR + fechas
- `/frontend/src/components/patient-management/PatientsList.tsx` - Fechas corregidas

### Endpoints API Nuevos

```typescript
// Redistribuir cupos de una availability
POST /api/availabilities/:id/redistribute

// Redistribuir todas las availabilities activas
POST /api/availabilities/redistribute/all

// Obtener resumen de cupos sin asignar
GET /api/availabilities/:id/unassigned-summary
```

### Dependencias Instaladas

```json
{
  "dependencies": {
    "qrcode": "^1.5.4"
  },
  "devDependencies": {
    "@types/qrcode": "^1.5.5"
  }
}
```

### Comandos de Despliegue

```bash
# Backend
cd /home/ubuntu/app/backend
npm run build
pm2 restart cita-central-backend

# Frontend
cd /home/ubuntu/app/frontend
npm run build
# Archivos se copian automáticamente a nginx
```

---

## 📚 Documentación Adicional

| Documento | Descripción |
|-----------|-------------|
| `SISTEMA_QR_CITAS.md` | Documentación técnica del sistema QR |
| `RESUMEN_IMPLEMENTACION_QR.md` | Resumen ejecutivo del QR |
| `GUIA_RAPIDA_QR.md` | Guía de usuario para QR |
| `SISTEMA_REDISTRIBUCION_CUPOS.md` | Documentación técnica redistribución |
| `REDISTRIBUCION_RESUMEN.md` | Resumen ejecutivo redistribución |
| `RESUMEN_SESION_COMPLETO.md` | Resumen completo de todas las mejoras |

---

## ❓ Preguntas Frecuentes

### ¿Las fechas ya están corregidas?
✅ Sí, tanto en backend como frontend. No requiere ninguna acción.

### ¿Cómo descargo el código QR?
📱 Desde el Portal de Usuario, busca tu cita y haz clic en "Descargar QR".

### ¿Puedo imprimir el código QR?
✅ Sí, el archivo PNG se puede imprimir o mostrar en pantalla.

### ¿Qué pasa con los cupos de días pasados?
🔄 Se redistribuyen automáticamente a días futuros (si configuras el cron job).

### ¿Cómo sé si la redistribución funcionó?
📊 Revisa los logs: `pm2 logs cita-central-backend | grep redistrib`

### ¿Necesito hacer algo especial para usar estas funcionalidades?
❌ No, todo está desplegado y funcionando. Solo úsalas.

---

## 🆘 Soporte

Si encuentras algún problema:

1. **Revisa los logs del backend:**
   ```bash
   pm2 logs cita-central-backend --lines 50
   ```

2. **Verifica el estado del servicio:**
   ```bash
   pm2 status
   ```

3. **Consulta la documentación técnica** en `/docs/`

4. **Contacta al administrador del sistema**

---

**✅ Sistema actualizado y operativo**  
**📅 Última actualización:** 13 de Octubre de 2025  
**🔄 Backend restart:** #27
