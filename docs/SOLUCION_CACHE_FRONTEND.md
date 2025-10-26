# Solución: Error 404 al eliminar de cola de espera

## Problema
El navegador está usando archivos JavaScript antiguos guardados en caché que no tienen el nuevo endpoint DELETE.

## Causa
Nginx está configurado con caché de 1 año para archivos estáticos (.js, .css), por lo que el navegador no descarga los nuevos archivos automáticamente.

## Solución Inmediata (Usuario)

### Opción 1: Hard Refresh (Recomendado)
Presiona las siguientes teclas según tu navegador:

- **Chrome/Edge en Windows/Linux**: `Ctrl + Shift + R` o `Ctrl + F5`
- **Chrome/Edge en Mac**: `Cmd + Shift + R`
- **Firefox**: `Ctrl + Shift + R` o `Ctrl + F5`
- **Safari**: `Cmd + Option + R`

### Opción 2: Limpiar caché manualmente
1. Abre las **Herramientas de Desarrollador** (F12)
2. Haz clic derecho en el botón de **Recargar** 
3. Selecciona "**Vaciar caché y recargar de forma forzada**"

### Opción 3: Modo incógnito
Abre https://biosanarcall.site/queue en una **ventana privada/incógnita** para probar sin caché.

## Verificación
Después del hard refresh, deberías ver:
- ✅ El botón rojo 🗑️ funciona correctamente
- ✅ Aparece el diálogo de confirmación
- ✅ El paciente se elimina de la lista
- ✅ Mensaje de éxito: "Paciente eliminado de la cola de espera"

## Estado del Sistema
- ✅ Backend compilado y funcionando (restart #36, PID 866120)
- ✅ Endpoint DELETE verificado: `DELETE /api/appointments/waiting-list/:id`
- ✅ Frontend compilado (17:33, Oct 14)
- ✅ Archivos en `/home/ubuntu/app/frontend/dist` actualizados
- ⚠️ **Caché del navegador necesita limpiarse**

## Prueba Manual del Endpoint
```bash
# El endpoint funciona correctamente desde el servidor:
curl -X DELETE "http://127.0.0.1:4000/api/appointments/waiting-list/60" \
-H "Authorization: Bearer [TOKEN]" | jq

# Respuesta exitosa:
{
  "success": true,
  "message": "Paciente eliminado de la cola de espera exitosamente",
  "deleted_id": 60
}
```

## Archivos Modificados
1. `/home/ubuntu/app/backend/src/routes/appointments.ts` - Endpoint DELETE agregado
2. `/home/ubuntu/app/frontend/src/lib/api.ts` - Función deleteWaitingListEntry
3. `/home/ubuntu/app/frontend/src/pages/Queue.tsx` - Botón de eliminar con confirmación

## Fecha
14 de octubre de 2025
