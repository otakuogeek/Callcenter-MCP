# Sistema de Códigos QR para Citas Médicas

## 📋 Descripción General

El sistema permite generar códigos QR descargables que contienen toda la información de una cita médica. Estos códigos pueden ser escaneados para validar la cita al momento de la llegada del paciente.

## 🎯 Funcionalidades Implementadas

### Portal de Pacientes (`/users`)
- ✅ Botón "Descargar QR de Cita" en cada cita programada
- ✅ Generación automática de imagen PNG con QR y detalles de la cita
- ✅ Diseño profesional con logo y colores institucionales
- ✅ Información completa del paciente y la cita

### Panel de Administración (`/patients`)
- ✅ Botón "Descargar QR" en el modal de detalles del paciente
- ✅ Visible en la sección de citas (pasadas y futuras)
- ✅ Permite a recepcionistas generar QR para los pacientes
- ✅ Notificación toast al generar exitosamente

## 📦 Información Contenida en el QR

El código QR contiene un objeto JSON con la siguiente estructura:

```json
{
  "tipo": "CITA_MEDICA",
  "paciente": {
    "nombre": "Juan Pérez",
    "documento": "12345678",
    "telefono": "3001234567"
  },
  "cita": {
    "id": 135,
    "fecha": "2025-10-20",
    "hora": "07:00",
    "doctor": "Dra. Laura Julia Podeva",
    "especialidad": "Odontología",
    "sede": "Sede biosanarcall san gil",
    "motivo": "Chequeo general",
    "estado": "Confirmada"
  },
  "generado": "2025-10-13T12:30:00.000Z",
  "institucion": "Fundación Biosanar IPS"
}
```

## 🎨 Diseño del QR Descargable

La imagen generada incluye:

1. **Header Azul** (600x80px)
   - Fondo azul (#2563EB)
   - Título: "Fundación Biosanar IPS"
   - Tipografía: Arial Bold 28px

2. **Sección de Información** (600x320px)
   - Título: "CONFIRMACIÓN DE CITA"
   - Datos del paciente:
     - Nombre completo
     - Número de documento
   - Detalles de la cita:
     - Fecha (formato legible: "20 de Octubre de 2025")
     - Hora (formato 24h: "07:00")
     - Doctor asignado
     - Sede

3. **Código QR** (300x300px)
   - Centrado en la imagen
   - Alta resolución (512x512px internamente)
   - Margen de 2 módulos
   - Colores: Negro (#000000) sobre blanco (#FFFFFF)

4. **Footer Informativo**
   - Texto instructivo: "Escanee este código al llegar a su cita"
   - ID de cita para referencia rápida

## 💾 Especificaciones Técnicas

### Librería Utilizada
- **qrcode** v1.5.4
- **@types/qrcode** para TypeScript
- Canvas API del navegador para composición

### Configuración del QR
```typescript
{
  width: 512,          // Resolución alta para impresión
  margin: 2,           // Margen mínimo
  color: {
    dark: '#000000',   // Módulos oscuros
    light: '#FFFFFF'   // Fondo blanco
  }
}
```

### Dimensiones del Archivo
- Canvas: 600x800 píxeles
- Formato: PNG
- Peso aproximado: 50-80 KB
- Nombre del archivo: `Cita_{ID}_{Documento}.png`

## 🔄 Flujo de Uso

### Para Pacientes:
1. Ingresar al portal con su documento
2. Ir a la pestaña "Mis Citas"
3. Localizar la cita programada
4. Hacer clic en "Descargar QR de Cita"
5. Guardar la imagen en el teléfono o imprimirla
6. Presentar el QR al llegar a la cita

### Para Recepcionistas:
1. Buscar al paciente en el panel de administración
2. Abrir el modal de detalles del paciente
3. Ir a la sección de citas
4. Hacer clic en "Descargar QR" en la cita deseada
5. Enviar la imagen al paciente por WhatsApp/Email

## 🔐 Validación del QR (Futuro)

### Próximas Implementaciones Sugeridas:

1. **Lector de QR en Recepción**
   - Escanear QR al llegar el paciente
   - Validar información contra base de datos
   - Confirmar automáticamente la asistencia
   - Actualizar estado de la cita a "En curso"

2. **Backend Endpoint de Validación**
   ```typescript
   POST /api/appointments/validate-qr
   Body: { qrData: string }
   Response: { 
     valid: boolean, 
     appointment: {...},
     patient: {...}
   }
   ```

3. **Sistema de Check-in Automático**
   - Actualizar estado al escanear
   - Notificar al médico
   - Generar registro de hora de llegada
   - Calcular tiempo de espera

## 📱 Compatibilidad

### Navegadores Soportados:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Dispositivos:
- ✅ Desktop (Windows, macOS, Linux)
- ✅ Mobile (Android, iOS)
- ✅ Tablets

## 🐛 Solución de Problemas

### El QR no se descarga
**Solución:** Verificar que el navegador permita descargas automáticas. Revisar la configuración de seguridad.

### El QR está borroso al imprimir
**Solución:** La imagen se genera en alta resolución (512px). Asegurarse de imprimir al 100% de escala.

### Error al generar el QR
**Solución:** Verificar que todos los datos de la cita estén completos. Limpiar caché del navegador (Ctrl+Shift+R).

## 📊 Estadísticas de Uso (Futuras)

Se pueden implementar métricas para:
- Cantidad de QR generados por día
- Tasa de uso del QR vs. check-in manual
- Tiempo promedio ahorrado en recepción
- Satisfacción del paciente con el sistema

## 🔮 Mejoras Futuras

1. **Envío Automático por WhatsApp**
   - Generar QR al confirmar cita
   - Enviar automáticamente al paciente
   - Integración con Twilio/WhatsApp Business

2. **QR Dinámico con Tiempo Limitado**
   - Token temporal válido solo el día de la cita
   - Mayor seguridad
   - Prevenir duplicación de citas

3. **App Móvil para Escaneo**
   - App nativa para recepcionistas
   - Escaneo optimizado
   - Modo offline con sincronización

4. **Integración con Impresora Térmica**
   - Impresión automática del QR
   - Entrega física al paciente
   - Reducción de uso de papel A4

## 📝 Notas de Implementación

### Archivos Modificados:
- `frontend/src/pages/UserPortal.tsx` - Portal de pacientes
- `frontend/src/components/patient-management/PatientDetailsModal.tsx` - Panel admin
- `frontend/package.json` - Dependencia qrcode añadida

### Commits Relacionados:
- Implementación de generación de QR para citas
- Corrección de fechas sin conversión de timezone
- Mejora de UX con botones de descarga

## 🎓 Capacitación de Personal

### Para Recepcionistas:
1. Explicar el botón de descarga en el modal
2. Practicar generación de QR
3. Enseñar a enviar el archivo por WhatsApp

### Para Pacientes:
1. Video tutorial en portal
2. Instrucciones en confirmación de cita
3. Soporte telefónico disponible

---

**Fecha de Implementación:** 13 de Octubre de 2025  
**Versión:** 1.0.0  
**Desarrollado por:** Sistema Biosanarcall IPS  
**Estado:** ✅ Producción
