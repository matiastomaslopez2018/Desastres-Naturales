import type { Lang, RangeKey } from './types';

export type Bucket = { i: number; start: number; end: number; label: string; title: string };

/** Cantidad de barras de la línea de tiempo según el período: horas, días o meses. */
const COUNT: Record<RangeKey, number> = { '24h': 24, '7d': 7, '30d': 30, '1y': 12, year: 12 };

/**
 * Divide [s, e] en tramos iguales. Iguales (no calendario) para que cada barra
 * cubra el mismo tiempo y las alturas sean comparables.
 */
export function buckets(range: RangeKey, s: number, e: number, lang: Lang): Bucket[] {
  const n = COUNT[range];
  const w = (e - s) / n;
  const loc = lang === 'es' ? 'es-AR' : 'en-GB';
  const hour = new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', hour12: false });
  const wday = new Intl.DateTimeFormat(loc, { weekday: 'short' });
  const dnum = new Intl.DateTimeFormat(loc, { day: 'numeric' });
  const mon = new Intl.DateTimeFormat(loc, { month: 'short' });
  const full = new Intl.DateTimeFormat(loc, { dateStyle: 'medium', timeStyle: range === '24h' ? 'short' : undefined });
  const fmt = range === '24h' ? hour : range === '7d' ? wday : range === '30d' ? dnum : mon;
  const out: Bucket[] = [];
  for (let i = 0; i < n; i++) {
    const start = s + i * w, end = i === n - 1 ? e : s + (i + 1) * w;
    // Etiqueta: el instante en que termina el tramo (el día "de" esa barra).
    const at = new Date(range === '24h' ? start : end - 1);
    out.push({
      i, start, end,
      label: fmt.format(at).replace('.', ''),
      title: range === '24h' || range === '7d' || range === '30d'
        ? `${full.format(new Date(start))} – ${full.format(new Date(end))}`
        : new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(at),
    });
  }
  return out;
}

export const bucketOf = (bs: Bucket[], t: number) => {
  if (!bs.length || t < bs[0].start || t > bs[bs.length - 1].end) return -1;
  const w = (bs[bs.length - 1].end - bs[0].start) / bs.length;
  return Math.min(bs.length - 1, Math.floor((t - bs[0].start) / w));
};
