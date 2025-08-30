Resumen de migración: Añadir campos ampliados para pacientes

Propósito:
- Incorporar datos demográficos y administrativos adicionales al modelo `patients` (tipo de documento, tipo de afiliación, grupo poblacional, nivel educativo, estado civil, grupo sanguíneo, discapacidad, estrato, teléfono alternativo, notas) sin romper la compatibilidad.

Archivos creados:
- `migrations/20250821_add_patient_fields.sql` — script SQL para crear tablas lookup y alterar `patients`.

Pasos recomendados para aplicar en producción:
1. Backup completo: crear un dump y comprobar copia.
   mysqldump -u <user> -p --single-transaction --routines --triggers biosanar > biosanar_backup_YYYYMMDD.sql
2. Probar en staging: importar backup en entorno de staging y ejecutar el script.
3. Ejecutar migración en mantenimiento o ventana de baja actividad:
   mysql -u <user> -p biosanar < 20250821_add_patient_fields.sql
4. Verificar: revisar estructura `DESCRIBE patients;` y contenido de tablas lookup.
5. Actualizar backend y frontend (ver checklist abajo).

Rollback:
- No hay rollback automático en este script; para revertir manualmente:
  - DROP FOREIGN KEY constraints y DROP added columns, DROP lookup tables si necesario.
  - Recomendación: mantener backup para restauración si algo sale mal.

Checklist de cambios de aplicación (backend):
- Backend (Node/TypeScript):
  - Model/entity `Patient` (ORM) -> añadir campos:
    - documentTypeId, insuranceAffiliationType, bloodGroupId, populationGroupId,
      educationLevelId, maritalStatusId, hasDisability, disabilityTypeId, estrato,
      phoneAlt, notes
  - Validation rules: actualizar DTOs/schemas para aceptar nuevos campos; la mayoría opcionales (nullable).
  - API: endpoints de creación/actualización de paciente (/patients POST/PUT) deben aceptar y sanitizar estos campos.
  - Migrations: si usa ORM migrations, crear migration equivalente.
  - Tests: añadir tests para creación/actualización con y sin campos nuevos.

Checklist de cambios de aplicación (frontend):
- Formulario de registro/edición de paciente:
  - Añadir campos con validación mínima (p.ej. `document_type`, `estrato` 0-6, `email` formato, `phone_alt` formato).
  - Campos opcionales deben mostrarse colapsables para no saturar UI.
  - Mapear select inputs a las tablas lookup (obtener lista desde API endpoints o incluir estática si no cambia).
- Visualización: mostrar resumen compacto en la ficha del paciente.

Validación y restricciones sugeridas:
- `document` debe ser requerido (ya lo es). `document_type` opcional pero recomendado.
- `insurance_affiliation_type`: usar enum con valores controlados.
- `estrato`: aceptar 0..6 (Colombia) o NULL.
- `has_disability` boolean y `disability_type_id` solo si `has_disability=1`.
- `email` validación RFC simple.

Pruebas mínimas a ejecutar tras migración:
- Crear paciente nuevo con campos adicionales.
- Actualizar paciente existente y comprobar no se pierden datos previos.
- Registrar cita nueva con paciente existente.

Siguientes pasos que puedo ejecutar si quieres:
- Crear migration equivalente usando el ORM del backend (si me indicas cuál es: TypeORM, Sequelize, Prisma, etc.).
- Implementar cambios de modelo/DTO en backend y un endpoint para exponer listas lookup.
- Actualizar frontend: formularios y validaciones.

Estado actual respecto a tu petición:
- Requisitos solicitados: añadir EPS/afiliación, tipo de documento, estrato, educación, estado civil, grupo poblacional, grupo sanguíneo, discapacidad, email/phone, dirección y municipio (muchos ya presentes)
- Estado: He creado un script no destructivo y un README con checklist; pendiente aplicar la migración y actualizar código de backend/frontend.
