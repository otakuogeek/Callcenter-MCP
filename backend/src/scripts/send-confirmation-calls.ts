import { elevenLabsService } from '../services/elevenLabsService';
import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';
import { formatFullDateColombia, formatTimeColombia, formatDateTimeColombia, COLOMBIA_TIMEZONE } from '../utils/dateUtils';

/**
 * Script para enviar llamadas de confirmación automática
 * a pacientes con citas programadas para mañana
 */

interface UpcomingAppointment {
  appointment_id: number;
  patient_id: number;
  patient_name: string;
  patient_phone: string;
  scheduled_at: Date;
  doctor_name: string;
  specialty_name: string;
  location_name: string;
}

async function getUpcomingAppointments(): Promise<UpcomingAppointment[]> {
  const query = `
    SELECT 
      a.id as appointment_id,
      p.id as patient_id,
      p.name as patient_name,
      p.phone as patient_phone,
      a.scheduled_at,
      d.name as doctor_name,
      s.name as specialty_name,
      l.name as location_name
    FROM appointments a
    INNER JOIN patients p ON a.patient_id = p.id
    INNER JOIN availabilities av ON a.availability_id = av.id
    INNER JOIN doctors d ON av.doctor_id = d.id
    INNER JOIN specialties s ON av.specialty_id = s.id
    INNER JOIN locations l ON av.location_id = l.id
    WHERE a.status = 'scheduled'
      AND a.scheduled_at >= CURDATE() + INTERVAL 1 DAY
      AND a.scheduled_at < CURDATE() + INTERVAL 2 DAY
      AND p.phone IS NOT NULL
      AND p.phone != ''
      AND NOT EXISTS (
        SELECT 1 FROM elevenlabs_conversations ec
        WHERE ec.appointment_id = a.id
          AND ec.status IN ('initiated', 'completed')
          AND DATE(ec.created_at) = CURDATE()
      )
    ORDER BY a.scheduled_at ASC
  `;

  const [rows] = await pool.execute<RowDataPacket[]>(query);
  return rows as UpcomingAppointment[];
}

async function sendAppointmentConfirmationCalls() {
  console.log('🔄 Iniciando proceso de confirmación de citas...\n');

  try {
    // Obtener citas para mañana
    const appointments = await getUpcomingAppointments();

    if (appointments.length === 0) {
      console.log('✅ No hay citas pendientes de confirmación para mañana');
      return;
    }

    console.log(`📞 Se encontraron ${appointments.length} citas para confirmar\n`);

    let successCount = 0;
    let errorCount = 0;

    // Procesar cada cita
    for (const apt of appointments) {
      console.log(`\n📋 Procesando cita #${apt.appointment_id}:`);
      console.log(`   Paciente: ${apt.patient_name}`);
      console.log(`   Teléfono: ${apt.patient_phone}`);
      console.log(`   Fecha: ${formatDateTimeColombia(apt.scheduled_at)}`);
      console.log(`   Doctor: ${apt.doctor_name} - ${apt.specialty_name}`);
      console.log(`   Sede: ${apt.location_name}`);

      try {
        // Formatear fecha y hora (usando timezone Colombia UTC-5)
        const dateStr = formatFullDateColombia(apt.scheduled_at);
        const timeStr = formatTimeColombia(apt.scheduled_at);

        // Iniciar llamada
        const result = await elevenLabsService.initiateCall({
          phoneNumber: apt.patient_phone,
          patientId: apt.patient_id,
          patientName: apt.patient_name,
          appointmentId: apt.appointment_id,
          customVariables: {
            appointment_date: dateStr,
            appointment_time: timeStr,
            doctor_name: apt.doctor_name,
            specialty: apt.specialty_name,
            location: apt.location_name,
            reminder_type: 'confirmacion_24h'
          },
          metadata: {
            campaign: 'appointment_confirmation_24h',
            scheduled_at: apt.scheduled_at.toISOString()
          }
        });

        if (result.success) {
          console.log(`   ✅ Llamada iniciada exitosamente (ID: ${result.conversationId})`);
          successCount++;
          
          // Esperar 2 segundos entre llamadas para no saturar
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.log(`   ❌ Error al iniciar llamada: ${result.error}`);
          errorCount++;
        }
      } catch (error: any) {
        console.log(`   ❌ Error procesando cita: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Resumen:');
    console.log(`   Total de citas: ${appointments.length}`);
    console.log(`   Llamadas exitosas: ${successCount}`);
    console.log(`   Errores: ${errorCount}`);
    console.log('='.repeat(60) + '\n');

  } catch (error: any) {
    console.error('❌ Error general en el proceso:', error.message);
    throw error;
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  sendAppointmentConfirmationCalls()
    .then(() => {
      console.log('✅ Proceso completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error fatal:', error);
      process.exit(1);
    });
}

export { sendAppointmentConfirmationCalls };
