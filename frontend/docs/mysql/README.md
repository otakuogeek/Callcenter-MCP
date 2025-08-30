# Esquema MySQL - Cita Central IPS

Este esquema se generó a partir de las entidades usadas en el frontend (pacientes, doctores, especialidades, EPS, zonas/municipios, sedes, disponibilidades, citas, cola y llamadas).

## Tablas clave
- zones, municipalities: zonas y municipios (LocationManagement)
- eps, eps_agreements: EPS y convenios (EpsManagement)
- locations, location_specialties: sedes y sus especialidades (useAppointmentData)
- specialties: catálogo de especialidades (SpecialtyManagement)
- users: usuarios y roles del sistema (UserTable)
- doctors, doctor_specialties, doctor_locations: doctores y relaciones (DoctorManagement)
- patients: pacientes y su EPS/ubicación (PatientManagement)
- availabilities: disponibilidades (CreateAvailabilityModal/AvailabilityList)
- appointments: citas, enlazadas opcionalmente a una disponibilidad (AppointmentList/ManualAppointmentModal)
- waiting_queue: cola de espera por especialidad (Queue, AISchedulingModal)
- call_logs: resultados de llamadas AI/Manual (AISchedulingModal/ScheduleCallModal)

## Notas de mapeo
- Los strings de estado y tipos reflejan exactamente lo visto en el UI: 'Activa', 'Cancelada', 'Completa' para disponibilidades; 'Pendiente', 'Confirmada', 'Completada', 'Cancelada' para citas; prioridades 'Alta/Normal/Baja'.
- specialty_id reemplaza el string de especialidad del frontend. Crea filas en specialties con esos nombres y usa claves foráneas.
- doctor_id referencia a doctors; para múltiples especialidades/locaciones usa tablas puente.
- availability_id en appointments es NULL-able para permitir citas manuales sin slot preexistente.
- patients.insurance_eps_id referencia a eps.

## Cómo usar
1. Cargar el esquema (recomendado MySQL 8):

```sql
SOURCE docs/mysql/schema.sql;
```

2. Poblar catálogos mínimos (ejemplo rápido):

```sql
INSERT INTO zones (name) VALUES ('Zona Comunera'), ('Zona Guanentina');
INSERT INTO municipalities (zone_id, name) VALUES (1,'Socorro'),(1,'San Gil'),(2,'Málaga');
INSERT INTO specialties (name, description) VALUES
 ('Medicina General',''),('Cardiología',''),('Pediatría',''),('Dermatología',''),('Ginecología',''),('Ortopedia',''),('Fisioterapia',''),('Psicología','');
```

3. Para integrar con el frontend:
- Sustituye strings por IDs en tus endpoints/servicios (ej.: specialty -> specialty_id).
- Al crear disponibilidad, valida que doctor tenga esa especialidad y que la sede ofrezca esa especialidad.
- Usa appointments para cancelaciones con campo cancellation_reason y logs en call_logs.

## Reglas opcionales
- Hay triggers comentados para mantener availabilities.booked_slots en sincronía con appointments.
- Considera crear FULLTEXT en patients(name,email,address) si harás búsquedas libres.

## Consideraciones
- Todas las FK usan RESTRICT/SET NULL para proteger integridad.
- ENUMs reflejan los valores del UI; si necesitas más flexibilidad, migra a catálogos.
- Tiempos están en UTC; ajusta time_zone según tu despliegue si es necesario.

## Migraciones incluidas
- 2025-08-08-add-ai-settings-compat.sql: columnas de IA en system_settings (compat MySQL 8.0.x).
- 2025-08-08-add-general-settings-compat.sql: columnas generales org_* y cc_* en system_settings.
- 2025-08-08-add-org-extra-settings-compat.sql: añade org_nit, org_logo_url y org_timezone.
