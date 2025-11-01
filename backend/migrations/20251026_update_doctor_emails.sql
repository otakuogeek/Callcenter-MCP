-- Script para asignar emails únicos a cada doctor
-- Fecha: 2025-10-26

-- Actualizar emails para doctores con email duplicado lider.callcenterbiossanar@gmail.com
UPDATE doctors SET email = 'yesika.fiallo@biosanarcall.site' WHERE id = 5;
UPDATE doctors SET email = 'ana.escobar@biosanarcall.site' WHERE id = 6;
UPDATE doctors SET email = 'valentina.abaunza@biosanarcall.site' WHERE id = 7;
UPDATE doctors SET email = 'carlos.almira@biosanarcall.site' WHERE id = 8;
UPDATE doctors SET email = 'claudia.sierra@biosanarcall.site' WHERE id = 10;
UPDATE doctors SET email = 'andres.romero@biosanarcall.site' WHERE id = 11;
UPDATE doctors SET email = 'gina.castillo@biosanarcall.site' WHERE id = 13;
UPDATE doctors SET email = 'alexander.rugeles@biosanarcall.site' WHERE id = 14;
UPDATE doctors SET email = 'erwin.vargas@biosanarcall.site' WHERE id = 15;
UPDATE doctors SET email = 'calixto.escorcia@biosanarcall.site' WHERE id = 16;
UPDATE doctors SET email = 'nestor.motta@biosanarcall.site' WHERE id = 17;

-- Actualizar emails para doctores con email demo@demo.com
UPDATE doctors SET email = 'laura.podeva@biosanarcall.site' WHERE id = 19;
UPDATE doctors SET email = 'luis.garrido@biosanarcall.site' WHERE id = 20;
UPDATE doctors SET email = 'demo.cardiologo@biosanarcall.site' WHERE id = 21;

-- Verificar que no haya duplicados
SELECT email, COUNT(*) as count 
FROM doctors 
GROUP BY email 
HAVING COUNT(*) > 1;

-- Mostrar todos los doctores con sus nuevos emails
SELECT id, name, email, license_number 
FROM doctors 
ORDER BY id;
