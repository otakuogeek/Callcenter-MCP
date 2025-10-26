/**
 * UTILIDAD DE SINCRONIZACIÓN DE DISPONIBILIDADES
 * Mantiene la integridad de los datos de cupos en tiempo real
 */

import pool from '../db/pool';

interface AvailabilityData {
  id: number;
  capacity: number;
  booked_slots: number;
  actual_appointments: number;
}

/**
 * Sincroniza los booked_slots de una agenda con las citas reales
 */
export async function syncAvailabilitySlots(availabilityId: number): Promise<boolean> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Obtener datos actuales de la disponibilidad
    const [availRows]: any = await connection.query(
      'SELECT id, capacity, booked_slots FROM availabilities WHERE id = ?',
      [availabilityId]
    );
    
    if (!availRows || availRows.length === 0) {
      await connection.rollback();
      return false;
    }
    
    const availability = availRows[0];
    
    // Contar citas reales confirmadas para esta disponibilidad
    const [countRows]: any = await connection.query(
      `SELECT COUNT(*) as total 
       FROM appointments 
       WHERE availability_id = ? 
       AND status IN ('Confirmada', 'Reagendada', 'En sala de espera', 'En consulta')`,
      [availabilityId]
    );
    
    const actualAppointments = countRows[0].total;
    
    // Validar que no exceda la capacidad
    const validBookedSlots = Math.min(actualAppointments, availability.capacity);
    
    // Actualizar booked_slots
    await connection.query(
      'UPDATE availabilities SET booked_slots = ? WHERE id = ?',
      [validBookedSlots, availabilityId]
    );
    
    // Actualizar status basado en la ocupación
    let newStatus = 'Activa';
    if (validBookedSlots >= availability.capacity) {
      newStatus = 'Completa';
    }
    
    await connection.query(
      'UPDATE availabilities SET status = ? WHERE id = ?',
      [newStatus, availabilityId]
    );
    
    await connection.commit();
    
    console.log(`[SYNC] Availability ${availabilityId}: ${validBookedSlots}/${availability.capacity} cupos`);
    
    return true;
    
  } catch (error) {
    await connection.rollback();
    console.error(`[SYNC] Error sincronizando availability ${availabilityId}:`, error);
    return false;
  } finally {
    connection.release();
  }
}

/**
 * Sincroniza todas las disponibilidades activas
 */
export async function syncAllAvailabilities(): Promise<{ synced: number; errors: number }> {
  try {
    // Obtener todas las disponibilidades activas o completas
    const [rows]: any = await pool.query(
      `SELECT id FROM availabilities 
       WHERE status IN ('Activa', 'Completa') 
       AND date >= CURDATE()`
    );
    
    let synced = 0;
    let errors = 0;
    
    for (const row of rows) {
      const success = await syncAvailabilitySlots(row.id);
      if (success) {
        synced++;
      } else {
        errors++;
      }
    }
    
    console.log(`[SYNC] Total sincronizadas: ${synced}, Errores: ${errors}`);
    
    return { synced, errors };
    
  } catch (error) {
    console.error('[SYNC] Error en sincronización masiva:', error);
    return { synced: 0, errors: 0 };
  }
}

/**
 * Valida que se pueda agregar una cita a una disponibilidad
 */
export async function validateAvailabilityCapacity(availabilityId: number): Promise<{
  canBook: boolean;
  available: number;
  capacity: number;
  booked: number;
}> {
  try {
    // Primero sincronizar
    await syncAvailabilitySlots(availabilityId);
    
    // Obtener datos actualizados
    const [rows]: any = await pool.query(
      'SELECT capacity, booked_slots FROM availabilities WHERE id = ?',
      [availabilityId]
    );
    
    if (!rows || rows.length === 0) {
      return { canBook: false, available: 0, capacity: 0, booked: 0 };
    }
    
    const { capacity, booked_slots } = rows[0];
    const available = Math.max(0, capacity - booked_slots);
    
    return {
      canBook: available > 0,
      available,
      capacity,
      booked: booked_slots
    };
    
  } catch (error) {
    console.error('[SYNC] Error validando capacidad:', error);
    return { canBook: false, available: 0, capacity: 0, booked: 0 };
  }
}

/**
 * Incrementa los booked_slots de forma segura
 */
export async function incrementBookedSlots(availabilityId: number): Promise<boolean> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Obtener datos actuales con bloqueo
    const [rows]: any = await connection.query(
      'SELECT capacity, booked_slots FROM availabilities WHERE id = ? FOR UPDATE',
      [availabilityId]
    );
    
    if (!rows || rows.length === 0) {
      await connection.rollback();
      return false;
    }
    
    const { capacity, booked_slots } = rows[0];
    
    // Validar que no exceda la capacidad
    if (booked_slots >= capacity) {
      await connection.rollback();
      console.warn(`[SYNC] No se puede incrementar: capacidad máxima alcanzada (${booked_slots}/${capacity})`);
      return false;
    }
    
    // Incrementar
    const newBookedSlots = booked_slots + 1;
    await connection.query(
      'UPDATE availabilities SET booked_slots = ? WHERE id = ?',
      [newBookedSlots, availabilityId]
    );
    
    // Actualizar status si se llenó
    if (newBookedSlots >= capacity) {
      await connection.query(
        'UPDATE availabilities SET status = ? WHERE id = ?',
        ['Completa', availabilityId]
      );
    }
    
    await connection.commit();
    console.log(`[SYNC] Incrementado: ${newBookedSlots}/${capacity}`);
    
    return true;
    
  } catch (error) {
    await connection.rollback();
    console.error('[SYNC] Error incrementando booked_slots:', error);
    return false;
  } finally {
    connection.release();
  }
}

/**
 * Decrementa los booked_slots de forma segura (al cancelar una cita)
 */
export async function decrementBookedSlots(availabilityId: number): Promise<boolean> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Obtener datos actuales con bloqueo
    const [rows]: any = await connection.query(
      'SELECT capacity, booked_slots FROM availabilities WHERE id = ? FOR UPDATE',
      [availabilityId]
    );
    
    if (!rows || rows.length === 0) {
      await connection.rollback();
      return false;
    }
    
    const { capacity, booked_slots } = rows[0];
    
    // Validar que no sea negativo
    if (booked_slots <= 0) {
      await connection.rollback();
      console.warn('[SYNC] No se puede decrementar: ya está en 0');
      return false;
    }
    
    // Decrementar
    const newBookedSlots = booked_slots - 1;
    await connection.query(
      'UPDATE availabilities SET booked_slots = ? WHERE id = ?',
      [newBookedSlots, availabilityId]
    );
    
    // Actualizar status si se liberó espacio
    if (newBookedSlots < capacity) {
      await connection.query(
        'UPDATE availabilities SET status = ? WHERE id = ?',
        ['Activa', availabilityId]
      );
    }
    
    await connection.commit();
    console.log(`[SYNC] Decrementado: ${newBookedSlots}/${capacity}`);
    
    return true;
    
  } catch (error) {
    await connection.rollback();
    console.error('[SYNC] Error decrementando booked_slots:', error);
    return false;
  } finally {
    connection.release();
  }
}
