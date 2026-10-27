/** «Un día como hoy»: "10-27" → { m: 10, d: 27 } (null si no es una fecha válida; incluye el 29 de febrero). */
const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export function parseDay(s: string | undefined | null) {
  const m = /^(\d{2})-(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  const mo = +m[1], d = +m[2];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= DAYS[mo - 1] ? { m: mo, d } : null;
}
