import 'server-only';
import { geoDistance } from 'd3-geo';
import { inflateSync } from 'node:zlib';
import { fetchJson } from './cache';
import { pngPixels } from './images';
import { kvCached } from './kvCache';
import type { DisasterEvent } from '../types';

/*
 * Inundaciones y sequías (Fase 3 · D), con fuentes oficiales:
 *  - Copernicus EMS Rapid Mapping: activaciones de mapeo satelital (inundaciones y otros).
 *  - Copernicus Global Drought Observatory: riesgo de impacto de la sequía en la
 *    agricultura (RDrI-Agri), cada 10 días. El servicio no responde consultas puntuales:
 *    se lee el color del mapa oficial en el punto y se compara con su leyenda.
 * Los mapas de GloFAS, IMERG (NASA GIBS) y el US Drought Monitor se muestran como
 * imágenes del servicio oficial (ver HydroContext).
 */

const DAY = 864e5;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/* ───────────── Copernicus EMS ───────────── */

export type EmsActivation = { code: string; name: string; time: number; closed: boolean; aois: number; products: number; url: string; category: string };

type EmsRow = { code: string; name: string; eventTime: string; centroid: string; category: string; closed: boolean; gdacsId: string | null; n_aois: number; n_products: number };

async function emsList(): Promise<EmsRow[]> {
  const r = await kvCached('ems:activations', 3 * 36e5, async () => {
    const j = await fetchJson<{ results: EmsRow[] }>('https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/?limit=200', 30000, 1);
    return j.results;
  });
  return r.value;
}

const CATEGORY: Record<string, string> = { flood: 'Flood', fire: 'Wildfire', eq: 'Earthquake', storm: 'Storm', volcano: 'Volcanic', drought: 'Drought' };

/** Activación de EMS para un evento: por el id de GDACS o por cercanía (500 km, ±15 días, mismo tipo). */
export async function emsActivationFor(e: DisasterEvent): Promise<EmsActivation | null> {
  const list = await emsList().catch(() => [] as EmsRow[]);
  const gid = /^gdacs-([A-Z]{2})(\d+)$/.exec(e.id);
  const t = e.start ?? e.time;
  const hit = list.find((a) => gid && a.gdacsId === `${gid[1]}${gid[2]}`) ?? list.find((a) => {
    const m = /POINT \(([-\d.]+) ([-\d.]+)\)/.exec(a.centroid ?? '');
    if (!m || !new RegExp(CATEGORY[e.type] ?? '^$', 'i').test(a.category)) return false;
    const km = geoDistance([+m[1], +m[2]], [e.lon, e.lat]) * 6371;
    return km < 500 && Math.abs(Date.parse(`${a.eventTime}Z`) - t) < 15 * DAY;
  });
  return hit ? {
    code: hit.code, name: hit.name, time: Date.parse(`${hit.eventTime}Z`), closed: hit.closed, aois: hit.n_aois, products: hit.n_products,
    url: `https://rapidmapping.emergency.copernicus.eu/${hit.code}/`, category: hit.category,
  } : null;
}

/* ───────────── Copernicus GDO: riesgo de impacto de sequía en la agricultura ───────────── */

const GDO = 'https://drought.emergency.copernicus.eu/api/wms';
export const gdoMap = (layer: string, bbox: [number, number, number, number], w: number, h: number, date: string) =>
  `${GDO}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layer}&SRS=EPSG:4326&BBOX=${bbox.join(',')}&WIDTH=${w}&HEIGHT=${h}&STYLES=&FORMAT=image/png&TRANSPARENT=true&TIME=${date}`;

export type DroughtLevel = 'high' | 'medium' | 'low' | 'none';
/** Colores de la leyenda oficial de RDrI-Agri. */
const LEGEND: [DroughtLevel, [number, number, number]][] = [['high', [255, 0, 0]], ['medium', [255, 204, 0]], ['low', [255, 255, 0]]];

/** Fechas de publicación: días 1, 11 y 21 de cada mes (decádicas). */
function dekads(n: number): string[] {
  const out: string[] = [];
  let d = new Date();
  while (out.length < n) {
    const day = d.getUTCDate() >= 21 ? 21 : d.getUTCDate() >= 11 ? 11 : 1;
    const s = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!out.includes(s)) out.push(s);
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), day) - DAY);
  }
  return out;
}

