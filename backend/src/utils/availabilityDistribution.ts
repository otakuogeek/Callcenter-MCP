import pool from '../db/pool';

export interface AvailabilityDistributionParams {
  availability_id: number;
  start_date: string; // YYYY-MM-DD (fecha desde cuando distribuir)
  end_date: string; // YYYY-MM-DD (fecha hasta cuando distribuir) 
  total_quota: number; // total de cupos a distribuir
  exclude_weekends?: boolean; // omitir sábados y domingos (default: true)
}

export interface AvailabilityDistributionResult {
  availability_id: number;
  start_date: string;
  end_date: string;
  working_days: number;
  distribution: { date: string; quota: number }[];
  stats: {
    total_quota: number;
    average_per_day: number;
    max_quota: number;
    min_quota: number;
  };
  persisted: boolean;
  persisted_rows: number;
}

/**
 * Genera y persiste la distribución automática de cupos en availability_distribution
 * Distribuye aleatoriamente los cupos entre días hábiles (lun-vie) desde start_date hasta end_date
 */
export async function generateAvailabilityDistribution(params: AvailabilityDistributionParams): Promise<AvailabilityDistributionResult> {
  const startDate = new Date(params.start_date);
  const endDate = new Date(params.end_date);
  const excludeWeekends = params.exclude_weekends ?? true;
  
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  // Permitir fechas iguales para asignar todo a un día específico
  if (endDate < startDate) {
    throw new Error('La fecha de fin debe ser posterior o igual a la fecha de inicio.');
  }

  if (params.total_quota <= 0) {
    throw new Error('El total de cupos debe ser mayor a 0.');
  }

  // Construir días válidos según los parámetros
  const validDays: { date: string; weekday: number }[] = [];
  const cursor = new Date(startDate);
  
  while (cursor <= endDate) {
    const weekday = cursor.getDay();
    
    // Si exclude_weekends es true, omitir sábados (6) y domingos (0)
    if (!excludeWeekends || (weekday !== 0 && weekday !== 6)) {
      validDays.push({ 
        date: cursor.toISOString().split('T')[0], 
        weekday 
      });
    }
    
    cursor.setDate(cursor.getDate() + 1);
  }

  if (!validDays.length) {
    throw new Error('No hay días válidos en el rango especificado.');
  }

  // Inicializar distribución
  const distribution = validDays.map(d => ({ date: d.date, quota: 0 }));
  let remainingQuota = params.total_quota;

  // CASO ESPECIAL: Si solo hay un día válido, asignar toda la cuota a ese día
  if (validDays.length === 1) {
    distribution[0].quota = params.total_quota;
    remainingQuota = 0;
  } else {
    // Estrategia de distribución aleatoria equilibrada para múltiples días:
    // 1. Asignar al menos 1 cupo por día si es posible
    const minQuotaPerDay = Math.floor(params.total_quota / validDays.length);
    const extraQuota = params.total_quota % validDays.length;

    // Asignar cupo mínimo a cada día
    for (let i = 0; i < distribution.length; i++) {
      distribution[i].quota = minQuotaPerDay;
      remainingQuota -= minQuotaPerDay;
    }

    // Distribuir cupos restantes aleatoriamente
    const maxQuotaPerDay = Math.max(minQuotaPerDay + 2, Math.ceil(params.total_quota * 0.3)); // Límite máximo por día
    
    while (remainingQuota > 0) {
      const randomIndex = Math.floor(Math.random() * distribution.length);
      
      // Verificar que no supere el límite máximo
      if (distribution[randomIndex].quota < maxQuotaPerDay) {
        distribution[randomIndex].quota += 1;
        remainingQuota -= 1;
      }
      
      // Prevenir bucle infinito si todos los días alcanzan el máximo
      const canAssignMore = distribution.some(d => d.quota < maxQuotaPerDay);
      if (!canAssignMore) {
        // Distribuir el resto entre todos los días
        const remaining = remainingQuota;
        for (let i = 0; i < remaining && i < distribution.length; i++) {
          distribution[i].quota += 1;
          remainingQuota -= 1;
        }
        break;
      }
    }

    // Mezclar el orden para mayor aleatoriedad (solo si hay múltiples días)
    distribution.sort(() => Math.random() - 0.5);
  }

  // Calcular estadísticas
  const totalAssigned = distribution.reduce((sum, d) => sum + d.quota, 0);
  const average = totalAssigned / distribution.length;
  const maxQuota = Math.max(...distribution.map(d => d.quota));
  const minQuota = Math.min(...distribution.map(d => d.quota));

  // Persistir en la base de datos
  let persisted = false;
  let persistedCount = 0;

  try {
    // Eliminar distribuciones previas para este availability_id
    await pool.query(
      'DELETE FROM availability_distribution WHERE availability_id = ?',
      [params.availability_id]
    );

    // Insertar nueva distribución
    const insertValues: any[] = [];
    for (const row of distribution) {
      if (row.quota > 0) {
        insertValues.push([
          params.availability_id,
          row.date,
          row.quota,
          0 // assigned inicial en 0
        ]);
      }
    }

    if (insertValues.length > 0) {
      await pool.query(
        `INSERT INTO availability_distribution (availability_id, day_date, quota, assigned) VALUES ?`,
        [insertValues]
      );
      persisted = true;
      persistedCount = insertValues.length;
    }

  } catch (error) {
    console.error('Error al persistir availability_distribution:', error);
    throw new Error('No se pudo guardar la distribución en la base de datos.');
  }

  return {
    availability_id: params.availability_id,
    start_date: params.start_date,
    end_date: params.end_date,
    working_days: validDays.length,
    distribution: distribution.sort((a, b) => a.date.localeCompare(b.date)), // Ordenar por fecha para respuesta
    stats: {
      total_quota: totalAssigned,
      average_per_day: Number(average.toFixed(2)),
      max_quota: maxQuota,
      min_quota: minQuota
    },
    persisted,
    persisted_rows: persistedCount
  };
}

/**
 * Obtiene la distribución existente para un availability_id
 */
export async function getAvailabilityDistribution(availability_id: number): Promise<any[]> {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM availability_distribution 
       WHERE availability_id = ? 
       ORDER BY day_date ASC`,
      [availability_id]
    );
    return rows as any[];
  } catch (error) {
    console.error('Error al obtener availability_distribution:', error);
    return [];
  }
}

/**
 * Actualiza el conteo de asignados para un día específico
 */
export async function updateAssignedCount(availability_id: number, day_date: string, increment: number = 1): Promise<void> {
  try {
    await pool.query(
      `UPDATE availability_distribution 
       SET assigned = assigned + ? 
       WHERE availability_id = ? AND day_date = ?`,
      [increment, availability_id, day_date]
    );
  } catch (error) {
    console.error('Error al actualizar assigned count:', error);
    throw error;
  }
}