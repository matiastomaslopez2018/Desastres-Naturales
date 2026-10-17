import 'server-only';
import { geoContains, geoDistance } from 'd3-geo';
import platesData from '@/data/pb2002_plates.json';
import stepsData from '@/data/pb2002_steps.json';
import slabData from '@/data/slab2.json';
import { fetchJson } from './cache';
import { kvCached } from './kvCache';
import { getNearbyHistory } from './ncei';
import { decodeEntities, fetchUsgsDetail, type UsgsDetail } from './sources';
import { relativeVelocity } from '../morvel';
import type { DisasterEvent, HistoricEvent } from '../types';

/*
 * "Contexto geológico" de un sismo: mecanismo focal (USGS), placas y borde más cercano
 * (PB2002), velocidad relativa (NNR-MORVEL56), losa subducida (Slab2) con perfil, resumen
 * tectónico y pronóstico de réplicas de USGS, e historia de la zona (NOAA NCEI).
 * Lo que es interpretación nuestra (tipo de falla en palabras, interplaca/intraplaca) va
 * marcado como tal en la interfaz y explicado en Metodología.
 */

const R = 6371, RAD = Math.PI / 180;
const km = (a: [number, number], b: [number, number]) => geoDistance(a, b) * R;

/* ───────────── Mecanismo focal ───────────── */

export type Plane = { strike: number; dip: number; rake: number };
export type FaultKind = 'reverse' | 'normal' | 'strike-slip' | 'oblique';
export type Mechanism = { np1: Plane; np2: Plane | null; kind: FaultKind; source: string; magType?: string; url: string; plunges: { p: number; t: number; b: number } };

/** Vectores normal y de deslizamiento (x norte, y este, z abajo; Aki y Richards). */
export function faultVectors({ strike, dip, rake }: Plane) {
  const f = strike * RAD, d = dip * RAD, l = rake * RAD;
  const n = [-Math.sin(d) * Math.sin(f), Math.sin(d) * Math.cos(f), -Math.cos(d)];
  const s = [Math.cos(l) * Math.cos(f) + Math.cos(d) * Math.sin(l) * Math.sin(f), Math.cos(l) * Math.sin(f) - Math.cos(d) * Math.sin(l) * Math.cos(f), -Math.sin(l) * Math.sin(d)];
  return { n, s };
}
const plunge = (v: number[]) => Math.abs(Math.asin(Math.max(-1, Math.min(1, v[2] / Math.hypot(v[0], v[1], v[2])))) / RAD);

/**
 * Tipo de falla por la inclinación de los ejes P, T y B (Frohlich, 1992): inversa si T
 * inclina más de 50°, normal si P más de 60°, de rumbo si B más de 60°; si no, oblicua.
 */
export function classify(p: Plane): { kind: FaultKind; plunges: { p: number; t: number; b: number } } {
  const { n, s } = faultVectors(p);
  const T = n.map((x, i) => x + s[i]), P = n.map((x, i) => x - s[i]);
  const B = [n[1] * s[2] - n[2] * s[1], n[2] * s[0] - n[0] * s[2], n[0] * s[1] - n[1] * s[0]];
  const pl = { p: plunge(P), t: plunge(T), b: plunge(B) };
  const kind: FaultKind = pl.t > 50 ? 'reverse' : pl.p > 60 ? 'normal' : pl.b > 60 ? 'strike-slip' : 'oblique';
  return { kind, plunges: pl };
}

type Product = { source: string; code: string; properties: Record<string, string>; contents: Record<string, { url?: string; bytes?: string }> };
const products = (j: UsgsDetail) => (j.properties as unknown as { products?: Record<string, Product[]> }).products ?? {};

function mechanism(j: UsgsDetail, url: string): Mechanism | null {
  const pr = products(j);
  const mt = pr['moment-tensor']?.[0] ?? pr['focal-mechanism']?.[0];
  if (!mt) return null;
  const p = mt.properties, num = (k: string) => (p[k] != null && p[k] !== '' ? Number(p[k]) : NaN);
  const np1 = { strike: num('nodal-plane-1-strike'), dip: num('nodal-plane-1-dip'), rake: num('nodal-plane-1-rake') };
  if (![np1.strike, np1.dip, np1.rake].every(Number.isFinite)) return null;
  const np2v = { strike: num('nodal-plane-2-strike'), dip: num('nodal-plane-2-dip'), rake: num('nodal-plane-2-rake') };
  const c = classify(np1);
  return {
    np1, np2: [np2v.strike, np2v.dip, np2v.rake].every(Number.isFinite) ? np2v : null, kind: c.kind, plunges: c.plunges,
    source: (p['beachball-source'] || mt.source || '').toUpperCase(), magType: p['derived-magnitude-type'], url: `${url}/moment-tensor`,
  };
}

