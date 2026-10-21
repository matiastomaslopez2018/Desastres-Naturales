/*
 * Propagación de las ondas P y S en un modelo de Tierra realista.
 *
 * - Velocidades: modelo de referencia global ak135 (Kennett, Engdahl y Buland, 1995): corteza de dos capas
 *   (5,8 y 6,5 km/s en P), Moho a 35 km y manto con gradiente y discontinuidades a 210, 410 y 660 km.
 * - Curvatura: transformación de aplanamiento de la Tierra (Müller, 1971), exacta para rayos en un medio
 *   esféricamente simétrico: z' = −R·ln((R−z)/R), v' = v·R/(R−z).
 * - Tiempos de llegada a la estación: trazado de rayos en capas finas (onda directa y ondas refractadas que
 *   viajan por debajo de la fuente, entre ellas la Pn por el tope del manto); se toma la primera llegada.
 * - Frentes de onda para la animación: solución de la ecuación eikonal con el método de marcha rápida
 *   (Sethian, 1996) sobre una grilla del corte.
 */

export const EARTH_R = 6371;
export type Wave = 'P' | 'S';

/** ak135 (profundidad km, Vp, Vs en km/s) hasta 800 km. Las profundidades repetidas son discontinuidades. */
export const AK135: [number, number, number][] = [
  [0, 5.8, 3.46], [20, 5.8, 3.46], [20, 6.5, 3.85], [35, 6.5, 3.85], [35, 8.04, 4.48], [77.5, 8.045, 4.49],
  [120, 8.05, 4.5], [165, 8.175, 4.509], [210, 8.3, 4.518], [210, 8.3, 4.523], [260, 8.4825, 4.609],
  [310, 8.665, 4.696], [360, 8.8475, 4.783], [410, 9.03, 4.87], [410, 9.36, 5.08], [460, 9.528, 5.186],
  [510, 9.696, 5.292], [560, 9.864, 5.398], [610, 10.032, 5.504], [660, 10.2, 5.61], [660, 10.79, 5.96],
  [710, 10.9229, 6.0897], [760, 11.0558, 6.2095], [809.5, 11.1353, 6.2426],
];
export const MOHO = 35, CONRAD = 20;

/** Velocidad real a la profundidad z (km); en una discontinuidad devuelve la de abajo. */
export function velocity(z: number, w: Wave) {
  const k = w === 'P' ? 1 : 2;
  for (let i = 1; i < AK135.length; i++) {
    const z0 = AK135[i - 1][0], z1 = AK135[i][0];
    if (z1 > z0 && z >= z0 && z < z1) return AK135[i - 1][k] + ((z - z0) / (z1 - z0)) * (AK135[i][k] - AK135[i - 1][k]);
  }
  return AK135[AK135.length - 1][k];
}

/* ───────────── Aplanamiento ───────────── */

export const flatZ = (z: number) => -EARTH_R * Math.log((EARTH_R - z) / EARTH_R);
export const unflatZ = (zf: number) => EARTH_R * (1 - Math.exp(-zf / EARTH_R));
/** Velocidad en el modelo aplanado, en función de la profundidad aplanada. */
export const flatVelocity = (zf: number, w: Wave) => { const z = unflatZ(zf); return (velocity(z, w) * EARTH_R) / (EARTH_R - z); };

/* ───────────── Tiempos de llegada (capas finas) ───────────── */

type Layer = { top: number; d: number; v: number };
const DZ = 1; // espesor de las capas finas, en km aplanados

/** Capas finas del modelo aplanado entre 0 y zmax (km aplanados); las discontinuidades caen en bordes de capa. */
function layers(w: Wave, zmax: number): Layer[] {
  const breaks = [...new Set(AK135.map(([z]) => flatZ(z)))].filter((z) => z < zmax).concat([zmax]).sort((a, b) => a - b);
  const out: Layer[] = [];
  for (let i = 0; i < breaks.length - 1; i++) {
    const a = breaks[i], b = breaks[i + 1], n = Math.max(1, Math.round((b - a) / DZ));
    for (let j = 0; j < n; j++) {
      const top = a + ((b - a) * j) / n, d = (b - a) / n;
      out.push({ top, d, v: flatVelocity(top + d / 2, w) });
    }
  }
  return out;
}
const LAYERS_CACHE = new Map<Wave, Layer[]>();
const modelLayers = (w: Wave) => {
  let l = LAYERS_CACHE.get(w);
  if (!l) { l = layers(w, flatZ(780)); LAYERS_CACHE.set(w, l); }
  return l;
};

export type Arrival = {
  /** Tiempo de viaje en segundos. */
  t: number;
  /** 'direct': sube directo de la fuente a la estación; 'moho': viaja por el tope del manto (Pn/Sn); 'mantle': se refracta más abajo. */
  path: 'direct' | 'moho' | 'mantle';
  /** Profundidad real más honda que alcanza el rayo (km). */
  bottom: number;
};

