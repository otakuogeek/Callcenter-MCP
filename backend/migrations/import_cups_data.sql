-- Importación masiva de códigos CUPS
-- Fecha: 2025-10-15 20:03:50

USE biosanar;

-- Comenzar transacción
START TRANSACTION;

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('231301', 'INTRAORAL +', 'Radiología', 106750.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('231302', 'EXTRAORAL +', 'Radiología', 10000.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881112', '7.MHZ O MAS', 'Imágenes Diagnósticas', 123130.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881118', 'ECOGRAFIA CEREBRAL TRANSFONTANELAR CON ANALISIS DOPPLER', 'Imágenes Diagnósticas', 123130.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881130', 'ECOGRAFIA DE TEJIDOS BLANDOS DE CARA', 'Imágenes Diagnósticas', 121310.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881131', 'MAS', 'Imágenes Diagnósticas', 121310.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881132', 'ECOGRAFIA DE CUELLO', 'Imágenes Diagnósticas', 121310.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881141', 'ECOGRAFIA DE TIROIDES CON TRANSDUCTOR DE 7 MHZ O MAS', 'Imágenes Diagnósticas', 121310.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881151', 'ECOGRAFIA DE GLANGLIOS CERVICALES (MAPEO)', 'Imágenes Diagnósticas', 121310.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881201', 'ECOGRAFIA DE MAMA CON TRANSDUCTOR DE 7 MHZ O MAS', 'Imágenes Diagnósticas', 128030.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881211', 'ECOGRAFIA DE TORAX (PERICARDIO O PLEURA)', 'Imágenes Diagnósticas', 111020.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881212', 'ECOGRAFIA DE OTROS SITIOS TORACICOS', 'Imágenes Diagnósticas', 111020.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881301', 'ECOGRAFIA DE TEJIDOS BLANDOS DE PARED ABDOMINAL Y DE PELVIS', 'Imágenes Diagnósticas', 121310.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881302', 'BILIARES RIÃ‘ONES BAZO GRANDES VASOS PELVIS Y FLANCOS)', 'Imágenes Diagnósticas', 202020.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881305', 'RIÃ‘ONES BAZO Y GRANDES VASOS)', 'Imágenes Diagnósticas', 187180.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881306', 'ECOGRAFIA DE HIGADO PANCREAS VIA BILIAR Y VESICULA', 'Imágenes Diagnósticas', 118020.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881313', 'ECOGRAFIA DE ABDOMEN (PILORO)', 'Imágenes Diagnósticas', 187180.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881318', 'ECOGRAFIA DE RECTO', 'Imágenes Diagnósticas', 102830.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881331', 'ECOGRAFIA DE RIÃ‘ONES BAZO AORTA O ADRENALES', 'Imágenes Diagnósticas', 118020.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881332', 'TRANSABDOMINAL)', 'Imágenes Diagnósticas', 160000.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881340', 'RETROPERITONEO)', 'Imágenes Diagnósticas', 118020.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881360', 'ECOGRAFIA PELVICA CON ANALISIS DOPPLER', 'Imágenes Diagnósticas', 124670.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881362', 'ECOGRAFIA DE TEJIDOS BLANDOS DE ABDOMEN CON ANALISIS DOPPLER', 'Imágenes Diagnósticas', 158094.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881390', 'QUIRURGICO O INTERVENCIONISTA', 'Imágenes Diagnósticas', 202020.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881401', 'ECOGRAFIA PELVICA GINECOLOGICA TRANSVAGINAL', 'Imágenes Diagnósticas', 124670.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881402', 'ECOGRAFIA PELVICA GINECOLOGICA TRANSABDOMINAL', 'Imágenes Diagnósticas', 97370.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881403', 'CON ECO VAGINAL)', 'Imágenes Diagnósticas', 83090.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881410', 'HISTEROSALPINGOSONOGRAFIA)', 'Imágenes Diagnósticas', 97370.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881431', 'ECOGRAFIA OBSTETRICA TRANSABDOMINAL', 'Imágenes Diagnósticas', 110000.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881432', 'ECOGRAFIA OBSTETRICA TRANSVAGINAL', 'Imágenes Diagnósticas', 124670.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881436', 'ECOGRAFIA OBSTETRICA CON TRANSLUCENCIA NUCAL', 'Imágenes Diagnósticas', 70000.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881501', 'ECOGRAFIA DE PROSTATA TRANSABDOMINAL', 'Imágenes Diagnósticas', 142870.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881502', 'ECOGRAFIA DE PROSTATA TRANSRECTAL', 'Imágenes Diagnósticas', 102830.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881510', 'ECOGRAFIA TESTICULAR CON TRANSDUCTOR DE 7 MHZ O MAS', 'Imágenes Diagnósticas', 121310.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881511', 'ECOGRAFIA TESTICULAR CON ANALISIS DOPPLER', 'Imágenes Diagnósticas', 164080.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881521', 'ECOGRAFIA DE PENE CON TRANSDUCTOR DE 7 MHZ O MAS', 'Imágenes Diagnósticas', 121310.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881601', 'CON TRANSDUCTOR DE 7 MHZ O MAS', 'Imágenes Diagnósticas', 121310.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881602', 'CON TRANSDUCTOR DE 7 MHZ O MAS', 'Imágenes Diagnósticas', 127400.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881610', 'ECOGRAFIA ARTICULAR DE HOMBRO', 'Imágenes Diagnósticas', 127400.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881611', 'ECOGRAFIA ARTICULAR DE CODO', 'Imágenes Diagnósticas', 127400.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881612', 'ECOGRAFIA ARTICULAR DE PUÃ‘O (MUÃ‘ECA)', 'Imágenes Diagnósticas', 127400.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881613', 'ECOGRAFIA ARTICULAR DE MANO', 'Imágenes Diagnósticas', 127400.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881620', 'ECOGRAFIA ARTICULAR DE RODILLA', 'Imágenes Diagnósticas', 127400.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881621', 'ECOGRAFIA ARTICULAR DE TOBILLO', 'Imágenes Diagnósticas', 127400.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881622', 'ECOGRAFIA ARTICULAR DE PIE', 'Imágenes Diagnósticas', 127400.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881630', 'ECOGRAFIA ARTICULAR DE CADERA', 'Imágenes Diagnósticas', 127400.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('881640', 'ECOGRAFIA DE CALCANEO', 'Imágenes Diagnósticas', 127400.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('882103', 'ECOGRAFIA DOPPLER TRANSCRANEAL A COLOR', 'Imágenes Diagnósticas', 328380.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('882112', 'ECOGRAFIA DOPPLER DE VASOS DEL CUELLO', 'Imágenes Diagnósticas', 172620.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('882132', 'COLOR', 'Imágenes Diagnósticas', 154420.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('882203', 'ECOGRAFIA DOPPLER DE VASOS ABDOMINALES O PELVICOS', 'Imágenes Diagnósticas', 154420.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('882212', 'ECOGRAFIA DOPPLER DE AORTA ABDOMINAL', 'Imágenes Diagnósticas', 154420.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('882272', 'ECOGRAFIA DOPPLER DE VASOS DEL PENE A COLOR', 'Imágenes Diagnósticas', 383110.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('882282', 'ECOGRAFIA DOPPLER DE VASOS ESCROTALES A COLOR', 'Imágenes Diagnósticas', 547300.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('882292', 'MASAS ABDOMINALES A COLOR', 'Imágenes Diagnósticas', 154420.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('882294', 'MASAS PELVICAS', 'Imágenes Diagnósticas', 154420.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('882307', 'SUPERIORES', 'Imágenes Diagnósticas', 154420.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('882308', 'ECOGRAFIA DOPPLER DE VASOS ARTERIALES DE MIEMBROS INFERIORES', 'Imágenes Diagnósticas', 154420.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('882309', 'ECOGRAFIA DOPPLER DE VASOS VENOSOS DE MIEMBROS SUPERIORES', 'Imágenes Diagnósticas', 154420.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('882316', 'ECOGRAFIA DOPPLER DE VASOS VENOSOS DE MIEMBRO SUPERIOR', 'Imágenes Diagnósticas', 154420.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('882317', 'ECOGRAFIA DOPPLER DE VASOS VENOSOS DE MIEMBROS INFERIORES', 'Imágenes Diagnósticas', 154420.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();

INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('882318', 'ECOGRAFIA DOPPLER DE VASOS VENOSOS DE MIEMBRO INFERIOR', 'Imágenes Diagnósticas', 154420.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();


-- Confirmar transacción
COMMIT;
