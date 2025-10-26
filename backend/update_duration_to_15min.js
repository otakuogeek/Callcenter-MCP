const mysql = require('mysql2/promise');

async function updateDurationTo15Min() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'biosanar_user',
    password: 'Biosanar2024!',
    database: 'biosanar',
    port: 3306
  });

  console.log('✅ Conectado a la base de datos');

  try {
    // Primero, consultar las disponibilidades problemáticas
    const [avails] = await connection.query(`
      SELECT 
        av.id,
        av.date,
        av.start_time,
        av.end_time,
        av.duration_minutes,
        av.capacity,
        av.booked_slots,
        s.name as specialty,
        d.name as doctor
      FROM availabilities av
      JOIN specialties s ON av.specialty_id = s.id
      JOIN doctors d ON av.doctor_id = d.id
      WHERE av.id IN (142, 144, 155)
      ORDER BY av.id
    `);

    console.log('\n📊 DISPONIBILIDADES CON PROBLEMAS:');
    console.log('====================================\n');
    
    for (const av of avails) {
      console.log(`ID: ${av.id}`);
      console.log(`Doctor: ${av.doctor}`);
      console.log(`Especialidad: ${av.specialty}`);
      console.log(`Fecha: ${av.date.toISOString().split('T')[0]}`);
      console.log(`Horario: ${av.start_time} - ${av.end_time}`);
      console.log(`Duración actual: ${av.duration_minutes} minutos`);
      console.log(`Capacidad: ${av.capacity}`);
      console.log(`Citas reservadas: ${av.booked_slots}`);
      
      // Calcular cuántas citas caben con 15 minutos
      const [startH, startM] = av.start_time.split(':').map(Number);
      const [endH, endM] = av.end_time.split(':').map(Number);
      const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      const slotsWithNew = Math.floor(totalMinutes / 15);
      console.log(`✨ Citas que cabrían con 15 min: ${slotsWithNew}`);
      console.log('-----------------------------------\n');
    }

    // Actualizar la duración en las availabilities
    console.log('🔧 ACTUALIZANDO DURACIÓN A 15 MINUTOS...\n');
    
    const [updateResult] = await connection.query(`
      UPDATE availabilities
      SET duration_minutes = 15
      WHERE id IN (142, 144, 155)
    `);

    console.log(`✅ ${updateResult.affectedRows} disponibilidades actualizadas\n`);

    // Verificar la actualización
    const [updatedAvails] = await connection.query(`
      SELECT id, duration_minutes
      FROM availabilities
      WHERE id IN (142, 144, 155)
    `);

    console.log('📋 VERIFICACIÓN:');
    console.log('================');
    for (const av of updatedAvails) {
      console.log(`Availability ${av.id}: ${av.duration_minutes} minutos`);
    }

    console.log('\n✅ Proceso completado. Ahora puedes ejecutar nuevamente el script de actualización de horarios.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
    console.log('\n🔌 Conexión cerrada');
  }
}

updateDurationTo15Min();