/** Primera llegada de la onda w a una estación en superficie a `dist` km (sobre la superficie) de una fuente a `depth` km. */
export function firstArrival(w: Wave, depth: number, dist: number): Arrival {
  const L = modelLayers(w), hf = flatZ(depth);
  // Tramo entre la superficie y la fuente (la última capa, partida).
  const above: Layer[] = [];
  let k = 0;
  for (; k < L.length && L[k].top < hf; k++) {
    const d = Math.min(L[k].d, hf - L[k].top);
    if (d > 1e-9) above.push({ top: L[k].top, d, v: L[k].v });
  }
  const below = L.slice(k);
  const x = Math.max(dist, 1e-6);
  let best: Arrival = { t: Infinity, path: 'direct', bottom: depth };

  // 1. Onda directa: se busca el parámetro de rayo p con X(p) = x.
  if (above.length) {
    const vmax = Math.max(...above.map((l) => l.v));
    const X = (p: number) => above.reduce((s, l) => { const q = p * l.v; return s + (l.d * q) / Math.sqrt(1 - q * q); }, 0);
    let lo = 0, hi = (1 / vmax) * (1 - 1e-12);
    for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (X(m) < x) lo = m; else hi = m; }
    const p = (lo + hi) / 2;
    const t = above.reduce((s, l) => { const q = p * l.v; return s + l.d / (l.v * Math.sqrt(1 - q * q)); }, 0);
    // Si el rayo es casi horizontal (X no llega a x) se cae a la línea recta como cota (fuente muy somera, lejos).
    best = { t: X(p) >= x * 0.999 ? t : x / above[above.length - 1].v, path: 'direct', bottom: depth };
  } else {
    best = { t: x / (below[0]?.v ?? 6), path: 'direct', bottom: 0 };
  }

  // 2. Ondas que bajan por debajo de la fuente y vuelven (refractadas críticamente en cada capa más rápida).
  let vmaxPath = Math.max(0, ...above.map((l) => l.v));
  const down: Layer[] = [];
  for (const layer of below) {
    // (Con down vacío: fuente apoyada sobre el tope de esta capa, como la de 35 km en las tablas, que ya está en el manto.)
    if (layer.v > vmaxPath) {
      const p = 1 / layer.v;
      const eta = (l: Layer) => l.d * Math.sqrt(Math.max(0, 1 / (l.v * l.v) - p * p));
      const tanX = (l: Layer) => { const q = p * l.v; return (l.d * q) / Math.sqrt(Math.max(1e-12, 1 - q * q)); };
      const xmin = above.reduce((s, l) => s + tanX(l), 0) + 2 * down.reduce((s, l) => s + tanX(l), 0);
      if (x >= xmin) {
        const t = x * p + above.reduce((s, l) => s + eta(l), 0) + 2 * down.reduce((s, l) => s + eta(l), 0);
        if (t < best.t - 1e-9) {
          const zr = unflatZ(layer.top);
          best = { t, path: zr <= MOHO + 0.5 ? 'moho' : 'mantle', bottom: zr };
        }
      }
    }
    vmaxPath = Math.max(vmaxPath, layer.v);
    down.push(layer);
  }
  return best;
}

/* ───────────── Frentes de onda (marcha rápida) ───────────── */

export type Field = {
  /** Tiempos de primera llegada (s) en cada nodo; fila por fila desde la superficie. */
  t: Float32Array;
  nx: number; nz: number;
  /** Coordenadas reales: x0 y paso dx en km horizontales; profundidad real de cada fila. */
  x0: number; dx: number; zReal: Float32Array;
};

/**
 * Tiempos de primera llegada en todo el corte (eikonal de primer orden con marcha rápida) sobre una grilla
 * uniforme en profundidad aplanada. Horizontal: de x0 a x1 km; vertical: de 0 a zmax km reales.
 */