/** Color RGBA de un píxel de un PNG con paleta (1, 2, 4 u 8 bits) o RGB/RGBA de 8 bits. */
function pixelRGBA(buf: Buffer, x: number, y: number): [number, number, number, number] | null {
  let pos = 8, w = 0, depth = 0, ctype = 0;
  const idat: Buffer[] = [];
  let plte: Buffer | null = null, trns: Buffer | null = null;
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); depth = data[8]; ctype = data[9]; if (data[12] !== 0) return null; }
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (ctype !== 3) {
    const img = pngPixels(buf);
    if (!img) return null;
    const k = (y * w + x) * img.bpp;
    return [img.px[k], img.px[k + 1], img.px[k + 2], img.bpp === 4 ? img.px[k + 3] : 255];
  }
  if (!plte) return null;
  const stride = Math.ceil((w * depth) / 8);
  const raw = inflateSync(Buffer.concat(idat));
  // Quitar filtros fila por fila (con menos de 8 bits por píxel, el "bpp" del filtro es 1 byte).
  let prev = Buffer.alloc(stride), row = Buffer.alloc(stride);
  for (let r = 0; r <= y; r++) {
    const f = raw[r * (stride + 1)], src = raw.subarray(r * (stride + 1) + 1, (r + 1) * (stride + 1));
    row = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i ? row[i - 1] : 0, b = prev[i], c = i ? prev[i - 1] : 0;
      let v = src[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[i] = v & 255;
    }
    prev = row;
  }
  const bit = x * depth, byte = row[bit >> 3];
  const idx = (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
  return [plte[idx * 3], plte[idx * 3 + 1], plte[idx * 3 + 2], trns && idx < trns.length ? trns[idx] : 255];
}

async function levelAt(lon: number, lat: number, date: string): Promise<DroughtLevel | null> {
  const e = 0.05;
  const res = await fetch(gdoMap('rdria', [lon - e, lat - e, lon + e, lat + e], 3, 3, date), { signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!res?.ok) return null;
  const px = pixelRGBA(Buffer.from(await res.arrayBuffer()), 1, 1); // píxel central de 3×3
  if (!px) return null;
  const [r, g, b, a] = px;
  if (a < 128) return 'none';
  const best = LEGEND.map(([lv, c]) => ({ lv, d: Math.hypot(r - c[0], g - c[1], b - c[2]) })).sort((x, y) => x.d - y.d)[0];
  return best.d < 60 ? best.lv : 'none';
}

export type GdoDrought = { date: string; level: DroughtLevel; prevDate: string | null; prevLevel: DroughtLevel | null };

export async function gdoDrought(lon: number, lat: number): Promise<GdoDrought | null> {
  const r = await kvCached(`gdo1:${lon.toFixed(1)}:${lat.toFixed(1)}:${iso(Date.now())}`, DAY, async () => {
    // La última decádica publicada (el servicio responde 400 para fechas sin datos).
    const ds = dekads(12);
    for (let i = 0; i < ds.length - 1; i++) {
      const lv = await levelAt(lon, lat, ds[i]);
      if (lv == null) continue;
      const prev = await levelAt(lon, lat, ds[i + 1]);
      return { date: ds[i], level: lv, prevDate: prev != null ? ds[i + 1] : null, prevLevel: prev };
    }
    return null;
  }).catch(() => null);
  return r?.value ?? null;
}

/* ───────────── Leyenda de IMERG (colormap oficial de NASA GIBS) ───────────── */

export type ColorLegend = { colors: string[]; ticks: { pos: number; label: string }[]; units: string };

/** Escala de "Rain Rate" del colormap GPM_Precipitation_Rate de GIBS, resumida para una barra liviana. */
export async function imergLegend(): Promise<ColorLegend | null> {
  const r = await kvCached('gibs:legend:gpm', 30 * DAY, async () => {
    const res = await fetch('https://gibs.earthdata.nasa.gov/colormaps/v1.3/GPM_Precipitation_Rate.xml', { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`GIBS ${res.status}`);
    const xml = await res.text();
    const i = xml.indexOf('title="Rain Rate"');
    const units = /units="([^"]+)"/.exec(xml.slice(i, i + 200))?.[1] ?? '';
    const entries = [...xml.slice(i).matchAll(/rgb="(\d+),(\d+),(\d+)"[^>]*value="\[([-\d.eINF]+),/g)]
      .map((m) => ({ rgb: `rgb(${m[1]},${m[2]},${m[3]})`, v: Number(m[4]) })).filter((e) => Number.isFinite(e.v));
    if (entries.length < 2) throw new Error('colormap vacío');
    const step = Math.max(1, Math.floor(entries.length / 40));
    const colors = entries.filter((_, k) => k % step === 0).map((e) => e.rgb);
    // Marcas en valores redondos que existan en la escala.
    const ticks = [0.1, 1, 10, 100].map((v) => {
      const k = entries.findIndex((e) => e.v >= v);
      return k < 0 ? null : { pos: k / (entries.length - 1), label: String(v).replace('.', ',') };
    }).filter((x): x is { pos: number; label: string } => !!x);
    return { colors, ticks, units };
  }).catch(() => null);
  return r?.value ?? null;
}
