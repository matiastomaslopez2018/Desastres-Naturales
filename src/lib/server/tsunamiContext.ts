import 'server-only';
import { geoDistance } from 'd3-geo';
import { kvCached } from './kvCache';
import { getNearbyTsunamis } from './ncei';
import type { DisasterEvent, HistoricEvent } from '../types';

/*
 * Contexto de tsunami de un sismo oceánico: boyas DART de NOAA cercanas (NDBC) y tsunamis
 * históricos de la zona (NOAA NCEI). Los mapas de energía o tiempos de viaje salen de los
 * mensajes de NTWC/PTWC (tsunami.ts).
 */

export type Dart = { id: string; name: string; lat: number; lon: number; owner: string; reporting: boolean };

/** Boyas DART de la lista de estaciones activas de NDBC; "reporting" = atributo dart="y" de NDBC. */
export async function dartStations(): Promise<Dart[]> {
  const r = await kvCached('ndbc:dart2', 6 * 36e5, async () => {
    const res = await fetch('https://www.ndbc.noaa.gov/activestations.xml', { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`NDBC ${res.status}`);
    const xml = await res.text();
    const attr = (s: string, k: string) => new RegExp(`(?:^|\\s)${k}="([^"]*)"`).exec(s)?.[1] ?? '';
    return [...xml.matchAll(/<station\b[^>]*\/>/g)].map((m) => m[0]).filter((s) => attr(s, 'type') === 'dart').map((s) => ({
      id: attr(s, 'id'), name: attr(s, 'name').trim(), lat: Number(attr(s, 'lat')), lon: Number(attr(s, 'lon')),
      owner: attr(s, 'owner'), reporting: attr(s, 'dart') === 'y',
    })).filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lon));
  });
  return r.value;
}

/** Fecha del último dato publicado por una boya (archivo de tiempo real de NDBC). */
async function lastReading(id: string): Promise<number | null> {
  const r = await kvCached(`ndbc:dart:last:${id}`, 36e5, async () => {
    const res = await fetch(`https://www.ndbc.noaa.gov/data/realtime2/${id}.dart`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const line = (await res.text()).split('\n').find((l) => /^\d{4}\s/.test(l));
    if (!line) return null;
    const [y, mo, d, h, mi, s] = line.trim().split(/\s+/).map(Number);
    return Date.UTC(y, mo - 1, d, h, mi, s);
  }).catch(() => null);
  return r?.value ?? null;
}

export type TsunamiContext = {
  buoys: (Dart & { km: number; last: number | null })[];
  history: (HistoricEvent & { km: number })[];
};

export async function tsunamiContext(e: DisasterEvent): Promise<TsunamiContext> {
  const [darts, hist] = await Promise.all([
    dartStations().catch(() => [] as Dart[]),
    getNearbyTsunamis(e.lat, e.lon, 4).catch(() => ({ events: [] as HistoricEvent[] })),
  ]);
  const near = darts
    .map((d) => ({ ...d, km: Math.round(geoDistance([d.lon, d.lat], [e.lon, e.lat]) * 6371) }))
    .filter((d) => d.km <= 2500).sort((a, b) => a.km - b.km).slice(0, 5);
  const buoys = await Promise.all(near.map(async (d) => ({ ...d, last: await lastReading(d.id) })));
  const history = hist.events
    .map((h) => ({ ...h, km: Math.round(geoDistance([h.lon, h.lat], [e.lon, e.lat]) * 6371) }))
    .filter((h) => h.km <= 400)
    .sort((a, b) => (b.maxWaterHeight ?? 0) - (a.maxWaterHeight ?? 0) || (b.deaths ?? 0) - (a.deaths ?? 0))
    .slice(0, 8);
  return { buoys, history };
}
