/**
 * GSHAP (Global Seismic Hazard Assessment Program, 1999): aceleración máxima del suelo (PGA, m/s²)
 * con 10 % de probabilidad de ser superada en 50 años, en roca. Grilla ASCII de 0,1° publicada por
 * ETH Zürich: http://static.seismo.ethz.ch/gshap/gshpub.zip (GSHPUB.DAT, columnas lon lat pga).
 * "All GSHAP products and maps are available freely and are not covered by copyright,
 * provided that the source is cited." Cita: Giardini et al. (1999), Annali di Geofisica 42(6).
 *
 * Este script la convierte en curvas por nivel (MultiPolygon) para dibujarlas en el globo:
 *   public/data/gshap.json
 *
 *   npm run gshap        # requiere data/GSHPUB.DAT
 */
import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { contours } from 'd3-contour';

const SRC = 'data/GSHPUB.DAT';
const OUT = 'public/data/gshap.json';
/** Niveles de la leyenda original de GSHAP, en m/s². */
export const LEVELS = [0.2, 0.4, 0.8, 1.6, 2.4, 3.2, 4.0, 4.8];
/** Se remuestrea a 0,2° para que el archivo sea liviano (la grilla original es de 0,1°). */
const STEP = 0.2;
const W = Math.round(360 / STEP), LAT0 = 87, LAT1 = -62, H = Math.round((LAT0 - LAT1) / STEP) + 1;

const ring = (r: number[][]) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return a / 2; // < 0: horario con y hacia arriba (x_prev − x_cur)
};

async function main() {
  // Máximo por celda de 0,2° (no se promedia: el nivel de amenaza no debe bajar al remuestrear).
  const grid = new Float32Array(W * H).fill(0);
  const rl = createInterface({ input: createReadStream(SRC), crlfDelay: Infinity });
  for await (const line of rl) {
    const [xs, ys, zs] = line.trim().split(/\s+/);
    const z = Number(zs);
    if (!Number.isFinite(z)) continue;
    let lon = Number(xs);
    if (lon >= 180) lon -= 360;
    const col = Math.min(W - 1, Math.floor((lon + 180) / STEP));
    const row = Math.round((LAT0 - Number(ys)) / STEP);
    if (row < 0 || row >= H) continue;
    const k = row * W + col;
    if (z > grid[k]) grid[k] = z;
  }
  const gen = contours().size([W, H]).thresholds(LEVELS).smooth(true);
  const features = gen(Array.from(grid)).map((c) => {
    // De índices de grilla a lon/lat (centro de celda), con 2 decimales.
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
    source: 'GSHAP (Giardini et al., 1999) · ETH Zürich · PGA, 10 % en 50 años, m/s²',
    features,
  }));
  console.log(`${features.length} niveles → ${OUT}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
