// ==============================================
// SCRIPT DE TESTING PARA NUEVAS FUNCIONALIDADES
// ==============================================

import 'dotenv/config';
import pool from '../src/db/pool';

async function testNewFeatures() {
  try {
    console.log('🧪 Iniciando pruebas de nuevas funcionalidades...');

    // 1. Test de tablas de lookup
    console.log('\n1️⃣ Testing tablas de lookup...');
    
    const lookupTables = [
      { name: 'document_types', expected: 6 },
      { name: 'blood_groups', expected: 8 },
      { name: 'education_levels', expected: 7 },
      { name: 'marital_statuses', expected: 6 },
      { name: 'population_groups', expected: 9 },
      { name: 'disability_types', expected: 6 }
    ];

    for (const table of lookupTables) {
      const [rows] = await pool.execute(`SELECT COUNT(*) as count FROM ${table.name}`);
      const count = (rows as any[])[0].count;
      console.log(`✓ ${table.name}: ${count}/${table.expected} registros`);
      
      if (count < table.expected) {
        console.log(`⚠️  ${table.name} tiene menos registros de los esperados`);
      }
    }

    // 2. Test de creación de paciente con nuevos campos
    console.log('\n2️⃣ Testing creación de paciente con campos extendidos...');
    
    const testPatient = {
      document: `TEST${Date.now()}`,
      document_type_id: 1, // CC
      name: 'Paciente Test Biosanarcall',
      phone: '3001234567',
      email: 'test@biosanarcall.com',
      birth_date: '1990-01-01',
      gender: 'Masculino',
      address: 'Calle Test 123',
      municipality_id: 6, // Chima
      insurance_eps_id: 9, // COOMEVA
      insurance_affiliation_type: 'Contributivo',
      blood_group_id: 1, // A+
      population_group_id: 1, // General
      education_level_id: 3, // Básica secundaria
      marital_status_id: 1, // Soltero
      estrato: 3,
      has_disability: false,
      phone_alt: '3007654321',
      notes: 'Paciente de prueba para testing de sistema'
    };

    const [result] = await pool.execute(`
      INSERT INTO patients (
        document, document_type_id, name, phone, email, birth_date, gender, address,
        municipality_id, insurance_eps_id, insurance_affiliation_type,
        blood_group_id, population_group_id, education_level_id, marital_status_id,
        estrato, has_disability, phone_alt, notes,
        created_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'Activo')
    `, [
      testPatient.document,
      testPatient.document_type_id,
      testPatient.name,
      testPatient.phone,
      testPatient.email,
      testPatient.birth_date,
      testPatient.gender,
      testPatient.address,
      testPatient.municipality_id,
      testPatient.insurance_eps_id,
      testPatient.insurance_affiliation_type,
      testPatient.blood_group_id,
      testPatient.population_group_id,
      testPatient.education_level_id,
      testPatient.marital_status_id,
      testPatient.estrato,
      testPatient.has_disability ? 1 : 0,
      testPatient.phone_alt,
      testPatient.notes
    ]);

    const patientId = (result as any).insertId;
    console.log(`✓ Paciente creado con ID: ${patientId}`);

    // 3. Test de consulta con JOINs
    console.log('\n3️⃣ Testing consulta con JOINs...');
    
    const [patientData] = await pool.execute(
      `SELECT 
        p.*,
        dt.name as document_type_name,
        dt.code as document_type_code,
        m.name as municipality_name,
        e.name as eps_name,
        bg.name as blood_group_name,
        bg.code as blood_group_code,
        pg.name as population_group_name,
        el.name as education_level_name,
        ms.name as marital_status_name
       FROM patients p
       LEFT JOIN document_types dt ON p.document_type_id = dt.id
       LEFT JOIN municipalities m ON p.municipality_id = m.id
       LEFT JOIN eps e ON p.insurance_eps_id = e.id
       LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id
       LEFT JOIN population_groups pg ON p.population_group_id = pg.id
       LEFT JOIN education_levels el ON p.education_level_id = el.id
       LEFT JOIN marital_statuses ms ON p.marital_status_id = ms.id
       WHERE p.id = ?`,
      [patientId]
    );

    const patient = (patientData as any[])[0];
    if (patient) {
      console.log(`✓ Consulta con JOINs exitosa:`);
      console.log(`  - Nombre: ${patient.name}`);
      console.log(`  - Documento: ${patient.document} (${patient.document_type_name})`);
      console.log(`  - Municipio: ${patient.municipality_name}`);
      console.log(`  - EPS: ${patient.eps_name}`);
      console.log(`  - Grupo sanguíneo: ${patient.blood_group_name}`);
      console.log(`  - Nivel educativo: ${patient.education_level_name}`);
      console.log(`  - Estado civil: ${patient.marital_status_name}`);
      console.log(`  - Estrato: ${patient.estrato}`);
    } else {
      console.log(`❌ Error: No se pudo obtener el paciente`);
    }

    // 4. Test de búsqueda avanzada
    console.log('\n4️⃣ Testing búsqueda avanzada...');
    
    const [searchResults] = await pool.execute(
      `SELECT 
        p.id,
        p.name,
        p.document,
        dt.name as document_type_name,
        bg.name as blood_group_name,
        pg.name as population_group_name
       FROM patients p
       LEFT JOIN document_types dt ON p.document_type_id = dt.id
       LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id
       LEFT JOIN population_groups pg ON p.population_group_id = pg.id
       WHERE p.status = 'Activo' AND p.name LIKE ?
       LIMIT 5`,
      ['%Test%']
    );

    console.log(`✓ Búsqueda encontró ${(searchResults as any[]).length} resultados`);

    // 5. Test de estadísticas
    console.log('\n5️⃣ Testing estadísticas demográficas...');
    
    const [genderStats] = await pool.execute(
      `SELECT gender, COUNT(*) as count 
       FROM patients 
       WHERE status = 'Activo' 
       GROUP BY gender`
    );

    const [bloodGroupStats] = await pool.execute(
      `SELECT bg.name, COUNT(*) as count 
       FROM patients p 
       LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id 
       WHERE p.status = 'Activo' 
       GROUP BY bg.name`
    );

    console.log(`✓ Estadísticas por género: ${(genderStats as any[]).length} grupos`);
    console.log(`✓ Estadísticas por grupo sanguíneo: ${(bloodGroupStats as any[]).length} grupos`);

    // 6. Limpiar datos de prueba
    console.log('\n6️⃣ Limpiando datos de prueba...');
    await pool.execute('DELETE FROM patients WHERE document LIKE ?', ['TEST%']);
    console.log('✓ Datos de prueba eliminados');

    console.log('\n🎉 Todos los tests completados exitosamente!');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  testNewFeatures();
}

export default testNewFeatures;
