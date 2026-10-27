/*
 * Caída de tefra (ceniza y lapilli): modelo de advección y difusión de Suzuki (1983) en la forma de
 * Bonadonna et al. (2005) —el modelo Tephra2—, implementado acá a partir de las ecuaciones publicadas.
 *
 * - La columna se divide en capas; de cada una se suelta una fracción de la masa según una distribución
 *   beta de la altura (más masa cerca del tope).
 * - La granulometría es normal en unidades φ (φ = −log2 del diámetro en mm).
 * - Velocidad de caída: Bonadonna et al. (1998), con régimen laminar, intermedio y turbulento según el
 *   número de Reynolds, y densidad del aire que baja con la altura (escala de 8,2 km).
 * - Densidad de las partículas: pómez (gruesas) y líticos (finas), con una transición lineal en φ.
 * - El viento de cada capa (perfil por altura) desplaza a cada partícula mientras cae.
 * - Difusión: lineal para las partículas gruesas (coeficiente K) y ley de 5/2 de la turbulencia
 *   atmosférica para las finas (constante C) a partir de un tiempo de caída umbral (Suzuki, 1983).
 * La carga en cada punto es la suma de gaussianas: m / (π σ) · exp(−r² / σ), con r la distancia al punto
 * donde cae el centro de cada fracción y σ que crece con el tiempo de caída.
 */

export type WindLevel = { h: number; u: number; v: number };
export type WindProfile = WindLevel[];

export type TephraParams = {
  /** Altura de la boca (m s. n. m.) y del tope de la columna (m s. n. m.). */
  vent: number; top: number;
  /** Masa de tefra (kg). */
  mass: number;
  /** Granulometría: mediana y desvío (φ). */
  md: number; sigma: number;
  /** Altura del terreno donde cae la ceniza (m s. n. m.). */
  ground: number;
  wind: WindProfile;
  /** Forma de la distribución de masa en la columna (beta). */
  alpha?: number; beta?: number;
  /** Difusión de partículas gruesas K (m²/s), constante de difusión de las finas C (m²/s) y tiempo de cambio (s). */
  K?: number; C?: number; fallThreshold?: number;
  /** Densidad de la pómez y de los líticos (kg/m³). */
  pumice?: number; lithic?: number;
};

export const TEPHRA_DEFAULTS = { alpha: 3, beta: 2, K: 3000, C: 0.04, fallThreshold: 1500, pumice: 1000, lithic: 2600 };

const G = 9.81, AIR0 = 1.293, MU = 1.8325e-5, PHI_MIN = -5, PHI_MAX = 8, N_PHI = 26, N_COL = 40;

/** Viento (m/s hacia el este y el norte) a la altura z, interpolado linealmente entre niveles. */
export function windAt(w: WindProfile, z: number) {
  if (!w.length) return { u: 0, v: 0 };
  if (z <= w[0].h) return { u: w[0].u, v: w[0].v };
  for (let k = 1; k < w.length; k++) if (z <= w[k].h) {
    const a = w[k - 1], b = w[k], t = (z - a.h) / (b.h - a.h);
    return { u: a.u + t * (b.u - a.u), v: a.v + t * (b.v - a.v) };
  }
  const l = w[w.length - 1];
  return { u: l.u, v: l.v };
}

/** Velocidad de caída (m/s) de una partícula de diámetro d (m) y densidad rho (kg/m³) a la altura z (m). */
export function settling(d: number, rho: number, z: number) {
  const air = AIR0 * Math.exp(-z / 8200);
  const vl = (rho * G * d * d) / (18 * MU);
  if ((d * air * vl) / MU < 6) return vl;
  const vi = d * Math.cbrt((4 * G * G * rho * rho) / (225 * MU * air));
  if ((d * air * vi) / MU < 500) return vi;
  return Math.sqrt((3.1 * rho * G * d) / air);
}

/** Densidad de la partícula según su tamaño: pómez si φ ≤ −1, lítico si φ ≥ 7, lineal entre medio. */
const density = (phi: number, pumice: number, lithic: number) => (phi <= -1 ? pumice : phi >= 7 ? lithic : pumice + ((lithic - pumice) * (phi + 1)) / 8);

/** Una fracción de masa que cae: masa, desplazamiento del centro (m, este y norte) y su dispersión σ (m²). */
export type Parcel = { m: number; x: number; y: number; s: number; phi: number };