export function travelTimeField(w: Wave, depth: number, x0: number, x1: number, zmax: number, cells = 360): Field {
  const zfMax = flatZ(zmax);
  const h = Math.max(x1 - x0, zfMax) / cells;
  const nx = Math.ceil((x1 - x0) / h) + 1, nz = Math.ceil(zfMax / h) + 1;
  const n = nx * nz;
  const slow = new Float32Array(nz);
  const zReal = new Float32Array(nz);
  for (let j = 0; j < nz; j++) { const zf = j * h; zReal[j] = unflatZ(zf); slow[j] = 1 / flatVelocity(Math.min(zf + 1e-6, flatZ(800)), w); }
  const T = new Float32Array(n).fill(Infinity);
  const state = new Uint8Array(n); // 0 lejos, 1 frente, 2 aceptado
  // Montículo binario de índices ordenado por T.
  const heap: number[] = [], pos = new Int32Array(n).fill(-1);
  const swap = (a: number, b: number) => { const t = heap[a]; heap[a] = heap[b]; heap[b] = t; pos[heap[a]] = a; pos[heap[b]] = b; };
  const up = (i: number) => { while (i > 0) { const p = (i - 1) >> 1; if (T[heap[p]] <= T[heap[i]]) break; swap(i, p); i = p; } };
  const downH = (i: number) => { for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && T[heap[l]] < T[heap[m]]) m = l; if (r < heap.length && T[heap[r]] < T[heap[m]]) m = r; if (m === i) break; swap(i, m); i = m; } };
  const push = (id: number) => { if (pos[id] >= 0) { up(pos[id]); return; } heap.push(id); pos[id] = heap.length - 1; up(heap.length - 1); };
  const pop = () => { const top = heap[0], last = heap.pop()!; pos[top] = -1; if (heap.length) { heap[0] = last; pos[last] = 0; downH(0); } return top; };

  // Fuente: nodos cercanos con tiempo de línea recta (velocidad local), aceptados.
  const si = (0 - x0) / h, sj = flatZ(depth) / h;
  const R0 = 3;
  for (let j = Math.max(0, Math.floor(sj - R0)); j <= Math.min(nz - 1, Math.ceil(sj + R0)); j++) {
    for (let i = Math.max(0, Math.floor(si - R0)); i <= Math.min(nx - 1, Math.ceil(si + R0)); i++) {
      const r = Math.hypot(i - si, j - sj) * h;
      if (r <= R0 * h) { const id = j * nx + i; T[id] = r * 0.5 * (slow[j] + slow[Math.min(nz - 1, Math.round(sj))]); state[id] = 1; push(id); }
    }
  }
  const solve = (i: number, j: number) => {
    const id = j * nx + i, f = slow[j] * h;
    const a = Math.min(i > 0 && state[id - 1] === 2 ? T[id - 1] : Infinity, i < nx - 1 && state[id + 1] === 2 ? T[id + 1] : Infinity);
    const b = Math.min(j > 0 && state[id - nx] === 2 ? T[id - nx] : Infinity, j < nz - 1 && state[id + nx] === 2 ? T[id + nx] : Infinity);
    let t: number;
    if (!Number.isFinite(a)) t = b + f;
    else if (!Number.isFinite(b)) t = a + f;
    else if (Math.abs(a - b) >= f) t = Math.min(a, b) + f;
    else t = (a + b + Math.sqrt(2 * f * f - (a - b) ** 2)) / 2;
    if (t < T[id]) { T[id] = t; state[id] = 1; push(id); }
  };
  while (heap.length) {
    const id = pop();
    state[id] = 2;
    const i = id % nx, j = (id - i) / nx;
    if (i > 0 && state[id - 1] !== 2) solve(i - 1, j);
    if (i < nx - 1 && state[id + 1] !== 2) solve(i + 1, j);
    if (j > 0 && state[id - nx] !== 2) solve(i, j - 1);
    if (j < nz - 1 && state[id + nx] !== 2) solve(i, j + 1);
  }
  return { t: T, nx, nz, x0, dx: h, zReal };
}

/** Tiempo interpolado en un punto real (x km, z km) del corte. */
export function sampleField(F: Field, x: number, z: number) {
  const fi = (x - F.x0) / F.dx, fj = flatZ(Math.max(0, z)) / F.dx;
  const i = Math.max(0, Math.min(F.nx - 2, Math.floor(fi))), j = Math.max(0, Math.min(F.nz - 2, Math.floor(fj)));
  const u = Math.max(0, Math.min(1, fi - i)), v = Math.max(0, Math.min(1, fj - j));
  const g = (a: number, b: number) => F.t[b * F.nx + a];
  return (1 - u) * (1 - v) * g(i, j) + u * (1 - v) * g(i + 1, j) + (1 - u) * v * g(i, j + 1) + u * v * g(i + 1, j + 1);
}

/**
 * Trayectoria del rayo de primera llegada desde la estación (en superficie) hasta la fuente: se baja por el
 * gradiente del campo de tiempos. Devuelve puntos reales [x, z] en km.
 */
export function rayPath(F: Field, stationX: number, srcDepth: number): [number, number][] {
  const pts: [number, number][] = [[stationX, 0]];
  let x = stationX, zf = 0;
  const step = F.dx * 0.5, srcZf = flatZ(srcDepth);
  for (let k = 0; k < 20000; k++) {
    if (Math.hypot(x - 0, zf - srcZf) < F.dx * 2.5) { pts.push([0, srcDepth]); break; }
    const e = F.dx * 0.5;
    const tz = (a: number, b: number) => sampleField(F, a, unflatZ(Math.max(0, b)));
    const gx = (tz(x + e, zf) - tz(x - e, zf)) / (2 * e), gz = (tz(x, zf + e) - tz(x, Math.max(0, zf - e))) / (zf > e ? 2 * e : e + zf);
    const g = Math.hypot(gx, gz);
    if (!Number.isFinite(g) || g === 0) break;
    x -= (step * gx) / g; zf = Math.max(0, zf - (step * gz) / g);
    if (k % 2 === 0) pts.push([x, unflatZ(zf)]);
  }
  return pts;
}
