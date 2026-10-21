/*
 * Datos de cada tsunami del simulador:
 *   - fuente: subfallas del modelo de falla finita del USGS (archivo .fsp) o falla uniforme escalada;
 *   - observaciones de la base mundial de tsunamis de la NOAA (NCEI, HazEL): mareógrafos y boyas DART con
 *     su hora de llegada y altura, y alturas de inundación relevadas en la costa.
 * Se guardan en public/data/tsunami/<id>.json.
 *   npm run tsunami-data
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TSUNAMI_PRESETS, type TsunamiPreset } from '../src/lib/tsunami/presets';

const OUT = join(process.cwd(), 'public', 'data', 'tsunami');
const NCEI = 'https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/tsunamis';

async function get<T>(url: string, type: 'json' | 'text' = 'json'): Promise<T> {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (type === 'json' ? await r.json() : await r.text()) as T;
    } catch (e) {
      if (i === 4) throw new Error(`${url}: ${e}`);
      await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
    }
  }
  throw new Error('inalcanzable');
}

/** Subfallas del .fsp: [lon, lat, profundidad del centro km, largo km, ancho km, rumbo, buzamiento, rake, deslizamiento m]. */
function parseFsp(text: string) {
  const lines = text.split(/\r?\n/);
  const gDx = Number(/Dx\s*=\s*([\d.]+)/.exec(text)?.[1]);
  const out: number[][] = [];
  let seg: { strike: number; dip: number; len: number; wid: number; dx: number; n: number; rows: number[][] } | null = null;
  const flush = () => {
    if (!seg) return;
    const along = Math.max(1, Math.round(seg.len / seg.dx)), nz = Math.max(1, Math.round(seg.n / along)), dz = seg.wid / nz;
    for (const r of seg.rows) out.push([r[1], r[0], r[4], seg.dx, dz, seg.strike, seg.dip, r[6], r[5]]);
  };
  // Modelos de un solo segmento sin encabezado SEGMENT: rumbo y buzamiento de la línea Mech, tamaño de Size.
  if (!/SEGMENT\s*#/.test(text)) {
    const mech = /STRK\s*=\s*([\d.-]+)\s*DIP\s*=\s*([\d.-]+)/.exec(text), size = /LEN\s*=\s*([\d.]+)\s*km\s*WID\s*=\s*([\d.]+)/.exec(text), n = /Nsbfs\s*=\s*(\d+)/.exec(text);
    if (mech && size && n) seg = { strike: +mech[1], dip: +mech[2], len: +size[1], wid: +size[2], dx: gDx, n: +n[1], rows: [] };
  }
  for (const l of lines) {
    let m;
    if ((m = /SEGMENT\s*#\s*\d+:\s*STRIKE\s*=\s*([\d.-]+)\s*deg\s*DIP\s*=\s*([\d.-]+)/.exec(l))) { flush(); seg = { strike: +m[1], dip: +m[2], len: 0, wid: 0, dx: gDx, n: 0, rows: [] }; continue; }
    if (!seg) continue;
    if ((m = /^%\s*LEN\s*=\s*([\d.]+)\s*km\s*WID\s*=\s*([\d.]+)/.exec(l))) { seg.len = +m[1]; seg.wid = +m[2]; continue; }
    if ((m = /^%\s*Dx\s*=\s*([\d.]+)/.exec(l))) { seg.dx = +m[1]; continue; }
    if ((m = /Nsbfs\s*=\s*(\d+)/.exec(l))) { seg.n = +m[1]; continue; }
    if (!l.startsWith('%') && l.trim()) {
      const v = l.trim().split(/\s+/).map(Number);
      if (v.length >= 7 && v.every(Number.isFinite)) seg.rows.push(v);
    }
  }
  flush();
  return out;
}

/** Falla uniforme con largo y ancho de Strasser et al. (2010) y deslizamiento del momento (μ = 3·10¹⁰ Pa). */
function uniformFault(p: TsunamiPreset) {
  const u = p.uniform!;
  const L = 10 ** (-2.477 + 0.585 * p.mag), W = 10 ** (-0.882 + 0.351 * p.mag);
  const m0 = 10 ** (1.5 * p.mag + 9.1), slip = m0 / (3e10 * L * W * 1e6);
  // Profundidad del centro a partir del borde superior: así la falla no sale por encima del fondo marino.
  const centroid = u.topKm + (W / 2) * Math.sin((u.dip * Math.PI) / 180);
  return [[u.lon, u.lat, centroid, L, W, u.strike, u.dip, u.rake, slip]];
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const p of TSUNAMI_PRESETS) {
    // Fuente.
    let faults: number[][], source: string;
    const ev = await get<{ properties: { products: Record<string, { contents: Record<string, { url: string }> }[]> } }>(`https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=${p.usgs}&format=geojson`);
    const ff = ev.properties.products['finite-fault']?.[0];
    if (ff && !p.uniform) {
      faults = parseFsp(await get<string>(ff.contents['complete_inversion.fsp'].url, 'text'));
      source = 'usgs-ffm';
    } else { faults = uniformFault(p); source = 'uniform'; }

    // Evento de la NOAA (mismo día y magnitud parecida) y sus observaciones.
    const evs = await get<{ items: { id: number; month: number; day: number; eqMagnitude: number; deathsTotal?: number; maxWaterHeight?: number }[] }>(`${NCEI}/events?minYear=${p.year}&maxYear=${p.year}&minEqMagnitude=${p.mag - 0.4}`);
    const ncei = evs.items.find((e) => e.month === p.month && e.day === p.day);
    if (!ncei) throw new Error(`${p.id}: sin evento NCEI`);
    type Run = { latitude?: number; longitude?: number; typeMeasurementId?: number; travHours?: number; travMins?: number; runupHt?: number; maxWaterHeight?: number; firstMotion?: string; locationName?: string; country?: string; doubtful?: string };
    const runs: Run[] = [];
    for (let page = 1; ; page++) {
      const r = await get<{ items: Run[]; totalPages: number }>(`${NCEI}/runups?tsunamiEventId=${ncei.id}&page=${page}`);
      runs.push(...r.items);
      if (page >= r.totalPages) break;
    }
    const h = (r: Run) => r.runupHt ?? r.maxWaterHeight ?? null;
    // Mareógrafos (2) y boyas de fondo DART (3): [lon, lat, minutos de viaje o -1, altura m o -1, tipo, primer movimiento (1 sube, -1 baja, 0 ?), nombre]
    const gauges = runs.filter((r) => (r.typeMeasurementId === 2 || r.typeMeasurementId === 3) && r.latitude != null && r.longitude != null && r.doubtful !== 'y')
      .map((r) => [+r.longitude!.toFixed(3), +r.latitude!.toFixed(3), r.travHours != null ? r.travHours * 60 + (r.travMins ?? 0) : -1, h(r) ?? -1, r.typeMeasurementId, r.firstMotion === 'R' ? -1 : r.firstMotion === 'E' ? 1 : 0, `${r.locationName ?? ''}${r.country ? `, ${r.country}` : ''}`]);
    // Alturas relevadas en la costa (testigos y relevamientos posteriores): [lon, lat, altura m]
    const runups = runs.filter((r) => r.typeMeasurementId !== 2 && r.typeMeasurementId !== 3 && r.latitude != null && r.longitude != null && h(r) != null && r.doubtful !== 'y')
      .map((r) => [+r.longitude!.toFixed(3), +r.latitude!.toFixed(3), +h(r)!.toFixed(2)]);
    const out = { id: p.id, usgs: p.usgs, ncei: ncei.id, source, faults: faults.map((f) => f.map((v) => +v.toFixed(4))), gauges, runups: runups.slice(0, 3000), deaths: ncei.deathsTotal ?? null, maxWaterHeight: ncei.maxWaterHeight ?? null };
    writeFileSync(join(OUT, `${p.id}.json`), JSON.stringify(out));
    const withT = gauges.filter((g) => (g[2] as number) >= 0).length, dart = gauges.filter((g) => g[4] === 3).length;
    console.log(`${p.id}: ${source} ${faults.length} subfallas · NCEI ${ncei.id}: ${gauges.length} mareógrafos/DART (${withT} con hora, ${dart} DART), ${runups.length} alturas en costa · muertes ${ncei.deathsTotal ?? '?'} · altura máx ${ncei.maxWaterHeight ?? '?'} m · ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
  }
}
main();
