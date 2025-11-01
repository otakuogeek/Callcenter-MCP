# Credenciales de Acceso para Doctores

## 🔐 Sistema de Autenticación de Doctores

### URL de Acceso
- **Portal de Doctores**: https://biosanarcall.site/doctor-login

---

## 👨‍⚕️ Credenciales Activas

### Ana Teresa Escobar
- **Email**: ana.escobar@biosanarcall.site
- **Contraseña Temporal**: `temp123`
- **Registro Médico**: m1214
- **Teléfono**: 3142564784
- **Especialidad**: Medicina General
- **Sede**: Biosanar San Gil

> ⚠️ **IMPORTANTE**: El doctor debe cambiar esta contraseña temporal en el primer inicio de sesión.

---

## 🛠️ Gestión de Contraseñas (Administradores)

### Resetear Contraseña de un Doctor

Los administradores pueden resetear contraseñas desde:

1. **Panel de Administración**: https://biosanarcall.site/settings
2. Ir a la sección **"Gestión de Doctores"**
3. Localizar al doctor en la lista
4. Hacer clic en **"Editar"**
5. Usar el botón **"Resetear Contraseña"**

Esto generará automáticamente la contraseña temporal `temp123` y:
- Desbloqueará la cuenta
- Reseteará intentos de login
- Cerrará todas las sesiones activas
- Mostrará la contraseña temporal al administrador

### API Endpoint (Para uso programático)

```bash
POST /api/doctor-management/:doctorId/reset-password
Headers: 
  Authorization: Bearer <ADMIN_JWT_TOKEN>
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Contraseña reseteada exitosamente",
  "data": {
    "tempPassword": "temp123",
    "email": "doctor@biosanarcall.site",
    "name": "Nombre del Doctor"
  }
}
```

---

## 📋 Todos los Doctores en el Sistema

| ID  | Nombre                                    | Email                              | Registro |
|-----|-------------------------------------------|-------------------------------------|----------|
| 1   | Oscar Calderon                            | oscar@biosanar.com                  | -        |
| 2   | Dra. Yesika Andrea fiallo                 | yesika@biosanar.com                 | -        |
| **6**   | **Ana Teresa Escobar**                | **ana.escobar@biosanarcall.site**   | **m1214**|
| 7   | Dra. Valentina Abaunza Ballesteros        | vale@biosanar.com                   | -        |
| 8   | Dr. Carlos Rafael Almira                  | carlos@biosanar.com                 | -        |
| 9   | Dra. Claudia Sierra                       | claudia@biosanar.com                | -        |
| 10  | Dr. Andres Romero                         | andres@biosanar.com                 | -        |
| 11  | Dra. Gina Cristina Castillo Gonzalez      | gina@biosanar.com                   | -        |
| 12  | Dr. Alexander Rugeles                     | alex@biosanar.com                   | -        |
| 13  | Dr. Erwin Alirio Vargas Ariza             | erwin@biosanar.com                  | -        |
| 14  | Dr. Calixto Escorcia Angulo               | calixto@biosanar.com                | -        |
| 15  | Dr. Nestor Motta                          | nestor@biosanar.com                 | -        |
| 16  | Dra. Laura Julia Podeva                   | laura@biosanar.com                  | -        |
| 17  | Dra. Luisa Fernanda Garrido Castillo      | luisa@biosanar.com                  | -        |
| 18  | Demo Cardiologo                           | demo.cardio@biosanar.com            | -        |
| 19  | JORGE ENRIQUE VILLALBA SANCHEZ            | jor@biosanar.com                    | -        |

> **Nota**: Todos los doctores tienen contraseñas configuradas. Si necesitas las credenciales de alguno de ellos, usa el sistema de reseteo de contraseñas.

---

## 🔒 Política de Seguridad

### Intentos Fallidos de Login
- **Máximo**: 5 intentos consecutivos
- **Bloqueo**: 30 minutos automático después de 5 fallos
- **Desbloqueo**: Administrador puede desbloquear manualmente

### Contraseñas Temporales
- Todas las contraseñas reseteadas se establecen como: `temp123`
- **Longitud mínima**: 8 caracteres
- **Complejidad**: Se recomienda usar mayúsculas, minúsculas, números y símbolos

### Sesiones
- **Duración**: 2 días de actividad
- **Expiración**: Token JWT válido por 48 horas
- **Multi-sesión**: Permitido (el doctor puede estar logueado desde múltiples dispositivos)

---

## 🧪 Pruebas de Login

### Probar Login con cURL

```bash
curl -X POST https://biosanarcall.site/api/doctor-auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ana.escobar@biosanarcall.site",
    "password": "temp123"
  }'
```

**Respuesta esperada (éxito):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "doctor": {
      "id": 6,
      "name": "Ana Teresa Escobar",
      "email": "ana.escobar@biosanarcall.site",
      "phone": "3142564784",
      "license_number": "m1214"
    }
  }
}
```

---

## 🆘 Troubleshooting

### Error: "Credenciales inválidas"
✅ **Solución**: Usar el sistema de reset de contraseñas desde el panel de administración

### Error: "Cuenta bloqueada"
✅ **Solución**: Esperar 30 minutos o resetear desde el panel de administración

### Error: "500 Internal Server Error"
✅ **Solución**: Verificar logs del backend con `pm2 logs cita-central-backend`

### Doctor no puede cambiar su contraseña
✅ **Solución**: Implementar funcionalidad de cambio de contraseña en el portal de doctores (pendiente)

---

## 📝 Tareas Pendientes

- [ ] Implementar cambio de contraseña desde el portal de doctores
- [ ] Añadir validación de complejidad de contraseñas en el frontend
- [ ] Implementar recuperación de contraseña por email
- [ ] Añadir autenticación de dos factores (2FA)
- [ ] Crear interfaz de administración de contraseñas en Settings

---

**Última actualización**: 1 de Noviembre, 2025
**Responsable**: Sistema Biosanarcall Medical
