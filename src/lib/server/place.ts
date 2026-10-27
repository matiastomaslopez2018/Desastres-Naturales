import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { geoContains, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import grid from '@/data/ibtracs_grid.json';
import { fetchJson } from './cache';
import { kvCached } from './kvCache';
import { countryAt } from './countries';
import { getGvp } from './ingest';
import { getNearbyHistory } from './ncei';
import { plateContext, slabDepthAt, slabRelation, type PlateContext } from './geology';
import { recentEvents, volcanoIndex } from './landing';
import { VOLCANOES } from '../volcano/presets';
import { MERC_MAX } from '../png';
import type { EventType } from '../types';

/*
 * "Mi lugar": los peligros naturales de un punto con datos oficiales y científicos.
 *   - Sismos: amenaza del mapa global de GEM (2023), sismos registrados por el USGS (catálogo ComCat),
 *     sismos con víctimas o daños de NOAA NCEI, placa y borde más cercano (PB2002) y losa (Slab2).
 *   - Volcanes: volcanes del Holoceno del Smithsonian (GVP) a menos de 300 km.
 *   - Tsunamis: distancia a la costa (Natural Earth), altura del terreno (Copernicus DEM vía Open-Meteo)
 *     y olas medidas en la costa cercana (NOAA NCEI, base de alturas de tsunami).
 *   - Ciclones: los que pasaron cerca desde 1980 con 64 kt o más (IBTrACS).
 *   - Deslizamientos con víctimas (catálogo de la NASA).
 *   - Lo que pasa ahora cerca (la misma base del mapa).
 * Son datos, no un pronóstico ni un estudio de riesgo: cada sección dice de dónde sale.
 */

const R = 6371;
const km = (a: [number, number], b: [number, number]) => geoDistance(a, b) * R;
const pub = (p: string) => join(process.cwd(), 'public', p);

/* ───────────── Amenaza sísmica (GEM) ───────────── */

/** Límites de las clases del mapa de GEM (g), como en scripts/gem.ts: la clase k va de LEVELS[k-1] a LEVELS[k]. */
export const GEM_LEVELS = [0.02, 0.03, 0.05, 0.08, 0.13, 0.2, 0.35, 0.55, 0.9];
let gemIdx: { w: number; h: number; px: Uint8Array } | null = null;

/** Índices de la imagen con paleta public/data/gem-3857.png (un byte por píxel: la clase). */
function gemImage() {
  if (gemIdx) return gemIdx;
  const b = readFileSync(pub('data/gem-3857.png'));
  let o = 8, w = 0, h = 0;
  const parts: Buffer[] = [];
  while (o < b.length) {
    const n = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + n);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); if (d[8] !== 8 || d[9] !== 3) throw new Error('GEM: se esperaba PNG con paleta de 8 bits'); }
    else if (type === 'IDAT') parts.push(d);
    else if (type === 'IEND') break;
    o += 12 + n;
  }
  const raw = inflateSync(Buffer.concat(parts)), px = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (w + 1)], src = y * (w + 1) + 1, dst = y * w;
    for (let x = 0; x < w; x++) {
      const l = x ? px[dst + x - 1] : 0, u = y ? px[dst - w + x] : 0, ul = x && y ? px[dst - w + x - 1] : 0;
      let v = raw[src + x];
      if (f === 1) v += l; else if (f === 2) v += u; else if (f === 3) v += (l + u) >> 1;
      else if (f === 4) { const p = l + u - ul, pa = Math.abs(p - l), pb = Math.abs(p - u), pc = Math.abs(p - ul); v += pa <= pb && pa <= pc ? l : pb <= pc ? u : ul; }
      px[dst + x] = v & 255;
    }
  }
  return (gemIdx = { w, h, px });
}

