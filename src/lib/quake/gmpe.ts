/*
 * Movimiento del suelo esperado (ecuaciones de predicción, GMPE) y su conversión a intensidad.
 *
 * - Corteza superficial: Boore, Stewart, Seyhan y Atkinson (2014), "BSSA14" (NGA-West2). Rango: Mw 3–8,5
 *   (hasta 7 en fallas normales), distancia Joyner-Boore 0–400 km, Vs30 150–1500 m/s.
 * - Subducción (interplaca e intraplaca): Abrahamson, Gregor y Addo (2016), "BC Hydro", modelo central y
 *   ergódico, sitio en el antearco (sin término de trasarco). Rango: Mw 5–9,2, hasta ~300 km.
 * - Intensidad: Worden, Gerstenberger, Rhoades y Wald (2012), la conversión que usa ShakeMap (USGS).
 *
 * Las fórmulas siguen término a término la implementación de referencia de OpenQuake (GEM Foundation) y
 * se verifican contra sus tablas de prueba (scripts/verify-gmpe.ts).
 */
import { BCHYDRO, BCH_DC1_INTERFACE, BCH_FIELDS, BSSA14, BSSA_FIELDS } from './coeffs';

/** Gravedad estándar en cm/s² (para pasar de g a cm/s²). */
export const G_CMS2 = 980.665;

export type Mechanism = 'strike-slip' | 'normal' | 'reverse';
export type Setting = 'crustal' | 'interface' | 'slab';
/** 'pga', 'pgv' o un período espectral en segundos. */
export type Imt = 'pga' | 'pgv' | number;

/** Mediana (en g; PGV en cm/s) y desviación estándar total del logaritmo natural. */
export type Motion = { median: number; sigma: number };

const row = <K extends string>(fields: readonly K[], values: number[]) => Object.fromEntries(fields.map((f, i) => [f, values[i]])) as Record<K, number>;
const imtKey = (imt: Imt) => (typeof imt === 'number' ? String(imt) : imt);

/* ───────────── BSSA14 ───────────── */

export const BSSA_PERIODS = Object.keys(BSSA14).filter((k) => k !== 'pga' && k !== 'pgv').map(Number).sort((a, b) => a - b);

function bssaCoeffs(imt: Imt) {
  const v = BSSA14[imtKey(imt)];
  if (!v) throw new Error(`BSSA14: sin coeficientes para ${imt}`);
  return row(BSSA_FIELDS, v);
}
type BssaC = ReturnType<typeof bssaCoeffs>;

/** Término de magnitud (ecuación 2), con el estilo de falla. */
function bssaMag(C: BssaC, mag: number, mech: Mechanism) {
  const sof = mech === 'strike-slip' ? C.e1 : mech === 'normal' ? C.e2 : C.e3;
  const dm = mag - C.Mh;
  return sof + (mag <= C.Mh ? C.e4 * dm + C.e5 * dm * dm : C.e6 * dm);
}
/** Término de trayectoria (ecuación 3): expansión geométrica y atenuación anelástica. */
function bssaPath(C: BssaC, mag: number, rjb: number) {
  const r = Math.sqrt(rjb * rjb + C.h * C.h);
  return (C.c1 + C.c2 * (mag - 4.5)) * Math.log(r / 1) + (C.c3 + C.Dc3) * (r - 1);
}

export type CrustalInput = { mag: number; mech: Mechanism; rjb: number; vs30: number };

/** Mediana y sigma de BSSA14 (sin término de cuenca). */
export function bssa14(imt: Imt, x: CrustalInput): Motion {
  const C = bssaCoeffs(imt), P = bssaCoeffs('pga');
  const pgaRock = Math.exp(bssaMag(P, x.mag, x.mech) + bssaPath(P, x.mag, x.rjb));
  // Sitio: lineal (ecuación 6) + no lineal (ecuación 7): en suelos blandos la amplificación baja cuando el sacudón es fuerte.
  const flin = C.c * Math.log(Math.min(x.vs30, C.Vc) / 760);
  const vs = Math.min(x.vs30, 760);
  const f2 = C.f4 * (Math.exp(C.f5 * (vs - 360)) - Math.exp(C.f5 * 400));
  const fnl = 0 + f2 * Math.log((pgaRock + 0.1) / 0.1);
  const lnY = bssaMag(C, x.mag, x.mech) + bssaPath(C, x.mag, x.rjb) + flin + fnl;
  // Desviaciones (ecuaciones 13–17).
  const tau = x.mag <= 4.5 ? C.tau1 : x.mag >= 5.5 ? C.tau2 : C.tau1 + (C.tau2 - C.tau1) * (x.mag - 4.5);
  let phi = x.mag <= 4.5 ? C.f1 : x.mag >= 5.5 ? C.f2 : C.f1 + (C.f2 - C.f1) * (x.mag - 4.5);
  if (x.rjb > C.R2) phi += C.DfR;
  else if (x.rjb > C.R1) phi += C.DfR * (Math.log(x.rjb / C.R1) / Math.log(C.R2 / C.R1));
  if (x.vs30 <= 225) phi -= C.DfV;
  else if (x.vs30 <= 300) phi -= C.DfV * (Math.log(300 / x.vs30) / Math.log(300 / 225));
  return { median: Math.exp(lnY), sigma: Math.sqrt(tau * tau + phi * phi) };
}

