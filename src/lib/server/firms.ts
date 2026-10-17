import 'server-only';
import { kvCached } from './kvCache';
import type { HeatBin } from '../types';

/*
 * NASA FIRMS: focos de calor activos detectados por satélite (VIIRS S-NPP 375 m).
 * Requiere una MAP_KEY gratuita (FIRMS_MAP_KEY). Se piden las últimas 24 h del mundo
 * y se agregan en celdas de 0,25° (cantidad de focos, FRP máxima y total) para dibujar
 * un mapa de calor: con decenas de miles de focos por día, un punto por foco no se lee.
 * Es una capa separada de los incendios de NASA EONET (que son eventos, no focos).
 */

const SOURCE = 'VIIRS_SNPP_NRT';
const CELL = 0.25;

export const firmsKey = () => process.env.FIRMS_MAP_KEY?.trim() || null;

async function load(key: string): Promise<HeatBin[]> {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${SOURCE}/world/1`;
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(50000) });
  const text = await res.text();
  if (!res.ok || !/latitude/i.test(text.slice(0, 300))) throw new Error(`FIRMS ${res.status}: ${text.slice(0, 160)}`);
  const lines = text.trim().split('\n');
  const head = lines[0].split(',');
  const col = (n: string) => head.indexOf(n);
  const [iLat, iLon, iFrp, iDate, iTime] = [col('latitude'), col('longitude'), col('frp'), col('acq_date'), col('acq_time')];
  const bins = new Map<string, { n: number; lat: number; lon: number; max: number; sum: number; last: number }>();
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const lat = Number(c[iLat]), lon = Number(c[iLon]), frp = Number(c[iFrp]) || 0;
    if (!isFinite(lat) || !isFinite(lon)) continue;
    const t = c[iTime]?.padStart(4, '0') ?? '0000';
    const when = Date.parse(`${c[iDate]}T${t.slice(0, 2)}:${t.slice(2)}:00Z`);
    const key = `${Math.floor(lat / CELL)}:${Math.floor(lon / CELL)}`;
    const b = bins.get(key) ?? { n: 0, lat: 0, lon: 0, max: 0, sum: 0, last: 0 };
    b.n++; b.lat += lat; b.lon += lon; b.sum += frp; b.max = Math.max(b.max, frp); b.last = Math.max(b.last, when || 0);
    bins.set(key, b);
  }
  return [...bins.entries()].map(([k, b]) => ({
    id: `firms-${k}`, type: 'heat', src: 'NASA FIRMS', title: 'Focos de calor',
    lat: +(b.lat / b.n).toFixed(3), lon: +(b.lon / b.n).toFixed(3),
    count: b.n, frpMax: +b.max.toFixed(1), frpSum: +b.sum.toFixed(1), last: b.last,
  }) satisfies HeatBin);
}

/** Celdas de focos de las últimas 24 h (30 min de caché). Sin clave → null. */
export async function getHeat() {
  const key = firmsKey();
  if (!key) return null;
  const r = await kvCached('firms:viirs:24h', 30 * 6e4, () => load(key));
  return { bins: r.value, fetchedAt: r.at, stale: r.stale, source: SOURCE };
}