/* ───────────── Placas (PB2002) y velocidad (NNR-MORVEL56) ───────────── */

type PlateFeature = { type: 'Feature'; properties: { code: string; name: string }; geometry: GeoJSON.MultiPolygon };
const PLATES = (platesData as { features: PlateFeature[] }).features;
type Step = [number, number, number, number, string, string, string, string];
const STEPS = stepsData as Step[];

export const BOUNDARY: Record<string, 'convergent' | 'divergent' | 'transform'> = {
  SUB: 'convergent', OCB: 'convergent', CCB: 'convergent', OSR: 'divergent', CRB: 'divergent', OTF: 'transform', CTF: 'transform',
};

export const plateAt = (lon: number, lat: number) => PLATES.find((f) => geoContains(f, [lon, lat]))?.properties ?? null;
const plateName = (code: string) => PLATES.find((f) => f.properties.code === code)?.properties.name ?? code;

/** Distancia (km) de un punto a un tramo corto, en proyección local equirectangular. */
function segDist(lon: number, lat: number, s: Step) {
  const k = Math.cos(lat * RAD);
  let x1 = s[0] - lon, x2 = s[2] - lon;
  if (x1 > 180) x1 -= 360; if (x1 < -180) x1 += 360;
  if (x2 > 180) x2 -= 360; if (x2 < -180) x2 += 360;
  const ax = x1 * k, ay = s[1] - lat, bx = x2 * k, by = s[3] - lat;
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy) * 111.195;
}

export type PlateContext = {
  here: { code: string; name: string } | null;
  other: { code: string; name: string } | null;
  boundary: { kind: 'convergent' | 'divergent' | 'transform'; cls: string; distKm: number; subduction: boolean } | null;
  velocity: { mmYr: number; azimuth: number; of: string; relativeTo: string } | null;
};

export function plateContext(lon: number, lat: number): PlateContext {
  const here = plateAt(lon, lat);
  let best: Step | null = null, bestD = Infinity;
  for (const s of STEPS) {
    if (Math.abs(s[1] - lat) > 12 && Math.abs(s[3] - lat) > 12) continue;
    const d = segDist(lon, lat, s);
    if (d < bestD) { bestD = d; best = s; }
  }
  if (!best) return { here, other: null, boundary: null, velocity: null };
  const [, , , , cls, a, b] = best;
  const otherCode = here?.code === a ? b : here?.code === b ? a : a;
  const hereCode = here?.code ?? (otherCode === a ? b : a);
  const v = relativeVelocity(otherCode, hereCode, lon, lat);
  return {
    here: { code: hereCode, name: plateName(hereCode) },
    other: { code: otherCode, name: plateName(otherCode) },
    boundary: { kind: BOUNDARY[cls] ?? 'transform', cls, distKm: Math.round(bestD), subduction: cls === 'SUB' },
    velocity: v ? { ...v, of: otherCode, relativeTo: hereCode } : null,
  };
}

/* ───────────── Losa subducida (Slab2) ───────────── */

type Contour = [string, number, number[][][]];
const SLAB = slabData as Contour[];

/** Distancia mínima (km) de un punto a una curva de Slab2, y el punto más cercano. */
function contourDist(lon: number, lat: number, c: Contour): { d: number; p: [number, number] } {
  let best = { d: Infinity, p: [0, 0] as [number, number] };
  for (const line of c[2]) {
    for (let i = 1; i < line.length; i++) {
      const s: Step = [line[i - 1][0], line[i - 1][1], line[i][0], line[i][1], '', '', '', ''];
      const d = segDist(lon, lat, s);
      if (d < best.d) best = { d, p: [(line[i - 1][0] + line[i][0]) / 2, (line[i - 1][1] + line[i][1]) / 2] };
    }
  }
  return best;
}

/**
 * Profundidad de la losa en un punto: interpolación lineal por distancia entre las dos curvas
 * de profundidad distinta más cercanas (cada 20 km). Fuera de la losa (curva más cercana a
 * más de 60 km) → null. Es una estimación a partir de las curvas publicadas, no el valor de la grilla.
 */
export function slabDepthAt(lon: number, lat: number): { depth: number; region: string; nearKm: number } | null {
  const near = SLAB.filter((c) => c[2].some((l) => l.some(([x, y]) => Math.abs(y - lat) < 3 && Math.abs(((x - lon + 540) % 360) - 180) < 3 / Math.max(0.2, Math.cos(lat * RAD)))));
  if (!near.length) return null;
  const ds = near.map((c) => ({ c, ...contourDist(lon, lat, c) })).sort((a, b) => a.d - b.d);
  const first = ds[0];
  if (first.d > 60) return null;
  const second = ds.find((x) => x.c[0] === first.c[0] && x.c[1] !== first.c[1]);
  if (!second || second.d > 120) return { depth: first.c[1], region: first.c[0], nearKm: Math.round(first.d) };
  const depth = first.c[1] + (second.c[1] - first.c[1]) * (first.d / (first.d + second.d));
  return { depth: Math.round(depth), region: first.c[0], nearKm: Math.round(first.d) };
}

