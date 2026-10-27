/*
 * Caída de ceniza en un worker (no traba la página): suma las fases de la erupción sobre una grilla
 * regional y en cada lugar del mapa.
 */
import { extent, loadAt, loadGrid, parcels, type Parcel, type TephraParams } from '@/lib/volcano/tephra';

export type AshIn = {
  /** Lugares: nombre, lon, lat y si tiene que entrar en el mapa aunque no le llegue ceniza (tiene un dato medido). */
  id: number; phases: TephraParams[]; places: [string, number, number, boolean?][]; vent: [number, number]; n: number;
  /** Grilla fina sobre el recuadro del relieve 3D: medio lado (m) y celdas. */
  local: { half: number; n: number };
};
export type AshOut = {
  id: number;
  /** Carga (kg/m²) en n×n celdas, filas de norte a sur; centro (m al este y al norte de la boca) y paso (m). */
  grid: Float32Array; n: number; cx: number; cy: number; h: number;
  /** Carga en cada lugar (kg/m²) y distancia a la boca (km). */
  places: { name: string; lon: number; lat: number; load: number; km: number }[];
  /** Carga sobre el recuadro del relieve (filas de norte a sur), centrada en la boca. */
  local: Float32Array; localN: number;
  /** Por fase: desplazamiento del centro de masa (m) para dibujar la dirección. */
  axis: { x: number; y: number }[];
  ms: number;
};

const R = 6371e3;

self.onmessage = (e: MessageEvent<AshIn>) => {
  const t0 = performance.now();
  const { phases, places, vent, n, id, local } = e.data;
  const all: Parcel[][] = phases.map((p) => parcels(p));
  // Un recuadro común que contenga todas las fases.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const ps of all) { const b = extent(ps); x0 = Math.min(x0, b.cx - b.half); x1 = Math.max(x1, b.cx + b.half); y0 = Math.min(y0, b.cy - b.half); y1 = Math.max(y1, b.cy + b.half); }
  const flat = all.flat();
  const cosV = Math.cos((vent[1] * Math.PI) / 180);
  const out = places.map(([name, lon, lat, keep]) => {
    const dx = ((lon - vent[0]) * Math.PI) / 180 * R * cosV, dy = ((lat - vent[1]) * Math.PI) / 180 * R, load = loadAt(flat, dx, dy);
    // El recuadro se agranda para que entren los lugares con ceniza visible y los que tienen un dato medido.
    if (load >= 0.1 || keep) { x0 = Math.min(x0, dx - 20e3); x1 = Math.max(x1, dx + 20e3); y0 = Math.min(y0, dy - 20e3); y1 = Math.max(y1, dy + 20e3); }
    return { name, lon, lat, load, km: Math.hypot(dx, dy) / 1000 };
  });
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let half = Math.min(1.2e6, Math.max(x1 - x0, y1 - y0) / 2), h = (2 * half) / (n - 1), grid = loadGrid(flat, cx, cy, h, n, n);
  // Si la franja más fina (0,1 mm) toca el borde, se agranda el recuadro (hasta 3 veces) para que no quede cortada.
  for (let k = 0; k < 3 && half < 1.2e6; k++) {
    let edge = 0;
    for (let i = 0; i < n; i++) edge = Math.max(edge, grid[i], grid[(n - 1) * n + i], grid[i * n], grid[i * n + n - 1]);
    if (edge < 0.1) break;
    half = Math.min(1.2e6, half * 1.5); h = (2 * half) / (n - 1); grid = loadGrid(flat, cx, cy, h, n, n);
  }
  const axis = all.map((ps) => { let mx = 0, my = 0, mt = 0; for (const p of ps) { mx += p.m * p.x; my += p.m * p.y; mt += p.m; } return { x: mx / mt, y: my / mt }; });
  const lg = loadGrid(flat, 0, 0, (2 * local.half) / (local.n - 1), local.n, local.n);
  const msg: AshOut = { id, grid, n, cx, cy, h, places: out, axis, local: lg, localN: local.n, ms: performance.now() - t0 };
  (self as unknown as Worker).postMessage(msg, [grid.buffer, lg.buffer]);
};