/** Clase de amenaza de GEM en un punto: 0 = menos de 0,02 g; k = entre GEM_LEVELS[k-1] y GEM_LEVELS[k] (g). */
export function gemClass(lon: number, lat: number): number | null {
  if (Math.abs(lat) > MERC_MAX) return null;
  const { w, h, px } = gemImage();
  const x = Math.min(w - 1, Math.floor(((lon + 180) / 360) * w));
  const y = Math.min(h - 1, Math.floor(((1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2) * h));
  return px[y * w + x];
}

/* ───────────── Costa (Natural Earth 1:50 millones) ───────────── */

let coast: { rings: [number, number][][]; land: GeoJSON.FeatureCollection | GeoJSON.Feature } | null = null;
async function coastData() {
  if (coast) return coast;
  const m = await import('world-atlas/land-50m.json');
  const topo = (m.default ?? m) as unknown as Topology<{ land: GeometryCollection }>;
  const land = feature(topo, topo.objects.land) as GeoJSON.FeatureCollection | GeoJSON.Feature;
  const rings: [number, number][][] = [];
  for (const f of 'features' in land ? land.features : [land]) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const p of polys) for (const r of p) rings.push(r as [number, number][]);
  }
  return (coast = { rings, land });
}

/** Distancia a la costa más cercana (km) y si el punto está en tierra. */
async function coastDistance(lon: number, lat: number) {
  const { rings, land } = await coastData();
  const cos = Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (const r of rings) for (let i = 1; i < r.length; i++) {
    const a = r[i - 1], b = r[i];
    if (Math.abs(a[1] - lat) > 6 && Math.abs(b[1] - lat) > 6) continue;
    // Distancia al segmento en una proyección local (alcanza para unos cientos de km).
    let ax = (a[0] - lon) * cos, bx = (b[0] - lon) * cos;
    if (ax > 180) ax -= 360 * cos; if (ax < -180) ax += 360 * cos; if (bx > 180) bx -= 360 * cos; if (bx < -180) bx += 360 * cos;
    const ay = a[1] - lat, by = b[1] - lat, dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
    const d = Math.hypot(ax + t * dx, ay + t * dy) * 111.32;
    if (d < best) best = d;
  }
  return { km: Number.isFinite(best) ? best : null, onLand: geoContains(land, [lon, lat]) };
}

/* ───────────── Perfil ───────────── */

type UsgsF = { id: string; properties: { mag: number; time: number; place: string | null }; geometry: { coordinates: [number, number, number] } };
type Runup = { year?: number; month?: number; day?: number; locationName?: string; country?: string; latitude?: number; longitude?: number; runupHt?: number; deaths?: number; tsunamiEventId?: number; doubtful?: string };

export type PlaceProfile = {
  lat: number; lon: number; country: string | null; iso3: string | null;
  elevation: number | null; coastKm: number | null; onLand: boolean;
  quake: {
    gem: number | null; plate: PlateContext; slab: { depth: number; region: string } | null;
    radiusKm: number; m5: number | null; m6: number | null; m7: number | null;
    /** setting: ambiente para el simulador de sismos (interpretación con Slab2, como en la ficha de cada sismo). */
    big: { id: string; mag: number; time: number; depth: number; km: number; place: string; lon: number; lat: number; setting: 'crustal' | 'interface' | 'slab' }[];
    harmful: { year: number; mag: number | null; deaths: number | null; km: number; place: string; url: string }[];
  };
  volcano: { list: { num: number; name: string; country: string | null; km: number; lastErup: number | null; slug: string | null; sim: string | null; lon: number; lat: number }[] };
  tsunami: { radiusKm: number; runups: { year: number; place: string; height: number; km: number; deaths: number | null; eventId: number | null; lon: number; lat: number }[] };
  cyclone: { list: { sid: string; name: string; season: number; windKt: number; basin: string }[] };
  landslide: { radiusKm: number; list: { time: number | null; deaths: number; title: string; km: number; url: string | null; trigger: string | null; lon: number; lat: number }[] };
};

const QUAKE_R = 250, TSU_R = 50, SLIDE_R = 50, VOLC_R = 300;

