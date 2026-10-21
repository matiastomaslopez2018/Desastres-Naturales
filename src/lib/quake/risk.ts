/*
 * Daño en una cuadra de ejemplo: funciones de vulnerabilidad de GEM (pérdida estructural según la
 * intensidad) evaluadas con la intensidad que predice la GMPE en el sitio, con su incertidumbre.
 *
 * Cada construcción usa la medida de intensidad de su función (PGA o SA a su período). La pérdida es una
 * razón entre 0 y 1 (costo de reparación / costo de reposición) con distribución beta, como en OpenQuake.
 * Los niveles de daño de la animación son cortes orientativos de este simulador sobre esa razón
 * (1 %, 4,5 %, 22 % y 71 %): separan daño leve, moderado, extenso y casi total o colapso.
 */
import { GEM_ARG, type VulnFunction } from './vulnerability';
import type { Motion, Shaking } from './gmpe';

export type DamageState = 0 | 1 | 2 | 3 | 4; // ninguno, leve, moderado, extenso, completo
export const DS_CUTS = [0.01, 0.045, 0.22, 0.71];
export const damageState = (lr: number): DamageState => (lr < DS_CUTS[0] ? 0 : lr < DS_CUTS[1] ? 1 : lr < DS_CUTS[2] ? 2 : lr < DS_CUTS[3] ? 3 : 4);

/* ───────────── Construcciones de la cuadra ───────────── */

export type Kind = 'adobe' | 'brick' | 'wood' | 'confined' | 'rc-frame' | 'rc-wall';
export type BuildingClass = {
  fn: VulnFunction; kind: Kind; floors: number;
  /** Período fundamental aproximado (s), para la animación. */
  T: number;
  /** Nivel de diseño sismorresistente según la taxonomía de GEM (CDN ninguno … CDH alto). */
  design: 'none' | 'low' | 'moderate' | 'high';
  use: 'res' | 'com';
};
const kindOf = (id: string): Kind =>
  id.startsWith('MUR+ADO') ? 'adobe' : id.startsWith('MUR') ? 'brick' : id.startsWith('W/') ? 'wood' : id.startsWith('MCF') ? 'confined' : id.includes('LWAL') ? 'rc-wall' : 'rc-frame';
const designOf = (id: string) => (/CDN/.test(id) ? 'none' : /CDL/.test(id) ? 'low' : /CDM/.test(id) ? 'moderate' : 'high') as BuildingClass['design'];

export const BLOCK: BuildingClass[] = GEM_ARG.map((fn) => {
  const floors = Number(/H:(\d+)/.exec(fn.id)![1]), kind = kindOf(fn.id);
  // Período aproximado: ~0,1 s por piso; los muros de hormigón son más rígidos y la madera, liviana.
  const T = Math.max(0.1, kind === 'rc-wall' ? 0.075 * floors : kind === 'wood' ? 0.15 : 0.1 * floors);
  return { fn, kind, floors, T: +T.toFixed(2), design: designOf(fn.id), use: /\/COM/.test(fn.id) ? 'com' : 'res' };
});

/** Período de la medida de intensidad de una función ('PGA' → null). */
const imtPeriod = (imt: string) => (imt === 'PGA' ? null : Number(/SA\(([\d.]+)\)/.exec(imt)![1]));

/** Intensidad (mediana y sigma) que corresponde a la función, sacada del resultado de la GMPE. */
export function intensityFor(fn: VulnFunction, sh: Shaking): Motion {
  const T = imtPeriod(fn.imt);
  if (T == null) return sh.pga;
  const p = sh.spectrum.find((s) => Math.abs(s.T - T) < 1e-6);
  if (!p) throw new Error(`Sin SA(${T}) en el espectro`);
  return p.sa;
}

/** Media y CoV de la pérdida a una intensidad (interpolación lineal en log de la intensidad). */
export function lossAt(fn: VulnFunction, im: number) {
  const x = fn.imls;
  if (im <= x[0]) return { mean: 0, cov: 0 };
  const k = Math.min(x.length - 1, x.findIndex((v) => v >= im));
  if (k <= 0) return { mean: fn.mean[x.length - 1], cov: fn.cov[x.length - 1] };
  const u = Math.log(im / x[k - 1]) / Math.log(x[k] / x[k - 1]);
  return { mean: fn.mean[k - 1] + u * (fn.mean[k] - fn.mean[k - 1]), cov: fn.cov[k - 1] + u * (fn.cov[k] - fn.cov[k - 1]) };
}

