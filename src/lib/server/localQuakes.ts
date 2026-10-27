import 'server-only';
import { geoDistance } from 'd3-geo';
import { kvGet, kvSet, tryLock, unlock, upsertLocalQuakes } from './db';
import { withCountry } from './countries';
import type { DisasterEvent, LocalReport } from '../types';

/*
 * Sismos de los organismos sismológicos nacionales:
 *   - INPRES (Instituto Nacional de Prevención Sísmica, Argentina): los últimos 30 sismos que publica en
 *     https://www.inpres.gob.ar/mapa/sismos.xml (la fuente XML que ofrece en su página "Fuentes de datos
 *     alternativas"). Azul: automático; negro: revisado por un sismólogo; rojo: sentido y revisado.
 *   - CSN (Centro Sismológico Nacional, Universidad de Chile): el catálogo de cada día en
 *     https://www.sismologia.cl/sismicidad/catalogo/AAAA/MM/AAAAMMDD.html. Su política permite usar los datos
 *     con fines de divulgación citando "Centro Sismológico Nacional de la Universidad de Chile".
 * Se guardan en la tabla local_quakes (src INPRES / CSN). Al leer, si el USGS tiene el mismo sismo,
 * el dato local se suma a ese evento (campo `local`) en vez de mostrar dos puntos.
 */

const UA = 'Mozilla/5.0 (compatible; MapaDeDesastres/1.0; +https://desastres-naturales-rho.vercel.app)';
const KM = 6371;
const title = (s: string) => s.toLowerCase().replace(/(^|[\s(-])\p{L}/gu, (c) => c.toUpperCase()).replace(/(?<=\s)(De|Del|La|Las|Los|Y)\b/g, (w) => w.toLowerCase());

async function text(url: string, timeout = 20000) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store', signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
}

/* ───────────── INPRES ───────────── */

export async function fetchInpres(): Promise<DisasterEvent[]> {
  const xml = await text('https://www.inpres.gob.ar/mapa/sismos.xml');
  const out: DisasterEvent[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const tag = (k: string) => new RegExp(`<${k}>([^<]*)</${k}>`).exec(m[1])?.[1]?.trim() ?? '';
    const id = tag('idSismo'), lat = Number(tag('latitud')), lon = Number(tag('longitud'));
    // El id es la hora de origen en UTC: AAAAMMDDhhmmss.
    const t = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(id);
    if (!t || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const color = tag('color_link').toLowerCase(), prov = title(tag('prov'));
    const mag = Number(tag('mg'));
    out.push(withCountry({
      id: `inpres-${id}`, type: 'eq', src: 'INPRES', lon, lat, depth: Number(tag('prof')) || undefined,
      time: Date.UTC(+t[1], +t[2] - 1, +t[3], +t[4], +t[5], +t[6]), mag: Number.isFinite(mag) ? mag : null,
      status: color === '00f' ? 'automatic' : 'reviewed', felt: null, net: 'INPRES',
      title: prov ? `${prov}, Argentina` : 'Argentina', url: `https://www.inpres.gob.ar/desktop/epicentro1.php?s=${id}`,
      local: [{ agency: 'INPRES', id, mag: Number.isFinite(mag) ? mag : null, depth: Number(tag('prof')) || undefined, felt: color === 'f00', reviewed: color !== '00f', place: prov, url: `https://www.inpres.gob.ar/desktop/epicentro1.php?s=${id}` }],
    }));
  }
  return out;
}

/* ───────────── CSN ───────────── */

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

export async function fetchCsnDay(day: Date): Promise<DisasterEvent[]> {
  const s = ymd(day), html = await text(`https://www.sismologia.cl/sismicidad/catalogo/${s.slice(0, 4)}/${s.slice(4, 6)}/${s}.html`);
  const out: DisasterEvent[] = [];
  const row = /<a href="(\/sismicidad\/informes\/\d{4}\/\d{2}\/(\d+)\.html)">[^<]*<\/a><br>([^<]*)<\/td>\s*<td>(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})<\/td>\s*<td>(-?[\d.]+)<br>\s*(-?[\d.]+)<\/td>\s*<td>([\d.]+) km<\/td>\s*<td class="magnitud">([\d.]+)\s*([A-Za-z]*)<\/td>/g;
  for (const m of html.matchAll(row)) {
    const [, path, id, place, y, mo, d, h, mi, se, la, lo, depth, mag, magType] = m;
    const url = `https://www.sismologia.cl${path}`;
    out.push(withCountry({
      id: `csn-${id}`, type: 'eq', src: 'CSN', lon: Number(lo), lat: Number(la), depth: Number(depth),
      time: Date.UTC(+y, +mo - 1, +d, +h, +mi, +se), mag: Number(mag), magType: magType || undefined, status: 'reviewed', felt: null, net: 'CSN',
      title: place.trim(), url,
      local: [{ agency: 'CSN', id, mag: Number(mag), magType: magType || undefined, depth: Number(depth), place: place.trim(), url }],
    }));
  }
  return out;
}

