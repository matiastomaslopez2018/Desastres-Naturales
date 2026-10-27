/*
 * Guion de la película del volcán: capítulos, tiempo de la animación en cada uno, cámara y textos, armados
 * con los resultados del simulador (los mismos números de la página).
 */
import type { Lang } from '../types';
import { fmtNum } from '../format';
import type { Style, VolcanoType } from './presets';

export type VChapterId = 'volcano' | 'eruption' | 'ash' | 'hazards' | 'end';
export const V_CHAPTERS: { id: VChapterId; start: number; end: number }[] = [
  { id: 'volcano', start: 0, end: 9 },
  { id: 'eruption', start: 9, end: 29 },
  { id: 'ash', start: 29, end: 45 },
  { id: 'hazards', start: 45, end: 60 },
  { id: 'end', start: 60, end: 68 },
];
export const vChapterAt = (mt: number) => V_CHAPTERS.find((c) => mt < c.end) ?? V_CHAPTERS[V_CHAPTERS.length - 1];
const prog = (mt: number) => { const c = vChapterAt(mt); return Math.max(0, Math.min(1, (mt - c.start) / (c.end - c.start))); };
const smooth = (u: number) => u * u * (3 - 2 * u);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Peligro que se muestra en cada tramo del capítulo de peligros. */
export function hazardAt(mt: number): 'lava' | 'pdc' | 'lahar' | null {
  if (vChapterAt(mt).id !== 'hazards') return null;
  const u = prog(mt);
  return u < 1 / 3 ? 'lava' : u < 2 / 3 ? 'pdc' : 'lahar';
}

/** Tiempo de la animación de la erupción (0 a `animEnd`) en el instante `mt` de la película. */
export function animTimeAt(mt: number, animEnd: number) {
  const c = vChapterAt(mt);
  if (c.id === 'volcano') return 0;
  if (c.id === 'eruption') return prog(mt) * animEnd;
  if (c.id === 'hazards') return ((prog(mt) * 3) % 1) * animEnd; // cada peligro avanza en su tercio
  return animEnd;
}

/** Cámara (m): ángulo horizontal, elevación, distancia y altura del punto mirado. */
export function cameraAt(mt: number, boxM: number, columnM: number) {
  const c = vChapterAt(mt), u = smooth(prog(mt));
  const far = Math.max(1.5 * boxM, 2.7 * columnM);
  if (c.id === 'volcano') return { az: lerp(0.5, 1.5, u), el: lerp(0.5, 0.32, u), distM: lerp(1.9, 1.25, u) * boxM, lookM: 0 };
  if (c.id === 'eruption') return { az: lerp(1.5, 2.3, u), el: lerp(0.3, 0.24, u), distM: lerp(1.25 * boxM, far, u), lookM: lerp(0, 0.5 * columnM, u) };
  if (c.id === 'hazards') return { az: lerp(2.6, 3.4, u), el: 0.8, distM: 1.45 * boxM, lookM: 0 };
  return { az: lerp(2.3, 2.6, u), el: 0.24, distM: far, lookM: 0.5 * columnM };
}

export type VFacts = {
  name: string; country: string; type: VolcanoType; typeName: string; elev: number;
  eruption: string | null; year: number | null; style: Style; styleName: string;
  topKm: number; hours: number; mer: number; massKg: number; vei: number;
  windTo: number; windKmh: number; windSrc: string;
  places: { name: string; mm: number }[];
  check: string | null;
  lavaKm: number; pdcKm: number; laharKm: number; laharChannels: number;
  photo: string | null;
};

const DIRS: Record<Lang, string[]> = {
  es: ['el norte', 'el noreste', 'el este', 'el sudeste', 'el sur', 'el sudoeste', 'el oeste', 'el noroeste'],
  en: ['the north', 'the northeast', 'the east', 'the southeast', 'the south', 'the southwest', 'the west', 'the northwest'],
};
const dirOf = (lang: Lang, deg: number) => DIRS[lang][Math.round((((deg % 360) + 360) % 360) / 45) % 8];

function thick(lang: Lang, mm: number) {
  if (mm < 10) return `${fmtNum(lang, mm, mm < 1 ? 1 : 0)} mm`;
  if (mm < 1000) return `${fmtNum(lang, mm / 10, mm < 100 ? 1 : 0)} cm`;
  return `${fmtNum(lang, mm / 1000, 1)} m`;
}

