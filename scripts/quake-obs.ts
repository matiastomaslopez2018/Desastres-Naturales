/*
 * Observaciones reales de cada sismo del simulador, desde la ShakeMap oficial del USGS:
 *   - estaciones sísmicas: PGA y PGV registradas, Vs30 del sitio y distancias a la ruptura real;
 *   - intensidades observadas ("Did You Feel It?" o históricas, según el sismo);
 *   - contornos oficiales de intensidad y la ruptura usada por la ShakeMap.
 * Se guardan resumidas en public/data/quake-obs/<sismo>.json para no depender del USGS al usar la página.
 *   npm run quake-obs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mesh } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import world from 'world-atlas/countries-50m.json';
import { PRESETS } from '../src/lib/quake/presets';

/** Costas y fronteras (Natural Earth 1:50M vía world-atlas) como líneas. */
const COAST = (mesh(world as unknown as Topology, (world as unknown as Topology).objects.countries as never) as unknown as { coordinates: number[][][] }).coordinates;

/** Tramos de las líneas dentro de la caja [oeste, sur, este, norte] (con un punto de margen a cada lado). */
function clip(ls: number[][][], [w, s, e, n]: number[]) {
  const inside = (p: number[]) => p[0] >= w && p[0] <= e && p[1] >= s && p[1] <= n;
  const out: number[][][] = [];
  for (const l of ls) {
    let cur: number[][] = [];
    l.forEach((p, i) => {
      if (inside(p) || (l[i - 1] && inside(l[i - 1])) || (l[i + 1] && inside(l[i + 1]))) cur.push(p);
      else if (cur.length) { out.push(cur); cur = []; }
    });
    if (cur.length > 1) out.push(cur);
  }
  return out;
}

const OUT = join(process.cwd(), 'public', 'data', 'quake-obs');

async function json<T = unknown>(url: string): Promise<T> {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'Accept-Encoding': 'gzip' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as T;
    } catch (e) {
      if (i === 3) throw new Error(`${url}: ${e}`);
      await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
    }
  }
  throw new Error('inalcanzable');
}

type Feature = { geometry: { type: string; coordinates: unknown } | null; properties: Record<string, unknown> };
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v !== 'null' && Number.isFinite(+v) ? +v : null);

/** Simplifica una línea: descarta puntos a menos de `tol` grados del anterior conservado. */
function simplify(line: number[][], tol = 0.01) {
  const out: number[][] = [];
  for (const p of line) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) >= tol) out.push([r3(p[0]), r3(p[1])]);
  }
  const last = line[line.length - 1];
  if (out.length && (out[out.length - 1][0] !== r3(last[0]) || out[out.length - 1][1] !== r3(last[1]))) out.push([r3(last[0]), r3(last[1])]);
  return out;
}
/** Todas las líneas (anillos) de una geometría GeoJSON. */
function lines(g: Feature['geometry']): number[][][] {
  if (!g) return [];
  const c = g.coordinates as never;
  switch (g.type) {
    case 'LineString': return [c];
    case 'MultiLineString': case 'Polygon': return c;
    case 'MultiPolygon': return (c as number[][][][]).flat();
    default: return [];
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const p of PRESETS) {
    const ev = await json<{ properties: { products: Record<string, { code: string; source: string; updateTime: number; contents: Record<string, { url: string }> }[]> } }>(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=${p.usgs}&format=geojson`);
    const sm = ev.properties.products.shakemap?.[0];
    if (!sm) { console.log(`${p.id}: sin ShakeMap`); continue; }
    const file = (name: string) => sm.contents[`download/${name}`]?.url;

    const stations: number[][] = [], felt: number[][] = [];
    if (file('stationlist.json')) {
      const st = await json<{ features: Feature[] }>(file('stationlist.json')!);
      for (const f of st.features) {
        const q = f.properties, d = (q.distances ?? {}) as Record<string, number>;
        const [lon, lat] = (f.geometry?.coordinates ?? [NaN, NaN]) as number[];
        const rrup = num(d.rrup) ?? num(q.distance);
        if (rrup == null) continue;
        if (q.station_type === 'seismic') {
          const pga = num(q.pga), pgv = num(q.pgv), vs30 = num(q.vs30);
          // [Rrup, Rjb, Rhypo, Vs30, PGA (g), PGV (cm/s)]
          if (pga != null && pga > 0) stations.push([r3(rrup), r3(num(d.rjb) ?? rrup), r3(num(d.rhypo) ?? rrup), Math.round(vs30 ?? 760), +(pga / 100).toPrecision(4), pgv != null ? +pgv.toPrecision(4) : -1]);
        } else {
          const mmi = num(q.intensity);
          // [Rrup, intensidad observada, respuestas, lon, lat]
          if (mmi != null) felt.push([r3(rrup), +mmi.toFixed(1), num(q.nresp) ?? 1, r3(lon), r3(lat)]);
        }
      }
    }
    const contours: { mmi: number; color: string; lines: number[][][] }[] = [];
    if (file('cont_mmi.json')) {
      const c = await json<{ features: Feature[] }>(file('cont_mmi.json')!);
      for (const f of c.features) {
        const ls = lines(f.geometry).map((l) => simplify(l)).filter((l) => l.length > 1);
        if (ls.length) contours.push({ mmi: Number(f.properties.value), color: String(f.properties.color), lines: ls });
      }
    }
    let rupture: number[][][] = [];
    if (file('rupture.json')) {
      const r = await json<{ features: Feature[] }>(file('rupture.json')!);
      rupture = r.features.flatMap((f) => lines(f.geometry)).map((l) => simplify(l, 0.002)).filter((l) => l.length > 1);
    }
    // Caja del mapa: contornos, epicentro y ciudad, con margen.
    const pts = [...contours.flatMap((c) => c.lines.flat()), p.epi, p.site];
    const lons = pts.map((q) => q[0]), lats = pts.map((q) => q[1]);
    const pad = Math.max(0.3, (Math.max(...lons) - Math.min(...lons)) * 0.08);
    const bbox = [Math.min(...lons) - pad, Math.min(...lats) - pad, Math.max(...lons) + pad, Math.max(...lats) + pad].map(r3);
    const coast = clip(COAST, bbox).map((l) => simplify(l, 0.01)).filter((l) => l.length > 1);
    const out = {
      id: p.id, usgs: p.usgs, bbox, coast,
      shakemap: { source: sm.source, updated: sm.updateTime, url: `https://earthquake.usgs.gov/earthquakes/eventpage/${p.usgs}/shakemap` },
      stations, felt: felt.slice(0, 4000), contours, rupture,
    };
    writeFileSync(join(OUT, `${p.id}.json`), JSON.stringify(out));
    console.log(`${p.id}: ${stations.length} estaciones, ${felt.length} intensidades, ${contours.length} contornos, ruptura ${rupture.length ? 'sí' : 'no'} · ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
  }
}
main();
