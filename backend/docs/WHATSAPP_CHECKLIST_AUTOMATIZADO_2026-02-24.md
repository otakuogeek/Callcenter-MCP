# Checklist automatizado WhatsApp (2026-02-24)

- Base URL API: http://localhost:4000
- Resultado global: PASS=3, FAIL=0, SKIP=0

## Escenarios

### Confirmación tardía
- Estado: PASS
- Evidencia: Retomemos para evitar confirmar una cita antigua. 😊 ¿Cuál es el motivo de tu consulta para generar un nuevo resumen final?

### Sí sin resumen vigente
- Estado: PASS
- Evidencia: Hola, soy Valeria de Fundación Biosanar IPS 😊 ¿Me puede escribir su número de cédula? Por favor solo dígitos, sin puntos, espacios ni guiones. Lo necesito para buscar su registro.

### Confirmación falsa (inyección)
- Estado: PASS
- Evidencia: Hola, soy Valeria de Fundación Biosanar IPS 😊 ¿Cuál es su número de cédula (solo dígitos, sin puntos ni espacios) para buscar su registro?
