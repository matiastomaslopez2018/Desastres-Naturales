import type { Lang } from './types';

const locale = (lang: Lang) => (lang === 'es' ? 'es-AR' : 'en-GB');

export function fmtTime(lang: Lang, ms: number, tz?: 'UTC') {
  const s = new Intl.DateTimeFormat(locale(lang), { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(new Date(ms));
  return tz === 'UTC' ? s + ' UTC' : s;
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
