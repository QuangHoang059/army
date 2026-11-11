const pad = (n: number) => String(n).padStart(2, '0');

/** Local date YYYY-MM-DD, shifted by `days` from today. */
export function dayOffset(days = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local datetime YYYY-MM-DDTHH:MM, `days` from today at hour:15 (or now if hour omitted). */
export function dateTimeOffset(days = 0, hour?: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const h = hour ?? d.getHours();
  const m = hour === undefined ? d.getMinutes() : 15;
  return `${dayOffset(days)}T${pad(h)}:${pad(m)}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Days from today to `date` (negative = overdue). */
export function daysUntil(date: string): number {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = dayOffset(0).split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
}

/** YYYY-MM-DD -> DD/MM/YYYY */
export function fmtDate(s?: string): string {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** YYYY-MM-DDTHH:MM -> HH:MM DD/MM/YYYY */
export function fmtDateTime(s?: string): string {
  if (!s) return '—';
  const [date, time = ''] = s.split('T');
  return `${time.slice(0, 5)} ${fmtDate(date)}`.trim();
}
