/*
 * Datos del simulador de volcanes, en public/data/volcano/:
 *   <volcán>/dem.bin    relieve: Int16 (m) en una grilla de N×N sobre el recuadro, filas de norte a sur.
 *                       Fuente: Terrain Tiles de AWS (Mapzen/Tilezen; SRTM, GMTED, ETOPO1 y otros), zoom 12.
 *   <volcán>/image.jpg  imagen satelital en color real: Sentinel-2 L2A (Copernicus), la escena con menos nubes
 *                       que cubre todo el recuadro (catálogo Earth Search de Element 84), banda TCI.
 *   <volcán>/meta.json  recuadro, tamaño, escena usada y atribuciones.
 *   winds/<erupción>.json  perfil de viento de cada fase: reanálisis ERA5 (Copernicus/ECMWF, 0,25°, cada 6 h,
 *                       copia ARCO-ERA5 de Google) a la hora más cercana para 1959–2022; sin ERA5, el promedio
 *                       del mes 1991–2020 del reanálisis NCEP/NCAR de la NOAA.
 *   <volcán>/meta.json también guarda el viento promedio de cada mes (NCEP/NCAR) para el modo libre.
 *   npm run volcano-data [-- id1,id2]
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { fromUrl } from 'geotiff';
import { ERUPTIONS, VOLCANOES, type Volcano } from '../src/lib/volcano/presets';

const OUT = join(process.cwd(), 'public', 'data', 'volcano');
const N = 256, IMG = 1536, Z = 12;
const only = process.argv[2]?.split(',');

async function get(url: string, init?: RequestInit): Promise<Response> {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(url, init);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch (e) {
      if (i === 4) throw new Error(`${url}: ${e}`);
      await new Promise((res) => setTimeout(res, (String(e).includes('429') ? 15000 : 2000) * (i + 1)));
    }
  }
  throw new Error('inalcanzable');
}

export function box(v: Volcano) {
  const dLat = v.boxKm / 111.32, dLon = v.boxKm / (111.32 * Math.cos((v.lat * Math.PI) / 180));
  return { w: v.lon - dLon, e: v.lon + dLon, s: v.lat - dLat, n: v.lat + dLat };
}

/* ───────────── Relieve ───────────── */

const tileX = (lon: number) => ((lon + 180) / 360) * 2 ** Z;
const tileY = (lat: number) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z; };

