import { useState, useCallback } from 'react';
import api from '@/lib/api';

export interface DistributionDay {
  day_date: string;
  quota: number;
  assigned: number;
  remaining: number;
}

export function useDistribution() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [distribution, setDistribution] = useState<DistributionDay[]>([]);
  const [availabilityId, setAvailabilityId] = useState<number | null>(null);
  const [meta, setMeta] = useState<any>(null);

  const load = useCallback(async (id: number) => {
    setLoading(true); setError(null); setAvailabilityId(id);
    try {
      const res = await api.getAvailabilityDistribution(id + '?expanded=1');
      // Si viene expanded lo usamos para incluir días sin cuota
      const list = res.expanded && Array.isArray(res.expanded) ? res.expanded : (res.distribution || []);
      setDistribution(list);
      setMeta(res.availability || null);
    } catch (e:any) {
      setError(e.message || 'Error al cargar distribución');
      setDistribution([]);
    } finally { setLoading(false); }
  }, []);

  const distribute = useCallback(async (id: number, force = false) => {
    setLoading(true); setError(null); setAvailabilityId(id);
    try {
      const res = await api.distributeAvailability(id, force);
      // reconsultar para normalizar formato
  const again = await api.getAvailabilityDistribution(id + '?expanded=1');
  const list = again.expanded && Array.isArray(again.expanded) ? again.expanded : (again.distribution || []);
  setDistribution(list);
      setMeta(again.availability || null);
      return res;
    } catch (e:any) {
      setError(e.message || 'Error al distribuir');
      throw e;
    } finally { setLoading(false); }
  }, []);

  const consume = useCallback(async (day_date: string, count = 1) => {
    if (!availabilityId) return;
    try {
      await api.consumeDistribution(availabilityId, day_date, count);
      setDistribution(prev => prev.map(d => d.day_date === day_date ? { ...d, assigned: d.assigned + count, remaining: d.remaining - count } : d));
    } catch (e:any) {
      setError(e.message || 'Error al consumir cupo');
      throw e;
    }
  }, [availabilityId]);

  const revert = useCallback(async (day_date: string, count = 1) => {
    if (!availabilityId) return;
    try {
      await api.revertDistribution(availabilityId, day_date, count);
      setDistribution(prev => prev.map(d => d.day_date === day_date ? { ...d, assigned: d.assigned - count, remaining: d.remaining + count } : d));
    } catch (e:any) {
      setError(e.message || 'Error al revertir cupo');
      throw e;
    }
  }, [availabilityId]);

  return { loading, error, distribution, availability: meta, load, distribute, consume, revert };
}
