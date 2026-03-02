export function getTodayInColombia(): string {
  const now = new Date();
  const colombia = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return colombia.toISOString().split('T')[0];
}

export function convertUTCToColombiaTime(timeUTC?: string): string {
  if (!timeUTC) return '';
  const parts = timeUTC.split(':');
  if (parts.length < 2) return timeUTC;
  let hours = Number(parts[0]);
  const minutes = parts[1];
  hours -= 5;
  if (hours < 0) hours += 24;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

export function formatTimeTo12h(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  let hour = Number(h);
  const min = m || '00';
  const period = hour >= 12 ? 'p. m.' : 'a. m.';
  hour = hour % 12 || 12;
  return `${hour}:${min} ${period}`;
}

export function formatDateLabel(dateIso: string): string {
  if (!dateIso) return '';
  const [year, month, day] = dateIso.split('-');
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const idx = Math.max(0, Math.min(11, Number(month) - 1));
  return `${Number(day)} ${months[idx]} ${year}`;
}
