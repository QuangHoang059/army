// Date helpers. Dates are stored as 'YYYY-MM-DD', datetimes as 'YYYY-MM-DDTHH:MM' (local time).

const pad = (n) => String(n).padStart(2, '0');

export function todayStr(base = new Date()) {
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
}

/** Today shifted by `days`, as YYYY-MM-DD. */
export function dayOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return todayStr(d);
}

/** Today shifted by `days` at `hour`:15, as YYYY-MM-DDTHH:MM. */
export function dateTimeOffset(days, hour = 7) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${todayStr(d)}T${pad(hour)}:15`;
}

/** Add days to a YYYY-MM-DD string (timezone-safe). */
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Whole days from today until dateStr (negative = overdue). */
export function daysUntil(dateStr) {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = todayStr().split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
}

export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export const isDateTime = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** Wrap async/sync route handlers so thrown errors reach the error middleware. */
export const ah = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res, next);
    if (out && typeof out.catch === 'function') out.catch(next);
  } catch (e) {
    next(e);
  }
};
