/*
 * "¿Lo sentiste?": niveles de la pregunta, su intensidad de Mercalli (MMI) y los textos.
 * Las descripciones resumen las de la escala de Mercalli modificada que publica el USGS
 * (https://www.usgs.gov/programs/earthquake-hazards/modified-mercalli-intensity-scale).
 */
import type { Lang } from './types';

/** Intensidad de Mercalli de cada nivel (para el promedio); 0 = no lo sintió. */
export const FELT_MMI = [1, 2.5, 4, 5, 6, 7, 8];
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const romanOf = (mmi: number) => ROMAN[Math.max(0, Math.min(9, Math.round(mmi) - 1))];
/** Bandas de distancia al epicentro para el resumen (km). */
export const FELT_BANDS = [50, 150, 300, Infinity];
/** Hasta cuántos días después del sismo se aceptan reportes. */
export const FELT_DAYS = 30;

export type FeltSummary = { total: number; byLevel: number[]; bands: { maxKm: number; n: number; mmi: number | null }[]; located: number };

const es = {
  title: '¿Lo sentiste?',
  intro: 'Contanos cómo lo sentiste. Es anónimo: no guardamos tu nombre ni tu dirección IP.',
  levels: [
    ['No lo sentí', ''],
    ['Apenas', 'Lo noté quieto o acostado; casi nadie más'],
    ['Leve', 'Lo sintió casi todo el mundo; vibraron ventanas y vajilla'],
    ['Moderado', 'Se movieron cosas colgadas; se cayeron objetos chicos'],
    ['Fuerte', 'Asustó; costaba caminar; se cayeron cosas de los estantes'],
    ['Muy fuerte', 'Difícil mantenerse en pie; grietas en paredes'],
    ['Violento', 'Daños graves en construcciones'],
  ] as [string, string][],
  where: 'Sumar mi ubicación aproximada (a ~10 km)', whereHelp: 'Sirve para ver cómo se sintió según la distancia al epicentro.',
  send: 'Enviar', sending: 'Enviando…', thanks: '¡Gracias! Tu reporte ya se suma abajo.', already: 'Ya enviaste un reporte de este sismo desde este navegador.',
  failed: 'No se pudo enviar. Probá de nuevo en un rato.', closed: 'Este sismo ya no recibe reportes (pasaron más de 30 días).',
  results: (n: string) => (n === '1' ? '1 persona contó cómo lo sintió' : `${n} personas contaron cómo lo sintieron`), none: 'Todavía nadie contó cómo lo sintió en este sitio.',
  typical: (r: string) => `Intensidad más reportada: ${r}`,
  byDist: 'Según la distancia al epicentro', band: (a: string, b: string | null) => (b ? `${a} a ${b} km` : `más de ${a} km`), firstBand: (b: string) => `hasta ${b} km`,
  avg: (r: string) => `intensidad media ${r}`,
  official: 'Contalo también al organismo oficial', inpres: 'INPRES: ¿percibió este sismo?', usgs: 'USGS: Did You Feel It? (en inglés)',
  note: 'Son reportes de quienes visitan este sitio: no son datos oficiales. Las intensidades oficiales las publican el INPRES, el CSN y el USGS.',
};
const en: typeof es = {
  title: 'Did you feel it?',
  intro: 'Tell us how it felt. It is anonymous: we do not store your name or IP address.',
  levels: [
    ['I did not feel it', ''],
    ['Barely', 'I noticed it while still or lying down; hardly anyone else did'],
    ['Light', 'Almost everyone felt it; windows and dishes rattled'],
    ['Moderate', 'Hanging objects swung; small objects fell'],
    ['Strong', 'Frightening; hard to walk; things fell off shelves'],
    ['Very strong', 'Hard to stay standing; cracks in walls'],
    ['Violent', 'Heavy damage to buildings'],
  ],
  where: 'Add my approximate location (within ~10 km)', whereHelp: 'It helps show how it felt by distance from the epicenter.',
  send: 'Send', sending: 'Sending…', thanks: 'Thank you! Your report is now included below.', already: 'You already sent a report for this earthquake from this browser.',
  failed: 'It could not be sent. Try again in a while.', closed: 'This earthquake no longer takes reports (more than 30 days have passed).',
  results: (n: string) => `${n} ${n === '1' ? 'person' : 'people'} told us how it felt`, none: 'Nobody has reported how it felt on this site yet.',
  typical: (r: string) => `Most reported intensity: ${r}`,
  byDist: 'By distance from the epicenter', band: (a: string, b: string | null) => (b ? `${a} to ${b} km` : `over ${a} km`), firstBand: (b: string) => `up to ${b} km`,
  avg: (r: string) => `mean intensity ${r}`,
  official: 'Also tell the official agency', inpres: 'INPRES: did you feel this quake? (Spanish)', usgs: 'USGS: Did You Feel It?',
  note: 'These are reports from visitors to this site: not official data. Official intensities are published by INPRES, CSN and the USGS.',
};

export const FELT_TEXT: Record<Lang, typeof es> = { es, en };