async function dem(v: Volcano) {
  const b = box(v);
  const x0 = Math.floor(tileX(b.w)), x1 = Math.floor(tileX(b.e)), y0 = Math.floor(tileY(b.n)), y1 = Math.floor(tileY(b.s));
  const tiles = new Map<string, Buffer>();
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const png = Buffer.from(await (await get(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`)).arrayBuffer());
    tiles.set(`${x}/${y}`, (await sharp(png).removeAlpha().raw().toBuffer()));
  }
  // Terrarium: altura = R·256 + G + B/256 − 32768 (m). Bilineal en coordenadas de píxel Web Mercator.
  const at = (px: number, py: number) => {
    const tx = Math.floor(px / 256), ty = Math.floor(py / 256), t = tiles.get(`${tx}/${ty}`)!;
    const i = ((py - ty * 256) * 256 + (px - tx * 256)) * 3;
    return t[i] * 256 + t[i + 1] + t[i + 2] / 256 - 32768;
  };
  const out = new Int16Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const lon = b.w + ((b.e - b.w) * i) / (N - 1), lat = b.n - ((b.n - b.s) * j) / (N - 1);
    const fx = tileX(lon) * 256 - 0.5, fy = tileY(lat) * 256 - 0.5, ax = Math.floor(fx), ay = Math.floor(fy), u = fx - ax, w = fy - ay;
    const h = at(ax, ay) * (1 - u) * (1 - w) + at(ax + 1, ay) * u * (1 - w) + at(ax, ay + 1) * (1 - u) * w + at(ax + 1, ay + 1) * u * w;
    out[j * N + i] = Math.round(h);
  }
  let max = -1e9;
  out.forEach((h) => { max = Math.max(max, h); });
  return { out, max, tiles: tiles.size };
}

/* ───────────── Imagen Sentinel-2 ───────────── */

/** Proyección UTM (WGS84) directa, serie de Krüger como en Snyder (1987). */
function utm(lon: number, lat: number, zone: number, south: boolean) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const φ = (lat * Math.PI) / 180, λ0 = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180, λ = (lon * Math.PI) / 180;
  const Nn = a / Math.sqrt(1 - e2 * Math.sin(φ) ** 2), T = Math.tan(φ) ** 2, C = ep2 * Math.cos(φ) ** 2, A = Math.cos(φ) * (λ - λ0);
  const M = a * ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * φ - ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * φ)
    + ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * φ) - ((35 * e2 ** 3) / 3072) * Math.sin(6 * φ));
  const x = k0 * Nn * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5) / 120) + 500000;
  let y = k0 * (M + Nn * Math.tan(φ) * ((A * A) / 2 + ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 + ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6) / 720));
  if (south) y += 10000000;
  return [x, y];
}

type StacItem = { id: string; bbox: number[]; geometry: { type: string; coordinates: number[][][] | number[][][][] }; properties: Record<string, number | string>; assets: Record<string, { href: string }> };

const inRing = (ring: number[][], x: number, y: number) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const covers = (it: StacItem, pts: number[][]) => {
  const polys = (it.geometry.type === 'Polygon' ? [it.geometry.coordinates] : it.geometry.coordinates) as number[][][][];
  return pts.every(([x, y]) => polys.some((p) => inRing(p[0], x, y)));
};

async function image(v: Volcano) {
  const b = box(v);
  const pts = [[b.w, b.s], [b.e, b.s], [b.e, b.n], [b.w, b.n], [v.lon, v.lat]];
  const r = await get('https://earth-search.aws.element84.com/v1/search', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      collections: ['sentinel-2-c1-l2a'], datetime: '2019-01-01T00:00:00Z/2025-12-31T23:59:59Z',
      intersects: { type: 'Polygon', coordinates: [[...pts.slice(0, 4), pts[0]]] },
      query: { 'eo:cloud_cover': { lt: 8 } }, limit: 300,
    }),
  });
  const all = ((await r.json()) as { features: StacItem[] }).features;
  // La mejor escena tiene que cubrir el volcán; las demás solo completan lo que falte del recuadro.
  const items = all.filter((it) => covers(it, [[v.lon, v.lat]]));
  if (!items.length) throw new Error(`${v.id}: ninguna escena cubre el volcán`);
  // Preferencia: pocas nubes y poca nieve (verano local); a igualdad, la más reciente.
  const summer = (m: number) => (v.lat < 0 ? [12, 1, 2, 3].includes(m) : [6, 7, 8, 9].includes(m));
  const score = (it: StacItem) => Number(it.properties['eo:cloud_cover']) + 0.3 * Number(it.properties['s2:snow_ice_percentage'] ?? 0)
    + (summer(new Date(String(it.properties.datetime)).getUTCMonth() + 1) ? 0 : 4);
  items.sort((p, q) => score(p) - score(q) || String(q.properties.datetime).localeCompare(String(p.properties.datetime)));
  // Mosaico: primero la mejor escena; después las del mismo día (otras teselas de la misma pasada), y si
  // todavía falta, las siguientes mejores. Un píxel negro (0,0,0) en la banda TCI es "sin datos".
  const day = (it: StacItem) => String(it.properties.datetime).slice(0, 10);
  const best = items[0], rest = all.filter((it) => it !== best).sort((p, q) => score(p) - score(q));
  const order = [best, ...rest.filter((it) => day(it) === day(best)), ...rest.filter((it) => day(it) !== day(best))];
  const out = Buffer.alloc(IMG * IMG * 3), filled = new Uint8Array(IMG * IMG);
  let left = IMG * IMG;
  const used: { id: string; date: string; cloud: number }[] = [];
  const target = (2 * v.boxKm * 1000) / IMG;
  for (const it of order) {
    if (left < IMG * IMG * 0.0005 || used.length >= 6) break;
    const epsg = Number(String(it.properties['proj:code'] ?? it.properties['proj:epsg']).replace('EPSG:', ''));
    const zone = epsg % 100, south = Math.floor(epsg / 100) === 327;
    const tiff = await fromUrl(it.assets.visual.href);
    const full = await tiff.getImage(0);
    const [ox, oy] = [full.getOrigin()[0], full.getOrigin()[1]];
    const res0 = full.getResolution()[0];
    let level = 0;
    for (let k = 1; k < (await tiff.getImageCount()); k++) { const im = await tiff.getImage(k); if ((res0 * full.getWidth()) / im.getWidth() <= target) level = k; }
    const img = await tiff.getImage(level), res = (res0 * full.getWidth()) / img.getWidth();
    const corners = pts.slice(0, 4).map(([lo, la]) => utm(lo, la, zone, south));
    const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
    const px0 = Math.max(0, Math.floor((Math.min(...xs) - ox) / res) - 2), px1 = Math.min(img.getWidth(), Math.ceil((Math.max(...xs) - ox) / res) + 2);
    const py0 = Math.max(0, Math.floor((oy - Math.max(...ys)) / res) - 2), py1 = Math.min(img.getHeight(), Math.ceil((oy - Math.min(...ys)) / res) + 2);
    if (px1 - px0 < 4 || py1 - py0 < 4) continue;
    const ras = (await img.readRasters({ window: [px0, py0, px1, py1], interleave: true })) as unknown as Uint8Array;
    const W = px1 - px0, H = py1 - py0;
    let got = 0;
    for (let j = 0; j < IMG; j++) for (let i = 0; i < IMG; i++) {
      const o = j * IMG + i;
      if (filled[o]) continue;
      const lon = b.w + ((b.e - b.w) * (i + 0.5)) / IMG, lat = b.n - ((b.n - b.s) * (j + 0.5)) / IMG;
      const [x, y] = utm(lon, lat, zone, south);
      const fx = (x - ox) / res - px0 - 0.5, fy = (oy - y) / res - py0 - 0.5;
      if (fx < 0 || fy < 0 || fx > W - 2 || fy > H - 2) continue;
      const ax = Math.floor(fx), ay = Math.floor(fy), u = fx - ax, w = fy - ay;
      const g = (xx: number, yy: number, c: number) => ras[(yy * W + xx) * 3 + c];
      // Sin datos si alguno de los cuatro vecinos es negro.
      if ([[ax, ay], [ax + 1, ay], [ax, ay + 1], [ax + 1, ay + 1]].some(([xx, yy]) => g(xx, yy, 0) + g(xx, yy, 1) + g(xx, yy, 2) === 0)) continue;
      for (let c = 0; c < 3; c++) out[o * 3 + c] = Math.round(g(ax, ay, c) * (1 - u) * (1 - w) + g(ax + 1, ay, c) * u * (1 - w) + g(ax, ay + 1, c) * (1 - u) * w + g(ax + 1, ay + 1, c) * u * w);
      filled[o] = 1; left--; got++;
    }
    if (got) used.push({ id: it.id, date: day(it), cloud: Number(it.properties['eo:cloud_cover']) });
  }
  const jpg = await sharp(out, { raw: { width: IMG, height: IMG, channels: 3 } }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  return { jpg, scene: { scenes: used, date: used[0]?.date, missing: +(left / (IMG * IMG)).toFixed(4) } };
}

/* ───────────── Viento (reanálisis NCEP/NCAR) ───────────── */

const PSL = 'https://psl.noaa.gov/thredds/dodsC/Datasets';

/** Lee una variable de un .nc por OPeNDAP en formato ASCII: [nivel][lat][lon] para un índice de tiempo. */
async function opendap(path: string, varName: string, t: number, j0: number, i0: number) {
  const q = `${varName}%5B${t}%5D%5B0:1:16%5D%5B${j0}:1:${j0 + 1}%5D%5B${i0}:1:${i0 + 1}%5D`;
  const txt = await (await get(`${PSL}/${path}.ascii?${q}`)).text();
  const body = txt.split(/-{10,}/)[1] ?? '';
  // Cada línea de datos: "[0][k][a], v1, v2"
  const vals: number[][][] = [];
  for (const line of body.split('\n')) {
    const m = /^\[\d+\]\[(\d+)\]\[(\d+)\],\s*(.+)$/.exec(line.trim());
    if (!m) continue;
    const k = +m[1], a = +m[2];
    (vals[k] ??= [])[a] = m[3].split(',').map(Number);
  }
  // Escala y desplazamiento de la variable (los archivos de NCEP los guardan empaquetados).
  const das = await (await get(`${PSL}/${path}.das`)).text();
  const block = new RegExp(`${varName} \\{([\\s\\S]*?)\\}`).exec(das)?.[1] ?? '';
  const scale = Number(/scale_factor\s+([-\d.eE]+)/.exec(block)?.[1] ?? 1), offset = Number(/add_offset\s+([-\d.eE]+)/.exec(block)?.[1] ?? 0);
  return vals.map((r) => r.map((row) => row.map((v) => v * scale + offset)));
}

const LEVELS = [1000, 925, 850, 700, 600, 500, 400, 300, 250, 200, 150, 100, 70, 50, 30, 20, 10];

async function windProfile(lon: number, lat: number, when: string | { month: number }) {
  // Grilla de 2,5°: latitudes de 90 a −90, longitudes de 0 a 357,5.
  const lon360 = (lon + 360) % 360, fj = (90 - lat) / 2.5, fi = lon360 / 2.5;
  const j0 = Math.floor(fj), i0 = Math.floor(fi), v = fj - j0, u = fi - i0;
  let t: number, files: [string, string, string];
  let label: string;
  if (typeof when === 'string') {
    const d = new Date(when), y = d.getUTCFullYear();
    t = Math.round((d.getTime() - Date.UTC(y, 0, 1)) / 216e5);
    files = [`ncep.reanalysis/pressure/uwnd.${y}.nc`, `ncep.reanalysis/pressure/vwnd.${y}.nc`, `ncep.reanalysis/pressure/hgt.${y}.nc`];
    label = new Date(Date.UTC(y, 0, 1) + t * 216e5).toISOString().slice(0, 13) + ':00Z';
  } else {
    t = when.month - 1;
    files = ['ncep.reanalysis.derived/pressure/uwnd.mon.ltm.1991-2020.nc', 'ncep.reanalysis.derived/pressure/vwnd.mon.ltm.1991-2020.nc', 'ncep.reanalysis.derived/pressure/hgt.mon.ltm.1991-2020.nc'];
    label = `mes ${when.month}, promedio 1991–2020`;
  }
  const [U, V, Hh] = await Promise.all([opendap(files[0], 'uwnd', t, j0, i0), opendap(files[1], 'vwnd', t, j0, i0), opendap(files[2], 'hgt', t, j0, i0)]);
  const bil = (g: number[][]) => g[0][0] * (1 - u) * (1 - v) + g[0][1] * u * (1 - v) + g[1][0] * (1 - u) * v + g[1][1] * u * v;
  const levels = LEVELS.map((p, k) => ({ p, h: Math.round(bil(Hh[k])), u: +bil(U[k]).toFixed(2), v: +bil(V[k]).toFixed(2) }));
  return { time: label, levels };
}

/** Viento promedio de cada mes (1991–2020) sobre el volcán: 12 perfiles. */
async function climatology(lon: number, lat: number) {
  const lon360 = (lon + 360) % 360, fj = (90 - lat) / 2.5, fi = lon360 / 2.5;
  const j0 = Math.floor(fj), i0 = Math.floor(fi), v = fj - j0, u = fi - i0;
  const base = 'ncep.reanalysis.derived/pressure/';
  const read = async (name: string) => {
    const path = `${base}${name}.mon.ltm.1991-2020.nc`;
    const q = `${name}%5B0:1:11%5D%5B0:1:16%5D%5B${j0}:1:${j0 + 1}%5D%5B${i0}:1:${i0 + 1}%5D`;
    const txt = await (await get(`${PSL}/${path}.ascii?${q}`)).text();
    const body = txt.split(/-{10,}/)[1] ?? '';
    const vals: number[][][][] = [];
    for (const line of body.split('\n')) {
      const m = /^\[(\d+)\]\[(\d+)\]\[(\d+)\],\s*(.+)$/.exec(line.trim());
      if (m) ((vals[+m[1]] ??= [])[+m[2]] ??= [])[+m[3]] = m[4].split(',').map(Number);
    }
    const das = await (await get(`${PSL}/${path}.das`)).text();
    const block = new RegExp(`${name} \\{([\\s\\S]*?)\\}`).exec(das)?.[1] ?? '';
    const scale = Number(/scale_factor\s+([-\d.eE]+)/.exec(block)?.[1] ?? 1), offset = Number(/add_offset\s+([-\d.eE]+)/.exec(block)?.[1] ?? 0);
    return vals.map((mo) => mo.map((r) => r.map((row) => row.map((x) => x * scale + offset))));
  };
  // De a una (PSL limita la cantidad de pedidos).
  const U = await read('uwnd'), V = await read('vwnd'), Hh = await read('hgt');
  const bil = (g: number[][]) => g[0][0] * (1 - u) * (1 - v) + g[0][1] * u * (1 - v) + g[1][0] * (1 - u) * v + g[1][1] * u * v;
  return U.map((_, mo) => LEVELS.map((p, k) => ({ p, h: Math.round(bil(Hh[mo][k])), u: +bil(U[mo][k]).toFixed(2), v: +bil(V[mo][k]).toFixed(2) })));
}

/* ───────────── Viento (ERA5, ARCO-ERA5 en Google Cloud) ───────────── */

const ERA5 = 'https://storage.googleapis.com/gcp-public-data-arco-era5/ar/1959-2022-6h-1440x721.zarr';
const ERA5_LEVELS = [50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 850, 925, 1000];
// numcodecs solo se publica como ES module: se carga con import() dinámico.
let blosc: { decode: (b: Uint8Array) => Promise<Uint8Array> } | null = null;
const era5Chunk = async (name: string, t: number) => {
  blosc ??= (await import('numcodecs')).Blosc.fromConfig({ id: 'blosc', cname: 'lz4', clevel: 5, shuffle: 1, blocksize: 0 } as never) as never;
  return new Float32Array((await blosc!.decode(new Uint8Array(await (await get(`${ERA5}/${name}/${t}.0.0.0`)).arrayBuffer()))).buffer);
};

/** Perfil de ERA5 a la hora (múltiplo de 6 h) más cercana; grilla de 0,25° (latitudes de 90 a −90, longitudes de 0 a 359,75). */
async function era5Profile(lon: number, lat: number, when: string) {
  const t = Math.round((Date.parse(when) - Date.UTC(1959, 0, 1)) / 216e5);
  const fj = (90 - lat) / 0.25, fi = ((lon + 360) % 360) / 0.25, j0 = Math.floor(fj), i0 = Math.floor(fi), v = fj - j0, u = fi - i0;
  const at = (a: Float32Array, k: number) => {
    const o = k * 721 * 1440, g = (j: number, i: number) => a[o + j * 1440 + (i % 1440)];
    return g(j0, i0) * (1 - u) * (1 - v) + g(j0, i0 + 1) * u * (1 - v) + g(j0 + 1, i0) * (1 - u) * v + g(j0 + 1, i0 + 1) * u * v;
  };
  const U = await era5Chunk('u_component_of_wind', t), V = await era5Chunk('v_component_of_wind', t), Z = await era5Chunk('geopotential', t);
  const levels = ERA5_LEVELS.map((p, k) => ({ p, h: Math.round(at(Z, k) / 9.80665), u: +at(U, k).toFixed(2), v: +at(V, k).toFixed(2) })).sort((a, b) => b.p - a.p);
  return { time: new Date(Date.UTC(1959, 0, 1) + t * 216e5).toISOString().slice(0, 13) + ':00Z', levels };
}

/* ───────────── Principal ───────────── */

async function main() {
  mkdirSync(join(OUT, 'winds'), { recursive: true });
  for (const v of VOLCANOES) {
    if (only && !only.includes(v.id)) continue;
    const dir = join(OUT, v.id);
    mkdirSync(dir, { recursive: true });
    const b = box(v);
    const d = await dem(v);
    writeFileSync(join(dir, 'dem.bin'), Buffer.from(d.out.buffer));
    let scene = null;
    if (!existsSync(join(dir, 'image.jpg')) || process.env.FORCE_IMAGE) {
      // La lectura de los COG a veces corta la conexión: hasta 3 intentos.
      let im: Awaited<ReturnType<typeof image>> | null = null;
      for (let k = 0; k < 3 && !im; k++) im = await image(v).catch((e) => { console.warn(v.id, 'imagen, intento', k + 1, String(e).slice(0, 80)); return null; });
      if (!im) throw new Error(v.id + ': no se pudo armar la imagen');
      writeFileSync(join(dir, 'image.jpg'), im.jpg);
      scene = im.scene;
    } else {
      scene = JSON.parse(await (await import('node:fs/promises')).readFile(join(dir, 'meta.json'), 'utf8')).scene;
    }
    const clim = await climatology(v.lon, v.lat);
    writeFileSync(join(dir, 'meta.json'), JSON.stringify({ id: v.id, box: b, n: N, image: IMG, maxElev: d.max, scene, climate: { source: 'NCEP/NCAR Reanalysis 1, promedio mensual 1991–2020 (NOAA PSL)', months: clim } }));
    console.log(v.id, `relieve: ${d.tiles} tiles, máx ${d.max} m (GVP ${v.elev} m)`, scene ? `imagen ${scene.scenes.map((x: { date: string; cloud: number }) => x.date + ' (' + x.cloud + '%)').join(', ')} sin datos ${scene.missing * 100}%` : '');
  }
  for (const e of ERUPTIONS) {
    if (only && !only.includes(e.volcano) && !only.includes(e.id)) continue;
    const v = VOLCANOES.find((x) => x.id === e.volcano)!;
    const phases = [];
    for (const p of e.phases) {
      // Hora de la mitad de la fase.
      const mid = new Date(Date.parse(p.start.replace(/^00(\d\d)/, '20$1')) + (p.hours * 36e5) / 2).toISOString();
      const y = new Date(mid).getUTCFullYear();
      phases.push(e.wind === 'reanalysis' && y >= 1959 && y <= 2022 ? await era5Profile(v.lon, v.lat, mid) : await windProfile(v.lon, v.lat, e.wind === 'reanalysis' ? mid : e.wind));
    }
    writeFileSync(join(OUT, 'winds', `${e.id}.json`), JSON.stringify({ id: e.id, source: e.wind === 'reanalysis' ? 'ERA5 (Copernicus/ECMWF), copia ARCO-ERA5 de Google' : 'NCEP/NCAR Reanalysis 1, promedio mensual 1991–2020 (NOAA PSL)', phases }, null, 1));
    console.log(e.id, phases.map((ph) => `${ph.time}: ${ph.levels.filter((l) => [850, 500, 250, 100].includes(l.p)).map((l) => `${l.p} hPa ${(l.h / 1000).toFixed(1)} km ${Math.hypot(l.u, l.v).toFixed(0)} m/s hacia ${(((Math.atan2(l.u, l.v) * 180) / Math.PI + 360) % 360).toFixed(0)}°`).join(' · ')}`).join('\n   '));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
