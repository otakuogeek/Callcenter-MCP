import pool from '../db/pool';

export interface RedistributionResult {
  redistributed_quota: number;
  days_processed: number;
  days_updated: number;
  details: {
    from_date: string;
    to_date: string;
    quota_moved: number;
  }[];
}

/**
 * Redistribuye cupos no asignados de días pasados hacia días futuros
 * hasta el día actual, maximizando el aprovechamiento de la agenda
 * 
 * @param availability_id ID de la disponibilidad a redistribuir
 * @param until_date Fecha límite hasta donde redistribuir (default: hoy)
 * @returns Resultado de la redistribución con estadísticas
 */
export async function redistributeUnassignedQuota(
  availability_id: number,
  until_date?: string
): Promise<RedistributionResult> {
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const untilDate = until_date ? new Date(until_date) : today;
  untilDate.setHours(0, 0, 0, 0);
  
  const todayStr = today.toISOString().split('T')[0];
  const untilDateStr = untilDate.toISOString().split('T')[0];

  let totalRedistributed = 0;
  let daysProcessed = 0;
  let daysUpdated = 0;
  const redistributionDetails: { from_date: string; to_date: string; quota_moved: number }[] = [];

  try {
    // 1. Obtener todos los días con cupos no asignados (días pasados)
    const [pastDaysRows] = await pool.query(
      `SELECT id, day_date, quota, assigned, (quota - assigned) as available
       FROM availability_distribution
       WHERE availability_id = ?
         AND day_date < ?
         AND (quota - assigned) > 0
       ORDER BY day_date ASC`,
      [availability_id, todayStr]
    );

    const pastDays = pastDaysRows as any[];
    
    if (pastDays.length === 0) {
      return {
        redistributed_quota: 0,
        days_processed: 0,
        days_updated: 0,
        details: []
      };
    }

    // 2. Obtener días futuros (desde hoy hasta until_date) ordenados por fecha
    const [futureDaysRows] = await pool.query(
      `SELECT id, day_date, quota, assigned, (quota - assigned) as available
       FROM availability_distribution
       WHERE availability_id = ?
         AND day_date >= ?
         AND day_date <= ?
       ORDER BY day_date ASC`,
      [availability_id, todayStr, untilDateStr]
    );

    const futureDays = futureDaysRows as any[];

    if (futureDays.length === 0) {
      console.log('No hay días futuros disponibles para redistribución');
      return {
        redistributed_quota: 0,
        days_processed: pastDays.length,
        days_updated: 0,
        details: []
      };
    }

    // 3. Redistribuir cupos de días pasados a días futuros
    for (const pastDay of pastDays) {
      const quotaToRedistribute = pastDay.available;
      
      if (quotaToRedistribute <= 0) continue;

      daysProcessed++;
      let remainingQuota = quotaToRedistribute;

      // Distribuir equitativamente entre los días futuros
      const quotaPerDay = Math.floor(quotaToRedistribute / futureDays.length);
      const extraQuota = quotaToRedistribute % futureDays.length;

      for (let i = 0; i < futureDays.length && remainingQuota > 0; i++) {
        const futureDay = futureDays[i];
        let quotaToAdd = quotaPerDay;

        // Distribuir el remanente en los primeros días
        if (i < extraQuota) {
          quotaToAdd += 1;
        }

        if (quotaToAdd > 0) {
          // Actualizar la base de datos
          await pool.query(
            `UPDATE availability_distribution
             SET quota = quota + ?
             WHERE id = ?`,
            [quotaToAdd, futureDay.id]
          );

          // Actualizar también el objeto en memoria para futuras iteraciones
          futureDay.quota += quotaToAdd;
          futureDay.available += quotaToAdd;

          redistributionDetails.push({
            from_date: pastDay.day_date,
            to_date: futureDay.day_date,
            quota_moved: quotaToAdd
          });

          remainingQuota -= quotaToAdd;
          totalRedistributed += quotaToAdd;
          daysUpdated++;
        }
      }

      // 4. Marcar el día pasado como procesado (poner quota = assigned)
      await pool.query(
        `UPDATE availability_distribution
         SET quota = assigned
         WHERE id = ?`,
        [pastDay.id]
      );
    }

    console.log(`✅ Redistribución completada: ${totalRedistributed} cupos redistribuidos de ${daysProcessed} días pasados a ${daysUpdated} días futuros`);

    return {
      redistributed_quota: totalRedistributed,
      days_processed: daysProcessed,
      days_updated: daysUpdated,
      details: redistributionDetails
    };

  } catch (error) {
    console.error('❌ Error en redistribución de cupos:', error);
    throw new Error('No se pudo completar la redistribución de cupos');
  }
}

/**
 * Redistribuye cupos no asignados para todas las disponibilidades activas
 * Útil para ejecutar como tarea programada diaria
 * 
 * @param until_date Fecha límite hasta donde redistribuir (default: hoy)
 * @returns Array de resultados por cada disponibilidad procesada
 */
export async function redistributeAllActiveAvailabilities(until_date?: string): Promise<{
  total_availabilities: number;
  total_redistributed: number;
  results: Array<{ availability_id: number; result: RedistributionResult }>;
}> {
  
  try {
    // Obtener todas las disponibilidades activas
    const [availabilitiesRows] = await pool.query(
      `SELECT DISTINCT a.id as availability_id
       FROM availabilities a
       INNER JOIN availability_distribution ad ON a.id = ad.availability_id
       WHERE a.status = 'active'`
    );

    const availabilities = availabilitiesRows as any[];
    const results: Array<{ availability_id: number; result: RedistributionResult }> = [];
    let totalRedistributed = 0;

    for (const avail of availabilities) {
      try {
        const result = await redistributeUnassignedQuota(avail.availability_id, until_date);
        results.push({
          availability_id: avail.availability_id,
          result
        });
        totalRedistributed += result.redistributed_quota;
      } catch (error) {
        console.error(`Error redistribuyendo availability_id ${avail.availability_id}:`, error);
      }
    }

    return {
      total_availabilities: availabilities.length,
      total_redistributed: totalRedistributed,
      results
    };

  } catch (error) {
    console.error('Error redistribuyendo todas las disponibilidades:', error);
    throw error;
  }
}

/**
 * Obtiene un resumen de cupos no asignados por día
 * Útil para diagnóstico y monitoreo
 */
export async function getUnassignedQuotaSummary(availability_id: number): Promise<any[]> {
  try {
    const [rows] = await pool.query(
      `SELECT 
        day_date,
        quota,
        assigned,
        (quota - assigned) as unassigned,
        ROUND((assigned / quota) * 100, 2) as occupancy_rate
       FROM availability_distribution
       WHERE availability_id = ?
         AND (quota - assigned) > 0
       ORDER BY day_date ASC`,
      [availability_id]
    );
    return rows as any[];
  } catch (error) {
    console.error('Error obteniendo resumen de cupos no asignados:', error);
    return [];
  }
}
