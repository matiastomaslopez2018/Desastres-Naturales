import type { RangeKey } from './types';

export const RANGES: RangeKey[] = ['24h', '7d', '30d', '1y', 'year'];
export const MIN_YEAR = 1900;

export function parseRange(v: string | null | undefined): RangeKey {
  return (RANGES as string[]).includes(v ?? '') ? (v as RangeKey) : '7d';
}

export function parseYear(v: string | null | undefined): number {
  const y = Number(v);
  const max = new Date().getUTCFullYear();
  return Number.isInteger(y) && y >= MIN_YEAR && y <= max ? y : max - 1;
}

/** Ventana temporal y magnitud mínima de ingesta para un período. */
export function rangeInfo(range: RangeKey, year: number, now = new Date()) {
  let s: Date;
  let e = now;
  const day = 864e5;
  if (range === '24h') s = new Date(+now - day);
  else if (range === '7d') s = new Date(+now - 7 * day);
  else if (range === '30d') s = new Date(+now - 30 * day);
  else if (range === '1y') s = new Date(+now - 365 * day);
  else {
    s = new Date(Date.UTC(year, 0, 1));
    e = new Date(Math.min(Date.UTC(year + 1, 0, 1), +now));
  }
  const days = (+e - +s) / day;
  return { s, e, days, floor: days > 31 ? 4.5 : 2.5 };
}
