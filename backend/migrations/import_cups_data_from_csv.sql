-- Importación de códigos CUPS desde Libro3.csv
-- Fecha: 2025-10-15
-- Este script inserta o actualiza los códigos CUPS con sus precios promedio

-- Deshabilitar verificación de claves foráneas temporalmente
SET FOREIGN_KEY_CHECKS = 0;

-- Insertar o actualizar códigos CUPS
-- Para códigos duplicados, se calcula el precio promedio (excluyendo valores en 0)

-- 881201 - Ecografía de mama (Promedio: 68,656)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881201', 'ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS', 68656, 'Ecografía', FALSE, 'Media', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881302 - Ecografía de abdomen total (Promedio: 103,303)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881302', 'ECOGRAFIA DE ABDOMEN TOTAL (HIGADO PANCREAS VESICULA VIAS BILIARES RIǑONES BAZO GRANDES VASOS PELVIS Y FLANCOS)', 103303, 'Ecografía', TRUE, 'Alta', 45, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881332 - Ecografía de vías urinarias (Promedio: 83,845)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881332', 'ECOGRAFIA DE VIAS URINARIAS (RIǑONES VEJIGA Y PROSTATA TRANSABDOMINAL)', 83845, 'Ecografía', TRUE, 'Alta', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881510 - Ecografía testicular (Promedio: 52,256)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881510', 'ECOGRAFIA TESTICULAR CON TRANSDUCTOR DE 7 MHZ O MAS', 52256, 'Ecografía', TRUE, 'Media', 20, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881602 - Ecografía tejidos blandos extremidades inferiores (Promedio: 63,333)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881602', 'ECOGRAFIA DE TEJIDOS BLANDOS EN LAS EXTREMIDADES INFERIORES CON TRANSDUCTOR DE 7 MHZ O MAS', 63333, 'Ecografía', TRUE, 'Media', 25, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881305 - Ecografía de abdomen superior (Promedio: 73,920)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881305', 'ECOGRAFIA DE ABDOMEN SUPERIOR (HIGADO PANCREAS VIAS BILIARES RIǑONES BAZO Y GRANDES VASOS)', 73920, 'Ecografía', TRUE, 'Alta', 40, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881132 - Ecografía de cuello (Promedio: 77,438)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881132', 'ECOGRAFIA DE CUELLO', 77438, 'Ecografía', FALSE, 'Media', 25, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881141 - Ecografía de tiroides (Promedio: 59,970)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881141', 'ECOGRAFIA DE TIROIDES CON TRANSDUCTOR DE 7 MHZ O MAS', 59970, 'Ecografía', FALSE, 'Media', 25, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881402 - Ecografía pélvica ginecológica transabdominal (Promedio: 50,834)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881402', 'ECOGRAFIA PELVICA GINECOLOGICA TRANSABDOMINAL', 50834, 'Ecografía', TRUE, 'Media', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881401 - Ecografía pélvica ginecológica transvaginal (Promedio: 56,481)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881401', 'ECOGRAFIA PELVICA GINECOLOGICA TRANSVAGINAL', 56481, 'Ecografía', TRUE, 'Media', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881521 - Ecografía de pene (Promedio: 62,093)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881521', 'ECOGRAFIA DE PENE CON TRANSDUCTOR DE 7 MHZ O MAS', 62093, 'Ecografía', TRUE, 'Media', 20, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881620 - Ecografía articular de rodilla (Promedio: 58,160)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881620', 'ECOGRAFIA ARTICULAR DE RODILLA', 58160, 'Ecografía', TRUE, 'Media', 25, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881621 - Ecografía articular de tobillo (Promedio: 83,381)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881621', 'ECOGRAFIA ARTICULAR DE TOBILLO', 83381, 'Ecografía', TRUE, 'Alta', 25, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881431 - Ecografía obstétrica transabdominal (Promedio: 46,586)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881431', 'ECOGRAFIA OBSTETRICA TRANSABDOMINAL', 46586, 'Ecografía', FALSE, 'Media', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881610 - Ecografía articular de hombro (Promedio: 55,660)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881610', 'ECOGRAFIA ARTICULAR DE HOMBRO', 55660, 'Ecografía', TRUE, 'Media', 25, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881611 - Ecografía articular de codo (Promedio: 83,381)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881611', 'ECOGRAFIA ARTICULAR DE CODO', 83381, 'Ecografía', TRUE, 'Alta', 25, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881436 - Ecografía obstétrica con translucencia nucal (Promedio: 70,000)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881436', 'ECOGRAFIA OBSTETRICA CON TRANSLUCENCIA NUCAL', 70000, 'Ecografía', TRUE, 'Alta', 40, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881601 - Ecografía tejidos blandos extremidades superiores (Promedio: 60,737)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881601', 'ECOGRAFIA DE TEJIDOS BLANDOS EN LAS EXTREMIDADES SUPERIORES CON TRANSDUCTOR DE 7 MHZ O MAS', 60737, 'Ecografía', TRUE, 'Media', 25, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881301 - Ecografía de tejidos blandos pared abdominal (Promedio: 61266)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881301', 'ECOGRAFIA DE TEJIDOS BLANDOS DE PARED ABDOMINAL Y DE PELVIS', 61266, 'Ecografía', TRUE, 'Media', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881131 - Ecografía de glándulas salivales (Promedio: 76,683)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881131', 'ECOGRAFIA DE GLANDULAS SALIVALES CON TRANSDUCTOR DE 7 MHZ O MAS', 76683, 'Ecografía', TRUE, 'Media', 25, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881612 - Ecografía articular de puño/muñeca (Promedio: 70,231)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881612', 'ECOGRAFIA ARTICULAR DE PUǑO (MUǑECA)', 70231, 'Ecografía', TRUE, 'Media', 25, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881630 - Ecografía articular de cadera (Promedio: 83,738)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881630', 'ECOGRAFIA ARTICULAR DE CADERA', 83738, 'Ecografía', TRUE, 'Alta', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881432 - Ecografía obstétrica transvaginal (Promedio: 61395)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881432', 'ECOGRAFIA OBSTETRICA TRANSVAGINAL', 61395, 'Ecografía', TRUE, 'Media', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881306 - Ecografía de hígado, páncreas, vía biliar y vesícula (Promedio: 57,932)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881306', 'ECOGRAFIA DE HIGADO PANCREAS VIA BILIAR Y VESICULA', 57932, 'Ecografía', TRUE, 'Media', 35, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881211 - Ecografía de tórax (Promedio: 57,732)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881211', 'ECOGRAFIA DE TORAX (PERICARDIO O PLEURA)', 57732, 'Ecografía', TRUE, 'Media', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881331 - Ecografía de riñones, bazo, aorta o adrenales (Promedio: 64,010)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881331', 'ECOGRAFIA DE RIǑONES BAZO AORTA O ADRENALES', 64010, 'Ecografía', TRUE, 'Media', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881340 - Ecografía de abdomen (masas abdominales) (Promedio: 69,227)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881340', 'ECOGRAFIA DE ABDOMEN (MASAS ABDOMINALES Y DE RETROPERITONEO)', 69227, 'Ecografía', TRUE, 'Media', 35, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881501 - Ecografía de próstata transabdominal (Promedio: 71, 909)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881501', 'ECOGRAFIA DE PROSTATA TRANSABDOMINAL', 71909, 'Ecografía', TRUE, 'Media', 25, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881112 - Ecografía cerebral transfontanelar (Promedio: 83,047)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881112', 'ECOGRAFIA CEREBRAL TRANSFONTANELAR CON TRANSDUCTOR DE 7.MHZ O MAS', 83047, 'Ecografía', TRUE, 'Alta', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881118 - Ecografía cerebral transfontanelar con Doppler (Promedio: 108,806)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881118', 'ECOGRAFIA CEREBRAL TRANSFONTANELAR CON ANALISIS DOPPLER', 108806, 'Ecografía', TRUE, 'Alta', 40, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881130 - Ecografía de tejidos blandos de cara (Promedio: 65,655)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881130', 'ECOGRAFIA DE TEJIDOS BLANDOS DE CARA', 65655, 'Ecografía', TRUE, 'Media', 20, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881151 - Ecografía de ganglios cervicales (Promedio: 65,655)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881151', 'ECOGRAFIA DE GLANGLIOS CERVICALES (MAPEO)', 65655, 'Ecografía', TRUE, 'Media', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881212 - Ecografía de otros sitios torácicos (Promedio: 60,510)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881212', 'ECOGRAFIA DE OTROS SITIOS TORACICOS', 60510, 'Ecografía', TRUE, 'Media', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category, VALUES(category), updated_at = NOW();

