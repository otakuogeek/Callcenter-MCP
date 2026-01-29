# Análisis Detallado del Manejo de Zonas Horarias

## Resumen Ejecutivo
El sistema implementa una arquitectura **UTC-Centric** (Centrada en UTC) para el almacenamiento y procesamiento de datos en el Backend, MCP y Base de Datos, mientras que la capa de presentación (Frontend) fuerza la visualización en **America/Bogota**.

## 1. Backend (Node.js & MySQL)
El backend actúa como la fuente de verdad y está configurado explícitamente en UTC.

*   **Conexión a Base de Datos:**
    *   Archivo: `backend/src/db/pool.ts`
    *   Configuración: `timezone: '+00:00'`
    *   **Efecto:** Todas las fechas guardadas o recuperadas se tratan como UTC. `NOW()` en SQL retorna UTC.

*   **Manejo de Fechas Críticas:**
    *   Se detectó manipulación manual de cadenas en servicios como `labsmobile-sms.service.ts` y `appointments.ts`.
    *   **Riesgo:** Funciones como `formatDateForMySQL` construyen strings manualmente para evitar conversiones automáticas de `new Date()`. Esto se hace para asegurar que "2025-01-15" se interprete como tal en Colombia y no se desplace al día anterior por la diferencia horaria (-5h).

## 2. Frontend (React)
El cliente es responsable de la "localización" del tiempo para el usuario final.

*   **Configuración Global:**
    *   Archivo: `frontend/src/lib/utils.ts`
    *   Constante: `COLOMBIA_TIMEZONE = 'America/Bogota'`
*   **Visualización:**
    *   Las fechas recibidas del backend (ISO 8601 UTC, ej: `...Z`) se convierten usando `toLocaleString('es-CO', { timeZone: 'America/Bogota' })`.
    *   Componentes como `AppointmentsDashboard` formatean explícitamente para el usuario local.

## 3. Servidor MCP (Model Context Protocol)
El cerebro de la IA maneja su memoria interna estrictamente en UTC.

*   **Gestor de Memoria:**
    *   Archivo: `mcp-server-node/src/memory-manager.ts`
    *   Método: Usa `new Date().toISOString()` para todos los timestamps (`created_at`, `last_activity`).
    *   **Consistencia:** Al usar ISO String, garantiza que los logs y la memoria de la IA (JSON almacenado en DB) estén sincronizados con el resto del backend en UTC.

## 4. Integración WhatsApp
*   **Recepción:** Los mensajes se guardan con `CURRENT_TIMESTAMP` (UTC) en la tabla de mensajes.
*   **Procesamiento:** El servicio `WhatsAppAI.ts` calcula tiempos de respuesta usando `Date.now()` (Epoch UTC), manteniendo la coherencia.

## Conclusión y Recomendaciones
El sistema es consistente en su uso de UTC para almacenamiento. Sin embargo, la manipulación manual de strings en el backend para "forzar" horas locales en ciertos servicios (SMS, Citas) es un punto frágil.

**Recomendación:** Estandarizar el uso de una librería como `date-fns-tz` en el backend para conversiones explícitas `UTC <-> America/Bogota` en lugar de manipular strings manualmente.
