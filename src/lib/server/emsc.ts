import 'server-only';
import { geoDistance } from 'd3-geo';
import { cached, fetchJson } from './cache';
import type { EmscMatch } from '../types';

/*
 * EMSC SeismicPortal (Centro Sismológico Euromediterráneo): segunda fuente sísmica.
 * No se agregan eventos al mapa (serían duplicados de USGS): se busca el mismo sismo
 * en EMSC para mostrar su magnitud y los testimonios "lo sentí" (LastQuake).
 * Criterio de coincidencia: ±120 s, <100 km y |Δmag| < 0,7; gana el más cercano en
 * tiempo + distancia.
 */

const FDSN = 'https://www.seismicportal.eu/fdsnws/event/1/query';
const TESTIMONIES = 'https://www.seismicportal.eu/testimonies-ws/api/search';

type FdsnFeature = { properties: { unid: string; time: string; lat: number; lon: number; mag: number | null; magtype: string; flynn_region: string } };

export function getEmscMatch(q: { time: number; lat: number; lon: number; mag: number | null }): Promise<EmscMatch | null> {
  const key = `emsc:${Math.round(q.time / 1000)}:${q.lat.toFixed(2)}:${q.lon.toFixed(2)}`;
  return cached(key, 10 * 6e4, async () => {
    const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19);
    const url = `${FDSN}?format=json&starttime=${iso(q.time - 120_000)}&endtime=${iso(q.time + 120_000)}`
      + `&lat=${q.lat}&lon=${q.lon}&maxradius=1${q.mag != null ? `&minmag=${Math.max(0, q.mag - 0.7)}` : ''}`;
    const j = await fetchJson<{ features?: FdsnFeature[] }>(url, 20000).catch(() => ({ features: [] as FdsnFeature[] }));
    const cands = (j.features ?? []).map((f) => {
      const p = f.properties;
      const km = geoDistance([p.lon, p.lat], [q.lon, q.lat]) * 6371;
      const dt = Math.abs(Date.parse(p.time) - q.time) / 1000;
      return { p, km, dt };
    }).filter((c) => c.km < 100 && c.dt < 120 && (q.mag == null || c.p.mag == null || Math.abs(c.p.mag - q.mag) < 0.7))
      .sort((a, b) => a.dt / 120 + a.km / 100 - (b.dt / 120 + b.km / 100));
    const best = cands[0];
    if (!best) return null;
    // Testimonios LastQuake (puede no haber ninguno).
    const t = await fetchJson<{ ev_nbtestimonies?: number }[]>(`${TESTIMONIES}?format=json&unid=${encodeURIComponent(best.p.unid)}`, 15000).catch(() => []);
    return {
      unid: best.p.unid, mag: best.p.mag, magType: best.p.magtype, region: best.p.flynn_region,
      time: Date.parse(best.p.time), distanceKm: Math.round(best.km),
      felt: Array.isArray(t) && t[0]?.ev_nbtestimonies != null ? t[0].ev_nbtestimonies : null,
      url: `https://www.seismicportal.eu/eventdetails.html?unid=${encodeURIComponent(best.p.unid)}`,
    };
  });
}
