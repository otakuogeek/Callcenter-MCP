# 🔍 Diagnóstico: Problema de Caché en Cola Diaria

## 🎯 Problema Detectado

El navegador está usando **caché HTTP** (código 304 - Not Modified) en lugar de obtener datos frescos del servidor.

**Evidencia:**
```
"res":{"statusCode":304
"etag":"W/\"eb-x0o1OUjDzxG0CRcaNA4NkXfMPec\""
```

Cuando seleccionas el 20 de octubre (que tiene 12 citas), el navegador retorna la respuesta cacheada que está vacía.

---

## ✅ Soluciones Implementadas

### 1. **Backend: Desactivar Caché**

Agregado headers HTTP para desactivar caché:

```typescript
// En /backend/src/routes/appointments.ts (línea ~945)
res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
res.set('Pragma', 'no-cache');
res.set('Expires', '0');
```

### 2. **Logs de Depuración Agregados**

**Backend:**
```typescript
console.log(`[DAILY-QUEUE] Consultando fecha: ${targetDateStr}`);
console.log(`[DAILY-QUEUE] Resultados - Fecha: ${targetDateStr}, 
  Waiting: ${waitingRows.length}, 
  Appointments: ${appointmentRows.length}, 
  Grupos: ${data.length}`);
```

**Frontend:**
```typescript
console.log(`[DailyQueue] Consultando fecha: ${formattedDate}`);
console.log('[DailyQueue] Respuesta recibida:', {
  success: response.success,
  date: response.date,
  dataLength: response.data?.length || 0,
  totalScheduled: response.stats?.total_scheduled || 0
});
```

---

## 🧪 Cómo Verificar

### Paso 1: Abrir Consola del Navegador

1. Ve a https://biosanarcall.site/daily-queue
2. Abre las **Herramientas de Desarrollador** (F12)
3. Ve a la pestaña **Console**

### Paso 2: Seleccionar Fecha con Datos

1. Click en el selector de fecha (20 de octubre de 2025)
2. Observa los logs en la consola:

**Deberías ver:**
```
[DailyQueue] Consultando fecha: 2025-10-20
[DailyQueue] Respuesta recibida: {
  success: true,
  date: "2025-10-20",
  dataLength: 2,           ← Debe ser 2 (2 especialidades)
  totalScheduled: 12       ← Debe ser 12 (12 citas)
}
```

### Paso 3: Verificar Backend

Abre otra terminal y monitorea los logs:

```bash
pm2 logs cita-central-backend --lines 0
```

**Deberías ver:**
```
[DAILY-QUEUE] Consultando fecha: 2025-10-20
[DAILY-QUEUE] Resultados - Fecha: 2025-10-20, Waiting: 0, Appointments: 12, Grupos: 2
```

---

## 🔧 Si Aún No Funciona

### Opción 1: Limpiar Caché del Navegador

#### Chrome/Edge:
```
1. Abrir DevTools (F12)
2. Click derecho en el botón de Recargar
3. Seleccionar "Vaciar caché y recargar de forma forzada"
```

#### Firefox:
```
1. Abrir DevTools (F12)
2. Ir a Network tab
3. Marcar "Disable Cache"
4. Recargar la página (Ctrl+Shift+R)
```

### Opción 2: Modo Incógnito

```
1. Abre una ventana privada/incógnito
2. Ve a https://biosanarcall.site/daily-queue
3. Inicia sesión
4. Selecciona 20 de octubre
```

### Opción 3: Verificar Network Tab

1. Abre DevTools → Network
2. Selecciona el 20 de octubre
3. Busca la petición: `daily-queue?date=2025-10-20`
4. Verifica:
   - **Status:** Debe ser **200 OK**, NO 304
   - **Headers → Response Headers:** Debe incluir `Cache-Control: no-store`
   - **Response → Preview:** Debe mostrar los datos

**Ejemplo de respuesta correcta:**
```json
{
  "success": true,
  "date": "2025-10-20",
  "data": [
    {
      "specialty_id": 1,
      "specialty_name": "Medicina General",
      "waiting_count": 0,
      "scheduled_count": 9,
      "items": [ ... 9 citas ... ]
    },
    {
      "specialty_id": 5,
      "specialty_name": "Odontologia",
      "waiting_count": 0,
      "scheduled_count": 3,
      "items": [ ... 3 citas ... ]
    }
  ],
  "stats": {
    "total_waiting": 0,
    "total_scheduled": 12,
    "total_today": 12,
    ...
  }
}
```

---

## 📊 Datos Esperados por Fecha

| Fecha | Total Citas | Especialidades | Detalles |
|-------|-------------|----------------|----------|
| **20 oct 2025** | **12** | 2 | 9 Med. General + 3 Odontología |
| **11 oct 2025** (HOY) | **0** | 0 | Sin citas |

---

## 🐛 Debugging Adicional

### Ver Response completa en Console

Pega esto en la consola del navegador:

```javascript
fetch('https://biosanarcall.site/api/appointments/daily-queue?date=2025-10-20', {
  headers: {
    'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : '',
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => {
  console.log('===== RESPUESTA COMPLETA =====');
  console.log('Fecha:', data.date);
  console.log('Total citas:', data.stats?.total_scheduled);
  console.log('Grupos de especialidades:', data.data?.length);
  console.log('Datos completos:', data);
  console.table(data.data);
});
```

### Verificar en MySQL Directamente

```bash
mysql -h 127.0.0.1 -u biosanar_user -p'/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU' biosanar -e "
SELECT DATE(scheduled_at) as fecha, COUNT(*) as total 
FROM appointments 
WHERE DATE(scheduled_at) = '2025-10-20';"
```

**Resultado esperado:**
```
+------------+-------+
| fecha      | total |
+------------+-------+
| 2025-10-20 |    12 |
+------------+-------+
```

---

## ✅ Archivos Modificados

1. **Backend:**
   - `/backend/src/routes/appointments.ts`
     - Agregado `Cache-Control: no-store`
     - Agregados console.log para debug
   
2. **Frontend:**
   - `/frontend/src/pages/DailyQueue.tsx`
     - Agregados console.log para debug

---

## 🚀 Estado Actual

```bash
✅ Backend reiniciado con logs y sin caché
✅ Frontend desplegado con logs de depuración
✅ Queries SQL verificadas y funcionando
✅ 12 citas existentes para el 20 de octubre
```

---

## 📝 Próximos Pasos

1. **Recargar la página con caché limpio** (Ctrl+Shift+R)
2. **Abrir consola del navegador** (F12)
3. **Seleccionar 20 de octubre**
4. **Revisar los logs** en consola y verificar que `totalScheduled: 12`
5. **Si no funciona**, enviar screenshot de:
   - Consola del navegador
   - Network tab mostrando la petición
   - Response de la petición

---

**Fecha**: 2025-01-11  
**Estado**: 🔧 Esperando verificación del usuario  
**Archivos actualizados**: appointments.ts, DailyQueue.tsx
