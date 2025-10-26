/**
 * Script para corregir la asignación secuencial de horarios en appointments
 * 
 * VERSIÓN CORREGIDA - Usa availabilities como referencia
 * 
 * Las citas deben asignarse:
 * 1. Agrupadas por availability_id (que ya incluye location, specialty, doctor, fecha)
 * 2. Iniciando desde el start_time de la availability
 * 3. Sumando duration_minutes de la availability a cada cita sucesiva
 * 4. Respetando el break_between_slots si existe
 * 
 * Ejemplo para availability con start_time=07:00:00, duration_minutes=30:
 * Cita 1: 2025-10-20 07:00:00
 * Cita 2: 2025-10-20 07:30:00  
 * Cita 3: 2025-10-20 08:00:00
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/home/ubuntu/app/backend/.env' });

async function fixAppointmentTimes() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'biosanar_user',
    password: '/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU',
    database: 'biosanar'
  });

  try {
    console.log('🔍 Conectado a la base de datos...\n');

    // Obtener todas las availabilities activas
    const [availabilities] = await connection.execute(`
      SELECT 
        av.id,
        av.location_id,
        av.specialty_id,
        av.doctor_id,
        av.date,
        av.start_time,
        av.end_time,
        av.capacity,
        av.booked_slots,
        av.duration_minutes,
        av.break_between_slots,
        l.name as location_name,
        s.name as specialty_name,
        d.name as doctor_name
      FROM availabilities av
      LEFT JOIN locations l ON av.location_id = l.id
      LEFT JOIN specialties s ON av.specialty_id = s.id
      LEFT JOIN doctors d ON av.doctor_id = d.id
      WHERE av.status = 'Activa'
        AND av.date >= CURDATE()
      ORDER BY av.date, av.start_time
    `);

    console.log(`📊 Total de availabilities activas: ${availabilities.length}\n`);

    // Para cada availability, obtener y reorganizar sus citas
    let totalUpdated = 0;
    let totalAvailabilitiesProcessed = 0;

    for (const availability of availabilities) {
      // Obtener todas las citas de esta availability
      const [appointments] = await connection.execute(`
        SELECT 
          a.id,
          a.patient_id,
          a.scheduled_at,
          a.duration_minutes,
          a.status,
          p.name as patient_name
        FROM appointments a
        LEFT JOIN patients p ON a.patient_id = p.id
        WHERE a.availability_id = ?
          AND a.status IN ('Pendiente', 'Confirmada')
        ORDER BY a.id
      `, [availability.id]);

      if (appointments.length === 0) {
        continue; // No hay citas para esta availability
      }

      totalAvailabilitiesProcessed++;

      console.log(`\n🏥 Availability ID: ${availability.id}`);
      console.log(`   📅 Fecha: ${availability.date}`);
      console.log(`   👨‍⚕️ Doctor: ${availability.doctor_name}`);
      console.log(`   🏢 Sede: ${availability.location_name}`);
      console.log(`   💉 Especialidad: ${availability.specialty_name}`);
      console.log(`   ⏰ Horario: ${availability.start_time} - ${availability.end_time}`);
      console.log(`   📋 Duración por cita: ${availability.duration_minutes} min`);
      console.log(`   ⏸️  Descanso entre citas: ${availability.break_between_slots} min`);
      console.log(`   📌 Citas a reorganizar: ${appointments.length}/${availability.capacity}`);

      // Calcular hora de inicio base
      const fechaFormateada = new Date(availability.date).toISOString().split('T')[0];
      const fechaHoraInicio = `${fechaFormateada}T${availability.start_time}`;
      let currentTime = new Date(fechaHoraInicio);

      if (isNaN(currentTime.getTime())) {
        console.log(`   ⚠️  ERROR: Fecha/hora inválida: ${fechaHoraInicio}, saltando availability`);
        continue;
      }

      // Reorganizar cada cita secuencialmente
      for (let i = 0; i < appointments.length; i++) {
        const apt = appointments[i];
        
        // Verificar si la cita excede el end_time de la availability
        const endTimeDate = new Date(`${fechaFormateada}T${availability.end_time}`);
        
        if (currentTime >= endTimeDate) {
          console.log(`   ⚠️  ADVERTENCIA: Cita ${i + 1} excede el horario de fin (${availability.end_time})`);
          console.log(`   ⏩ Saltando citas restantes (${appointments.length - i} citas)`);
          break; // No procesar más citas que excedan el horario
        }
        
        // Formatear la nueva hora para MySQL datetime
        const newScheduledAt = currentTime.toISOString().slice(0, 19).replace('T', ' ');
        
        console.log(`   📌 Cita ${i + 1}/${appointments.length}:`);
        console.log(`      ID: ${apt.id} | Paciente: ${apt.patient_name}`);
        console.log(`      Hora anterior: ${new Date(apt.scheduled_at).toISOString().slice(0, 19).replace('T', ' ')}`);
        console.log(`      Hora nueva: ${newScheduledAt}`);

        // Actualizar la cita
        await connection.execute(
          `UPDATE appointments 
           SET scheduled_at = ? 
           WHERE id = ?`,
          [newScheduledAt, apt.id]
        );

        totalUpdated++;

        // Calcular siguiente hora: sumar duration_minutes + break_between_slots
        const totalMinutes = availability.duration_minutes + (availability.break_between_slots || 0);
        currentTime = new Date(currentTime.getTime() + (totalMinutes * 60 * 1000));
      }

      console.log(`   ✅ Availability procesada correctamente`);
    }

    console.log(`\n✨ Proceso completado!`);
    console.log(`📊 Availabilities procesadas: ${totalAvailabilitiesProcessed}`);
    console.log(`📊 Total de citas actualizadas: ${totalUpdated}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await connection.end();
    console.log('🔌 Conexión cerrada');
  }
}

// Ejecutar
fixAppointmentTimes().catch(console.error);
