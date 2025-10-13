# Sistema de Autorizaciones EPS por Especialidad y Sede

## 📋 Descripción General

Este sistema permite gestionar qué **EPS** (Entidades Promotoras de Salud) están autorizadas para atender en qué **especialidades** y en qué **sedes**, facilitando el control de convenios y restricciones de atención.

### Ejemplo de Uso
- **Famisanar** puede atender **Cardiología**, **Odontología** y **Medicina General** en la **Sede San Gil** y **Sede Socorro**
- **Nueva EPS** solo puede atender **Medicina General** y **Pediatría** en la **Sede San Gil**
- El sistema valida automáticamente si una combinación EPS-Especialidad-Sede está autorizada

---

## 🗄️ Estructura de Base de Datos

### Tabla Principal: `eps_specialty_location_authorizations`

```sql
CREATE TABLE eps_specialty_location_authorizations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  eps_id INT UNSIGNED NOT NULL,                    -- ID de la EPS
  specialty_id INT UNSIGNED NOT NULL,              -- ID de la especialidad
  location_id INT UNSIGNED NOT NULL,               -- ID de la sede
  authorized TINYINT(1) DEFAULT 1,                 -- Estado activo/inactivo
  authorization_date DATE,                         -- Fecha de inicio
  expiration_date DATE,                            -- Fecha de expiración (opcional)
  max_monthly_appointments INT UNSIGNED,           -- Cupo mensual máximo
  copay_percentage DECIMAL(5,2),                   -- Porcentaje de copago
  requires_prior_authorization TINYINT(1) DEFAULT 0, -- Requiere autorización previa
  notes TEXT,                                      -- Notas adicionales
  created_by INT UNSIGNED,                         -- Usuario que creó
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_eps_specialty_location (eps_id, specialty_id, location_id),
  FOREIGN KEY (eps_id) REFERENCES eps(id) ON DELETE CASCADE,
  FOREIGN KEY (specialty_id) REFERENCES specialties(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);
```

### Vista: `v_eps_authorizations`

Vista con nombres legibles para consultas:

```sql
SELECT 
  ea.id,
  e.name AS eps_name,
  e.code AS eps_code,
  s.name AS specialty_name,
  l.name AS location_name,
  ea.authorized,
  ea.authorization_date,
  ea.expiration_date,
  -- Validación de vigencia
  CASE 
    WHEN ea.authorized = 1 
      AND (ea.authorization_date IS NULL OR ea.authorization_date <= CURDATE())
      AND (ea.expiration_date IS NULL OR ea.expiration_date >= CURDATE())
    THEN 1 ELSE 0
  END AS is_currently_valid
FROM eps_specialty_location_authorizations ea
INNER JOIN eps e ON ea.eps_id = e.id
INNER JOIN specialties s ON ea.specialty_id = s.id
INNER JOIN locations l ON ea.location_id = l.id;
```

### Tabla de Auditoría: `eps_authorization_audit`

Registra todos los cambios en las autorizaciones con triggers automáticos.

---

## 🔧 Funciones y Procedimientos Almacenados

### Función: `is_eps_authorized(eps_id, specialty_id, location_id)`

Valida si una EPS está autorizada:

```sql
SELECT is_eps_authorized(12, 3, 1) AS autorizado;
-- Retorna: 1 (Famisanar autorizada para Cardiología en Sede San Gil)
```

### Procedimiento: `get_authorized_specialties_for_eps(eps_id, location_id)`

Obtiene todas las especialidades autorizadas para una EPS en una sede:

```sql
CALL get_authorized_specialties_for_eps(12, 1);
-- Retorna: Cardiología, Odontología, Medicina General
```

### Procedimiento: `get_authorized_locations_for_eps_specialty(eps_id, specialty_id)`

Obtiene todas las sedes donde una EPS está autorizada para una especialidad:

```sql
CALL get_authorized_locations_for_eps_specialty(12, 3);
-- Retorna: Sede San Gil, Sede Socorro (ambas para Famisanar-Cardiología)
```

---

## 🌐 API Endpoints

### Base URL: `/api/eps-authorizations`

---

### 1. **Listar Autorizaciones** `GET /`

Obtiene todas las autorizaciones con filtros opcionales.

#### Query Parameters:
- `eps_id` (opcional): Filtrar por EPS
- `specialty_id` (opcional): Filtrar por especialidad
- `location_id` (opcional): Filtrar por sede
- `authorized` (opcional): `true` | `false`
- `active_only` (opcional): `true` para solo vigentes

#### Ejemplo de Petición:
```bash
curl -X GET "http://localhost:4000/api/eps-authorizations?eps_id=12&active_only=true"
```

