import type { Lang } from './types';

const locale = (lang: Lang) => (lang === 'es' ? 'es-AR' : 'en-GB');

/** "13 oct 2026 · 12:23 UTC": fecha corta y hora de 24 h (UTC o la hora local del dispositivo). */
export function fmtTime(lang: Lang, ms: number, tz?: 'UTC') {
  const d = new Date(ms);
  // Por partes: es-AR intercala "de" ("13 de oct de 2026") y aquí va "13 oct 2026".
  const parts = new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz }).formatToParts(d);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const date = `${part('day')} ${part('month').replace('.', '')} ${part('year')}`;
  const time = new Intl.DateTimeFormat(locale(lang), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(d);
  return `${date} · ${time}${tz === 'UTC' ? ' UTC' : ''}`;
}

/** "0,409° S · 19,431° O": coordenadas con hemisferio (O en castellano, W en inglés). */
export function fmtCoords(lang: Lang, lat: number, lon: number, digits = 3) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : lang === 'es' ? 'O' : 'W';
  return `${fmtNum(lang, Math.abs(lat), digits)}° ${ns} · ${fmtNum(lang, Math.abs(lon), digits)}° ${ew}`;
}

export function fmtRel(lang: Lang, ms: number) {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const d = (ms - Date.now()) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'], [3600, 'minute'], [86400, 'hour'], [2592000, 'day'], [31536000, 'month'], [Infinity, 'year'],
  ];
  let prev = 1;
  for (const [lim, u] of steps) {
    if (Math.abs(d) < lim) return rtf.format(Math.round(d / prev), u);
    prev = lim;
  }
  return '';
}

export function fmtNum(lang: Lang, x: number, digits = 0) {
  return new Intl.NumberFormat(lang === 'es' ? 'es-AR' : 'en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(x);
}

/** "20 dic" (o "20 dic 2025" si no es del año en curso), sin el "de" de es-AR. */
export function fmtDay(lang: Lang, ms: number) {
  const d = new Date(ms);
  const withYear = d.getFullYear() !== new Date().getFullYear();
  const parts = new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).formatToParts(d);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return [part('day'), part('month').replace('.', ''), withYear ? part('year') : ''].filter(Boolean).join(' ');
}

/** "18:20": hora local de 24 h. */
export function fmtHour(lang: Lang, ms: number) {
  return new Intl.DateTimeFormat(locale(lang), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
}
