/// <reference lib="webworker" />
/*
 * Corre la simulación del tsunami fuera del hilo principal: fuente (Okada) + propagación (aguas someras).
 * Devuelve cuadros cada FRAME_S segundos de tiempo simulado, cuantizados a 8 bits con escala raíz cuadrada
 * (se ven tanto los metros cerca de la fuente como los centímetros en mar abierto), más el tiempo de llegada
 * y la altura máxima en cada celda y la serie de tiempo en los puntos de costa pedidos.
 */
import { createSim, type Grid } from '@/lib/tsunami/swe';
import { sourceOnGrid, toSubfault, type FaultRow } from '@/lib/tsunami/source';
import { dzAt, prepare } from '@/lib/tsunami/okada';

export type WorkerIn = {
  grid: Grid; faults: FaultRow[]; slipScale: number; hours: number;
  /** Índices de celda donde registrar la serie de tiempo (costas de la escena). */
  probes: number[];
};
export type WorkerOut =
  | { type: 'progress'; t: number; hours: number }
  | { type: 'done'; frames: Int8Array[]; frameS: number; amp: number; eta0: Float32Array; arrival: Float32Array; maxEta: Float32Array; series: Float32Array[]; seriesDt: number; dt: number; ms: number; fine: FineSource; local: LocalBirth };

/**
 * Nacimiento de la ola con más detalle: los primeros minutos en una grilla fina (la de la fuente) con la
 * batimetría interpolada de la grilla del océano. Para el primer capítulo de la película.
 */
export type LocalBirth = { lon0: number; lat0: number; step: number; nx: number; ny: number; h: Float32Array; frames: Float32Array[]; frameS: number };
export const LOCAL_MINUTES = 20;

/** Deformación del fondo en una grilla fina (≥ 0,04°) alrededor de la ruptura, para el detalle de la fuente. */
export type FineSource = { lon0: number; lat0: number; step: number; nx: number; ny: number; dz: Float32Array };

