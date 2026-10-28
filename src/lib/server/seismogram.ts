import 'server-only';
import { geoDistance } from 'd3-geo';
import { kvGet, kvSet } from './db';
import { readMiniseed } from './miniseed';
import { firstArrival } from '../quake/waves';

/*
 * Sismograma real de un sismo: la componente vertical (BHZ) de la estación de banda ancha más cercana de las
 * redes globales y regionales abiertas que reparte EarthScope (servicios FDSN): GSN (IU, II), GEOSCOPE (G),
 * GTSN (GT), la red del Caribe (CU), la china (IC), la de EE. UU. (US) y la red sismológica nacional de Chile (C1).
 * Hasta 25° (~2.800 km), que es hasta donde llega el modelo ak135 del simulador para marcar las llegadas P y S.
 * La señal se pasa a velocidad del suelo con la sensibilidad del instrumento (aproximada: sin la respuesta completa)
 * y se le saca la deriva lenta.
 */

const FDSN = 'https://service.earthscope.org/fdsnws';
const NETS = 'IU,II,G,GT,CU,IC,US,C1';
const UA = 'MapaDeDesastres/1.0 (+https://desastres-naturales-rho.vercel.app)';

export type Seismogram = {
  net: string; sta: string; loc: string; cha: string; site: string; lat: number; lon: number; distKm: number;
  /** Inicio de la señal (ms, UTC) y muestras por segundo. */
  start: number; sps: number;
  /** Velocidad máxima (m/s) y muestras normalizadas a ±32767, en base64 (Int16, little-endian). */
  peak: number; data: string;
  /** Llegadas calculadas (s desde el origen): P, S y, en sismos someros, ondas superficiales (~3,5 km/s). */
  p: number; s: number; surface: number | null;
};

type Chan = { net: string; sta: string; loc: string; cha: string; lat: number; lon: number; scale: number; sps: number; km: number };

async function text(url: string) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store', signal: AbortSignal.timeout(30000) });
  if (r.status === 204) return '';
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
}

async function stations(lat: number, lon: number, time: number): Promise<Chan[]> {
  const d = new Date(time).toISOString().slice(0, 19);
  const t = await text(`${FDSN}/station/1/query?network=${NETS}&channel=BHZ&level=channel&format=text&latitude=${lat}&longitude=${lon}&maxradius=25&starttime=${d}&endtime=${d}`);
  const out: Chan[] = [];
  for (const line of t.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const c = line.split('|');
    const la = +c[4], lo = +c[5], scale = +c[11], sps = +c[14];
    if (!Number.isFinite(la) || !(scale > 0) || !(sps >= 10 && sps <= 50)) continue;
    out.push({ net: c[0], sta: c[1], loc: c[2], cha: c[3], lat: la, lon: lo, scale, sps, km: geoDistance([lon, lat], [lo, la]) * 6371 });
  }
  // Una por estación (la ubicación 00 si hay varias) y de la más cercana a la más lejana.
  const best = new Map<string, Chan>();
  for (const c of out) { const k = `${c.net}.${c.sta}`, b = best.get(k); if (!b || (c.loc === '00' && b.loc !== '00')) best.set(k, c); }
  return [...best.values()].sort((a, b) => a.km - b.km);
}

async function siteName(c: Chan) {
  const t = await text(`${FDSN}/station/1/query?network=${c.net}&station=${c.sta}&level=station&format=text`).catch(() => '');
  const line = t.split('\n').find((l) => l && !l.startsWith('#'));
  return line?.split('|')[5]?.trim() ?? '';
}

function encode(v: Float64Array) {
  let peak = 0;
  for (const x of v) if (Math.abs(x) > peak) peak = Math.abs(x);
  const q = new Int16Array(v.length);
  for (let i = 0; i < v.length; i++) q[i] = Math.round((v[i] / (peak || 1)) * 32767);
  return { peak, data: Buffer.from(q.buffer).toString('base64') };
}

async function load(e: { lat: number; lon: number; time: number; depth: number }): Promise<Seismogram | null> {
  const list = (await stations(e.lat, e.lon, e.time)).slice(0, 6);
  for (const c of list) {
    const p = firstArrival('P', e.depth, c.km).t, s = firstArrival('S', e.depth, c.km).t;
    const surface = e.depth <= 70 ? c.km / 3.5 : null;
    // Desde 30 s antes del origen hasta que pasan las ondas superficiales (o la S) y un poco de coda.
    const end = Math.min(1800, Math.max(180, (surface ?? s) * 1.25 + 120));
    const t0 = new Date(e.time - 30_000).toISOString().slice(0, 23), t1 = new Date(e.time + end * 1000).toISOString().slice(0, 23);
    const r = await fetch(`${FDSN}/dataselect/1/query?network=${c.net}&station=${c.sta}&location=${c.loc || '--'}&channel=${c.cha}&starttime=${t0}&endtime=${t1}`,
      { headers: { 'User-Agent': UA }, cache: 'no-store', signal: AbortSignal.timeout(45000) }).catch(() => null);
    if (!r || r.status !== 200) continue;
    const tr = readMiniseed(await r.arrayBuffer());
    // Al menos el 80 % de la ventana pedida.
    if (!tr || tr.samples.length < tr.sps * (end + 30) * 0.8) continue;
    // Cuentas → m/s, sin la media; filtro pasa-altos de un polo a 0,01 Hz para la deriva lenta.
    const n = tr.samples.length, v = new Float64Array(n);
    let mean = 0;
    for (const x of tr.samples) mean += x / n;
    const dt = 1 / tr.sps, rc = 1 / (2 * Math.PI * 0.01), a = rc / (rc + dt);
    let prevX = (tr.samples[0] - mean) / c.scale, prevY = 0;
    for (let i = 0; i < n; i++) {
      const x = (tr.samples[i] - mean) / c.scale, y = a * (prevY + x - prevX);
      v[i] = y; prevX = x; prevY = y;
    }
    // 40 sps → 20 sps (promedio de a pares): alcanza para ver y escuchar, y pesa la mitad.
    const k = Math.max(1, Math.round(tr.sps / 20)), m = Math.floor(n / k), w = new Float64Array(m);
    for (let i = 0; i < m; i++) { let sum = 0; for (let j = 0; j < k; j++) sum += v[i * k + j]; w[i] = sum / k; }
    return { net: c.net, sta: c.sta, loc: c.loc, cha: c.cha, site: await siteName(c), lat: c.lat, lon: c.lon, distKm: Math.round(c.km), start: tr.start, sps: tr.sps / k, ...encode(w), p, s, surface };
  }
  return null;
}

/**
 * Sismograma del sismo (guardado una vez encontrado; si todavía no hay datos, se reintenta en la próxima consulta:
 * las estaciones tardan minutos en publicarlos).
 */
export async function getSeismogram(id: string, e: { lat: number; lon: number; time: number; depth: number }) {
  const key = `seis:v1:${id}`;
  const hit = await kvGet<Seismogram | null>(key).catch(() => null);
  if (hit && (hit.value || Date.now() - hit.updatedAt < 6 * 3600_000)) return hit.value;
  const v = await load(e);
  // Si no hay datos y el sismo es viejo, se recuerda unas horas para no repetir la búsqueda.
  if (v || Date.now() - e.time > 2 * 864e5) await kvSet(key, v).catch(() => {});
  return v;
}
