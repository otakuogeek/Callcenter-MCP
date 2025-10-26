# 🚀 Guía Rápida: Diagnosticar Problema de Sincronización

## Paso 1: Abrir los Logs 📊

```bash
cd /home/ubuntu/app/backend
pm2 logs cita-central-backend --lines 100
```

Deja esta terminal abierta.

---

## Paso 2: Ejecutar Sincronización 🔄

1. Abre la agenda con las citas duplicadas en 08:00
2. Verifica que el botón **"Sincronizar Horas"** ahora esté visible al final
3. Haz clic en **"Sincronizar Horas"**
4. Confirma la acción

---

## Paso 3: Leer el Log 🔍

Busca esta información en el log:

### ¿Cuál es la duración de cada cita?

```
🔧 Sincronización de horas iniciada:
  - Duration minutes: ???  ← Este valor
  - Break between slots: ???
```

### ¿Qué pasó con cada cita?

```
📅 Cita 1: Marta González
   Hora anterior: 2025-01-15 08:00:00
   Hora nueva: 2025-01-15 08:00:00
   Total minutos a sumar: ???  ← Este valor
   
📅 Cita 2: Carlos Pérez
   Hora anterior: 2025-01-15 08:00:00
   Hora nueva: 2025-01-15 08:??:00  ← ¿Cambió?
```

---

## 🔴 Problema Detectado: Duration = 0 o NULL

Si ves:
```
Duration minutes: 0
```
o
```
Duration minutes: null
```

**ESTE ES EL PROBLEMA** ❌

### Solución:

Actualizar la duración en la base de datos:

```sql
UPDATE availabilities 
SET duration_minutes = 15 
WHERE id = TU_AVAILABILITY_ID;
```

Luego vuelve a intentar la sincronización.

---

## 🟢 Funcionamiento Correcto

Si ves:
```
Duration minutes: 15
Break between slots: 0

📅 Cita 1: Marta
   Hora nueva: 2025-01-15 08:00:00
   Siguiente hora disponible: 08:15:00
   
📅 Cita 2: Carlos
   Hora nueva: 2025-01-15 08:15:00
   Siguiente hora disponible: 08:30:00
   
📅 Cita 3: Paola
   Hora nueva: 2025-01-15 08:30:00
   Siguiente hora disponible: 08:45:00
```

**¡PERFECTO!** ✅ Las citas se están reorganizando correctamente.

---

## 📋 Checklist de Verificación

- [ ] Botón "Sincronizar Horas" es visible al final del modal
- [ ] Al hacer clic, aparece diálogo de confirmación
- [ ] Los logs muestran "🔧 Sincronización de horas iniciada"
- [ ] `Duration minutes` NO es 0 ni NULL
- [ ] Cada cita muestra su "Hora nueva" diferente
- [ ] Aparece mensaje "✅ X citas sincronizadas"
- [ ] El modal se recarga mostrando las nuevas horas

---

## 🆘 Si Aún No Funciona

Comparte el log COMPLETO desde:
```
🔧 Sincronización de horas iniciada:
```

Hasta:
```
✅ Sincronización completada: X citas actualizadas
```

Con esa información podré ver exactamente qué está fallando.

---

## 💡 Valores Esperados por Especialidad

| Especialidad | Duration | Break | Total |
|-------------|----------|-------|-------|
| Medicina General | 15 min | 0 min | 15 min |
| Odontología | 30 min | 5 min | 35 min |
| Psicología | 45 min | 0 min | 45 min |

Si tu especialidad tiene un `duration_minutes` diferente, es normal.

---

**¡Listo!** Con estos pasos podrás identificar y resolver el problema. 🎉
