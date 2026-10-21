/*
 * Propagación del tsunami en el océano: ecuaciones lineales de aguas someras en coordenadas esféricas, con
 * Coriolis, como los modelos de propagación en aguas profundas (MOST de la NOAA, COMCOT; Liu et al. 1995):
 *   ∂η/∂t + 1/(R cosφ)·[∂M/∂λ + ∂(N cosφ)/∂φ] = 0
 *   ∂M/∂t + g·h/(R cosφ)·∂η/∂λ − f·N = 0
 *   ∂N/∂t + g·h/R·∂η/∂φ + f·M = 0
 * η: nivel del mar; M, N: flujos (caudal por metro) hacia el este y el norte; h: profundidad; f = 2Ω·senφ.
 * Grilla escalonada de Arakawa C, paso de tiempo adelante-atrás (η con los flujos viejos y los flujos con
 * el η nuevo), estable con número de Courant ≤ 1/√2. Costas reflejantes (flujo nulo en caras con tierra);
 * bordes abiertos con una franja esponja que absorbe la onda. Lineal: vale en aguas profundas; cerca de la
 * costa la amplificación y la inundación se estiman aparte.
 */

export const G = 9.81;
const R = 6.371e6, OMEGA = 7.2921e-5, D2R = Math.PI / 180;
/** Profundidad mínima de una celda mojada (m); menos que eso se trata como tierra. */
export const MIN_DEPTH = 10;

export type Grid = {
  nx: number; ny: number;
  lon0: number; lat0: number; step: number; // grados; centros de celda
  /** Profundidad (m, positiva bajo el mar; ≤ 0 tierra), fila por fila de sur a norte. */
  h: Float32Array;
};

export type Sim = ReturnType<typeof createSim>;

export function createSim(grid: Grid, eta0: Float32Array, opts: { sponge?: number; coriolis?: boolean; threshold?: number } = {}) {
  const { nx, ny, step, h } = grid;
  const n = nx * ny;
  const dl = step * D2R, dp = step * D2R;
  const wet = new Uint8Array(n);
  for (let k = 0; k < n; k++) wet[k] = h[k] >= MIN_DEPTH ? 1 : 0;
  const eta = new Float32Array(n), M = new Float32Array(n), N = new Float32Array(n);
  for (let k = 0; k < n; k++) if (wet[k]) eta[k] = eta0[k];
  // Coeficientes por fila (latitud) y profundidades en las caras.
  const cosC = new Float64Array(ny), cosN = new Float64Array(ny), fC = new Float64Array(ny);
  for (let j = 0; j < ny; j++) {
    const lat = grid.lat0 + j * step;
    cosC[j] = Math.cos(lat * D2R); cosN[j] = Math.cos((lat + step / 2) * D2R);
    fC[j] = opts.coriolis === false ? 0 : 2 * OMEGA * Math.sin(lat * D2R);
  }
  const hu = new Float32Array(n), hv = new Float32Array(n);
  let hmax = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (wet[k]) hmax = Math.max(hmax, h[k]);
    if (i < nx - 1 && wet[k] && wet[k + 1]) hu[k] = 0.5 * (h[k] + h[k + 1]);
    if (j < ny - 1 && wet[k] && wet[k + nx]) hv[k] = 0.5 * (h[k] + h[k + nx]);
  }
  // Paso de tiempo por la condición de Courant (celda más angosta, a la latitud más alta, y agua más honda).
  let dxMin = Infinity;
  for (let j = 0; j < ny; j++) dxMin = Math.min(dxMin, R * cosC[j] * dl);
  const dt = (0.8 * Math.min(dxMin, R * dp)) / (Math.sqrt(G * hmax) * Math.SQRT2);
  // Franja esponja en los bordes abiertos (amortiguamiento que crece hacia el borde).
  const S = opts.sponge ?? 12;
  const damp = new Float32Array(n).fill(1);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const d = Math.min(i, nx - 1 - i, j, ny - 1 - j);
    if (d < S) damp[j * nx + i] = 1 - 0.12 * ((S - d) / S) ** 2;
  }
  // Resultados: momento de llegada (primera vez que |η| supera el umbral) y máximo |η| en cada celda.
  const arrival = new Float32Array(n).fill(-1), maxEta = new Float32Array(n);
  const THRESH = opts.threshold ?? 0.01; // m
  let t = 0;

  function stepOnce() {
    // 1) Continuidad: η con los flujos actuales.
    for (let j = 1; j < ny - 1; j++) {
      const a = dt / (R * cosC[j]), bx = a / dl, by = a / dp, cn = cosN[j], cs = cosN[j - 1];
      for (let i = 1; i < nx - 1; i++) {
        const k = j * nx + i;
        if (!wet[k]) continue;
        eta[k] -= bx * (M[k] - M[k - 1]) + by * (N[k] * cn - N[k - nx] * cs);
      }
    }
    // 2) Momento: flujos con el η nuevo (Coriolis con el flujo transversal promediado en la cara).
    for (let j = 0; j < ny; j++) {
      const ax = (G * dt) / (R * cosC[j] * dl), ay = (G * dt) / (R * dp), f = fC[j] * dt;
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (hu[k] > 0) {
          const nAvg = f ? 0.25 * (N[k] + N[k + 1] + (j > 0 ? N[k - nx] + N[k - nx + 1] : 0)) : 0;
          M[k] = (M[k] - ax * hu[k] * (eta[k + 1] - eta[k]) + f * nAvg) * damp[k];
        } else M[k] = 0;
        if (hv[k] > 0) {
          const mAvg = f ? 0.25 * (M[k] + M[k + nx] + (i > 0 ? M[k - 1] + M[k + nx - 1] : 0)) : 0;
          N[k] = (N[k] - ay * hv[k] * (eta[k + nx] - eta[k]) - f * mAvg) * damp[k];
        } else N[k] = 0;
      }
    }
    for (let k = 0; k < n; k++) {
      if (damp[k] < 1) eta[k] *= damp[k];
      const a = Math.abs(eta[k]);
      if (a > maxEta[k]) maxEta[k] = a;
      if (arrival[k] < 0 && a >= THRESH) arrival[k] = t + dt;
    }
    t += dt;
  }

  return {
    grid, wet, eta, arrival, maxEta, dt,
    get t() { return t; },
    /** Avanza hasta alcanzar o pasar el tiempo dado (s); se pasa como mucho un paso. */
    runTo(tEnd: number) { while (t < tEnd) stepOnce(); },
  };
}

/** Recorta la batimetría global (filas de sur a norte, longitudes 0–360) a una caja, con submuestreo. */
export function cropGrid(global: { z: Int16Array; nx: number; ny: number; lon0: number; lat0: number; step: number }, box: { lonW: number; lonE: number; latS: number; latN: number }, factor = 1): Grid {
  const st = global.step * factor;
  const nx = Math.floor((box.lonE - box.lonW) / st) + 1, ny = Math.floor((box.latN - box.latS) / st) + 1;
  const h = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const lat = box.latS + j * st, gj = Math.round((lat - global.lat0) / global.step);
    for (let i = 0; i < nx; i++) {
      const lon = (((box.lonW + i * st) % 360) + 360) % 360, gi = Math.round((lon - global.lon0) / global.step) % global.nx;
      h[j * nx + i] = gj >= 0 && gj < global.ny ? -global.z[gj * global.nx + gi] : 0;
    }
  }
  return { nx, ny, lon0: box.lonW, lat0: box.latS, step: st, h };
}