function settingOf(lon: number, lat: number, z: number): 'crustal' | 'interface' | 'slab' {
  const s = slabDepthAt(lon, lat);
  const r = s ? slabRelation(z, s.depth) : z > 70 ? 'intraslab' : 'crustal';
  return r === 'interface' ? 'interface' : r === 'intraslab' ? 'slab' : 'crustal';
}

async function quakes(lon: number, lat: number) {
  const base = `https://earthquake.usgs.gov/fdsnws/event/1/`, q = `latitude=${lat}&longitude=${lon}&maxradiuskm=${QUAKE_R}&starttime=1900-01-01&eventtype=earthquake`;
  const count = (m: number) => fetchJson<{ count: number }>(`${base}count?format=geojson&${q}&minmagnitude=${m}`, 25000).then((j) => j.count).catch(() => null);
  const [m5, m6, m7, top, hist] = await Promise.all([
    count(5), count(6), count(7),
    fetchJson<{ features: UsgsF[] }>(`${base}query?format=geojson&${q}&minmagnitude=5&orderby=magnitude&limit=8`, 30000).then((j) => j.features).catch(() => []),
    getNearbyHistory(lat, lon, 2.5, 1500).then((r) => r.events).catch(() => []),
  ]);
  return {
    m5, m6, m7,
    big: top.map((f) => ({
      id: f.id, mag: f.properties.mag, time: f.properties.time, depth: f.geometry.coordinates[2], place: f.properties.place ?? '',
      lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], km: Math.round(km([lon, lat], [f.geometry.coordinates[0], f.geometry.coordinates[1]])),
      setting: settingOf(f.geometry.coordinates[0], f.geometry.coordinates[1], f.geometry.coordinates[2]),
    })),
    harmful: hist.map((e) => ({ year: e.year, mag: e.mag, deaths: e.deaths, km: Math.round(km([lon, lat], [e.lon, e.lat])), place: e.location, url: e.url }))
      .filter((e) => e.km <= QUAKE_R && (e.deaths ?? 0) > 0).sort((a, b) => (b.deaths ?? 0) - (a.deaths ?? 0)).slice(0, 8),
  };
}