export type SlabRelation = 'interface' | 'intraslab' | 'crustal' | 'unclear';

/**
 * Interpretación (no es un dato oficial): con la profundidad del sismo Z y la de la losa S,
 * |Z − S| ≤ 15 km y Z ≤ 70 km → interplaca (en el contacto); Z > S + 15 → intraplaca (dentro
 * de la losa); Z < S − 15 y Z ≤ 40 km → cortical (placa superior); lo demás, sin clasificar.
 */
export function slabRelation(z: number, s: number): SlabRelation {
  if (Math.abs(z - s) <= 15) return z <= 70 ? 'interface' : 'intraslab';
  if (z > s + 15) return 'intraslab';
  if (z < s - 15 && z <= 40) return 'crustal';
  return 'unclear';
}

/** Punto a `d` km en el rumbo `az` (°) desde lon/lat (esfera). */
function dest(lon: number, lat: number, az: number, d: number): [number, number] {
  const a = d / R, t = az * RAD, p1 = lat * RAD, l1 = lon * RAD;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(a) + Math.cos(p1) * Math.sin(a) * Math.cos(t));
  const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(a) * Math.cos(p1), Math.cos(a) - Math.sin(p1) * Math.sin(p2));
  return [((l2 / RAD + 540) % 360) - 180, p2 / RAD];
}
const bearing = (a: [number, number], b: [number, number]) => {
  const p1 = a[1] * RAD, p2 = b[1] * RAD, dl = (b[0] - a[0]) * RAD;
  return (Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) / RAD + 360) % 360;
};

export type Section = {
  azimuth: number; slab: [number, number][]; quake: [number, number]; aftershocks: [number, number, number][];
};

/**
 * Perfil profundidad–distancia en la dirección en que se hunde la losa (de la curva más
 * superficial a la más profunda cercanas al epicentro), de −250 a +350 km.
 */
function section(e: DisasterEvent, region: string, after: DisasterEvent[]): Section | null {
  const cs = SLAB.filter((c) => c[0] === region);
  const near = cs.map((c) => ({ c, ...contourDist(e.lon, e.lat, c) })).filter((x) => x.d < 250).sort((a, b) => a.c[1] - b.c[1]);
  if (near.length < 2) return null;
  const shallow = near[0], deep = near[near.length - 1];
  const az = bearing(shallow.p, deep.p);
  const slab: [number, number][] = [];
  for (let d = -250; d <= 350; d += 10) {
    const [lon, lat] = dest(e.lon, e.lat, az, d);
    const s = slabDepthAt(lon, lat);
    if (s && s.region === region) slab.push([d, s.depth]);
  }
  if (slab.length < 3) return null;
  // Réplicas: distancia a lo largo del perfil (proyección) si están a menos de 100 km de la línea.
  const aft: [number, number, number][] = [];
  for (const a of after) {
    if (a.depth == null) continue;
    const dist = km([e.lon, e.lat], [a.lon, a.lat]);
    const ang = (bearing([e.lon, e.lat], [a.lon, a.lat]) - az) * RAD;
    const along = dist * Math.cos(ang), across = Math.abs(dist * Math.sin(ang));
    if (across <= 100 && along >= -250 && along <= 350) aft.push([Math.round(along), Math.round(a.depth), a.mag ?? 0]);
  }
  return { azimuth: Math.round(az), slab, quake: [0, Math.round(e.depth ?? 0)], aftershocks: aft };
}

/* ───────────── Resumen tectónico y réplicas de USGS ───────────── */

