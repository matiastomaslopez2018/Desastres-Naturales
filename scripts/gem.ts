/**
 * GEM Global Seismic Hazard Map v2023.1 (GEM Foundation): aceleración máxima del suelo (PGA, en g)
 * con 10 % de probabilidad de ser superada en 50 años, en roca (Vs30 760–800 m/s), grilla de 3'.
 * Zenodo: https://doi.org/10.5281/zenodo.8409647 (GEM-GSHM_PGA-475y-rock_v2023.zip).
 * Licencia CC BY-NC-SA 4.0: uso no comercial, con atribución y compartir igual.
 *
 * Este script lo convierte en curvas por nivel (MultiPolygon) para dibujarlas en el globo:
 *   public/data/gem.json
 *
 *   npm run gem -- <ruta a v2023_1_pga_475_rock_3min.tif>
 */
import { writeFileSync } from 'node:fs';
import { contours } from 'd3-contour';
import { fromFile } from 'geotiff';

const OUT = 'public/data/gem.json';
/** Límites de las clases de la paleta oficial de GEM (README del mapa), en g. Debajo de 0,02 g no se pinta. */
export const LEVELS = [0.02, 0.03, 0.05, 0.08, 0.13, 0.2, 0.35, 0.55, 0.9];
/** Se remuestrea a 0,2° tomando el máximo de cada celda (la grilla original es de 0,05°). */
const STEP = 0.2;

const ring = (r: number[][]) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return a / 2;
};

async function main() {
  const src = process.argv[2];
  if (!src) throw new Error('Falta la ruta al GeoTIFF de GEM');
  const tiff = await fromFile(src);
  const img = await tiff.getImage();
  const [x0, y0, x1, y1] = img.getBoundingBox(); // oeste, sur, este, norte
  const w = img.getWidth(), h = img.getHeight();
  const nodata = img.getGDALNoData();
  const [band] = (await img.readRasters({ samples: [0] })) as unknown as [ArrayLike<number>];
  const dx = (x1 - x0) / w, dy = (y1 - y0) / h;
  const W = Math.round(360 / STEP), LAT0 = Math.min(90, y1), LAT1 = Math.max(-90, y0);
  const H = Math.round((LAT0 - LAT1) / STEP) + 1;
  const grid = new Float32Array(W * H).fill(0);
  for (let r = 0; r < h; r++) {
    const lat = y1 - (r + 0.5) * dy;
    const row = Math.round((LAT0 - lat) / STEP);
    if (row < 0 || row >= H) continue;
    for (let c = 0; c < w; c++) {
      const z = band[r * w + c];
      if (!Number.isFinite(z) || z < 0 || (nodata != null && z === nodata)) continue;
      let lon = x0 + (c + 0.5) * dx;
      if (lon >= 180) lon -= 360;
      const k = row * W + Math.min(W - 1, Math.floor((lon + 180) / STEP));
      if (z > grid[k]) grid[k] = z;
    }
  }
  const gen = contours().size([W, H]).thresholds(LEVELS).smooth(true);
  const features = gen(Array.from(grid)).map((c) => {
    const coords = c.coordinates.map((poly) =>
      poly.map((r, i) => {
        // Se descartan puntos a menos de 0,3° del anterior (curvas más livianas para dibujar en el globo).
        const pts: number[][] = [];
        for (const [x, y] of r) {
          const p = [Math.round((x * STEP - 180) * 10) / 10, Math.round((LAT0 - y * STEP) * 10) / 10];
          const q = pts[pts.length - 1];
          if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) >= 0.3) pts.push(p);
        }
        if (pts.length < 4) return null;
        pts.push(pts[0]);
        // d3-geo (esférico): anillo exterior en sentido horario, huecos al revés.
        const cw = ring(pts) < 0;
        return (i === 0) === cw ? pts : pts.reverse();
      }),
    ).filter((poly) => poly[0] != null).map((poly) => poly.filter((r): r is number[][] => !!r));
    return { type: 'Feature', properties: { pga: c.value }, geometry: { type: 'MultiPolygon', coordinates: coords } };
  });
  writeFileSync(OUT, JSON.stringify({
    type: 'FeatureCollection',
    source: 'GEM Global Seismic Hazard Map v2023.1 · GEM Foundation · CC BY-NC-SA 4.0 · PGA en g, 10 % en 50 años, roca',
    features,
  }));
  console.log(`${w}×${h} píxeles, ${features.length} niveles → ${OUT}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
