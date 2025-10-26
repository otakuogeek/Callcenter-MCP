/**
 * Script para corregir la asignación secuencial de horarios en appointments
 * 
 * Las citas deben asignarse sumando duration_minutes a cada cita sucesiva
 * Agrupadas por: location_id, specialty_id, doctor_id y fecha
 * 
 * Ejemplo:
 * Cita 1: 2025-10-20 07:00:00 (duration: 30min)
 * Cita 2: 2025-10-20 07:30:00 (duration: 30min)  
 * Cita 3: 2025-10-20 08:00:00 (duration: 30min)
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/home/ubuntu/app/backend/.env' });

async function fixAppointmentTimes() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    console.log('🔍 Conectado a la base de datos...\n');

    // Obtener todas las citas agrupadas por disponibilidad
    const [appointments] = await connection.execute(`
      SELECT 
        a.id,
        a.patient_id,
        a.availability_id,
        a.scheduled_at,
        a.duration_minutes,
        a.location_id,
        a.specialty_id,
        a.doctor_id,
        DATE(a.scheduled_at) as fecha,
        av.start_time,
        av.end_time,
        p.name as patient_name,
        d.name as doctor_name
      FROM appointments a
      LEFT JOIN availabilities av ON a.availability_id = av.id
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      WHERE a.status IN ('Pendiente', 'Confirmada')
        AND DATE(a.scheduled_at) >= CURDATE()
      ORDER BY 
        a.location_id, 
        a.specialty_id, 
        a.doctor_id, 
        DATE(a.scheduled_at),
        a.id
    `);

    console.log(`📊 Total de citas a procesar: ${appointments.length}\n`);

    // Agrupar citas por location_id, specialty_id, doctor_id y fecha
    const groups = {};
    
    appointments.forEach(apt => {
      const key = `${apt.location_id}_${apt.specialty_id}_${apt.doctor_id}_${apt.fecha}`;
      if (!groups[key]) {
        groups[key] = {
          location_id: apt.location_id,
          specialty_id: apt.specialty_id,
          doctor_id: apt.doctor_id,
          fecha: apt.fecha,
          start_time: apt.start_time,
          doctor_name: apt.doctor_name,
          appointments: []
        };
      }
      groups[key].appointments.push(apt);
    });

    console.log(`📋 Total de grupos (ubicación/especialidad/doctor/fecha): ${Object.keys(groups).length}\n`);

    let totalUpdated = 0;

    // Procesar cada grupo
    for (const [key, group] of Object.entries(groups)) {
      console.log(`\n🏥 Procesando grupo: ${key}`);
      console.log(`   Doctor: ${group.doctor_name || 'N/A'}`);
      console.log(`   Fecha: ${group.fecha}`);
      console.log(`   Hora inicio: ${group.start_time || 'No definida'}`);
      console.log(`   Citas en grupo: ${group.appointments.length}`);

      if (!group.start_time) {
        console.log(`   ⚠️  ADVERTENCIA: No hay hora de inicio definida, saltando grupo`);
        continue;
      }

      // Calcular hora de inicio base (combinar fecha con start_time)
      const [hours, minutes, seconds] = group.start_time.split(':');
      let currentTime = new Date(`${group.fecha}T${group.start_time}`);

      // Actualizar cada cita del grupo secuencialmente
      for (let i = 0; i < group.appointments.length; i++) {
        const apt = group.appointments[i];
        
        // Formatear la nueva hora para MySQL datetime
        const newScheduledAt = currentTime.toISOString().slice(0, 19).replace('T', ' ');
        
        console.log(`   📌 Cita ${i + 1}/${group.appointments.length}:`);
        console.log(`      ID: ${apt.id} | Paciente: ${apt.patient_name}`);
        console.log(`      Hora anterior: ${apt.scheduled_at}`);
        console.log(`      Hora nueva: ${newScheduledAt}`);
        console.log(`      Duración: ${apt.duration_minutes} min`);

        // Actualizar la cita
        await connection.execute(
          `UPDATE appointments 
           SET scheduled_at = ? 
           WHERE id = ?`,
          [newScheduledAt, apt.id]
        );

        totalUpdated++;

        // Sumar duration_minutes para la siguiente cita
        currentTime = new Date(currentTime.getTime() + (apt.duration_minutes * 60 * 1000));
      }

      console.log(`   ✅ Grupo actualizado correctamente`);
    }

    console.log(`\n✨ Proceso completado!`);
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
