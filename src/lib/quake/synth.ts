/*
 * Acelerograma sintético y respuesta de edificios.
 *
 * La fase fuerte (ondas S) se genera con el método estocástico (Boore 2003, PAGEOPH 160:635–676): ruido
 * blanco con la ventana de Saragoni y Hart, filtrado por el espectro de fuente ω² de Brune con atenuación
 * anelástica y kappa. Después se ajusta en frecuencia para que su espectro de respuesta coincida con la
 * mediana de la ecuación de predicción (GMPE): lo que se ve y lo que se mide son el mismo movimiento. El
 * pico de la traza queda cerca de la PGA de la GMPE pero no es idéntico (como en un registro real). La llegada P es ilustrativa (amplitud ~1/4 de la S en la componente horizontal).
 *
 * La respuesta de cada edificio es la de un oscilador de un grado de libertad con 5 % de amortiguamiento
 * (método de Newmark de aceleración promedio), la misma definición del espectro de respuesta.
 */
import type { Motion } from './gmpe';

const G = 9.80665;

/* ───────────── Utilidades ───────────── */

/** Generador pseudoaleatorio con semilla (mulberry32): el mismo escenario da siempre la misma traza. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());
const nextPow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(2, n)));

/** FFT compleja in situ (radix 2). inverse = true para la inversa (sin normalizar). */
export function fft(re: Float64Array, im: Float64Array, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

/** Respuesta de un oscilador (período T, amortiguamiento z) a la aceleración del suelo ag (m/s²): desplazamiento relativo (m). */
export function sdof(ag: Float32Array | Float64Array, dt: number, T: number, z = 0.05) {
  const w = (2 * Math.PI) / T, k = w * w, c = 2 * z * w;
  // Newmark, aceleración promedio (γ = 1/2, β = 1/4), masa unitaria.
  const kh = k + (2 * c) / dt + 4 / (dt * dt);
  const u = new Float32Array(ag.length);
  let ui = 0, vi = 0, ai = -ag[0];
  for (let i = 1; i < ag.length; i++) {
    const dp = -(ag[i] - ag[i - 1]);
    const dph = dp + (4 / dt + 2 * c) * vi + 2 * ai;
    const du = dph / kh;
    const dv = (2 / dt) * du - 2 * vi;
    const da = (4 / (dt * dt)) * du - (4 / dt) * vi - 2 * ai;
    ui += du; vi += dv; ai += da;
    u[i] = ui;
  }
  return u;
}
/** Seudoaceleración espectral (g) = ω²·máx|u|. */
const psa = (ag: Float64Array, dt: number, T: number) => {
  const u = sdof(ag, dt, T);
  let m = 0;
  for (let i = 0; i < u.length; i++) m = Math.max(m, Math.abs(u[i]));
  return (((2 * Math.PI) / T) ** 2 * m) / G;
};
const peak = (a: ArrayLike<number>) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i])); return m; };

/* ───────────── Acelerograma ───────────── */

export type SynthInput = {
  seed: number; mag: number;
  /** Distancia usada para la duración (km). */
  dist: number;
  /** Velocidad S en la fuente (km/s). */
  beta: number;
  tP: number; tS: number;
  /** Objetivos de la GMPE: PGA (g) y espectro (g). */
  pga: Motion; spectrum: { T: number; sa: Motion }[];
  /** Períodos de los edificios que se animan (s). */
  buildings: number[];
};
export type Synth = {
  dt: number; acc: Float32Array; // aceleración horizontal del suelo, en g, desde la hora de origen
  /** Pico de la traza (g). */
  peak: number;
  /** Duración de la fase fuerte según el método estocástico (s). */
  strongDuration: number;
  buildings: { T: number; u: Float32Array; drift: number; sa: number }[];
};

