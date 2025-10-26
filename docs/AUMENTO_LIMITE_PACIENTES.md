# Aumento del Límite de Visualización de Pacientes

**Fecha:** 15 de octubre de 2025  
**Problema:** El sistema solo mostraba 100 pacientes en el frontend aunque la base de datos contenía 126 pacientes.

## Cambios Realizados

### Backend

Se aumentó el límite máximo de registros por consulta de **100 a 500** en los siguientes archivos:

#### 1. `/backend/src/routes/patients-updated.ts` (Ruta principal)
- **Línea 512:** Cambio en `limitNumber`
  ```typescript
  // Antes:
  const limitNumber = Math.max(1, Math.min(100, parseInt(limit as string) || 20));
  
  // Después:
  const limitNumber = Math.max(1, Math.min(500, parseInt(limit as string) || 20));
  ```

#### 2. `/backend/src/routes/patients.ts` (Ruta legacy)
- **Líneas 75 y 81:** Cambio en LIMIT de consultas SQL
  ```sql
  -- Antes:
  LIMIT 100
  
  -- Después:
  LIMIT 500
  ```

#### 3. `/backend/src/routes/patients-enhanced.ts` (Ruta enhanced)
- **Líneas 95 y 110:** Cambio en LIMIT de consultas SQL
  ```sql
  -- Antes:
  LIMIT 100
  
  -- Después:
  LIMIT 500
  ```

### Frontend

Se agregó el parámetro `limit=500` a las llamadas a la API en los siguientes componentes:

#### 1. `/frontend/src/components/patient-management/PatientsList.tsx`
- **Línea 112:** Agregado parámetro `limit` a la URL de la API
  ```typescript
  // Antes:
  const response = await fetch(`${apiBase}/patients-v2`, { ... });
  
  // Después:
  const response = await fetch(`${apiBase}/patients-v2?limit=500`, { ... });
  ```

#### 2. `/frontend/src/components/PatientDashboard.tsx`
- **Línea 89:** Actualizado parámetro limit
  ```typescript
  // Antes:
  api.getPatientsV2({ limit: 100 })
  
  // Después:
  api.getPatientsV2({ limit: 500 })
  ```

#### 3. `/frontend/src/components/DailyQueueManager.tsx`
- **Línea 151:** Actualizado parámetro limit
  ```typescript
  // Antes:
  api.getPatientsV2({ limit: 100 })
  
  // Después:
  api.getPatientsV2({ limit: 500 })
  ```

#### 4. `/frontend/src/components/PatientManagementV2.tsx`
- **Línea 155:** Actualizado parámetro limit
  ```typescript
  // Antes:
  await api.getPatientsV2({ limit: 100 });
  
  // Después:
  await api.getPatientsV2({ limit: 500 });
  ```

## Compilación y Despliegue

1. **Backend compilado:**
   ```bash
   cd /home/ubuntu/app/backend && npm run build
   ```

2. **Backend reiniciado:**
   ```bash
   pm2 restart cita-central-backend
   ```

3. **Frontend compilado:**
   ```bash
   cd /home/ubuntu/app/frontend && npm run build
   ```

## Resultados Esperados

- ✅ El frontend ahora puede cargar hasta **500 pacientes** por consulta
- ✅ Los 126 pacientes existentes en la base de datos se visualizarán correctamente
- ✅ El sistema mantiene la paginación local en el frontend para una mejor experiencia de usuario
- ✅ Se mantiene la compatibilidad con búsquedas y filtros

## Consideraciones de Rendimiento

- El límite de 500 registros es suficiente para la base de pacientes actual (126)
- Si la base de datos crece significativamente, se recomienda:
  - Implementar paginación del lado del servidor
  - Usar scroll infinito o carga incremental
  - Optimizar consultas con índices adicionales

## Pruebas Recomendadas

1. ✅ Verificar que se muestren todos los 126 pacientes
2. ✅ Confirmar que la búsqueda funciona correctamente
3. ✅ Validar que los filtros por EPS, municipio, género funcionen
4. ✅ Comprobar el rendimiento de carga de la página

## Notas Técnicas

- La paginación **local** (frontend) sigue configurada con 10 elementos por página por defecto
- Los usuarios pueden cambiar el número de elementos por página desde el selector de la interfaz
- El backend ahora acepta solicitudes de hasta 500 registros como máximo de seguridad