async function runups(lon: number, lat: number) {
  const d = 0.6, cos = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const qs = `minLatitude=${lat - d}&maxLatitude=${lat + d}&minLongitude=${lon - d / cos}&maxLongitude=${lon + d / cos}&minYear=1500`;
  const items: Runup[] = [];
  for (let page = 1; page <= 10; page++) {
    const j = await fetchJson<{ items?: Runup[]; totalPages?: number }>(`https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/tsunamis/runups?${qs}&page=${page}`, 30000);
    items.push(...(j.items ?? []));
    if (!j.totalPages || page >= j.totalPages) break;
  }
  return items
    .filter((r) => r.latitude != null && r.longitude != null && r.year != null && r.runupHt != null && r.doubtful !== 'y')
    .map((r) => ({ year: r.year!, place: [r.locationName, r.country].filter(Boolean).join(', ').toLowerCase().replace(/(^|[\s,(-])\p{L}/gu, (c) => c.toUpperCase()), height: r.runupHt!, km: Math.round(km([lon, lat], [r.longitude!, r.latitude!])), deaths: r.deaths ?? null, eventId: r.tsunamiEventId ?? null, lon: r.longitude!, lat: r.latitude! }))
    .filter((r) => r.km <= TSU_R)
    // La base repite algunas mediciones (mismo año, lugar y altura).
    .filter((r, i, a) => a.findIndex((x) => x.year === r.year && x.place === r.place && x.height === r.height) === i);
}

type Glc = [number, number, number | null, number, string | null, string, string | null, string | null, string | null];
let glc: Glc[] | null = null;
const glcData = () => (glc ??= JSON.parse(readFileSync(pub('data/glc_fatal.json'), 'utf8')) as Glc[]);

const G = grid as unknown as { storms: [string, string, number, number, string][]; cells: Record<string, number[]> };

async function profile(lat: number, lon: number): Promise<PlaceProfile> {
  const c = countryAt(lon, lat);
  const [eq, tsu, elev, shore, gvp, idx] = await Promise.all([
    quakes(lon, lat),
    runups(lon, lat).catch(() => null),
    fetchJson<{ elevation?: number[] }>(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`, 15000).then((j) => j.elevation?.[0] ?? null).catch(() => null),
    coastDistance(lon, lat),
    getGvp().catch(() => []),
    volcanoIndex().catch(() => null),
  ]);
  const slab = slabDepthAt(lon, lat);
  // Ciclones: celdas de 2° alrededor del punto (unos 300 km), como en la ficha de cada ciclón.
  const cx = Math.floor(lon / 2), cy = Math.floor(lat / 2), ids = new Set<number>();
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const i of G.cells[`${cx + dx},${cy + dy}`] ?? []) ids.add(i);
  return {
    lat, lon, country: c?.name ?? null, iso3: c?.iso3 ?? null,
    elevation: elev, coastKm: shore.km == null ? null : Math.round(shore.km * 10) / 10, onLand: shore.onLand,
    quake: { gem: gemClass(lon, lat), plate: plateContext(lon, lat), slab: slab && slab.nearKm < 30 ? { depth: slab.depth, region: slab.region } : null, radiusKm: QUAKE_R, ...eq },
    volcano: {
      list: gvp.map((v) => ({ v, d: km([lon, lat], [v.lon, v.lat]) })).filter((x) => x.d <= VOLC_R).sort((a, b) => a.d - b.d).slice(0, 8).map(({ v, d }) => ({
        num: v.num, name: v.title.replace(/^(.+?),s*(.+)$/, '$2 $1'), country: v.country ?? null, km: Math.round(d), lastErup: v.lastErup ?? null, slug: idx?.slugOf.get(v.num) ?? null,
        sim: VOLCANOES.find((s) => s.gvp === v.num)?.id ?? null, lon: v.lon, lat: v.lat,
      })),
    },
    tsunami: { radiusKm: TSU_R, runups: tsu ?? [] },
    cyclone: { list: [...ids].map((i) => G.storms[i]).sort((a, b) => b[3] - a[3]).map(([sid, name, season, windKt, basin]) => ({ sid, name, season, windKt, basin })) },
    landslide: {
      radiusKm: SLIDE_R,
      list: glcData().map((g) => ({ g, d: km([lon, lat], [g[0], g[1]]) })).filter((x) => x.d <= SLIDE_R).sort((a, b) => b.g[3] - a.g[3])
        .map(({ g, d }) => ({ time: g[2], deaths: g[3], title: g[5], km: Math.round(d), url: g[6], trigger: g[4], lon: g[0], lat: g[1] })),
    },
  };
}

/** Perfil de un punto (redondeado a ~1 km; una semana de caché: son datos históricos). */
export async function placeProfile(lat: number, lon: number) {
  const la = Math.round(lat * 100) / 100, lo = Math.round(lon * 100) / 100;
  return (await kvCached(`place:v3:${la}:${lo}`, 7 * 24 * 36e5, () => profile(la, lo))).value;
}

/** Eventos de los últimos 30 días a menos de `radiusKm` (los del mapa). */
export async function placeNow(lat: number, lon: number, radiusKm = 300) {
  const { events } = await recentEvents('30d');
  return events
    .map((e) => ({ e, d: km([lon, lat], [e.lon, e.lat]) }))
    .filter(({ e, d }) => d <= radiusKm && !(e.type === 'eq' && (e.mag ?? 0) < 4))
    .sort((a, b) => b.e.time - a.e.time).slice(0, 12)
    .map(({ e, d }) => ({ id: e.id, type: e.type as EventType, title: e.title, time: e.time, mag: e.mag ?? null, km: Math.round(d) }));
}