#### Respuesta:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "eps_id": 12,
      "eps_name": "FAMISANAR",
      "eps_code": "2718",
      "specialty_id": 3,
      "specialty_name": "Cardiología",
      "location_id": 1,
      "location_name": "Sede biosanar san gil",
      "authorized": true,
      "authorization_date": "2024-01-01",
      "expiration_date": null,
      "is_currently_valid": true,
      "notes": "Convenio inicial - Cardiología"
    }
  ],
  "count": 1
}
```

---

### 2. **Verificar Autorización** `GET /check/:eps_id/:specialty_id/:location_id`

Valida rápidamente si una combinación está autorizada.

#### Ejemplo:
```bash
curl -X GET "http://localhost:4000/api/eps-authorizations/check/12/3/1"
```

#### Respuesta:
```json
{
  "success": true,
  "authorized": true,
  "eps_id": 12,
  "specialty_id": 3,
  "location_id": 1
}
```

---

### 3. **Especialidades Autorizadas** `GET /eps/:eps_id/location/:location_id/specialties`

Obtiene todas las especialidades autorizadas para una EPS en una sede.

#### Ejemplo:
```bash
curl -X GET "http://localhost:4000/api/eps-authorizations/eps/12/location/1/specialties"
```

#### Respuesta:
```json
{
  "success": true,
  "data": [
    {
      "specialty_id": 1,
      "specialty_name": "Medicina General",
      "authorization_date": "2024-01-01",
      "notes": "Convenio inicial"
    },
    {
      "specialty_id": 3,
      "specialty_name": "Cardiología",
      "authorization_date": "2024-01-01"
    }
  ],
  "count": 2
}
```

---

### 4. **Sedes Autorizadas** `GET /eps/:eps_id/specialty/:specialty_id/locations`

Obtiene todas las sedes donde una EPS está autorizada para una especialidad.

#### Ejemplo:
```bash
curl -X GET "http://localhost:4000/api/eps-authorizations/eps/12/specialty/3/locations"
```

#### Respuesta:
```json
{
  "success": true,
  "data": [
    {
      "location_id": 1,
      "location_name": "Sede biosanar san gil",
      "address": "Cra. 9 #10-29, San Gil",
      "authorization_date": "2024-01-01"
    },
    {
      "location_id": 3,
      "location_name": "Sede Biosanar Socorro",
      "address": "Calle 12 #13-31, Socorro",
      "authorization_date": "2024-01-01"
    }
  ],
  "count": 2
}
```

---

### 5. **Crear Autorización** `POST /`

Crea una nueva autorización.

#### Body:
```json
{
  "eps_id": 12,
  "specialty_id": 5,
  "location_id": 1,
  "authorized": true,
  "authorization_date": "2025-01-01",
  "max_monthly_appointments": 100,
  "copay_percentage": 10.5,
  "requires_prior_authorization": false,
  "notes": "Convenio renovado para Odontología"
}
```

#### Respuesta:
```json
{
  "success": true,
  "message": "Autorización creada exitosamente",
  "data": {
    "id": 11,
    "eps_name": "FAMISANAR",
    "specialty_name": "Odontologia",
    "location_name": "Sede biosanar san gil",
    "authorized": true
  }
}
```

---

### 6. **Crear Múltiples Autorizaciones (Batch)** `POST /batch`

Crea varias autorizaciones en una sola transacción.

#### Body:
```json
{
  "authorizations": [
    {
      "eps_id": 12,
      "specialty_id": 1,
      "location_id": 1,
      "authorized": true,
      "notes": "Medicina General"
    },
    {
      "eps_id": 12,
      "specialty_id": 3,
      "location_id": 3,
      "authorized": true,
      "notes": "Cardiología en Socorro"
    }
  ]
}
```

#### Respuesta:
```json
{
  "success": true,
  "message": "Proceso de batch completado",
  "created": 2,
  "errors": 0,
  "results": [
    {
      "eps_id": 12,
      "specialty_id": 1,
      "location_id": 1,
      "status": "success",
      "id": 15
    }
  ]
}
```

---

### 7. **Actualizar Autorización** `PUT /:id`

Modifica una autorización existente.

#### Body:
```json
{
  "authorized": false,
  "expiration_date": "2025-12-31",
  "notes": "Convenio suspendido temporalmente"
}
```

#### Respuesta:
```json
{
  "success": true,
  "message": "Autorización actualizada exitosamente",
  "data": {
    "id": 1,
    "authorized": false,
    "expiration_date": "2025-12-31"
  }
}
```

---

### 8. **Eliminar Autorización** `DELETE /:id`

Elimina una autorización (en cascada si hay restricciones).

#### Ejemplo:
```bash
curl -X DELETE "http://localhost:4000/api/eps-authorizations/5"
```

#### Respuesta:
```json
{
  "success": true,
  "message": "Autorización eliminada exitosamente"
}
```

---

### 9. **Historial de Auditoría** `GET /audit/:authorization_id`

Obtiene el historial de cambios de una autorización.

#### Respuesta:
```json
{
  "success": true,
  "data": [
    {
      "id": 15,
      "authorization_id": 1,
      "action": "updated",
      "old_data": {"authorized": true},
      "new_data": {"authorized": false},
      "changed_at": "2025-10-11T18:30:00Z"
    }
  ],
  "count": 1
}
```

---

## 📊 Casos de Uso Prácticos

### 1. Validar EPS al Agendar Cita

```javascript
// En el frontend, al seleccionar EPS, especialidad y sede:
const validateEPS = async (epsId, specialtyId, locationId) => {
  const response = await fetch(
    `/api/eps-authorizations/check/${epsId}/${specialtyId}/${locationId}`
  );
  const { authorized } = await response.json();
  
  if (!authorized) {
    alert('La EPS seleccionada no está autorizada para esta especialidad en esta sede');
    return false;
  }
  return true;
};
```

### 2. Filtrar Especialidades por EPS

```javascript
// Mostrar solo especialidades autorizadas para la EPS del paciente
const getAvailableSpecialties = async (epsId, locationId) => {
  const response = await fetch(
    `/api/eps-authorizations/eps/${epsId}/location/${locationId}/specialties`
  );
  const { data } = await response.json();
  return data; // Lista de especialidades autorizadas
};
```

### 3. Mostrar Sedes Disponibles

```javascript
// Al seleccionar especialidad, filtrar sedes donde la EPS está autorizada
const getAvailableLocations = async (epsId, specialtyId) => {
  const response = await fetch(
    `/api/eps-authorizations/eps/${epsId}/specialty/${specialtyId}/locations`
  );
  const { data } = await response.json();
  return data; // Lista de sedes autorizadas
};
```

---

## 🔐 Seguridad y Validaciones

1. **Restricción única**: No se pueden crear duplicados para la misma combinación EPS-Especialidad-Sede
2. **Integridad referencial**: Las foreign keys aseguran que solo existan IDs válidos
3. **Auditoría automática**: Todos los cambios se registran con triggers
4. **Validación de vigencia**: La función `is_currently_valid` considera fechas de inicio y expiración
5. **Transacciones en batch**: Las operaciones múltiples usan transacciones para garantizar consistencia

---

## 🚀 Instalación y Migración

### Aplicar la Migración

```bash
mysql -h 127.0.0.1 -u biosanar_user -p'TU_PASSWORD' biosanar < \
  /home/ubuntu/app/backend/migrations/20251011_create_eps_authorizations.sql
