/*
 * Comparación de la simulación con lo observado y estimación en la costa.
 */
import { boxLon, type OceanBox } from './presets';
import type { Grid } from './swe';

/** Celda mojada más cercana a un punto (busca hasta `radius` celdas alrededor); -1 si no hay. */
export function cellAt(grid: Grid, wet: Uint8Array, box: OceanBox, lon: number, lat: number, radius = 3, minDepth = 0) {
  const x = (boxLon(box, lon) - grid.lon0) / grid.step, y = (lat - grid.lat0) / grid.step;
  let best = -1, bd = Infinity;
  for (let dj = -radius; dj <= radius; dj++) for (let di = -radius; di <= radius; di++) {
    const i = Math.round(x) + di, j = Math.round(y) + dj;
    if (i < 0 || j < 0 || i >= grid.nx || j >= grid.ny) continue;
    const k = j * grid.nx + i;
    if (!wet[k] || grid.h[k] < minDepth) continue;
    const d = Math.hypot(i - x, j - y);
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

/** Fila de observación: [lon, lat, minutos de viaje o -1, altura m o -1, tipo (2 mareógrafo, 3 DART), primer movimiento, nombre]. */
export type Gauge = [number, number, number, number, number, number, string];

export type Comparison = {
  arrivals: { g: Gauge; obs: number; sim: number }[]; // minutos
  amps: { g: Gauge; obs: number; sim: number }[]; // m, solo DART
  medDart: number | null; medGauge: number | null; // error relativo mediano de la llegada
  within: number; // fracción con |error| ≤ máx(15 min, 10 %)
  ampRatio: number | null; // media geométrica simulado/observado en DART
};

const median = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

export function compare(grid: Grid, wet: Uint8Array, box: OceanBox, arrival: Float32Array, maxEta: Float32Array, gauges: Gauge[]): Comparison {
  const arrivals: Comparison['arrivals'] = [], amps: Comparison['amps'] = [];
  for (const g of gauges) {
    const k = cellAt(grid, wet, box, g[0], g[1]);
    if (k < 0 || arrival[k] < 0) continue;
    if (g[2] > 0) arrivals.push({ g, obs: g[2], sim: arrival[k] / 60 });
    if (g[4] === 3 && g[3] > 0) amps.push({ g, obs: g[3], sim: maxEta[k] });
  }
  const rel = (kind: number) => median(arrivals.filter((a) => a.g[4] === kind).map((a) => (a.sim - a.obs) / a.obs));
  const within = arrivals.length ? arrivals.filter((a) => Math.abs(a.sim - a.obs) <= Math.max(15, 0.1 * a.obs)).length / arrivals.length : 0;
  const ampRatio = amps.length ? Math.exp(amps.reduce((s, a) => s + Math.log(Math.max(a.sim, 1e-4) / a.obs), 0) / amps.length) : null;
  return { arrivals, amps, medDart: rel(3), medGauge: rel(2), within, ampRatio };
}

/**
 * Amplificación al acercarse a la costa por la ley de Green (conservación del flujo de energía en una onda
 * larga que entra a aguas menos profundas): A₂ = A₁·(h₁/h₂)^¼. Hasta 1 m de profundidad, como orden de
 * magnitud de la altura en la orilla; la forma de la costa (bahías, resonancias) puede cambiarla mucho.
 */
export const greensFactor = (hFrom: number, hTo = 1) => Math.pow(Math.max(hFrom, hTo) / hTo, 0.25);

/** Distancia (km) entre dos puntos [lon, lat]. */
export function km([lo1, la1]: number[], [lo2, la2]: number[]) {
  const r = Math.PI / 180, a = Math.sin(((la2 - la1) * r) / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(((lo2 - lo1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