export function parcels(p: TephraParams): Parcel[] {
  // Los parámetros que no vienen (o vienen sin valor) toman el valor por omisión.
  const o = { ...p } as Required<TephraParams>;
  for (const [k, v] of Object.entries(TEPHRA_DEFAULTS)) if ((p as Record<string, unknown>)[k] == null) (o as Record<string, unknown>)[k] = v;
  const out: Parcel[] = [];
  const dz = (o.top - o.vent) / N_COL, dphi = (PHI_MAX - PHI_MIN) / N_PHI;
  // Pesos de la columna (beta) y de la granulometría (normal en φ), normalizados.
  const wc = Array.from({ length: N_COL }, (_, j) => { const x = Math.min(0.999, (j + 1) / N_COL); return x ** (o.alpha - 1) * (1 - x) ** (o.beta - 1); });
  const wp = Array.from({ length: N_PHI }, (_, i) => { const f = PHI_MIN + (i + 0.5) * dphi; return Math.exp(-((f - o.md) ** 2) / (2 * o.sigma * o.sigma)); });
  const sc = wc.reduce((a, b) => a + b, 0), sp = wp.reduce((a, b) => a + b, 0);
  for (let i = 0; i < N_PHI; i++) {
    const phi = PHI_MIN + (i + 0.5) * dphi, d = 1e-3 * 2 ** -phi, rho = density(phi, o.pumice, o.lithic);
    // Caída desde la boca hasta el suelo (con el viento del nivel más bajo de esa franja).
    let tLow = 0, xLow = 0, yLow = 0;
    const below = Math.max(0, o.vent - o.ground), nb = Math.max(1, Math.ceil(below / 500));
    for (let k = 0; k < nb && below > 0; k++) {
      const z = o.vent - (below * (k + 0.5)) / nb, dt = below / nb / settling(d, rho, z), w = windAt(o.wind, z);
      tLow += dt; xLow += w.u * dt; yLow += w.v * dt;
    }
    // Desde cada capa de la columna hasta la boca, acumulando tiempo y arrastre del viento capa por capa.
    let t = 0, x = 0, y = 0;
    for (let j = 0; j < N_COL; j++) {
      const z = o.vent + (j + 1) * dz, dt = dz / settling(d, rho, z), w = windAt(o.wind, z - dz / 2);
      t += dt; x += w.u * dt; y += w.v * dt;
      const m = (o.mass * (wc[j] / sc) * (wp[i] / sp));
      if (m <= 0) continue;
      const h = (j + 1) * dz, T = t + tLow;
      // Tiempo de difusión inicial en la columna (radio de la pluma) y dispersión según el régimen.
      const s = T >= o.fallThreshold ? (8 / 5) * o.C * (T + (0.2 * h * h) ** 0.4) ** 2.5 : 4 * o.K * (T + (0.0032 * h * h) / o.K);
      out.push({ m, x: x + xLow, y: y + yLow, s, phi });
    }
  }
  return out;
}

/** Carga (kg/m²) en un punto a (dx, dy) m de la boca (este, norte). */
export function loadAt(ps: Parcel[], dx: number, dy: number) {
  let sum = 0;
  for (const p of ps) {
    const e = ((dx - p.x) ** 2 + (dy - p.y) ** 2) / p.s;
    if (e < 40) sum += (p.m / (Math.PI * p.s)) * Math.exp(-e);
  }
  return sum;
}

/** Grilla de carga (kg/m²) de nx×ny celdas centrada en (cx, cy) m con paso h (m); filas de norte a sur. */
export function loadGrid(ps: Parcel[], cx: number, cy: number, h: number, nx: number, ny: number) {
  const out = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) out[j * nx + i] = loadAt(ps, cx + (i - (nx - 1) / 2) * h, cy + ((ny - 1) / 2 - j) * h);
  return out;
}

/**
 * Recuadro que contiene el depósito visible (desde ~0,05 kg/m², medio milímetro de ceniza): el centro de
 * masa de las fracciones y su extensión. Devuelve centro y medio lado (m).
 */
export function extent(ps: Parcel[]) {
  let mx = 0, my = 0, mt = 0;
  for (const p of ps) { mx += p.m * p.x; my += p.m * p.y; mt += p.m; }
  mx /= mt; my /= mt;
  let r = 5000;
  for (const p of ps) {
    // Hasta dónde llega esta fracción con al menos 0,05 kg/m² en su eje.
    const peak = p.m / (Math.PI * p.s);
    if (peak < 0.05) continue;
    const reach = Math.sqrt(p.s * Math.log(peak / 0.05));
    r = Math.max(r, Math.abs(p.x - mx) + reach, Math.abs(p.y - my) + reach);
  }
  // Que entre la boca.
  r = Math.max(r * 1.15, Math.abs(mx) + 3000, Math.abs(my) + 3000);
  return { cx: mx, cy: my, half: Math.min(r, 1.2e6) };
}

/* ───────────── Columna eruptiva ───────────── */

/** Densidad del magma sin burbujas (DRE) que usa Mastin et al. (2009), kg/m³. */
export const DRE = 2500;

/** Tasa de emisión (kg/s) para una columna de `km` sobre la boca: H = 2,00·V^0,241, V en m³/s DRE (Mastin et al., 2009). */
export const merFromHeight = (km: number) => DRE * (Math.max(km, 0.05) / 2) ** (1 / 0.241);
export const heightFromMer = (mer: number) => 2 * (mer / DRE) ** 0.241;

/** Índice de explosividad volcánica (VEI) según el volumen de tefra (m³, depósito). */
export function vei(volM3: number) {
  const cuts = [1e4, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12];
  let k = 0;
  while (k < cuts.length && volM3 >= cuts[k]) k++;
  return k;
}
