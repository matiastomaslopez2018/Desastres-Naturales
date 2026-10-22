/*
 * Datos de la película del sismo que comparten la escena 3D, la 2D y los textos: la ventana del bloque de
 * corteza y la respuesta de la cuadra (los mismos osciladores y el mismo daño típico que la animación 2D).
 */
import { BLOCK, blockRisk, typicalDamage, type DamageState } from '@/lib/quake/risk';
import { sdof, type Synth } from '@/lib/quake/synth';
import type { Arrival } from '@/lib/quake/waves';
import type { Mechanism, Setting, Shaking } from '@/lib/quake/gmpe';
import type { Rupture } from '@/lib/quake/source';
import type { QTiming } from '@/lib/quake/movie';
import type { Lang } from '@/lib/types';
import { G } from './cityDraw';

const NICE = [1, 2, 5, 10, 20, 50, 100, 200];

/** Bloque de corteza (km): de x0 a x1 en el corte (el lugar en x = dist), hasta zMax de profundidad y Lz a lo largo del rumbo. */
export type TectonicView = { x0: number; x1: number; zMax: number; Lz: number; ve: number };

export function tectonicView(depth: number, dist: number, rup: Rupture): TectonicView {
  const xs = [0, dist, rup.top[0], rup.bottom[0]];
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  const pad = Math.max((x1 - x0) * 0.15, 10);
  x0 -= pad; x1 += pad;
  const zMax = Math.min(Math.max(Math.max(depth, rup.bottom[1]) * 1.4, 45), 700);
  const Lz = Math.min(Math.max(rup.length / 2 * 1.2, (x1 - x0) * 0.45), (x1 - x0) * 1.2);
  // Exageración vertical cuando el bloque es muy chato (se informa en pantalla).
  const ve = Math.max(1, Math.min(4, Math.round(((0.3 * (x1 - x0)) / zMax) * 2) / 2));
  return { x0, x1, zMax, Lz, ve };
}

export type BlockResponse = {
  bld: { u: Float32Array; peak: number; peakAt: number; onset: number; ds: DamageState }[];
  tree: Float32Array;
  /** Exageración común de los desplazamientos de las construcciones. */
  exag: number;
};

export function blockResponse(synth: Synth, sh: Shaking, tS: number): BlockResponse {
  const ag = Float64Array.from(synth.acc, (v) => v * G);
  const typical = typicalDamage(blockRisk(sh));
  const bld = BLOCK.map((b, i) => {
    const u = sdof(ag, synth.dt, b.T);
    let m = 0, at = 0;
    for (let k = 0; k < u.length; k++) if (Math.abs(u[k]) > m) { m = Math.abs(u[k]); at = k * synth.dt; }
    let onset = at;
    for (let k = 0; k < u.length; k++) if (Math.abs(u[k]) >= 0.6 * m) { onset = k * synth.dt; break; }
    return { u, peak: m, peakAt: Math.max(at, tS), onset: Math.max(onset, tS), ds: typical[i].ds };
  });
  const want = 0.9 / Math.max(...bld.map((b) => b.peak), 1e-6);
  return { bld, tree: sdof(ag, synth.dt, 0.9), exag: NICE.reduce((best, k) => (k <= want ? k : best), 1) };
}

export type QMovieInput = {
  lang: Lang;
  depth: number; dist: number; setting: Setting; mech: Mechanism;
  rup: Rupture; tP: Arrival; tS: Arrival; surface: { tL: number; tR: number } | null;
  synth: Synth; sh: Shaking; seed: number; end: number;
  siteLabel: string;
  timing: QTiming; view: TectonicView; block: BlockResponse;
};

export type QSceneProps = QMovieInput & { clock: { now: () => number; subscribe: (fn: (t: number) => void) => () => void }; onFail: () => void };
