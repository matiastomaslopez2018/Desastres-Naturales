import 'server-only';
import { fetchJson } from './cache';
import { kvCached } from './kvCache';
import type { NhcStorm } from '../types';

/*
 * Ciclones activos fuera de las cuencas de NHC (Pacífico oeste, Índico, hemisferio sur),
 * con la trayectoria, el cono y las zonas de viento que publica GDACS. GDACS indica qué
 * agencia hizo el pronóstico (en general JTWC); esa agencia se muestra en la ficha.
 */

type GFeature = { geometry: GeoJSON.Geometry; properties: Record<string, unknown> & { Class?: string } };
type GEvent = {
  properties: {
    eventid: number; episodeid: number; name: string; eventname?: string; alertlevel?: string; iscurrent?: string; country?: string;
    fromdate: string; todate: string; url?: { geometry?: string; report?: string };
    severitydata?: { severity?: number; severitytext?: string };
  };
  geometry?: { type: string; coordinates: [number, number] };
};

const parseUtc = (s: string) => Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
const centroid = (g: GeoJSON.Geometry): [number, number] | null => {
  const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'Point' ? [g.coordinates] : null;
  if (!ring?.length) return null;
  return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
};

/** Palabra por cuenca: huracán al este de 180° en el hemisferio norte, tifón en el Pacífico NO, ciclón en el resto. */
export function basinWord(lon: number, lat: number): 'hurricane' | 'typhoon' | 'cyclone' {
  if (lat < 0) return 'cyclone'; // hemisferio sur
  if (lon >= 100 && lon <= 180) return 'typhoon'; // Pacífico noroeste
  if (lon > 30 && lon < 100) return 'cyclone'; // Índico norte
  return 'hurricane'; // Atlántico y Pacífico nordeste/central
}

/** "14/10 12:00 UTC" con el año del evento → ms. */
function labelTime(label: string, year: number): number | null {
  const m = /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/.exec(label.trim());
  return m ? Date.UTC(year, +m[2] - 1, +m[1], +m[3], +m[4]) : null;
}

async function loadOthers(): Promise<NhcStorm[]> {
  const to = new Date(), from = new Date(Date.now() - 10 * 864e5);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const list = await fetchJson<{ features?: GEvent[] }>(
    `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC&fromDate=${day(from)}&toDate=${day(to)}`, 30000, 1);
  // Activos: con datos en las últimas 30 h.
  const active = (list.features ?? []).filter((f) => Date.now() - parseUtc(f.properties.todate) < 30 * 36e5);
  const out = await Promise.all(active.map(async (ev): Promise<NhcStorm | null> => {
    const p = ev.properties;
    const url = p.url?.geometry;
    if (!url) return null;
    const g = await fetchJson<{ features?: GFeature[] }>(url, 30000, 1).catch(() => null);
    const feats = g?.features ?? [];
    const head = feats[0]?.properties ?? {};
    const agency = String(head.source ?? 'GDACS');
    const issued = parseUtc(String(head.polygondate ?? p.todate));
    const year = new Date(parseUtc(p.fromdate)).getUTCFullYear();
    const pts = feats.filter((f) => /^Point_Polygon_Point_/.test(f.properties.Class ?? ''))
      .map((f) => ({ c: centroid(f.geometry), t: labelTime(String(f.properties.polygonlabel ?? ''), year) }))
      .filter((x): x is { c: [number, number]; t: number } => !!x.c && x.t != null)
      .sort((a, b) => a.t - b.t);
    const past = pts.filter((x) => x.t <= issued + 60_000);
    const fut = pts.filter((x) => x.t > issued + 60_000);
    const now = past[past.length - 1] ?? pts[0];
    const [lon, lat] = now?.c ?? ev.geometry?.coordinates ?? [0, 0];
    const sev = Number(p.severitydata?.severity);
    const kt = Number.isFinite(sev) ? Math.round(sev / 1.852) : null;
    const word = basinWord(lon, lat);
    const sevText = p.severitydata?.severitytext ?? '';
    const classification = /hurricane|typhoon/i.test(sevText) ? (word === 'typhoon' ? 'TY' : word === 'hurricane' ? 'HU' : 'TC')
      : /storm/i.test(sevText) ? 'TS' : /depression/i.test(sevText) ? 'TD' : 'TC';
    const name = (p.eventname ?? p.name).replace(/-\d{2}$/, '');
    const zones: [string, number][] = [['Poly_Green', 34], ['Poly_Orange', 50], ['Poly_Red', 64]];
    const alert = (p.alertlevel ?? '').toLowerCase();
    return {
      id: `gdacs-tc-${p.eventid}`, type: 'nhc', src: 'NOAA NHC', title: name, name: name.charAt(0) + name.slice(1).toLowerCase(),
      classification, lon, lat, windKt: kt, pressureMb: null, movementDir: null, movementSpeedMph: null,
      lastUpdate: issued,
      cone: feats.find((f) => f.properties.Class === 'Poly_Cones')?.geometry ?? null,
      pastTrack: past.length > 1 ? [past.map((x) => x.c)] : [],
      forecastTrack: fut.length ? [past[past.length - 1]?.c ?? fut[0].c, ...fut.map((x) => x.c)] : [],
      forecastPoints: fut.map((x) => ({ lon: x.c[0], lat: x.c[1], label: '', windKt: null, cat: '', tau: Math.round((x.t - issued) / 36e5), time: x.t })),
      pastPoints: past.map((x) => ({ lon: x.c[0], lat: x.c[1], kt: null, time: x.t })),
      // Zonas de viento de GDACS (aprox. 34, 50 y 64 kt: 63, 93 y 119 km/h). Se juntan los polígonos de cada color.
      windField: zones.map(([cls, k]) => {
        const polys = feats.filter((f) => f.properties.Class === cls && f.geometry.type === 'Polygon').map((f) => (f.geometry as GeoJSON.Polygon).coordinates);
        return polys.length ? { kt: k, geometry: { type: 'MultiPolygon', coordinates: polys } as GeoJSON.MultiPolygon } : null;
      }).filter((x): x is { kt: number; geometry: GeoJSON.MultiPolygon } => !!x),
      agency, basinWord: word, alert: alert === 'green' || alert === 'orange' || alert === 'red' ? alert : null,
      reportUrl: p.url?.report, severityText: sevText,
    };
  }));
  return out.filter((x): x is NhcStorm => !!x);
}

/** Ciclones activos de GDACS (30 min de caché). */
export async function getOtherStorms() {
  const r = await kvCached('gdacs:tc:active', 30 * 6e4, loadOthers);
  return { storms: r.value, fetchedAt: r.at };
}
