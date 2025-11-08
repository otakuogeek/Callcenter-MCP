# 🔐 Guía de Pruebas: Restricciones EPS por Zona en Portal de Usuarios

## 📋 Resumen de la Implementación

### ✅ **Funcionalidades Completadas:**

1. **Base de Datos Actualizada:**
   - ✅ Columna `zone_id` agregada a la tabla `locations`
   - ✅ San Gil (ID: 1) → Zona San Gil (ID: 4)
   - ✅ Socorro (ID: 3) → Zona de Socorro (ID: 3)

2. **Nuevos Endpoints API:**
   - ✅ `GET /api/locations/public/eps/:eps_id` - Ubicaciones autorizadas (público, sin autenticación)
   - ✅ `GET /api/locations/eps/:eps_id` - Ubicaciones autorizadas (con autenticación)
   - ✅ `GET /api/locations/zones/authorizations` - Debug de autorizaciones por zona

3. **Frontend Actualizado:**
   - ✅ Portal de usuarios usa endpoint público
   - ✅ Filtrado automático de sedes por EPS
   - ✅ Mensajes de error cuando no hay acceso

## 🧪 Pacientes de Prueba Creados

| Documento | Nombre | EPS | Zona Autorizada | Sedes Permitidas |
|-----------|--------|-----|----------------|------------------|
| `12345001` | Juan Pérez COOSALUD | COOSALUD | Socorro | **Solo Socorro** |
| `12345002` | María García FAMISANAR | FAMISANAR | San Gil | **Solo San Gil** |
| `12345003` | Carlos López NUEVA EPS | NUEVA EPS | Ambas | **Socorro + San Gil** |

## 🔍 Pruebas Paso a Paso

### **1. Prueba con COOSALUD (Solo Socorro)**

1. Ir a: **https://biosanarcall.site/users**
2. Ingresar documento: `12345001`
3. Verificar datos del paciente: "Juan Pérez COOSALUD"
4. Seleccionar cualquier especialidad disponible
5. **✅ Resultado esperado:** Solo debe aparecer la "Sede Biosanar Socorro"

### **2. Prueba con FAMISANAR (Solo San Gil)**

1. Ir a: **https://biosanarcall.site/users**
2. Ingresar documento: `12345002`
3. Verificar datos del paciente: "María García FAMISANAR"
4. Seleccionar cualquier especialidad disponible
5. **✅ Resultado esperado:** Solo debe aparecer la "Sede biosanar san gil"

### **3. Prueba con NUEVA EPS (Ambas Sedes)**

1. Ir a: **https://biosanarcall.site/users**
2. Ingresar documento: `12345003`
3. Verificar datos del paciente: "Carlos López NUEVA EPS"
4. Seleccionar cualquier especialidad disponible
5. **✅ Resultado esperado:** Deben aparecer AMBAS sedes:
   - "Sede biosanar san gil" 
   - "Sede Biosanar Socorro"

## 🔧 Verificación Técnica

### **Endpoints de Verificación:**

```bash
# COOSALUD - Solo Socorro
curl -s "https://biosanarcall.site/api/locations/public/eps/60" | jq '.[] | .name'

# FAMISANAR - Solo San Gil  
curl -s "https://biosanarcall.site/api/locations/public/eps/12" | jq '.[] | .name'

# NUEVA EPS - Ambas sedes
curl -s "https://biosanarcall.site/api/locations/public/eps/14" | jq '.[] | .name'
```

### **Logs del Frontend (DevTools > Console):**

Buscar estos mensajes durante las pruebas:

- `🔍 Consultando ubicaciones autorizadas para EPS X` - Llamada al endpoint
- `✅ Ubicaciones autorizadas cargadas:` - Sedes encontradas
- `❌ No hay ubicaciones autorizadas para EPS X` - Sin acceso
- `⚠️ No hay ubicaciones autorizadas para este EPS` - Warning

## 🚨 Casos de Error Esperados

### **EPS sin Autorizaciones:**
Si un paciente tiene un EPS que no tiene autorizaciones configuradas:
- ✅ **Comportamiento:** Mensaje "Tu EPS no tiene autorización para agendar citas"
- ✅ **No se rompe:** El sistema continúa funcionando normalmente

### **Paciente sin EPS:**
Si un paciente no tiene EPS asignada:
- ✅ **Comportamiento:** Se cargan todas las sedes disponibles
- ✅ **Fallback:** Mantiene compatibilidad con datos existentes

## 📊 Matriz de Restricciones

| EPS | ID | Zona Socorro | Zona San Gil | Total Especialidades |
|-----|----|--------------|--------------|--------------------|
| **COOSALUD** | 60 | ✅ Autorizada | ❌ Restringida | 10 |
| **FAMISANAR** | 12 | ❌ Restringida | ✅ Autorizada | 10 |
| **NUEVA EPS** | 14 | ✅ Autorizada | ✅ Autorizada | 20 (10+10) |
| **DELOREAN** | 74 | ✅ Autorizada | ✅ Autorizada | 7 (1+6) |

## 🔄 Script de Verificación Automática

```bash
# Ejecutar desde: /home/ubuntu/app/
./test_eps_restrictions.sh
```

Este script verifica:
- ✅ Endpoints públicos funcionando
- ✅ Autorizaciones por zona correctas
- ✅ Logs de depuración

## 💡 Tips para Debugging

1. **Si no aparecen sedes:** Verificar que el EPS tenga autorizaciones en `eps_specialty_location_authorizations`
2. **Error 401:** Verificar que se use el endpoint `/public/eps/` en lugar de `/eps/`
3. **Sedes incorrectas:** Verificar que `locations.zone_id` esté correctamente asignada
4. **Frontend no actualiza:** Limpiar cache del navegador (Ctrl+F5)

## ✅ Checklist de Verificación

- [ ] COOSALUD ve solo Socorro
- [ ] FAMISANAR ve solo San Gil  
- [ ] NUEVA EPS ve ambas sedes
- [ ] Mensajes de error apropiados para EPS sin acceso
- [ ] Logs del frontend informativos
- [ ] Endpoints públicos responden sin autenticación
- [ ] No hay errores 401 en el portal de usuarios

---

**🎯 Estado:** ✅ **IMPLEMENTACIÓN COMPLETA Y FUNCIONAL**

**📅 Fecha:** Noviembre 7, 2025

**🔗 URL de Prueba:** https://biosanarcall.site/users