/*
 * Guion de la película del sismo: capítulos, cómo avanza el tiempo del sismo en cada uno y los textos,
 * armados con los resultados del simulador (los mismos números que muestran las fichas).
 */
import type { Lang } from '../types';
import { fmtNum } from '../format';
import type { Mechanism, Setting } from './gmpe';

export type QChapterId = 'fault' | 'waves' | 'city' | 'end';
export type QChapter = { id: QChapterId; start: number; end: number };

/** Capítulos (segundos de película). */
export const Q_CHAPTERS: QChapter[] = [
  { id: 'fault', start: 0, end: 10 },
  { id: 'waves', start: 10, end: 30 },
  { id: 'city', start: 30, end: 58 },
  { id: 'end', start: 58, end: 66 },
];

export const qChapterAt = (mt: number) => Q_CHAPTERS.find((c) => mt < c.end) ?? Q_CHAPTERS[Q_CHAPTERS.length - 1];
export const qProgress = (c: QChapter, mt: number) => Math.max(0, Math.min(1, (mt - c.start) / (c.end - c.start)));
export const smooth = (u: number) => u * u * (3 - 2 * u);

/** Tiempos del sismo (s desde la hora de origen) que cubre cada capítulo. */
export type QTiming = {
  /** Fin del capítulo de las ondas: la S (y las superficiales) ya pasaron por el lugar. */
  wavesTo: number;
  /** Ventana del capítulo de la ciudad: desde poco antes de la P hasta el final de la traza. */
  cityFrom: number; cityTo: number;
};

/**
 * Tiempo del sismo en el instante `mt` de la película y avance de la ruptura (0–1). En el primer capítulo
 * el reloj del sismo no corre: se muestra cómo se rompe la falla (en la realidad tarda la duración de la ruptura).
 */
export function qSimTimeAt(mt: number, tm: QTiming) {
  const c = qChapterAt(mt), u = qProgress(c, mt);
  switch (c.id) {
    case 'fault': return { t: 0, rupture: smooth(Math.max(0, Math.min(1, (mt - 1.5) / 6.5))) };
    case 'waves': return { t: u * tm.wavesTo, rupture: 1 };
    case 'city': return { t: tm.cityFrom + u * (tm.cityTo - tm.cityFrom), rupture: 1 };
    default: return { t: tm.cityTo, rupture: 1 };
  }
}

export type QFacts = {
  name: string | null; site: string;
  mag: number; depth: number; dist: number; setting: Setting; mech: Mechanism;
  length: number; width: number; slip: number; duration: number;
  vp: number; tP: number; tS: number; surface: boolean;
  mmi: string; mmiName: string; pga: number; model: string;
  /** Cantidad de construcciones de la cuadra en cada nivel de daño (0–4). */
  damage: number[]; nBuildings: number;
  energy: string; hiroshima: number;
};

const MECH: Record<Lang, (s: Setting, m: Mechanism) => string> = {
  es: (s, m) => s === 'interface' ? 'Es el contacto entre dos placas: la oceánica se mete por debajo y el borde de la otra salta hacia arriba.'
    : s === 'slab' ? 'La ruptura ocurre dentro de la placa que se hunde, a bastante profundidad.'
    : m === 'reverse' ? 'Falla inversa: un bloque de corteza se monta sobre el otro.'
    : m === 'normal' ? 'Falla normal: un bloque de corteza baja respecto del otro.'
    : 'Falla de rumbo: los dos bloques se deslizan de costado, uno contra el otro.',
  en: (s, m) => s === 'interface' ? 'It is the contact between two plates: the oceanic plate slides beneath and the edge of the other springs upward.'
    : s === 'slab' ? 'The rupture happens inside the sinking plate, at considerable depth.'
    : m === 'reverse' ? 'Reverse fault: one block of crust rides up over the other.'
    : m === 'normal' ? 'Normal fault: one block of crust drops relative to the other.'
    : 'Strike-slip fault: the two blocks slide sideways past each other.',
};

