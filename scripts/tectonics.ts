/**
 * Datos tectónicos para "Contexto geológico" y las capas del mapa (se corre una vez):
 *
 *  - PB2002 (Bird, 2003; versión GeoJSON de Ahlenius/Nordpil, licencia ODC-By 1.0):
 *      src/data/pb2002_plates.json  polígonos de las 52 placas, simplificados
 *      src/data/pb2002_steps.json   tramos del borde: [lon1,lat1,lon2,lat2,clase,placaA,placaB]
 *  - Slab2 (Hayes et al., 2018; USGS, dominio público): curvas de profundidad de las losas
 *    cada 20 km, del servicio earthquake.usgs.gov/arcgis/rest/services/eq/slab2_depth:
 *      src/data/slab2.json y public/data/slab2.json  [región, profundidad km, [[lon,lat],…]]
 *
 *   npm run tectonics
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const FRAXEN = 'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON';
const SLAB2 = 'https://earthquake.usgs.gov/arcgis/rest/services/eq/slab2_depth/MapServer/0';

const get = async <T>(url: string): Promise<T> => {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return (await r.json()) as T;
    } catch (err) {
      if (i >= 3) throw err;
      await new Promise((ok) => setTimeout(ok, 1500 * (i + 1)));
    }
  }
};
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Descarta puntos a menos de `tol` grados del anterior (curvas más livianas). */
function thin(line: number[][], tol: number) {
  const out: number[][] = [];
  for (const p of line) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) >= tol) out.push([r2(p[0]), r2(p[1])]);
  }
  const last = line[line.length - 1];
  if (out.length && (out[out.length - 1][0] !== r2(last[0]) || out[out.length - 1][1] !== r2(last[1]))) out.push([r2(last[0]), r2(last[1])]);
  return out;
}

type Geo = { type: string; coordinates: unknown };
async function plates() {
  const j = await get<{ features: { properties: { Code: string; PlateName: string }; geometry: Geo }[] }>(`${FRAXEN}/PB2002_plates.json`);
  const features = j.features.map((f) => {
    const g = f.geometry;
    const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as number[][][][];
    return {
      type: 'Feature', properties: { code: f.properties.Code, name: f.properties.PlateName },
      geometry: { type: 'MultiPolygon', coordinates: polys.map((poly) => poly.map((ring) => thin(ring, 0.05))) },
    };
  });
  writeFileSync('src/data/pb2002_plates.json', JSON.stringify({ type: 'FeatureCollection', features }));
  console.log(`placas: ${features.length}`);
}

async function steps() {
  const j = await get<{ features: { properties: { STARTLONG: number; STARTLAT: number; FINALLONG: number; FINALLAT: number; PLATEBOUND: string; STEPCLASS: string } }[] }>(`${FRAXEN}/PB2002_steps.json`);
  const out = j.features.map(({ properties: p }) => {
    const [a, b] = p.PLATEBOUND.split(/[-\\/]/);
    return [r2(p.STARTLONG), r2(p.STARTLAT), r2(p.FINALLONG), r2(p.FINALLAT), p.STEPCLASS, a, b, p.PLATEBOUND.includes('\\') ? '\\' : p.PLATEBOUND.includes('/') ? '/' : '-'];
  });
  writeFileSync('src/data/pb2002_steps.json', JSON.stringify(out));
  console.log(`tramos: ${out.length}`);
}

async function slab2() {
  const { objectIds } = await get<{ objectIds: number[] }>(`${SLAB2}/query?where=1%3D1&returnIdsOnly=true&f=json`);
  const out: [string, number, number[][][]][] = [];
  // El servicio devuelve un objeto por consulta: se piden de a 6 en paralelo.
  for (let i = 0; i < objectIds.length; i += 6) {
    const batch = await Promise.all(objectIds.slice(i, i + 6).map((id) =>
      get<{ features: { properties: { depth: number; region: string }; geometry: Geo }[] }>(
        `${SLAB2}/query?objectIds=${id}&outFields=depth,region&maxAllowableOffset=0.02&f=geojson`)));
    for (const j of batch) {
      const f = j.features[0];
      if (!f?.geometry) continue;
      const lines = (f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][];
      out.push([f.properties.region, f.properties.depth, lines.map((l) => thin(l, 0.04)).filter((l) => l.length > 1)]);
    }
    if (i % 120 === 0) console.log(`slab2 ${i}/${objectIds.length}`);
  }
  const json = JSON.stringify(out);
  writeFileSync('src/data/slab2.json', json);
  writeFileSync('public/data/slab2.json', json);
  console.log(`slab2: ${out.length} curvas`);
}

(async () => {
  mkdirSync('src/data', { recursive: true });
  await plates();
  await steps();
  await slab2();
})().catch((err) => { console.error(err); process.exit(1); });