/* ───────────── Ingesta ───────────── */

const DAYS_BACK = 30;

/**
 * Trae lo nuevo de INPRES y del CSN (como mucho cada 5 minutos). Del CSN se piden hoy y ayer en cada pasada,
 * y de a 3 días hacia atrás los que falten hasta completar 30 días (los días pasados ya no cambian).
 */
export async function refreshLocal(): Promise<void> {
  const last = await kvGet<number>('local:lastRun').catch(() => null);
  if (last && Date.now() - last.value < 5 * 6e4) return;
  if (!(await tryLock('local:lock', 60_000))) return;
  try {
    await kvSet('local:lastRun', Date.now());
    const done = new Set((await kvGet<string[]>('local:csnDays').catch(() => null))?.value ?? []);
    const today = new Date(), days: Date[] = [];
    for (let k = 0; k < DAYS_BACK; k++) days.push(new Date(+today - k * 864e5));
    const recent = days.slice(0, 2), older = days.slice(2).filter((d) => !done.has(ymd(d))).slice(0, 3);
    const results = await Promise.allSettled([fetchInpres(), ...[...recent, ...older].map((d) => fetchCsnDay(d))]);
    const events = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    results.forEach((r) => { if (r.status === 'rejected') console.warn('[local]', String(r.reason).slice(0, 160)); });
    if (events.length) await upsertLocalQuakes(events);
    // Días completos del CSN (todos menos hoy y ayer) que ya se guardaron bien.
    older.forEach((d, i) => { if (results[1 + recent.length + i].status === 'fulfilled') done.add(ymd(d)); });
    const keep = new Set(days.map(ymd));
    await kvSet('local:csnDays', [...done].filter((x) => keep.has(x)));
  } finally {
    await unlock('local:lock').catch(() => {});
  }
}

/* ───────────── Unión con el USGS ───────────── */

const near = (a: DisasterEvent, b: DisasterEvent) =>
  Math.abs(a.time - b.time) <= 90_000 && geoDistance([a.lon, a.lat], [b.lon, b.lat]) * KM <= 120 && (a.mag == null || b.mag == null || Math.abs(a.mag - b.mag) < 1.2);

/**
 * Un mismo sismo informado por el USGS y por INPRES o el CSN se muestra una sola vez: el del USGS con el dato
 * local adentro. Entre INPRES y CSN queda el del país donde ocurrió (el otro se suma como dato local).
 */
export function mergeLocal(rows: DisasterEvent[]): DisasterEvent[] {
  const local = rows.filter((e) => e.src === 'INPRES' || e.src === 'CSN');
  if (!local.length) return rows;
  const usgs = rows.filter((e) => e.src === 'USGS' && e.type === 'eq');
  const out = rows.filter((e) => e.src !== 'INPRES' && e.src !== 'CSN').map((e) => (e.local ? { ...e, local: [...e.local] } : e));
  const byId = new Map(out.map((e) => [e.id, e]));
  const kept: DisasterEvent[] = [];
  // Primero el del país del sismo (INPRES en la Argentina, CSN en el resto), así queda ese y el otro se le suma.
  const home = (e: DisasterEvent) => (e.src === (e.iso3 === 'ARG' ? 'INPRES' : 'CSN') ? 0 : 1);
  for (const l of local.slice().sort((a, b) => home(a) - home(b))) {
    const rep: LocalReport[] = l.local ?? [];
    const u = usgs.find((x) => near(x, l));
    if (u) { const t = byId.get(u.id)!; t.local = [...(t.local ?? []).filter((r) => r.agency !== rep[0]?.agency), ...rep]; continue; }
    const k = kept.find((x) => x.src !== l.src && near(x, l));
    if (k) { k.local = [...(k.local ?? []), ...rep]; continue; }
    kept.push({ ...l, local: [...rep] });
  }
  return [...out, ...kept];
}