-- 881360 - Ecografía pélvica con Doppler (Promedio: 88,057)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881360', 'ECOGRAFIA PELVICA CON ANALISIS DOPPLER', 88057, 'Doppler', TRUE, 'Alta', 40, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881362 - Ecografía tejidos blandos abdomen con Doppler (Promedio: 109,047)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881362', 'ECOGRAFIA DE TEJIDOS BLANDOS DE ABDOMEN CON ANALISIS DOPPLER', 109047, 'Doppler', TRUE, 'Alta', 40, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881502 - Ecografía de próstata transrectal (Promedio: 71,621)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881502', 'ECOGRAFIA DE PROSTATA TRANSRECTAL', 71621, 'Ecografía', TRUE, 'Media', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881511 - Ecografía testicular con Doppler (Promedio: 89,843)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881511', 'ECOGRAFIA TESTICULAR CON ANALISIS DOPPLER', 89843, 'Doppler', TRUE, 'Alta', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881613 - Ecografía articular de mano (Promedio: 83,381)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881613', 'ECOGRAFIA ARTICULAR DE MANO', 83381, 'Ecografía', TRUE, 'Alta', 25, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881622 - Ecografía articular de pie (Promedio: 83,700)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881622', 'ECOGRAFIA ARTICULAR DE PIE', 83700, 'Ecografía', TRUE, 'Alta', 25, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881640 - Ecografía de calcáneo (Promedio: 83,700)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881640', 'ECOGRAFIA DE CALCANEO', 83700, 'Ecografía', TRUE, 'Alta', 20, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 882112 - Ecografía Doppler de vasos del cuello (Promedio: 143,027)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('882112', 'ECOGRAFIA DOPPLER DE VASOS DEL CUELLO', 143027, 'Doppler', TRUE, 'Alta', 35, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 882132 - Ecografía Doppler de otros vasos periféricos del cuello (Promedio: 120,838)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('882132', 'ECOGRAFIA DOPPLER DE OTROS VASOS PERIFERICOS DEL CUELLO A COLOR', 120838, 'Doppler', TRUE, 'Alta', 35, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 882282 - Ecografía Doppler de vasos escrotales (Promedio: 278,650)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('882282', 'ECOGRAFIA DOPPLER DE VASOS ESCROTALES A COLOR', 278650, 'Doppler', TRUE, 'Alta', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 882292 - Ecografía Doppler con evaluación de flujo en masas abdominales (Promedio: 82,210)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('882292', 'ECOGRAFIA DOPPLER CON EVALUACION DE FLUJO SANGUINEO EN MASAS ABDOMINALES A COLOR', 82210, 'Doppler', TRUE, 'Alta', 40, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 882294 - Ecografía Doppler con evaluación de flujo en masas pélvicas (Promedio: 82,210)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('882294', 'ECOGRAFIA DOPPLER CON EVALUACION DE FLUJO SANGUINEO EN MASAS PELVICAS', 82210, 'Doppler', TRUE, 'Alta', 40, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 882307 - Ecografía Doppler vasos arteriales miembros superiores (Promedio: 82,210)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('882307', 'ECOGRAFIA DOPPLER DE VASOS ARTERIALES DE MIEMBROS SUPERIORES', 82210, 'Doppler', TRUE, 'Alta', 35, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 882308 - Ecografía Doppler vasos arteriales miembros inferiores (Promedio: 82,316)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('882308', 'ECOGRAFIA DOPPLER DE VASOS ARTERIALES DE MIEMBROS INFERIORES', 82316, 'Doppler', TRUE, 'Alta', 35, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 882309 - Ecografía Doppler vasos venosos miembros superiores (Promedio: 82,210)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('882309', 'ECOGRAFIA DOPPLER DE VASOS VENOSOS DE MIEMBROS SUPERIORES', 82210, 'Doppler', TRUE, 'Alta', 35, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 882316 - Ecografía Doppler vasos venosos miembro superior (Promedio: 82,210)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('882316', 'ECOGRAFIA DOPPLER DE VASOS VENOSOS DE MIEMBRO SUPERIOR', 82210, 'Doppler', TRUE, 'Alta', 35, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 882317 - Ecografía Doppler vasos venosos miembros inferiores (Promedio: 95,850)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('882317', 'ECOGRAFIA DOPPLER DE VASOS VENOSOS DE MIEMBROS INFERIORES', 95850, 'Doppler', TRUE, 'Alta', 35, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 882318 - Ecografía Doppler vasos venosos miembro inferior (Promedio: 91,210)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('882318', 'ECOGRAFIA DOPPLER DE VASOS VENOSOS DE MIEMBRO INFERIOR', 91210, 'Doppler', TRUE, 'Alta', 35, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881318 - Ecografía de recto (Promedio: 60,066)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881318', 'ECOGRAFIA DE RECTO', 60066, 'Ecografía', TRUE, 'Media', 25, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881313 - Ecografía de abdomen (piloro) (Promedio: 107,747)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881313', 'ECOGRAFIA DE ABDOMEN (PILORO)', 107747, 'Ecografía', TRUE, 'Alta', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 882272 - Ecografía Doppler de vasos del pene (Promedio: 196,555)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('882272', 'ECOGRAFIA DOPPLER DE VASOS DEL PENE A COLOR', 196555, 'Doppler', TRUE, 'Alta', 30, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 882212 - Ecografía Doppler de aorta abdominal (Promedio: 146,395)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('882212', 'ECOGRAFIA DOPPLER DE AORTA ABDOMINAL', 146395, 'Doppler', TRUE, 'Alta', 35, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 882203 - Ecografía Doppler de vasos abdominales o pélvicos (Promedio: 133927)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('882203', 'ECOGRAFIA DOPPLER DE VASOS ABDOMINALES O PELVICOS', 133927, 'Doppler', TRUE, 'Alta', 40, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 882103 - Ecografía Doppler transcraneal (Promedio: 250,084)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('882103', 'ECOGRAFIA DOPPLER TRANSCRANEAL A COLOR', 250084, 'Doppler', TRUE, 'Alta', 45, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881410 - Ecografía pélvica ginecológica (histerosonografía) (Promedio: 84,323)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881410', 'ECOGRAFIA PELVICA GINECOLOGICA (HISTEROSONOGRAFIA O HISTEROSALPINGOSONOGRAFIA)', 84323, 'Ecografía', TRUE, 'Alta', 40, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881403 - Ecografía pélvica ginecológica (estudio folicular) (Promedio: 71,798)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881403', 'ECOGRAFIA PELVICA GINECOLOGICA (ESTUDIO INTEGRAL FOLICULAR CON ECO VAGINAL)', 71798, 'Ecografía', TRUE, 'Media', 35, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 881390 - Ecografía abdomen y pelvis como guía (Promedio: 121,001)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('881390', 'ECOGRAFIA DEL ABDOMEN Y PELVIS COMO GUIA DE PROCEDIMIENTO QUIRURGICO O INTERVENCIONISTA', 121001, 'Ecografía', TRUE, 'Alta', 45, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 231301 - Exodoncia de incluido posición ectópica abordaje intraoral (Promedio: 58,375)
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('231301', 'EXODONCIA DE INCLUIDO EN POSICION ECTOPICA CON ABORDAJE INTRAORAL +', 58375, 'Odontología', TRUE, 'Media', 60, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- 231302 - Exodoncia de incluido posición ectópica abordaje extraoral
INSERT INTO cups (code, name, base_price, category, requires_authorization, complexity_level, estimated_duration_minutes, status, created_at, updated_at)
VALUES ('231302', 'EXODONCIA DE INCLUIDO EN POSICION ECTOPICA CON ABORDAJE EXTRAORAL +', 10000, 'Odontología', FALSE, 'Alta', 90, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), base_price = VALUES(base_price), category = VALUES(category), updated_at = NOW();

-- Habilitar verificación de claves foráneas
SET FOREIGN_KEY_CHECKS = 1;

-- Consulta para verificar la importación
SELECT 
  category,
  COUNT(*) as total,
  ROUND(AVG(base_price), 2) as avg_price,
  MIN(base_price) as min_price,
  MAX(base_price) as max_price
FROM cups
WHERE status = 'active'
GROUP BY category
ORDER BY category;