export const FRAME_S = 600;
/** Altura que se dibuja con color pleno (m); por encima se satura. */
export const AMP = 1.5;

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  const t0 = performance.now();
  const { grid, faults, slipScale, hours, probes } = e.data;
  const scaled = faults.map((r) => { const c = r.slice(); c[8] *= slipScale; return c; });
  const eta0 = sourceOnGrid(scaled, grid);
  const sim = createSim(grid, eta0);
  const tEnd = hours * 3600, n = grid.nx * grid.ny;
  const frames: Int8Array[] = [];
  const quant = () => {
    const q = new Int8Array(n);
    for (let k = 0; k < n; k++) {
      const v = sim.eta[k];
      if (v) q[k] = Math.sign(v) * Math.min(127, Math.round(127 * Math.sqrt(Math.min(1, Math.abs(v) / AMP))));
    }
    return q;
  };
  frames.push(quant());
  const seriesDt = 30;
  const series = probes.map(() => new Float32Array(Math.ceil(tEnd / seriesDt) + 1));
  let nextSeries = 0, nextFrame = FRAME_S, lastPost = 0;
  while (sim.t < tEnd) {
    sim.runTo(Math.min(sim.t + seriesDt, tEnd));
    while (nextSeries * seriesDt <= sim.t && nextSeries < series[0]?.length) {
      probes.forEach((k, i) => { series[i][nextSeries] = k >= 0 ? sim.eta[k] : 0; });
      nextSeries++;
    }
    if (sim.t >= nextFrame) { frames.push(quant()); nextFrame += FRAME_S; }
    const now = performance.now();
    if (now - lastPost > 120) { lastPost = now; (self as unknown as Worker).postMessage({ type: 'progress', t: sim.t, hours } satisfies WorkerOut); }
  }
  // Grilla fina de la fuente (sin recortar por profundidad: muestra también el levantamiento de la costa).
  const wrap = (lon: number) => { let x = ((lon % 360) + 360) % 360; if (x < grid.lon0) x += 360; return x; };
  const subs = scaled.filter((r) => r[8] > 0.01).map((r) => toSubfault(r, wrap)), ps = subs.map(prepare);
  // Margen: 1,5° más la mitad de la subfalla más grande (una falla uniforme de 1.000 km necesita más lugar).
  const pad = 1.5 + Math.max(...subs.map((q) => Math.max(q.length, q.width))) / 2 / 111e3;
  const lon0 = Math.min(...subs.map((q) => q.lon)) - pad, lat0 = Math.min(...subs.map((q) => q.lat)) - pad;
  // Paso de 0,04° o más, para no pasar de ~160 puntos por lado (las rupturas largas, como Sumatra, tienen cientos de subfallas).
  const ext = Math.max(Math.max(...subs.map((q) => q.lon)) + pad - lon0, Math.max(...subs.map((q) => q.lat)) + pad - lat0);
  const step = Math.max(0.04, ext / 160);
  const fnx = Math.ceil((Math.max(...subs.map((q) => q.lon)) + pad - lon0) / step) + 1, fny = Math.ceil((Math.max(...subs.map((q) => q.lat)) + pad - lat0) / step) + 1;
  const dz = new Float32Array(fnx * fny);
  for (let j = 0; j < fny; j++) for (let i = 0; i < fnx; i++) { let v = 0; for (const P of ps) v += dzAt(P, lon0 + i * step, lat0 + j * step); dz[j * fnx + i] = v; }
  const fine: FineSource = { lon0, lat0, step, nx: fnx, ny: fny, dz };

  // Simulación local fina de los primeros minutos (misma física, misma fuente, batimetría interpolada).
  const lh = new Float32Array(fnx * fny);
  for (let j = 0; j < fny; j++) for (let i = 0; i < fnx; i++) {
    const fi = (lon0 + i * step - grid.lon0) / grid.step, fj = (lat0 + j * step - grid.lat0) / grid.step;
    const i0 = Math.max(0, Math.min(grid.nx - 2, Math.floor(fi))), j0 = Math.max(0, Math.min(grid.ny - 2, Math.floor(fj)));
    const u = Math.max(0, Math.min(1, fi - i0)), v = Math.max(0, Math.min(1, fj - j0)), g = (a: number, b: number) => grid.h[b * grid.nx + a];
    lh[j * fnx + i] = (1 - u) * (1 - v) * g(i0, j0) + u * (1 - v) * g(i0 + 1, j0) + (1 - u) * v * g(i0, j0 + 1) + u * v * g(i0 + 1, j0 + 1);
  }
  const leta0 = new Float32Array(fnx * fny);
  for (let k = 0; k < leta0.length; k++) leta0[k] = lh[k] >= 10 ? dz[k] : 0;
  const lsim = createSim({ nx: fnx, ny: fny, lon0, lat0, step, h: lh }, leta0, { sponge: 8 });
  const lframes: Float32Array[] = [Float32Array.from(lsim.eta)];
  const LF = 30;
  for (let tt = LF; tt <= LOCAL_MINUTES * 60; tt += LF) { lsim.runTo(tt); lframes.push(Float32Array.from(lsim.eta)); }
  const local: LocalBirth = { lon0, lat0, step, nx: fnx, ny: fny, h: lh, frames: lframes, frameS: LF };
  const msg: WorkerOut = { type: 'done', fine, local, frames, frameS: FRAME_S, amp: AMP, eta0, arrival: sim.arrival, maxEta: sim.maxEta, series, seriesDt, dt: sim.dt, ms: performance.now() - t0 };
  (self as unknown as Worker).postMessage(msg, [...frames.map((f) => f.buffer), ...lframes.map((f) => f.buffer), lh.buffer, dz.buffer, eta0.buffer, sim.arrival.buffer, sim.maxEta.buffer, ...series.map((s) => s.buffer)]);
};
