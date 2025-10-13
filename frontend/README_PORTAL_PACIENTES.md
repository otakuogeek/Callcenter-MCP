# 🏥 Portal de Autoservicio para Pacientes

> **Acceso Público**: `https://biosanarcall.site/users`

## 🎯 Descripción

Portal web independiente que permite a los pacientes de Fundación Biosanar IPS acceder a su información médica y gestionar sus datos personales de forma segura usando únicamente su número de documento de identidad.

## ✨ Características Principales

### 🔐 Acceso Seguro
- Login sin contraseña (solo documento)
- Normalización automática de cédula
- Validación en tiempo real
- Sesión temporal en navegador

### 📋 Información Disponible
Los pacientes pueden:
- ✅ **VER** toda su información personal y médica
- ✅ **EDITAR** datos de contacto y dirección
- ✅ **CONSULTAR** citas programadas
- ✅ **GESTIONAR** embarazo (solo mujeres)
- ❌ **NO PUEDEN** borrar información ni cancelar citas

### 📱 3 Secciones Principales

#### 1. Mi Información 👤
- Datos personales (nombre, documento, fecha nacimiento, género)
- Información de contacto (teléfonos, email, dirección)
- Información de seguro (EPS, tipo afiliación)
- Gestión de embarazo (solo pacientes femeninos)

#### 2. Mis Citas 📅
- Próximas citas confirmadas
- Detalles completos (fecha, hora, médico, sede, motivo)
- Historial de citas pasadas
- Estados con badges de colores

#### 3. Información Médica ❤️
- Grupo sanguíneo
- Discapacidad
- Notas médicas (solo lectura)
- Datos demográficos (educación, estado civil, estrato)

## 🚀 Inicio Rápido

### Para Pacientes

1. Visita: `https://biosanarcall.site/users`
2. Ingresa tu número de cédula (sin puntos ni comas)
3. Click en "Ingresar"
4. Accede a toda tu información

### Para Desarrolladores

```bash
# Compilar frontend
cd /home/ubuntu/app/frontend
npm run build

# Ejecutar pruebas
./test-user-portal.sh
```

## 📊 Ejemplo de Uso

### Login
```
Documento: 1.234.567-8
Sistema normaliza → "12345678"
Busca en BD → Paciente encontrado
Acceso concedido → Dashboard
```

### Editar Información
```
1. Click en botón "Editar"
2. Modificar teléfono: 3001234567
3. Click en "Guardar Cambios"
4. ✅ Información actualizada
```

## 🔒 Seguridad

### Campos Protegidos (No Editables)
- Número de documento
- Información médica
- Notas clínicas
- Historial de citas

### Restricciones
- Sin opción de eliminar cuenta
- Sin cancelación de citas
- Solo actualización de datos personales
- Validación en backend

## 🛠️ Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS
- **Routing**: React Router 6
- **State**: TanStack Query
- **Forms**: React Hook Form + Zod
- **Date**: date-fns
- **Icons**: Lucide React

## 📁 Estructura de Archivos

```
frontend/
├── src/
│   ├── pages/
│   │   └── UserPortal.tsx           # Página principal + login
│   ├── components/
│   │   └── user-portal/
│   │       └── UserDashboard.tsx    # Dashboard con 3 tabs
│   └── App.tsx                       # Ruta /users agregada
├── PORTAL_PACIENTES.md               # Documentación detallada
└── test-user-portal.sh               # Script de pruebas
```

## 🎨 Capturas de Pantalla

### Login
![Login](https://via.placeholder.com/800x400?text=Login+Portal+Pacientes)

### Dashboard
![Dashboard](https://via.placeholder.com/800x400?text=Dashboard+con+Tabs)

### Citas
![Citas](https://via.placeholder.com/800x400?text=Vista+de+Citas)

## 📝 APIs Utilizadas

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/patients?search={doc}` | GET | Búsqueda por documento |
| `/api/patients/{id}` | GET | Datos completos del paciente |
| `/api/patients/{id}` | PUT | Actualizar información |
| `/api/appointments?patient_id={id}` | GET | Citas del paciente |
| `/api/pregnancies/patient/{id}/active` | GET | Embarazo activo |
| `/api/lookups/eps` | GET | Lista de EPS |
| `/api/lookups/zones` | GET | Lista de zonas |
| `/api/lookups/municipalities` | GET | Lista de municipios |

## 🧪 Testing

```bash
# Ejecutar script de pruebas
cd /home/ubuntu/app/frontend
./test-user-portal.sh
```

**Pruebas incluidas**:
- ✅ Búsqueda de paciente por documento
- ✅ Obtención de datos completos
- ✅ Consulta de citas
- ✅ Carga de datos de referencia
- ✅ Detección de embarazo (mujeres)

## 🔄 Integración con Sistema Existente

### Con Gestión de Pacientes
- Misma API que panel administrativo
- Mismos datos en tiempo real
- Sin duplicación de información

### Con Sistema de Citas
- Consulta automática de citas
- Filtrado por paciente
- Estados sincronizados

### Con Gestión de Embarazos
- Componente `PregnancyManagement` reutilizado
- Cálculo automático de semanas
- Fecha probable de parto (FPP)

## 📞 Soporte

**¿Problemas para acceder?**
- Teléfono: **321 123 4567**
- Email: soporte@biosanarcall.site
- Horario: Lunes a Viernes, 8am - 6pm

## 🐛 Troubleshooting

### "No se encontró paciente"
- Verifica el documento sin puntos ni comas
- Solo números (Ej: 12345678)
- Confirma que exista en la base de datos

### "No se pudo actualizar información"
- Revisa los logs del backend
- Verifica campos obligatorios
- Contacta soporte técnico

### "No cargan las citas"
- Verifica conexión con API
- Revisa permisos del paciente
- Contacta administrador

## 📈 Roadmap

### Próximas Funcionalidades
- [ ] Notificaciones por email
- [ ] Recordatorios de citas por SMS
- [ ] Descarga de PDF con información
- [ ] Solicitud de citas en línea
- [ ] Chat con asistente virtual
- [ ] Historial clínico detallado
- [ ] Resultados de exámenes

## 🤝 Contribución

Este portal es parte del sistema Biosanarcall Medical Management System.

Para contribuir:
1. Revisa la documentación completa en `PORTAL_PACIENTES.md`
2. Sigue las convenciones del proyecto
3. Ejecuta pruebas antes de commit
4. Documenta cambios importantes

## 📄 Licencia

© 2025 Fundación Biosanar IPS - Todos los derechos reservados

---

**Versión**: 1.0.0  
**Última actualización**: 12 de octubre de 2025  
**Estado**: ✅ En Producción

**URL**: https://biosanarcall.site/users