export function synthesize(x: SynthInput): Synth {
  const r = rng(x.seed);
  // Frecuencia de esquina de Brune (Hz) con Δσ = 70 bar; M0 en dina·cm.
  const m0 = 10 ** (1.5 * x.mag + 16.1);
  const fc = 4.906e6 * x.beta * (70 / m0) ** (1 / 3);
  const Tgm = 1 / fc + 0.05 * x.dist; // duración de la fase fuerte
  const tEta = 2 * Tgm; // largo de la ventana (Boore 2003)
  const dt = Tgm > 120 ? 0.04 : 0.02;

  // Fase S: ruido con ventana de Saragoni y Hart (ε = 0,2, η = 0,05).
  const eps = 0.2, eta = 0.05;
  const b = (-eps * Math.log(eta)) / (1 + eps * (Math.log(eps) - 1)), cc = b / eps, aa = (Math.E / eps) ** b;
  const nS = Math.round(tEta / dt), N = nextPow2(nS * 1.25 + Math.round(20 / dt));
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < nS; i++) { const tt = (i * dt) / tEta; re[i] = gauss(r) * aa * tt ** b * Math.exp(-cc * tt); }
  fft(re, im);
  // Espectro de Fourier objetivo: ω² de Brune, atenuación anelástica Q(f) = 180·f^0,45 y kappa 0,04 s.
  const df = 1 / (N * dt);
  let norm = 0;
  for (let k = 1; k < N / 2; k++) norm += re[k] * re[k] + im[k] * im[k];
  norm = Math.sqrt(norm / (N / 2 - 1));
  const shape = (f: number) => (f * f) / (1 + (f / fc) ** 2) * Math.exp((-Math.PI * f * x.dist) / (180 * f ** 0.45 * 3.5)) * Math.exp(-Math.PI * 0.04 * f);
  const scaleBins = (mult: (f: number) => number) => {
    for (let k = 0; k <= N / 2; k++) {
      const m = k === 0 ? 0 : mult(k * df);
      re[k] *= m; im[k] *= m;
      if (k > 0 && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; }
    }
  };
  scaleBins((f) => shape(f) / norm);
  const toTime = () => { const tr = re.slice(), ti = im.slice(); fft(tr, ti, true); for (let i = 0; i < N; i++) tr[i] /= N; return tr; };

  // Ajuste espectral: 8 iteraciones multiplicando el espectro de Fourier por SA_objetivo/SA_simulada.
  // Solo períodos que la traza resuelve (T ≥ 4·dt) y que caben en la ventana.
  const targets = [...x.spectrum].sort((p, q) => p.T - q.T).filter((p) => p.T >= 4 * dt && p.T <= tEta * 2);
  let acc = toTime();
  const accMs2 = () => acc.map((v) => v * G);
  for (let it = 0; it < 8; it++) {
    const a = accMs2();
    const ratios = targets.map((p) => ({ f: 1 / p.T, q: p.sa.median / Math.max(psa(a, dt, p.T), 1e-12) }));
    ratios.sort((p, q) => p.f - q.f);
    const pgaRatio = x.pga.median / Math.max(peak(acc), 1e-12);
    const mult = (f: number) => {
      if (f <= ratios[0].f) return ratios[0].q;
      const fHi = ratios[ratios.length - 1].f;
      if (f >= fHi) { const t = Math.min(1, Math.log(f / fHi) / Math.log(25 / fHi || 2)); return ratios[ratios.length - 1].q * (1 - t) + pgaRatio * t; }
      for (let i = 1; i < ratios.length; i++) if (f <= ratios[i].f) {
        const p = ratios[i - 1], q = ratios[i], u = Math.log(f / p.f) / Math.log(q.f / p.f);
        return Math.exp(Math.log(p.q) * (1 - u) + Math.log(q.q) * u);
      }
      return 1;
    };
    scaleBins(mult);
    acc = toTime();
  }

  // Traza completa desde la hora de origen: P (ilustrativa) + S.
  const total = nextPow2((x.tS + nS * dt + 10) / dt);
  const out = new Float32Array(total);
  const iS = Math.round(x.tS / dt), iP = Math.round(x.tP / dt);
  for (let i = 0; i < N && iS + i < total; i++) out[iS + i] += acc[i];
  // P: más corta y de frecuencia algo más alta (se suaviza el ruido con una media móvil de 3 muestras).
  const pLen = Math.max(1, Math.round(Math.min(Tgm, (x.tS - x.tP) + Tgm) / dt));
  const pAmp = 0.25 * x.pga.median / 2.5;
  let prev = 0;
  for (let i = 0; i < pLen && iP + i < total; i++) {
    const tt = (i * dt) / Math.max(dt, Math.min(Tgm, x.tS - x.tP + 1));
    const env = Math.min(1, tt * 6) * Math.exp(-2.2 * tt);
    const nz = gauss(r);
    out[iP + i] += pAmp * env * (nz + prev) / 1.4;
    prev = nz;
  }

  const ag = Float64Array.from(out, (v) => v * G);
  const buildings = x.buildings.map((T) => {
    const u = sdof(ag, dt, T);
    const drift = peak(u);
    return { T, u, drift, sa: (((2 * Math.PI) / T) ** 2 * drift) / G };
  });
  return { dt, acc: out, peak: peak(out), strongDuration: Tgm, buildings };
}

/**
 * Desplazamiento del suelo (m) a partir de la aceleración (g): doble integración en frecuencia con un
 * filtro pasa-altos suave (coseno entre 0,05 y 0,1 Hz) para quitar la deriva, como se procesan los registros.
 */
export function groundDisplacement(acc: Float32Array, dt: number) {
  const n = 2 ** Math.ceil(Math.log2(acc.length * 1.25));
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < acc.length; i++) re[i] = acc[i] * G;
  fft(re, im);
  const df = 1 / (n * dt);
  for (let k = 0; k <= n / 2; k++) {
    const f = k * df;
    const taper = f < 0.05 ? 0 : f < 0.1 ? 0.5 - 0.5 * Math.cos((Math.PI * (f - 0.05)) / 0.05) : 1;
    const w2 = (2 * Math.PI * f) ** 2, g = k === 0 ? 0 : (-taper / w2);
    re[k] *= g; im[k] *= g;
    if (k > 0 && k < n / 2) { re[n - k] = re[k]; im[n - k] = -im[k]; }
  }
  fft(re, im, true);
  const out = new Float32Array(acc.length);
  for (let i = 0; i < acc.length; i++) out[i] = re[i] / n;
  return out;
}
