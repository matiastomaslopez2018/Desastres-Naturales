/**
 * Flechas de movimiento de placas para el mapa: velocidad de cada placa en el marco sin
 * rotación neta (NNR-MORVEL56, Argus et al., 2011) en una grilla de 10° (y 5° en placas
 * chicas), dentro de los polígonos de PB2002.
 *   public/data/plate_vectors.json  [lon, lat, vEste mm/año, vNorte mm/año, código][]
 *
 *   npm run plate-vectors   (después de npm run tectonics)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { geoArea, geoContains } from 'd3-geo';
import { NNR_MORVEL56, morvelCode } from '../src/lib/morvel';

type F = { properties: { code: string }; geometry: GeoJSON.MultiPolygon };
const plates = (JSON.parse(readFileSync('src/data/pb2002_plates.json', 'utf8')) as { features: F[] }).features;
const RAD = Math.PI / 180;

function velocity(code: string, lon: number, lat: number) {
  const m = morvelCode(code);
  if (!m) return null;
  const [plat, plon, w] = NNR_MORVEL56[m];
  const k = w * RAD;
  const W = [k * Math.cos(plat * RAD) * Math.cos(plon * RAD), k * Math.cos(plat * RAD) * Math.sin(plon * RAD), k * Math.sin(plat * RAD)];
  const R = 6371, la = lat * RAD, lo = lon * RAD;
  const r = [R * Math.cos(la) * Math.cos(lo), R * Math.cos(la) * Math.sin(lo), R * Math.sin(la)];
  const v = [W[1] * r[2] - W[2] * r[1], W[2] * r[0] - W[0] * r[2], W[0] * r[1] - W[1] * r[0]];
  const east = -Math.sin(lo) * v[0] + Math.cos(lo) * v[1];
  const north = -Math.sin(la) * Math.cos(lo) * v[0] - Math.sin(la) * Math.sin(lo) * v[1] + Math.cos(la) * v[2];
  return [Math.round(east * 10) / 10, Math.round(north * 10) / 10];
}

const out: [number, number, number, number, string][] = [];
for (const p of plates) {
  const small = geoArea(p as unknown as GeoJSON.Feature) < 0.02;
  const step = small ? 2.5 : 10;
  for (let lat = -80; lat <= 80; lat += step) {
    for (let lon = -180 + step / 2; lon < 180; lon += step) {
      if (!geoContains(p as unknown as GeoJSON.Feature, [lon, lat])) continue;
      const v = velocity(p.properties.code, lon, lat);
      if (v) out.push([lon, lat, v[0], v[1], p.properties.code]);
    }
  }
}
writeFileSync('public/data/plate_vectors.json', JSON.stringify(out));
console.log(`${out.length} flechas`);
