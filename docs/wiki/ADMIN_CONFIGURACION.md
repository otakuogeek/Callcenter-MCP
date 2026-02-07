# ⚙️ Configuración del Sistema

## ¿Quién puede acceder a Configuración?

Solo usuarios con rol de **Administrador** o **SuperAdmin** pueden modificar la configuración del sistema.

---

## 🏥 Gestión de Especialidades

### Ver especialidades:
Lista de todas las especialidades médicas disponibles (Medicina General, Odontología, etc.)

### Crear nueva especialidad:
1. Haz clic en **"Nueva Especialidad"**
2. Ingresa el nombre
3. Guarda

### Editar especialidad:
1. Busca la especialidad
2. Haz clic en **"Editar"**
3. Modifica el nombre
4. Guarda

### Eliminar especialidad:
⚠️ Solo se puede eliminar si no tiene agendas ni citas asociadas.

---

## 👨‍⚕️ Gestión de Médicos

### Ver lista de médicos:
Todos los doctores registrados con su especialidad y estado.

### Registrar nuevo médico:
1. Haz clic en **"Nuevo Médico"**
2. Completa los datos:
   - 👤 Nombre completo
   - 🩺 Especialidad
   - 🪪 Número de licencia médica
   - 📞 Teléfono
   - 📧 Email
3. Guarda

### Crear credenciales de acceso:
1. Abre el perfil del médico
2. Haz clic en **"Crear Acceso"**
3. El sistema generará una contraseña temporal
4. Envía la contraseña al médico por SMS o email

### Restablecer contraseña:
1. Abre el perfil del médico
2. Haz clic en **"Cambiar Contraseña"**
3. Ingresa la nueva contraseña
4. Notifica al médico

---

## 📍 Gestión de Sedes / Ubicaciones

### Ver sedes:
Lista de todas las sedes con su dirección y capacidad.

### Crear nueva sede:
1. Haz clic en **"Nueva Sede"**
2. Completa los datos:
   - 🏢 Nombre de la sede
   - 📍 Dirección completa
   - 🏙️ Ciudad/Municipio
   - 📞 Teléfono de la sede
   - 👥 Capacidad máxima diaria
3. Guarda

### Configurar especialidades por sede:
Cada sede puede tener diferentes especialidades disponibles.
1. Abre la sede
2. Ve a **"Especialidades"**
3. Marca/desmarca las especialidades
4. Guarda

---

## 🏥 Gestión de EPS

### Ver lista de EPS:
Todas las EPS con las que trabaja la IPS.

### Agregar EPS:
1. Haz clic en **"Nueva EPS"**
2. Ingresa el nombre de la EPS
3. Marca como "Activa"
4. Guarda

### Activar/Desactivar EPS:
Las EPS inactivas no aparecerán como opción al registrar pacientes.

---

## 🔗 Autorizaciones EPS - Especialidad

### ¿Qué es esto?
Define qué especialidades puede autorizar cada EPS a sus afiliados.

### Configurar autorizaciones:
1. Selecciona una EPS
2. Marca las especialidades autorizadas
3. Guarda

### Ejemplo:
- **Nueva EPS**: ✅ Medicina General, ✅ Odontología, ❌ Oftalmología
- **Sanitas**: ✅ Medicina General, ✅ Oftalmología, ✅ Cardiología

---

## 🔬 Gestión de CUPS

### ¿Qué son los CUPS?
Códigos Únicos de Procedimientos en Salud - identifican cada procedimiento médico.

### Ver catálogo CUPS:
Lista de todos los procedimientos disponibles.

### Agregar nuevo CUPS:
1. Haz clic en **"Nuevo CUPS"**
2. Ingresa:
   - 🔢 Código CUPS
   - 📝 Descripción del procedimiento
   - 🏷️ Categoría
3. Guarda

---

## 👥 Gestión de Usuarios del Sistema

### Ver usuarios:
Lista de personal administrativo con acceso al sistema.

### Crear nuevo usuario:
1. Haz clic en **"Nuevo Usuario"**
2. Completa los datos:
   - 👤 Nombre completo
   - 📧 Email (será el usuario de login)
   - 🔑 Contraseña inicial
   - 👔 Rol (Admin, SuperAdmin, Operador)
3. Guarda

### Roles disponibles:

| Rol | Permisos |
|-----|----------|
| **Operador** | Ver y agendar citas |
| **Administrador** | Todo excepto configuración de usuarios |
| **SuperAdmin** | Acceso total al sistema |

### Desactivar usuario:
Los usuarios desactivados no pueden acceder al sistema pero sus acciones históricas se conservan.

---

## 📊 Auditoría del Sistema

### ¿Qué se registra?
Todas las acciones importantes:
- ✏️ Creación de registros
- 📝 Modificaciones
- 🗑️ Eliminaciones
- 🔐 Inicios de sesión

### Ver logs de auditoría:
1. Ve a **"Auditoría"**
2. Filtra por:
   - Tipo de acción
   - Usuario
   - Fecha
   - Entidad (pacientes, citas, etc.)

### Cada log muestra:
- 👤 Quién hizo la acción
- 📅 Cuándo la hizo
- 📝 Qué cambió (valores anteriores y nuevos)

---

## ❓ Preguntas Frecuentes

### ¿Puedo deshacer un cambio en configuración?
No directamente, pero puedes ver en auditoría qué se cambió y revertirlo manualmente.

### ¿Cómo agrego una nueva zona geográfica?
Contacta al desarrollador, las zonas están definidas en el sistema.

### ¿Puedo importar médicos o EPS masivamente?
Sí, hay opción de importar desde Excel. Consulta al administrador técnico.

### ¿Los cambios de configuración afectan citas existentes?
No, solo afectan nuevas citas y registros.

---

*Para cambios técnicos avanzados, contacta al equipo de desarrollo.*
