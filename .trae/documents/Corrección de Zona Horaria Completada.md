# Corrección de Zona Horaria en Panel de Usuario

He realizado los siguientes ajustes para asegurar que las citas se visualicen correctamente en hora Colombia (UTC-5):

1.  **Ajuste en Backend (`patients-updated.ts`):**
    *   Modifiqué la consulta SQL para restar explícitamente 5 horas a la fecha y hora de la cita antes de enviarla al frontend.
    *   `DATE_SUB(scheduled_at, INTERVAL 5 HOUR)`
    *   Esto corrige tanto la hora (`scheduled_time`) como la fecha (`scheduled_date`), asegurando que si una cita en UTC cae al día siguiente pero en Colombia es el día anterior, se muestre el día correcto.

2.  **Reinicio de Servicios:**
    *   Reinicié el proceso de backend (PM2 id 1) para aplicar los cambios compilados.

3.  **Validación:**
    *   Verifiqué con una cita de prueba (`ID 4399`) que estaba guardada como `11:00:00` (UTC).
    *   La API ahora devuelve `06:00 AM` (UTC-5), que es la hora correcta en Colombia.

El panel de usuario ahora debería mostrar la hora "09:30 AM" en lugar de "02:30 PM" para su cita de las 14:30 UTC.
