function normalizeTimeString(time: string): string {
  const t = time.trim();
  if (!t) return '00:00:00';

  const parts = t.split(':');
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  const s = Number(parts[2] ?? 0);

  const hh = String(isFinite(h) ? h : 0).padStart(2, '0');
  const mm = String(isFinite(m) ? m : 0).padStart(2, '0');
  const ss = String(isFinite(s) ? s : 0).padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
}

export function timeToMinutes(time: string): number {
  const normalized = normalizeTimeString(time);
  const [hh, mm] = normalized.split(':').map(Number);
  return hh * 60 + mm;
}

export function minutesToTime(minutes: number): string {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.floor(minutes)));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
}

export function addMinutesToTime(time: string, deltaMinutes: number): string {
  return minutesToTime(timeToMinutes(time) + deltaMinutes);
}