/** Texto "Tectonic Summary" de USGS (en inglés), como párrafos de texto plano. */
function tectonicSummary(j: UsgsDetail): string[] | null {
  for (const g of products(j)['general-text'] ?? []) {
    const html = g.contents['']?.bytes ?? '';
    const i = html.search(/tectonic summary/i);
    if (i < 0) continue;
    const body = html.slice(i).replace(/^[^<]*<\/h\d>/i, '').replace(/^tectonic summary/i, '');
    const paras = body.split(/<\/p>|<br\s*\/?>\s*<br\s*\/?>|\n\s*\n/i)
      .map((p) => decodeEntities(p.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 40 && !/^tectonic summary$/i.test(p));
    if (paras.length) return paras.slice(0, 8);
  }
  return null;
}

export type Aftershocks = {
  url: string; created: number; window: string; model: string;
  forecast: { label: string; start: number; end: number; bins: { mag: number; prob: number; lo: number; hi: number }[] }[];
  observed: { mag: number; count: number }[];
};

async function oaf(j: UsgsDetail, url: string): Promise<Aftershocks | null> {
  const o = products(j).oaf?.[0];
  const f = o?.contents['forecast.json']?.url;
  if (!f) return null;
  type Raw = { creationTime: number; advisoryTimeFrame: string; model?: { name?: string }; observations?: { magnitude: number; count: number }[]; forecast: { label: string; timeStart: number; timeEnd: number; bins: { magnitude: number; probability: number; p95minimum: number; p95maximum: number }[] }[] };
  const raw = await fetchJson<Raw>(f, 20000, 1).catch(() => null);
  if (!raw?.forecast) return null;
  return {
    url: `${url}/oaf/forecast`, created: raw.creationTime, window: raw.advisoryTimeFrame, model: raw.model?.name ?? '',
    observed: (raw.observations ?? []).map((x) => ({ mag: x.magnitude, count: x.count })),
    forecast: raw.forecast.map((x) => ({
      label: x.label, start: x.timeStart, end: x.timeEnd,
      bins: x.bins.map((b) => ({ mag: b.magnitude, prob: b.probability, lo: b.p95minimum, hi: b.p95maximum })),
    })),
  };
}

/** Réplicas: sismos de USGS a menos de 150 km, desde el principal hasta 30 días después. */
async function aftershocksOf(e: DisasterEvent): Promise<DisasterEvent[]> {
  const end = Math.min(Date.now(), e.time + 30 * 864e5);
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${new Date(e.time + 1000).toISOString()}&endtime=${new Date(end).toISOString()}&latitude=${e.lat}&longitude=${e.lon}&maxradiuskm=150&minmagnitude=${(e.mag ?? 5) >= 7 ? 4 : 2.5}&limit=400&orderby=time`;
  type F = { id: string; geometry: { coordinates: [number, number, number] }; properties: { mag: number | null; time: number } };
  const j = await fetchJson<{ features?: F[] }>(url, 20000, 1).catch(() => null);
  return (j?.features ?? []).map((f) => ({
    id: f.id, type: 'eq', src: 'USGS', lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], depth: f.geometry.coordinates[2],
    time: f.properties.time, mag: f.properties.mag, title: '',
  }) as DisasterEvent);
}

/* ───────────── Todo junto ───────────── */

export type QuakeGeology = {
  mechanism: Mechanism | null;
  plates: PlateContext;
  slab: { depth: number; region: string; relation: SlabRelation } | null;
  section: Section | null;
  summary: string[] | null;
  aftershocks: Aftershocks | null;
  history: HistoricEvent[];
  url: string;
};

export async function quakeGeology(e: DisasterEvent): Promise<QuakeGeology | null> {
  if (e.type !== 'eq' || e.src !== 'USGS') return null;
  const young = Date.now() - e.time < 7 * 864e5;
  const r = await kvCached(`geo1:${e.id}`, young ? 36e5 : 30 * 864e5, async () => {
    const j = await fetchUsgsDetail(e.id);
    const url = (j.properties as { url?: string }).url ?? `https://earthquake.usgs.gov/earthquakes/eventpage/${e.id}`;
    const s = slabDepthAt(e.lon, e.lat);
    const [after, hist, af] = await Promise.all([
      s ? aftershocksOf(e) : Promise.resolve([]),
      getNearbyHistory(e.lat, e.lon, 3).catch(() => ({ events: [] as HistoricEvent[] })),
      oaf(j, url),
    ]);
    return {
      mechanism: mechanism(j, url),
      plates: plateContext(e.lon, e.lat),
      slab: s && e.depth != null ? { depth: s.depth, region: s.region, relation: slabRelation(e.depth, s.depth) } : null,
      section: s ? section(e, s.region, after) : null,
      summary: tectonicSummary(j),
      aftershocks: af,
      // Historia: sismos significativos de NCEI a menos de 300 km (sin el mismo sismo).
      history: hist.events
        .filter((h) => h.kind === 'eq' && km([e.lon, e.lat], [h.lon, h.lat]) <= 300 && !(h.year === new Date(e.time).getUTCFullYear() && h.month === new Date(e.time).getUTCMonth() + 1 && h.day === new Date(e.time).getUTCDate()))
        .sort((a, b) => (b.deaths ?? 0) - (a.deaths ?? 0) || (b.mag ?? 0) - (a.mag ?? 0))
        .slice(0, 10),
      url,
    } satisfies QuakeGeology;
  });
  return r.value;
}