/* ───────────── BC Hydro ───────────── */

export const BCH_PERIODS = Object.keys(BCHYDRO).filter((k) => k !== 'pga').map(Number).sort((a, b) => a - b);
const BCH = { n: 1.18, c: 1.88, theta3: 0.1, theta4: 0.9, theta5: 0, theta9: 0.4, c4: 10, C1: 7.8 };

function bchCoeffs(imt: Imt) {
  if (imt === 'pgv') throw new Error('BC Hydro no tiene PGV');
  const v = BCHYDRO[imtKey(imt)];
  if (!v) throw new Error(`BC Hydro: sin coeficientes para ${imt}`);
  return row(BCH_FIELDS, v);
}
type BchC = ReturnType<typeof bchCoeffs>;

/** ΔC1 de interplaca: tabla del modelo central, interpolada en log(período) como hace OpenQuake. */
function dc1Interface(imt: Imt) {
  if (imt === 'pga') return BCH_DC1_INTERFACE.find(([k]) => k === 'pga')![1];
  const T = imt as number;
  const pts = BCH_DC1_INTERFACE.filter(([k]) => k !== 'pga') as [number, number][];
  if (T <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
    if (T <= t1) return v0 + ((v1 - v0) * Math.log(T / t0)) / Math.log(t1 / t0);
  }
  return pts[pts.length - 1][1];
}

export type SubductionInput = { mag: number; setting: 'interface' | 'slab'; /** Interplaca: distancia a la ruptura; intraplaca: hipocentral (km). */ dist: number; depth: number; vs30: number };

function bchRock(C: BchC, dc1: number, x: SubductionInput) {
  // Magnitud (ecuación 2).
  const dmag = BCH.C1 + dc1;
  const fmag = C.theta1 + BCH.theta4 * dc1 + (x.mag > dmag ? BCH.theta5 * (x.mag - dmag) : BCH.theta4 * (x.mag - dmag)) + C.theta13 * (10 - x.mag) ** 2;
  // Distancia (con los términos propios de intraplaca).
  const slab = x.setting === 'slab';
  const th14 = slab ? C.theta14 : 0, th10 = slab ? C.theta10 : 0;
  const fdist = (C.theta2 + th14 + BCH.theta3 * (x.mag - BCH.C1)) * Math.log(x.dist + BCH.c4 * Math.exp((x.mag - 6) * BCH.theta9)) + C.theta6 * x.dist + th10;
  // Profundidad focal (ecuación 3, solo intraplaca).
  const fdepth = slab ? C.theta11 * (Math.min(x.depth, 120) - 60) : 0;
  return fmag + fdist + fdepth; // antearco: sin término de trasarco
}

/** Mediana y sigma de BC Hydro (modelo central, ergódico, antearco). */
export function bcHydro(imt: Imt, x: SubductionInput): Motion {
  const C = bchCoeffs(imt), P = bchCoeffs('pga');
  const dc1 = x.setting === 'slab' ? -0.3 : dc1Interface(imt);
  const dc1Pga = x.setting === 'slab' ? -0.3 : dc1Interface('pga');
  const pga1000 = Math.exp(bchRock(P, dc1Pga, x) + (P.theta12 + P.b * BCH.n) * Math.log(1000 / P.vlin));
  // Respuesta de sitio (Walling et al. 2008), no lineal por debajo de vlin.
  const arg = Math.min(x.vs30, 1000) / C.vlin;
  let site = C.theta12 * Math.log(arg);
  if (x.vs30 >= C.vlin) site += C.b * BCH.n * Math.log(arg);
  else site += -C.b * Math.log(pga1000 + BCH.c) + C.b * Math.log(pga1000 + BCH.c * arg ** BCH.n);
  return { median: Math.exp(bchRock(C, dc1, x) + site), sigma: C.sigma };
}

/* ───────────── Intensidad (Worden et al. 2012) ───────────── */

