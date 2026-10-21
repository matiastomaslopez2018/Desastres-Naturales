/*
 * La fuente sísmica: tamaño, energía y geometría de la ruptura, y distancias al sitio.
 *
 * - Momento sísmico: Hanks y Kanamori (1979), M0 = 10^(1,5·Mw + 9,1) N·m (forma adoptada por IASPEI).
 * - Energía radiada: estimación que publica el USGS, log10 E[J] = 5,24 + 1,44·Mw.
 * - Ruptura: corteza, Wells y Coppersmith (1994) por tipo de falla (largo subsuperficial y ancho);
 *   interplaca, Strasser, Arango y Bommer (2010) (largo y ancho); intraplaca, Strasser et al. (2010) para el
 *   área, con proporción largo/ancho 1,5 supuesta. Deslizamiento medio D = M0 / (μ·A), μ = 3·10¹⁰ Pa.
 */
import { velocity } from './waves';
import type { Mechanism, Setting, Scenario } from './gmpe';

export const RIGIDITY = 3e10; // Pa
export const TNT_TON = 4.184e9; // J

export const moment = (mw: number) => 10 ** (1.5 * mw + 9.1); // N·m
export const energy = (mw: number) => 10 ** (5.24 + 1.44 * mw); // J

export type Rupture = {
  length: number; width: number; area: number; slip: number; dip: number;
  /** Duración aproximada de la ruptura (s): largo / velocidad de ruptura, si se propaga hacia un lado. */
  duration: number;
  /** Extremos del plano en el corte, [x, z] en km (x = 0 bajo el epicentro). */
  top: [number, number]; bottom: [number, number];
  /** Si el ancho se recortó al espesor sismogénico (la corteza frágil, ~20 km). */
  clipped: boolean;
};

/** Inclinación típica del plano según el ambiente y el tipo de falla (grados). */
export const dipFor = (setting: Setting, mech: Mechanism) =>
  setting === 'interface' ? 15 : setting === 'slab' ? 45 : mech === 'strike-slip' ? 90 : mech === 'normal' ? 55 : 35;

/** Dimensiones medianas de la ruptura (km). */
export function ruptureSize(mw: number, setting: Setting, mech: Mechanism) {
  if (setting === 'interface') return { length: 10 ** (-2.477 + 0.585 * mw), width: 10 ** (-0.882 + 0.351 * mw) };
  if (setting === 'slab') { const a = 10 ** (-3.225 + 0.89 * mw); return { length: Math.sqrt(a * 1.5), width: Math.sqrt(a / 1.5) }; }
  const [l, w] = mech === 'strike-slip' ? [[-2.57, 0.62], [-0.76, 0.27]] : mech === 'reverse' ? [[-2.42, 0.58], [-1.61, 0.41]] : [[-1.88, 0.5], [-1.14, 0.35]];
  return { length: 10 ** (l[0] + l[1] * mw), width: 10 ** (w[0] + w[1] * mw) };
}

/** Espesor de la corteza frágil donde ocurren los sismos corticales (km). */
export const SEISMOGENIC = 20;

/**
 * Ruptura centrada en el hipocentro (x = 0, z = depth), inclinada hacia el sitio (x > 0, el sitio queda sobre
 * el bloque colgante) y desplazada para no salir por encima de la superficie.
 */
export function rupture(mw: number, depth: number, setting: Setting, mech: Mechanism): Rupture {
  const { length } = ruptureSize(mw, setting, mech);
  let { width } = ruptureSize(mw, setting, mech);
  const dip = dipFor(setting, mech), s = Math.sin((dip * Math.PI) / 180), c = Math.cos((dip * Math.PI) / 180);
  let clipped = false;
  if (setting === 'crustal') {
    const maxW = Math.max(SEISMOGENIC, depth + 2) / s;
    if (width > maxW) { width = maxW; clipped = true; }
  }
  let zTop = depth - (width / 2) * s;
  if (zTop < 0) zTop = 0;
  const zBot = zTop + width * s;
  // Hipocentro sobre el plano: x a lo largo del buzamiento.
  const xAt = (z: number) => ((z - depth) * c) / Math.max(s, 1e-6);
  const top: [number, number] = [dip === 90 ? 0 : xAt(zTop), zTop], bottom: [number, number] = [dip === 90 ? 0 : xAt(zBot), zBot];
  const area = length * width;
  const slip = moment(mw) / (RIGIDITY * area * 1e6);
  const vr = 0.8 * velocity(Math.min(depth, 60), 'S');
  return { length, width, area, slip, dip, duration: length / vr, top, bottom, clipped };
}

/** Distancias del sitio (en superficie, a `x` km del epicentro) a la fuente, en km. */
export function distances(x: number, depth: number, r: Rupture) {
  const [x1, z1] = r.top, [x2, z2] = r.bottom;
  // Distancia a la ruptura: al segmento del corte (el sitio está frente al centro del largo de la falla).
  const dx = x2 - x1, dz = z2 - z1, L2 = dx * dx + dz * dz;
  const u = L2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (0 - z1) * dz) / L2)) : 0;
  const rrup = Math.hypot(x - (x1 + u * dx), 0 - (z1 + u * dz));
  const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
  const rjb = x < lo ? lo - x : x > hi ? x - hi : 0;
  return { rjb, rrup, rhypo: Math.hypot(x, depth) };
}

export type ScenarioInput = { mag: number; setting: Setting; mech: Mechanism; depth: number; dist: number };
export function scenario(i: ScenarioInput): { s: Scenario; rup: Rupture } {
  const mech = i.setting === 'crustal' ? i.mech : 'reverse';
  const rup = rupture(i.mag, i.depth, i.setting, mech);
  return { s: { mag: i.mag, setting: i.setting, mech, depth: i.depth, ...distances(i.dist, i.depth, rup) }, rup };
}

/* ───────────── Escala de energía ───────────── */

/** Energía en una unidad legible. */
export function tnt(j: number) {
  const t = j / TNT_TON;
  if (t >= 1e6) return { value: t / 1e6, unit: 'Mt' as const };
  if (t >= 1e3) return { value: t / 1e3, unit: 'kt' as const };
  return { value: t, unit: 't' as const };
}
/** Bomba de Hiroshima: ~15 kt de TNT (Departamento de Energía de EE. UU.). */
export const HIROSHIMA_J = 15e3 * TNT_TON;

/** Promedio anual mundial por clase de magnitud, catálogo ComCat del USGS, 2000–2024 (contado con su API). */
export const PER_YEAR: { from: number; to: number; n: number }[] = [
  { from: 5, to: 6, n: 1624 }, { from: 6, to: 7, n: 134 }, { from: 7, to: 8, n: 13.8 }, { from: 8, to: 10, n: 1.1 },
];
