#!/usr/bin/env node

/**
 * Script para generar citas de muestra en el sistema Biosanar
 * Genera citas realistas para los pacientes, doctores y especialidades existentes
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'biosanar_user',
  password: process.env.DB_PASS || '/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU',
  database: process.env.DB_NAME || 'biosanar',
  port: parseInt(process.env.DB_PORT || '3306')
};

interface Patient {
  id: number;
  name: string;
}

interface Doctor {
  id: number;
  name: string;
}

interface Specialty {
  id: number;
  name: string;
}

interface Location {
  id: number;
  name: string;
}

// Datos para generar citas realistas
const APPOINTMENT_REASONS = [
  'Consulta de control',
  'Dolor abdominal',
  'Cefalea persistente',
  'Control de presión arterial',
  'Examen de rutina',
  'Dolor de espalda',
  'Seguimiento post-operatorio',
  'Revisión de medicamentos',
  'Chequeo preventivo',
  'Dolor en el pecho',
  'Problemas digestivos',
  'Control de diabetes',
  'Evaluación de peso',
  'Mareos y vértigo',
  'Problemas de sueño',
  'Control de colesterol',
  'Evaluación cardiológica',
  'Revisión dermatológica',
  'Control pediátrico',
  'Terapia psicológica'
];

const INSURANCE_TYPES = [
  'Contributivo',
  'Subsidiado',
  'Especial',
  'Particular'
];

const APPOINTMENT_STATUSES = [
  'Pendiente',
  'Confirmada',
  'Completada',
  'Cancelada'
];

const APPOINTMENT_TYPES = ['Presencial', 'Telemedicina'];

// Función para generar una fecha aleatoria en un rango
function getRandomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Función para generar hora de cita (8 AM a 6 PM, cada 30 minutos)
function getRandomAppointmentTime(): string {
  const hours = [8, 9, 10, 11, 14, 15, 16, 17]; // 8AM-12PM, 2PM-6PM
  const minutes = [0, 30];
  
  const hour = hours[Math.floor(Math.random() * hours.length)];
  const minute = minutes[Math.floor(Math.random() * minutes.length)];
  
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
}

// Función para obtener un elemento aleatorio de un array
function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

async function generateSampleAppointments() {
  let connection: mysql.Connection | null = null;
  
  try {
    console.log('🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(DB_CONFIG);
    
    // Obtener datos existentes
    console.log('📊 Obteniendo datos existentes...');
    
    const [patientsResult] = await connection.execute('SELECT id, name FROM patients WHERE status = "Activo"');
    const patients = patientsResult as Patient[];
    
    const [doctorsResult] = await connection.execute('SELECT id, name FROM doctors WHERE active = 1');
    const doctors = doctorsResult as Doctor[];
    
    const [specialtiesResult] = await connection.execute('SELECT id, name FROM specialties');
    const specialties = specialtiesResult as Specialty[];
    
    const [locationsResult] = await connection.execute('SELECT id, name FROM locations');
    const locations = locationsResult as Location[];
    
    console.log(`👥 Pacientes encontrados: ${patients.length}`);
    console.log(`👨‍⚕️ Doctores encontrados: ${doctors.length}`);
    console.log(`🏥 Especialidades encontradas: ${specialties.length}`);
    console.log(`📍 Ubicaciones encontradas: ${locations.length}`);
    
    if (patients.length === 0 || doctors.length === 0 || specialties.length === 0 || locations.length === 0) {
      throw new Error('No hay suficientes datos maestros para generar citas');
    }
    
    // Verificar si ya existen citas
    const [existingAppointments] = await connection.execute('SELECT COUNT(*) as count FROM appointments');
    const existingCount = (existingAppointments as any)[0].count;
    
    if (existingCount > 0) {
      console.log(`⚠️ Ya existen ${existingCount} citas en el sistema.`);
      console.log('Se agregarán citas adicionales...');
    }
    
    // Generar citas para los próximos 30 días y últimos 15 días
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 15); // 15 días atrás
    
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 30); // 30 días adelante
    
    console.log(`📅 Generando citas desde ${startDate.toDateString()} hasta ${endDate.toDateString()}`);
    
    const appointmentsToCreate = [];
    
    // Generar entre 2-4 citas por paciente
    for (const patient of patients) {
      const numAppointments = Math.floor(Math.random() * 3) + 2; // 2-4 citas
      
      for (let i = 0; i < numAppointments; i++) {
        const appointmentDate = getRandomDate(startDate, endDate);
        const appointmentTime = getRandomAppointmentTime();
        
        // Combinar fecha y hora
        const scheduledDateTime = new Date(`${appointmentDate.toISOString().split('T')[0]} ${appointmentTime}`);
        
        const doctor = getRandomElement(doctors);
        const specialty = getRandomElement(specialties);
        const location = getRandomElement(locations);
        
        // Determinar status basado en la fecha
        let status: string;
        if (scheduledDateTime < today) {
          // Citas pasadas: 70% completadas, 20% canceladas, 10% pendientes
          const rand = Math.random();
          if (rand < 0.7) status = 'Completada';
          else if (rand < 0.9) status = 'Cancelada';
          else status = 'Pendiente';
        } else {
          // Citas futuras: 60% confirmadas, 30% pendientes, 10% canceladas
          const rand = Math.random();
          if (rand < 0.6) status = 'Confirmada';
          else if (rand < 0.9) status = 'Pendiente';
          else status = 'Cancelada';
        }
        
        const appointment = {
          patient_id: patient.id,
          doctor_id: doctor.id,
          specialty_id: specialty.id,
          location_id: location.id,
          scheduled_at: scheduledDateTime.toISOString().slice(0, 19).replace('T', ' '),
          duration_minutes: [30, 45, 60][Math.floor(Math.random() * 3)], // 30, 45 o 60 minutos
          appointment_type: getRandomElement(APPOINTMENT_TYPES),
          status,
          reason: getRandomElement(APPOINTMENT_REASONS),
          insurance_type: getRandomElement(INSURANCE_TYPES),
          notes: status === 'Completada' ? 
            'Paciente atendido satisfactoriamente. Se recomienda seguimiento.' : 
            status === 'Cancelada' ? 
            'Cita cancelada por el paciente.' : null,
          cancellation_reason: status === 'Cancelada' ? 
            ['Emergencia familiar', 'Enfermedad', 'Viaje', 'Conflicto de horario'][Math.floor(Math.random() * 4)] : 
            null,
          created_by_user_id: 1 // Usuario admin
        };
        
        appointmentsToCreate.push(appointment);
      }
    }
    
    // Insertar las citas en la base de datos
    console.log(`💾 Insertando ${appointmentsToCreate.length} citas...`);
    
    const insertQuery = `
      INSERT INTO appointments (
        patient_id, doctor_id, specialty_id, location_id, scheduled_at,
        duration_minutes, appointment_type, status, reason, insurance_type,
        notes, cancellation_reason, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const appointment of appointmentsToCreate) {
      try {
        await connection.execute(insertQuery, [
          appointment.patient_id,
          appointment.doctor_id,
          appointment.specialty_id,
          appointment.location_id,
          appointment.scheduled_at,
          appointment.duration_minutes,
          appointment.appointment_type,
          appointment.status,
          appointment.reason,
          appointment.insurance_type,
          appointment.notes,
          appointment.cancellation_reason,
          appointment.created_by_user_id
        ]);
        successCount++;
      } catch (error) {
        console.error(`Error insertando cita para paciente ${appointment.patient_id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`✅ Citas creadas exitosamente: ${successCount}`);
    if (errorCount > 0) {
      console.log(`❌ Errores en la creación: ${errorCount}`);
    }
    
    // Mostrar estadísticas
    const [statsResult] = await connection.execute(`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER()), 2) as percentage
      FROM appointments 
      GROUP BY status
      ORDER BY count DESC
    `);
    
    console.log('\n📊 Estadísticas de citas creadas:');
    console.table(statsResult);
    
    // Mostrar citas por especialidad
    const [specialtyStats] = await connection.execute(`
      SELECT 
        s.name as especialidad,
        COUNT(a.id) as total_citas
      FROM appointments a
      JOIN specialties s ON a.specialty_id = s.id
      GROUP BY s.id, s.name
      ORDER BY total_citas DESC
    `);
    
    console.log('\n🏥 Citas por especialidad:');
    console.table(specialtyStats);
    
  } catch (error) {
    console.error('❌ Error generando citas de muestra:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

// Ejecutar el script si se llama directamente
if (require.main === module) {
  console.log('🚀 Iniciando generación de citas de muestra para Biosanar...\n');
  generateSampleAppointments()
    .then(() => {
      console.log('\n🎉 ¡Generación de citas completada exitosamente!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error en la generación de citas:', error);
      process.exit(1);
    });
}

export default generateSampleAppointments;