export function qCaptions(lang: Lang, f: QFacts, simT: number): Record<QChapterId, { title: string; text: string }> {
  const nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const sl = f.slip < 1 ? 2 : 1;
  const sec = (x: number) => nf(x, x < 10 ? 1 : 0);
  const [, d1, d2, d3, d4] = f.damage;
  if (lang === 'es') {
    const who = f.name ? `${f.name}: un sismo` : 'Un sismo';
    const dmg = d4 + d3 === 0 && d2 === 0
      ? `Ninguna de las ${f.nBuildings} construcciones de la cuadra pasa de daño leve${d1 ? ` (${d1} con fisuras)` : ''}.`
      : `De las ${f.nBuildings} construcciones de la cuadra: ${[d4 && `${d4} colapsan o quedan casi destruidas`, d3 && `${d3} con daño extenso`, d2 && `${d2} con daño moderado`, d1 && `${d1} con daño leve`].filter(Boolean).join(', ')}.`;
    return {
      fault: { title: 'La falla', text: `${who} de magnitud ${nf(f.mag, 1)} a ${nf(f.depth)} km de profundidad. Se rompe un plano de unos ${nf(f.length)} × ${nf(f.width)} km y los bloques se deslizan ${nf(f.slip, sl)} m en unos ${nf(f.duration)} segundos. ${MECH.es(f.setting, f.mech)}` },
      waves: { title: 'Las ondas', text: `Primero sale la onda P, que comprime la roca a unos ${nf(f.vp, 1)} km/s: llega ${/^el /.test(f.site) ? `al ${f.site.slice(3)}` : `a ${f.site}`}, a ${nf(f.dist)} km, a los ${sec(f.tP)} s. La onda S, más lenta y más fuerte, llega a los ${sec(f.tS)} s.${f.surface ? ' Detrás vienen las ondas superficiales.' : ''} t = ${sec(simT)} s.` },
      city: { title: `El sacudón en ${f.site}`, text: `Intensidad ${f.mmi} (${f.mmiName.toLowerCase()}): el suelo acelera hasta ${nf(f.pga, f.pga < 0.01 ? 3 : 2)} g según ${f.model}. Cada construcción oscila con su propio período, y el daño sale de funciones de vulnerabilidad de GEM. t = ${sec(simT)} s.` },
      end: { title: 'Lo que muestra la simulación', text: `${dmg} Es el resultado típico (la mediana): con otro sacudón posible puede ser mejor o peor. Energía liberada: ${f.energy}${f.hiroshima >= 1 ? `, como ${nf(f.hiroshima, f.hiroshima < 10 ? 1 : 0)} bombas de Hiroshima` : ''}.` },
    };
  }
  const who = f.name ? `${f.name}: a magnitude ${nf(f.mag, 1)} earthquake` : `A magnitude ${nf(f.mag, 1)} earthquake`;
  const dmg = d4 + d3 === 0 && d2 === 0
    ? `None of the ${f.nBuildings} buildings on the block goes beyond slight damage${d1 ? ` (${d1} with cracks)` : ''}.`
    : `Of the ${f.nBuildings} buildings on the block: ${[d4 && `${d4} collapse or are nearly destroyed`, d3 && `${d3} with extensive damage`, d2 && `${d2} with moderate damage`, d1 && `${d1} with slight damage`].filter(Boolean).join(', ')}.`;
  return {
    fault: { title: 'The fault', text: `${who} ${nf(f.depth)} km deep. A plane of about ${nf(f.length)} × ${nf(f.width)} km breaks and the blocks slip ${nf(f.slip, sl)} m in about ${nf(f.duration)} seconds. ${MECH.en(f.setting, f.mech)}` },
    waves: { title: 'The waves', text: `The P wave goes first, compressing the rock at about ${nf(f.vp, 1)} km/s: it reaches ${f.site}, ${nf(f.dist)} km away, after ${sec(f.tP)} s. The S wave, slower and stronger, arrives after ${sec(f.tS)} s.${f.surface ? ' Surface waves follow.' : ''} t = ${sec(simT)} s.` },
    city: { title: `The shaking in ${f.site}`, text: `Intensity ${f.mmi} (${f.mmiName.toLowerCase()}): the ground accelerates up to ${nf(f.pga, f.pga < 0.01 ? 3 : 2)} g according to ${f.model}. Each building sways with its own period, and the damage comes from GEM vulnerability functions. t = ${sec(simT)} s.` },
    end: { title: 'What the simulation shows', text: `${dmg} This is the typical (median) result: another possible shaking could make it better or worse. Energy released: ${f.energy}${f.hiroshima >= 1 ? `, like ${nf(f.hiroshima, f.hiroshima < 10 ? 1 : 0)} Hiroshima bombs` : ''}.` },
  };
}