export function vCaptions(lang: Lang, f: VFacts, mt: number): { title: string; text: string } {
  const nf = (x: number, d = 0) => fmtNum(lang, x, d), c = vChapterAt(mt), hz = hazardAt(mt);
  const dur = f.hours >= 1 ? (lang === 'es' ? `${nf(f.hours, f.hours < 10 ? 1 : 0)} horas` : `${nf(f.hours, f.hours < 10 ? 1 : 0)} hours`) : `${nf(f.hours * 60)} min`;
  const top3 = f.places.filter((p) => p.mm >= 0.1).slice(0, 3);
  if (lang === 'es') {
    switch (c.id) {
      case 'volcano': return { title: f.name, text: `${f.typeName} de ${nf(f.elev)} m en ${f.country}. ${f.eruption ? `Esta es la erupción de ${f.year && f.year < 1000 ? `el año ${f.year}` : f.year}.` : 'Una erupción imaginada, con el viento de este momento.'}` };
      case 'eruption': return { title: `Erupción ${f.styleName.toLowerCase()}`, text: `La columna sube hasta ${nf(f.topKm, 1)} km de altura. Para eso salen unas ${nf(f.mer / 1000)} toneladas de magma por segundo, durante ${dur}. Arriba, el viento sopla hacia ${dirOf('es', f.windTo)} a unos ${nf(f.windKmh)} km/h y se lleva la nube.` };
      case 'ash': return { title: 'Dónde cae la ceniza', text: top3.length ? `${top3.map((p) => `${p.name}: ${thick('es', p.mm)}`).join(' · ')}. ${f.check ?? 'Lo grueso cae cerca; la ceniza fina viaja cientos de kilómetros.'}` : 'La ceniza casi no llega a los lugares marcados: cae cerca del volcán o se va lejos con el viento.' };
      case 'hazards': return hz === 'lava' ? { title: 'Lava', text: `Si saliera lava, bajaría por los valles hasta unos ${nf(f.lavaKm, 1)} km. Avanza despacio: casi nunca mata, pero destruye lo que cubre.` }
        : hz === 'pdc' ? { title: 'Flujos piroclásticos', text: `Si la columna colapsa, nubes de gas y ceniza a cientos de grados bajan a más de 100 km/h. Con un ángulo de movilidad típico llegarían a unos ${nf(f.pdcKm, 1)} km del cráter.` }
        : { title: 'Lahares', text: f.laharChannels ? `La ceniza mezclada con agua de lluvia o de nieve derretida baja por ${f.laharChannels} cauces, hasta ${nf(f.laharKm, 1)} km. Los lahares pueden llegar mucho más lejos que la erupción.` : 'En las laderas suaves de este volcán casi no se forman cauces para los lahares.' };
      default: return { title: 'Lo que muestra la simulación', text: `${f.photo ? `${f.photo}. ` : ''}Índice de explosividad (VEI): ${f.vei}. Masa de tefra: ${nf(f.massKg / 1e9, f.massKg < 1e10 ? 1 : 0)} millones de toneladas. Viento: ${f.windSrc}` };
    }
  }
  switch (c.id) {
    case 'volcano': return { title: f.name, text: `A ${nf(f.elev)} m ${f.typeName.toLowerCase()} in ${f.country}. ${f.eruption ? `This is the eruption of ${f.year && f.year < 1000 ? `AD ${f.year}` : f.year}.` : 'An imagined eruption, with the current wind.'}` };
    case 'eruption': return { title: `${f.styleName} eruption`, text: `The column rises to ${nf(f.topKm, 1)} km. That takes about ${nf(f.mer / 1000)} tonnes of magma per second, for ${dur}. Up high, the wind blows toward ${dirOf('en', f.windTo)} at about ${nf(f.windKmh)} km/h and carries the cloud away.` };
    case 'ash': return { title: 'Where the ash falls', text: top3.length ? `${top3.map((p) => `${p.name}: ${thick('en', p.mm)}`).join(' · ')}. ${f.check ?? 'Coarse ash falls nearby; fine ash travels hundreds of kilometres.'}` : 'The ash barely reaches the marked places: it falls near the volcano or travels far with the wind.' };
    case 'hazards': return hz === 'lava' ? { title: 'Lava', text: `If lava came out, it would run down the valleys for about ${nf(f.lavaKm, 1)} km. It moves slowly: it rarely kills, but it destroys what it covers.` }
      : hz === 'pdc' ? { title: 'Pyroclastic flows', text: `If the column collapses, clouds of gas and ash at hundreds of degrees race down at over 100 km/h. With a typical mobility angle they would reach about ${nf(f.pdcKm, 1)} km from the crater.` }
      : { title: 'Lahars', text: f.laharChannels ? `Ash mixed with rain or meltwater runs down ${f.laharChannels} channels, up to ${nf(f.laharKm, 1)} km. Lahars can travel much farther than the eruption itself.` : 'On this volcano’s gentle slopes hardly any channels form for lahars.' };
    default: return { title: 'What the simulation shows', text: `${f.photo ? `${f.photo}. ` : ''}Volcanic Explosivity Index (VEI): ${f.vei}. Tephra mass: ${nf(f.massKg / 1e9, f.massKg < 1e10 ? 1 : 0)} million tonnes. Wind: ${f.windSrc}` };
  }
}
