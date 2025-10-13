# 🚀 Inicio Rápido - Sistema de Autorizaciones EPS

## ⚡ Instalación en 3 Pasos

### 1. Aplicar Migración SQL

```bash
mysql -h 127.0.0.1 -u biosanar_user -p'/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU' biosanar < \
  /home/ubuntu/app/backend/migrations/20251011_create_eps_authorizations.sql
```

✅ **Resultado**: Tabla creada con 10 autorizaciones de ejemplo

---

### 2. Compilar y Reiniciar Backend

```bash
cd /home/ubuntu/app/backend
npm run build
pm2 restart cita-central-backend
```

✅ **Resultado**: Endpoints disponibles en `/api/eps-authorizations`

---

### 3. Verificar Funcionamiento

```bash
# Ver todas las autorizaciones activas
curl "http://localhost:4000/api/eps-authorizations?active_only=true" | jq .

# Verificar que Famisanar puede atender Cardiología en San Gil
curl "http://localhost:4000/api/eps-authorizations/check/12/3/1" | jq .
```

✅ **Resultado esperado**: `{"authorized": true}`

---

## 📋 Ejemplos de Uso Rápido

### Crear Nueva Autorización

```bash
curl -X POST "http://localhost:4000/api/eps-authorizations" \
  -H "Content-Type: application/json" \
  -d '{
    "eps_id": 12,
    "specialty_id": 8,
    "location_id": 1,
    "authorized": true,
    "notes": "Pediatría autorizada para Famisanar"
  }'
```

### Ver Especialidades Autorizadas

```bash
# Especialidades que Famisanar puede atender en San Gil
curl "http://localhost:4000/api/eps-authorizations/eps/12/location/1/specialties" | jq '.data[].specialty_name'
```

**Resultado**:
```
"Cardiología"
"Medicina General"
"Odontologia"
```

### Ver Sedes Autorizadas

```bash
# Sedes donde Famisanar puede atender Cardiología
curl "http://localhost:4000/api/eps-authorizations/eps/12/specialty/3/locations" | jq '.data[].location_name'
```

**Resultado**:
```
"Sede biosanar san gil"
"Sede Biosanar Socorro"
```

---

## 🎯 Integración en Frontend (React)

### Paso 1: Validar EPS al Seleccionar

```typescript
// Copiar en tu componente de citas
const validateEPS = async (epsId: number, specialtyId: number, locationId: number) => {
  const response = await fetch(
    `${API_URL}/api/eps-authorizations/check/${epsId}/${specialtyId}/${locationId}`
  );
  const { authorized } = await response.json();
  return authorized;
};
```

### Paso 2: Mostrar Solo Especialidades Autorizadas

```typescript
// Cargar especialidades según la EPS del paciente
const loadAuthorizedSpecialties = async (epsId: number, locationId: number) => {
  const response = await fetch(
    `${API_URL}/api/eps-authorizations/eps/${epsId}/location/${locationId}/specialties`
  );
  const { data } = await response.json();
  return data; // Array de especialidades
};
```

---

## 🔍 Consultas SQL Útiles

### Ver Resumen de Autorizaciones

```sql
SELECT 
  e.name AS EPS,
  s.name AS Especialidad,
  l.name AS Sede,
  ea.authorization_date AS Desde
FROM v_eps_authorizations ea
JOIN eps e ON ea.eps_id = e.id
JOIN specialties s ON ea.specialty_id = s.id
JOIN locations l ON ea.location_id = l.id
WHERE ea.is_currently_valid = 1
ORDER BY e.name, s.name;
```

### Buscar Autorizaciones de una EPS Específica

```sql
SELECT * FROM v_eps_authorizations
WHERE eps_id = 12 -- Famisanar
  AND is_currently_valid = 1;
```

---

## 📊 IDs de Referencia

### EPS Principales
- **12** = FAMISANAR
- **14** = NUEVA EPS
- **60** = COOSALUD (Subsidiado)

### Especialidades Comunes
- **1** = Medicina General
- **3** = Cardiología
- **5** = Odontología
- **8** = Pediatría
- **10** = Dermatología

### Sedes
- **1** = Sede biosanar san gil
- **3** = Sede Biosanar Socorro

---

## 🆘 Solución de Problemas

### Error 404 en los Endpoints

```bash
# Verificar que el servidor está corriendo
pm2 list

# Ver logs
pm2 logs cita-central-backend --lines 50

# Reiniciar
pm2 restart cita-central-backend
```

### La Base de Datos No Tiene la Tabla

```bash
# Verificar que existe
mysql -h 127.0.0.1 -u biosanar_user -p biosanar \
  -e "SHOW TABLES LIKE 'eps_specialty_location_authorizations';"

# Si no existe, aplicar migración nuevamente
mysql -h 127.0.0.1 -u biosanar_user -p biosanar < \
  /home/ubuntu/app/backend/migrations/20251011_create_eps_authorizations.sql
```

---

## 📚 Documentación Completa

- **Sistema completo**: `/backend/docs/EPS_AUTHORIZATIONS_SYSTEM.md`
- **Ejemplos de código**: `/backend/docs/EPS_AUTHORIZATIONS_EXAMPLES.md`
- **Resumen técnico**: `/backend/docs/EPS_AUTHORIZATIONS_IMPLEMENTATION_SUMMARY.md`

---

## ✅ Checklist de Verificación

- [ ] Migración SQL aplicada correctamente
- [ ] Backend compilado sin errores
- [ ] PM2 reiniciado
- [ ] Endpoint `/api/eps-authorizations` responde 200
- [ ] Consulta de prueba retorna autorizaciones
- [ ] Vista `v_eps_authorizations` existe en la BD

---

**¡Sistema listo para producción!** 🎉

Si tienes dudas, consulta la documentación completa o revisa los logs con:
```bash
pm2 logs cita-central-backend
```
