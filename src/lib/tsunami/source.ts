/*
 * Condición inicial del tsunami: el mar copia la deformación vertical del fondo (Okada) en el instante del
 * sismo, porque la ruptura dura poco frente al período del tsunami. Solo en celdas con agua.
 */
import { dzAt, prepare, type Subfault } from './okada';
import { MIN_DEPTH, type Grid } from './swe';

/** [lon, lat, profundidad del centro km, largo km, ancho km, rumbo, buzamiento, rake, deslizamiento m] */
export type FaultRow = number[];

export const toSubfault = (r: FaultRow, lonWrap: (lon: number) => number): Subfault => ({
  lon: lonWrap(r[0]), lat: r[1], depth: r[2] * 1e3, length: r[3] * 1e3, width: r[4] * 1e3,
  strike: r[5], dip: r[6], rake: r[7], slip: r[8], spec: 'centroid',
});

/** Margen alrededor de la ruptura en el que se calcula la deformación (grados). */
const MARGIN = 5;
const MIN_DZ = 0.01;

export function sourceOnGrid(rows: FaultRow[], grid: Grid) {
  const wrap = (lon: number) => { let x = ((lon % 360) + 360) % 360; if (x < grid.lon0) x += 360; return x; };
  const subs = rows.filter((r) => r[8] > 0.01).map((r) => toSubfault(r, wrap));
  const ps = subs.map(prepare);
  const lons = subs.map((s) => s.lon), lats = subs.map((s) => s.lat);
  const i0 = Math.max(0, Math.floor((Math.min(...lons) - MARGIN - grid.lon0) / grid.step)), i1 = Math.min(grid.nx - 1, Math.ceil((Math.max(...lons) + MARGIN - grid.lon0) / grid.step));
  const j0 = Math.max(0, Math.floor((Math.min(...lats) - MARGIN - grid.lat0) / grid.step)), j1 = Math.min(grid.ny - 1, Math.ceil((Math.max(...lats) + MARGIN - grid.lat0) / grid.step));
  const eta = new Float32Array(grid.nx * grid.ny);
  for (let j = j0; j <= j1; j++) {
    const lat = grid.lat0 + j * grid.step;
    for (let i = i0; i <= i1; i++) {
      const k = j * grid.nx + i;
      if (grid.h[k] < MIN_DEPTH) continue;
      const lon = grid.lon0 + i * grid.step;
      let s = 0;
      for (const P of ps) s += dzAt(P, lon, lat);
      // Deformaciones de menos de 1 cm lejos de la ruptura no generan un tsunami apreciable (y la costa sube o baja con el mar).
      eta[k] = Math.abs(s) >= MIN_DZ ? s : 0;
    }
  }
  return eta;
}

/** Momento sísmico (N·m) de las subfallas, con rigidez μ = 3·10¹⁰ Pa (para controlar contra el Mw). */
export const momentOf = (rows: FaultRow[]) => rows.reduce((s, r) => s + 3e10 * r[3] * 1e3 * r[4] * 1e3 * r[8], 0);