/** Coeficientes de la tabla 1 (y extensión para MMI < 2 de ShakeMap). PGA en cm/s², PGV en cm/s. */
const WGRW12 = {
  pga: { c1: 1.78, c2: 1.55, c3: -1.6, c4: 3.7, t1: 1.57, sigma: 0.73, lo: { c1: 1.71, c2: 2.08, t1: 0.14 } },
  pgv: { c1: 3.78, c2: 1.47, c3: 2.89, c4: 3.16, t1: 0.53, sigma: 0.65, lo: { c1: 4.62, c2: 2.17, t1: -1.21 } },
};

/** Intensidad de Mercalli Modificada a partir de PGA (cm/s²) o PGV (cm/s), recortada a 1–10 como ShakeMap. */
export function mmiFrom(kind: 'pga' | 'pgv', value: number) {
  const C = WGRW12[kind], x = Math.log10(Math.max(value, 1e-6));
  const mmi = x <= C.lo.t1 ? C.lo.c1 + C.lo.c2 * x : x <= C.t1 ? C.c1 + C.c2 * x : C.c3 + C.c4 * x;
  return Math.max(1, Math.min(10, mmi));
}
/** Pendiente dMMI/dlog10(Y) en el valor dado (para propagar la incertidumbre del movimiento). */
function mmiSlope(kind: 'pga' | 'pgv', value: number) {
  const C = WGRW12[kind], x = Math.log10(Math.max(value, 1e-6));
  return x <= C.lo.t1 ? C.lo.c2 : x <= C.t1 ? C.c2 : C.c4;
}
/** Desviación de la intensidad: la propia de la conversión más la del movimiento (en ln) propagada. */
export const mmiSigma = (kind: 'pga' | 'pgv', value: number, lnSigma: number) =>
  Math.sqrt((lnSigma * Math.LOG10E * mmiSlope(kind, value)) ** 2 + WGRW12[kind].sigma ** 2);

/* ───────────── Fachada ───────────── */

export type Site = { vs30: number };
export type Scenario = {
  mag: number; setting: Setting; mech: Mechanism; depth: number;
  /** Distancias desde el sitio (km): Joyner-Boore, a la ruptura e hipocentral. */
  rjb: number; rrup: number; rhypo: number;
};

/** Modelo que corresponde al escenario. */
export const modelFor = (s: Pick<Scenario, 'setting'>) => (s.setting === 'crustal' ? 'BSSA14' : 'BC Hydro 2016');

/** Movimiento para una medida (g; PGV en cm/s). PGV solo existe en BSSA14. */
export function motion(imt: Imt, s: Scenario, site: Site): Motion {
  if (s.setting === 'crustal') return bssa14(imt, { mag: s.mag, mech: s.mech, rjb: s.rjb, vs30: site.vs30 });
  return bcHydro(imt, { mag: s.mag, setting: s.setting, dist: s.setting === 'interface' ? s.rrup : s.rhypo, depth: s.depth, vs30: site.vs30 });
}

/** Períodos disponibles para el espectro de respuesta del modelo. */
export const periodsFor = (setting: Setting) => (setting === 'crustal' ? BSSA_PERIODS : BCH_PERIODS);

export type Shaking = {
  pga: Motion; pgv: Motion | null;
  /** Intensidad media y su desviación; viene de PGV si el modelo la tiene (preferencia de ShakeMap), si no de PGA. */
  mmi: number; mmiSigma: number; mmiFrom: 'pga' | 'pgv';
  spectrum: { T: number; sa: Motion }[];
};

export function shaking(s: Scenario, site: Site): Shaking {
  const pga = motion('pga', s, site);
  const pgv = s.setting === 'crustal' ? motion('pgv', s, site) : null;
  const kind = pgv ? 'pgv' : 'pga';
  const val = pgv ? pgv.median : pga.median * G_CMS2;
  const sig = pgv ? pgv.sigma : pga.sigma;
  return {
    pga, pgv,
    mmi: mmiFrom(kind, val), mmiSigma: mmiSigma(kind, val, sig), mmiFrom: kind,
    spectrum: periodsFor(s.setting).map((T) => ({ T, sa: motion(T, s, site) })),
  };
}

/** Rango de validez de cada modelo (para avisar cuando el escenario se sale). */
export function outOfRange(s: Scenario, site: Site): string[] {
  const out: string[] = [];
  if (s.setting === 'crustal') {
    const mMax = s.mech === 'normal' ? 7 : 8.5;
    if (s.mag > mMax) out.push('mag');
    if (s.rjb > 400) out.push('dist');
    if (s.depth > 25) out.push('depth');
  } else {
    if (s.mag < 5 || s.mag > 9.2) out.push('mag');
    if ((s.setting === 'interface' ? s.rrup : s.rhypo) > 300) out.push('dist');
    if (s.setting === 'interface' && s.depth > 60) out.push('depth');
  }
  if (site.vs30 < 150 || site.vs30 > 1500) out.push('vs30');
  return out;
}
