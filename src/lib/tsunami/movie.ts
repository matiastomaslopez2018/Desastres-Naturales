/*
 * Guion de la película del tsunami: capítulos, correspondencia entre el tiempo de la película y el tiempo
 * simulado, y los textos que se muestran (calculados con los resultados de la simulación).
 */
import type { Lang } from '../types';

export type ChapterId = 'quake' | 'birth' | 'ocean' | 'coast' | 'end';
export type Chapter = { id: ChapterId; start: number; end: number };

/** Duración total y capítulos (segundos de película). */
export const CHAPTERS: Chapter[] = [
  { id: 'quake', start: 0, end: 9 },
  { id: 'birth', start: 9, end: 22 },
  { id: 'ocean', start: 22, end: 54 },
  { id: 'coast', start: 54, end: 70 },
  { id: 'end', start: 70, end: 76 },
];
export const MOVIE_S = CHAPTERS[CHAPTERS.length - 1].end;
/** Minutos de la simulación local fina (debe coincidir con LOCAL_MINUTES del worker). */
export const BIRTH_MIN = 20;

export const chapterAt = (mt: number) => CHAPTERS.find((c) => mt < c.end) ?? CHAPTERS[CHAPTERS.length - 1];
/** Avance normalizado (0–1) dentro del capítulo. */
export const progressIn = (c: Chapter, mt: number) => Math.max(0, Math.min(1, (mt - c.start) / (c.end - c.start)));
export const smooth = (u: number) => u * u * (3 - 2 * u);

export type Timing = {
  /** Horas de océano simuladas. */
  hours: number;
  /** Ventana de la costa: segundos simulados de inicio y fin. */
  coastFrom: number; coastTo: number;
};

/**
 * Tiempo simulado (s) que corresponde a un instante de la película. En el capítulo del sismo, además, cuánto
 * se completó la deformación del fondo (la ruptura tarda unos minutos; se muestra en ~4 s).
 */
export function simTimeAt(mt: number, tm: Timing) {
  const c = chapterAt(mt), u = progressIn(c, mt);
  switch (c.id) {
    case 'quake': return { t: 0, rupture: smooth(Math.max(0, Math.min(1, (mt - 2) / 4))) };
    case 'birth': return { t: u * BIRTH_MIN * 60, rupture: 1 };
    case 'ocean': return { t: BIRTH_MIN * 60 + u * (tm.hours * 3600 - BIRTH_MIN * 60), rupture: 1 };
    case 'coast': return { t: tm.coastFrom + u * (tm.coastTo - tm.coastFrom), rupture: 1 };
    // Cierre: el frente en mitad del Pacífico (más tarde solo quedan rebotes que se ven como ruido).
    default: return { t: Math.min(tm.hours, 10) * 3600, rupture: 1 };
  }
}

export type MovieFacts = {
  name: string; mag: number; lengthKm: number; up: number; down: number;
  sites: { name: string; arrivalS: number | null; shoreMax: number; obsMed: number | null; obsMax: number | null }[];
  coastSite: number;
  dartPct: number | null; dartN: number;
};

const hm = (lang: Lang, s: number) => {
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return lang === 'es' ? (h ? `${h} h ${m} min` : `${m} minutos`) : (h ? `${h} h ${m} min` : `${m} minutes`);
};
const n1 = (lang: Lang, x: number) => new Intl.NumberFormat(lang === 'es' ? 'es-AR' : 'en-US', { maximumFractionDigits: x < 10 ? 1 : 0 }).format(x);

/** Título y texto de cada capítulo, con los números de esta simulación. */
export function captions(lang: Lang, f: MovieFacts, simT: number): Record<ChapterId, { title: string; text: string }> {
  const es = lang === 'es';
  const near = f.sites[f.coastSite], far = f.sites.find((s, i) => i !== f.coastSite && s.arrivalS != null && s.arrivalS > 3 * 3600);
  return {
    quake: {
      title: es ? 'El sismo' : 'The earthquake',
      text: es
        ? `${f.name}: un sismo de magnitud ${n1(lang, f.mag)} rompe unos ${Math.round(f.lengthKm / 10) * 10} km del contacto entre dos placas. En pocos minutos el fondo del mar sube hasta ${n1(lang, f.up)} m en un sector y baja ${n1(lang, f.down)} m en otro.`
        : `${f.name}: a magnitude ${n1(lang, f.mag)} earthquake ruptures about ${Math.round(f.lengthKm / 10) * 10} km of the contact between two plates. Within minutes the seafloor rises up to ${n1(lang, f.up)} m in one area and drops ${n1(lang, f.down)} m in another.`,
    },
    birth: {
      title: es ? 'Nace la ola' : 'The wave is born',
      text: es
        ? `El océano copia esa deformación y empieza a moverse: la ola se abre en dos frentes, uno hacia mar abierto y otro hacia la costa. ${hm(lang, simT)} después del sismo.`
        : `The ocean copies that deformation and starts to move: the wave splits into two fronts, one towards the open ocean and one towards the coast. ${hm(lang, simT)} after the earthquake.`,
    },
    ocean: {
      title: es ? 'Cruza el océano' : 'Across the ocean',
      text: (es
        ? `En aguas profundas viaja a unos 700 km/h, casi como un avión, con apenas decenas de centímetros de altura. ${hm(lang, simT)} después del sismo.`
        : `In deep water it travels at about 700 km/h, almost like a plane, only tens of centimetres high. ${hm(lang, simT)} after the earthquake.`)
        + (far?.arrivalS ? (es ? ` Llega a ${far.name} a las ${hm(lang, far.arrivalS)}.` : ` It reaches ${far.name} after ${hm(lang, far.arrivalS)}.`) : ''),
    },
    coast: {
      title: es ? `La llegada a ${near?.name ?? 'la costa'}` : `Arrival at ${near?.name ?? 'the coast'}`,
      text: near ? (es
        ? `Al entrar a aguas poco profundas la ola frena y crece. Estimación en la orilla: hasta ${n1(lang, near.shoreMax)} m.${near.obsMed != null ? ` La NOAA midió cerca una mediana de ${n1(lang, near.obsMed)} m y un máximo de ${n1(lang, near.obsMax!)} m.` : ''}`
        : `As it enters shallow water the wave slows down and grows. Estimate at the shoreline: up to ${n1(lang, near.shoreMax)} m.${near.obsMed != null ? ` NOAA measured a median of ${n1(lang, near.obsMed)} m nearby and a maximum of ${n1(lang, near.obsMax!)} m.` : ''}`) : '',
    },
    end: {
      title: es ? 'Lo que muestra la simulación' : 'What the simulation shows',
      text: (es
        ? 'Las mismas ecuaciones que usan los modelos de alerta, con la falla del USGS y el fondo marino de la NOAA.'
        : 'The same equations warning models use, with the USGS fault and NOAA’s seafloor.')
        + (f.dartPct != null && f.dartN >= 2 ? (es ? ` En ${f.dartN} boyas DART, la hora de llegada simulada difiere ${n1(lang, Math.abs(f.dartPct * 100))} % de la real.` : ` At ${f.dartN} DART buoys, the simulated arrival time differs by ${n1(lang, Math.abs(f.dartPct * 100))}% from the real one.`) : ''),
    },
  };
}