/* ───────────── Muestreo ───────────── */

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const normal = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());
/**
 * Logaritmo de una muestra Gamma(k, 1) (Marsaglia y Tsang). En logaritmos porque con forma k muy chica
 * (CoV de pérdida muy alto) la muestra cae por debajo del menor número representable.
 */
function logGamma(r: () => number, k: number): number {
  if (k < 1) return logGamma(r, k + 1) + Math.log(Math.max(r(), 1e-300)) / k;
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do { x = normal(r); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = r();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return Math.log(d * v);
  }
}
/**
 * Razón de pérdida con distribución beta de media y CoV dados. Si la varianza pedida supera la máxima
 * posible para esa media, se acota (la distribución queda concentrada cerca de 0 y de 1).
 */
export function sampleLoss(r: () => number, mean: number, cov: number) {
  if (mean <= 1e-6) return 0;
  if (mean >= 1 - 1e-6) return 1;
  const v = Math.min((cov * mean) ** 2, 0.99 * mean * (1 - mean));
  const s = (mean * (1 - mean)) / v - 1, a = mean * s, b = (1 - mean) * s;
  const lx = logGamma(r, a), ly = logGamma(r, b);
  return 1 / (1 + Math.exp(ly - lx));
}

export type BuildingRisk = {
  cls: BuildingClass;
  /** Intensidad mediana de su función (g). */
  im: number; imt: string;
  /** Pérdida esperada (media sobre la incertidumbre del sacudón y de la vulnerabilidad). */
  expected: number;
  /** Probabilidad de alcanzar o superar cada nivel de daño (leve, moderado, extenso, completo). */
  pAtLeast: [number, number, number, number];
};

/**
 * Correlación del sacudón entre las medidas de intensidad de los distintos edificios (PGA y SA entre 0,3 y
 * 1 s en un mismo sitio): ~0,8 según Baker y Jayaram (2008). Cada edificio recibe ε = ρ·ε_común + √(1−ρ²)·ε_propio.
 */
export const RHO = 0.8;

/** Estadística de la cuadra por Monte Carlo (n tiradas del sacudón y de la vulnerabilidad). */
export function blockRisk(sh: Shaking, n = 3000, seed = 1): BuildingRisk[] {
  const r = rng(seed);
  const common = Array.from({ length: n }, () => normal(r));
  return BLOCK.map((cls) => {
    const m = intensityFor(cls.fn, sh);
    let sum = 0;
    const cnt = [0, 0, 0, 0];
    for (const ec of common) {
      const e = RHO * ec + Math.sqrt(1 - RHO * RHO) * normal(r);
      const { mean, cov } = lossAt(cls.fn, m.median * Math.exp(m.sigma * e));
      const lr = sampleLoss(r, mean, cov);
      sum += lr;
      const ds = damageState(lr);
      for (let k = 0; k < ds; k++) cnt[k]++;
    }
    return { cls, im: m.median, imt: cls.fn.imt, expected: sum / n, pAtLeast: cnt.map((c) => c / n) as BuildingRisk['pAtLeast'] };
  });
}

/**
 * Daño típico de cada construcción para la vista inicial: la mediana de su distribución (el nivel más alto
 * que se alcanza o supera con al menos 50 % de probabilidad). Es más representativo que el nivel más
 * probable cuando la probabilidad se reparte entre varios niveles.
 */
export function typicalDamage(risk: BuildingRisk[]) {
  return risk.map((b) => {
    let ds: DamageState = 0;
    b.pAtLeast.forEach((p, k) => { if (p >= 0.5) ds = (k + 1) as DamageState; });
    return { ds, lr: [0, 0.02, 0.1, 0.4, 0.9][ds] };
  });
}

/**
 * Un resultado posible para la animación. Con common = 0 el sacudón de la cuadra es el mediano (la vista
 * inicial); sin darlo, se sortea. Devuelve también el ε común usado (cuántas desviaciones sobre la mediana).
 */
export function blockOutcome(sh: Shaking, seed: number, common?: number) {
  const r = rng(seed);
  const ec = common ?? normal(r);
  const items = BLOCK.map((cls) => {
    const e = RHO * ec + Math.sqrt(1 - RHO * RHO) * normal(r);
    const m = intensityFor(cls.fn, sh);
    const { mean, cov } = lossAt(cls.fn, m.median * Math.exp(m.sigma * e));
    const lr = sampleLoss(r, mean, cov);
    return { lr, ds: damageState(lr) };
  });
  return { eps: ec, items };
}