```

### Verificar la Instalación

```bash
# Verificar estructura
mysql -h 127.0.0.1 -u biosanar_user -p'TU_PASSWORD' biosanar \
  -e "DESCRIBE eps_specialty_location_authorizations;"

# Verificar datos de ejemplo
mysql -h 127.0.0.1 -u biosanar_user -p'TU_PASSWORD' biosanar \
  -e "SELECT * FROM v_eps_authorizations LIMIT 5;"
```

---

## 📝 Datos de Ejemplo Pre-cargados

El sistema incluye 10 autorizaciones de ejemplo:

| EPS                   | Especialidad       | Sede              | Estado  |
|-----------------------|--------------------|-------------------|---------|
| FAMISANAR (12)        | Cardiología        | San Gil           | ✅ Activo |
| FAMISANAR (12)        | Odontología        | San Gil           | ✅ Activo |
| FAMISANAR (12)        | Medicina General   | San Gil           | ✅ Activo |
| FAMISANAR (12)        | Cardiología        | Socorro           | ✅ Activo |
| FAMISANAR (12)        | Odontología        | Socorro           | ✅ Activo |
| FAMISANAR (12)        | Medicina General   | Socorro           | ✅ Activo |
| NUEVA EPS (14)        | Medicina General   | San Gil           | ✅ Activo |
| NUEVA EPS (14)        | Pediatría          | San Gil           | ✅ Activo |
| COOSALUD Sub. (60)    | Medicina General   | San Gil           | ✅ Activo |
| COOSALUD Sub. (60)    | Medicina General   | Socorro           | ✅ Activo |

---

## 🎯 Integración con Sistema de Citas

### Modificación Recomendada en `availabilities`

Agregar validación al crear disponibilidad:

```sql
-- Trigger para validar autorizaciones al crear availabilities
DELIMITER $$

CREATE TRIGGER validate_eps_authorization_on_availability
BEFORE INSERT ON availabilities
FOR EACH ROW
BEGIN
  DECLARE auth_count INT DEFAULT 0;
  
  -- Verificar si hay al menos una EPS autorizada
  SELECT COUNT(*) INTO auth_count
  FROM eps_specialty_location_authorizations
  WHERE specialty_id = NEW.specialty_id
    AND location_id = NEW.location_id
    AND authorized = 1
    AND (authorization_date IS NULL OR authorization_date <= CURDATE())
    AND (expiration_date IS NULL OR expiration_date >= CURDATE());
  
  IF auth_count = 0 THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'No hay EPS autorizadas para esta especialidad en esta sede';
  END IF;
END$$

DELIMITER ;
```

---

## 📞 Soporte

Para dudas o problemas:
- Verificar logs en `/home/ubuntu/app/backend/logs/`
- Revisar tabla de auditoría `eps_authorization_audit`
- Contactar al equipo de desarrollo

---

## 📅 Historial de Versiones

- **v1.0** (2025-10-11): Versión inicial del sistema de autorizaciones
  - Tabla principal con relaciones
  - Vista con nombres legibles
  - Funciones y procedimientos almacenados
  - API REST completa
  - Sistema de auditoría automática
  - 10 registros de ejemplo pre-cargados
