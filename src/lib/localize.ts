import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import { T } from './i18n';
import type { AlertLevel, DisasterEvent, Lang } from './types';

countries.registerLocale(en);

/*
 * Localización de los textos que vienen de las fuentes (en inglés): títulos de
 * tormentas, volcanes, sequías e inundaciones, niveles de alerta y severidades de
 * GDACS. Nunca inventa datos: si un patrón no se reconoce, deja el texto original.
 */

/* ───────────── países (nombres en inglés de GDACS/EONET → idioma de la página) ───────────── */

// Errores de tipeo y nombres que la librería ISO no reconoce tal como los escriben las fuentes.
const ALIAS: Record<string, string> = {
  Columbia: 'CO', Guatamala: 'GT', USA: 'US', 'United States': 'US', 'The Bahamas': 'BS', Bahamas: 'BS',
  'Democratic Republic of Congo': 'CD', 'The Democratic Republic of Congo': 'CD', 'The Democratic Republic of the Congo': 'CD', 'Democratic Republic of the Congo': 'CD', 'Republic of Congo': 'CG', Congo: 'CG',
  'Ivory Coast': 'CI', "Cote d'Ivoire": 'CI', 'Czech Republic': 'CZ', Czechia: 'CZ', Russia: 'RU', Tanzania: 'TZ',
  'Viet Nam': 'VN', Vietnam: 'VN', Laos: 'LA', Syria: 'SY', Iran: 'IR', 'South Korea': 'KR', 'North Korea': 'KP',
  Bolivia: 'BO', Venezuela: 'VE', Moldova: 'MD', Kosovo: 'XK', 'East Timor': 'TL', 'Timor-Leste': 'TL', 'Cape Verde': 'CV',
  Swaziland: 'SZ', Eswatini: 'SZ', Macedonia: 'MK', 'North Macedonia': 'MK', Burma: 'MM', Myanmar: 'MM', Micronesia: 'FM',
};

const displayNames = new Map<Lang, Intl.DisplayNames>();
export function countryFromEnglish(name: string, lang: Lang): string {
  const n = name.trim();
  const a2 = ALIAS[n] ?? countries.getAlpha2Code(n, 'en');
  if (!a2) return n;
  let dn = displayNames.get(lang);
  if (!dn) displayNames.set(lang, (dn = new Intl.DisplayNames([lang], { type: 'region' })));
  return dn.of(a2) ?? n;
}

/* ───────────── región aproximada (para títulos multipaís) ───────────── */

const REGIONS: { es: string; en: string; test: (lon: number, lat: number) => boolean }[] = [
  { es: 'Centroamérica y el Caribe', en: 'Central America and the Caribbean', test: (x, y) => y >= 5 && y <= 27 && x >= -95 && x <= -58 },
  { es: 'Sudamérica', en: 'South America', test: (x, y) => y >= -56 && y < 13 && x >= -82 && x <= -34 },
  { es: 'Norteamérica', en: 'North America', test: (x, y) => y >= 13 && x >= -170 && x <= -50 },
  { es: 'Europa', en: 'Europe', test: (x, y) => y >= 36 && y <= 72 && x >= -25 && x <= 45 },
  { es: 'Medio Oriente', en: 'the Middle East', test: (x, y) => y >= 12 && y < 42 && x > 34 && x <= 63 },
  { es: 'África', en: 'Africa', test: (x, y) => y >= -36 && y < 37 && x >= -20 && x <= 52 },
  { es: 'el Sudeste Asiático', en: 'Southeast Asia', test: (x, y) => y >= -11 && y <= 25 && x >= 92 && x <= 141 },
  { es: 'Oceanía', en: 'Oceania', test: (x, y) => y < 0 && (x >= 110 || x <= -150) },
  { es: 'Asia', en: 'Asia', test: (x, y) => y >= -11 && x > 45 && x <= 180 },
];
const regionOf = (lon: number, lat: number, lang: Lang) => {
  const r = REGIONS.find((g) => g.test(lon, lat));
  return r ? r[lang] : lang === 'es' ? 'varias regiones' : 'several regions';
};

/* ───────────── títulos ───────────── */

const STORM: Record<string, Record<Lang, string>> = {
  'super typhoon': { es: 'Supertifón', en: 'Super Typhoon' },
  typhoon: { es: 'Tifón', en: 'Typhoon' },
  hurricane: { es: 'Huracán', en: 'Hurricane' },
  'tropical storm': { es: 'Tormenta tropical', en: 'Tropical Storm' },
  'tropical depression': { es: 'Depresión tropical', en: 'Tropical Depression' },
  'severe tropical cyclone': { es: 'Ciclón tropical severo', en: 'Severe Tropical Cyclone' },
  'tropical cyclone': { es: 'Ciclón tropical', en: 'Tropical Cyclone' },
  'subtropical storm': { es: 'Tormenta subtropical', en: 'Subtropical Storm' },
  'post-tropical cyclone': { es: 'Ciclón postropical', en: 'Post-Tropical Cyclone' },
  cyclone: { es: 'Ciclón', en: 'Cyclone' },
};
const STORM_RE = new RegExp(`^(${Object.keys(STORM).sort((a, b) => b.length - a.length).join('|')})\\s+(.+)$`, 'i');

const IN_WORD: Record<string, Record<Lang, string>> = {
  drought: { es: 'Sequía', en: 'Drought' },
  flood: { es: 'Inundación', en: 'Flood' },
  floods: { es: 'Inundaciones', en: 'Floods' },
  'forest fires': { es: 'Incendios forestales', en: 'Forest fires' },
  'forest fire': { es: 'Incendio forestal', en: 'Forest fire' },
  wildfires: { es: 'Incendios forestales', en: 'Wildfires' },
  wildfire: { es: 'Incendio forestal', en: 'Wildfire' },
  earthquake: { es: 'Sismo', en: 'Earthquake' },
};
const IN_RE = /^(drought|floods?|forest fires?|wildfires?|earthquake) in (.+)$/i;

/** Lista de países del título ("Drought in A, B, C"), en el idioma de la página. */
function parsePlaces(e: DisasterEvent, lang: Lang): { word: string; places: string[] } | null {
  const m = IN_RE.exec(clean(e.title));
  if (!m) return null;
  return { word: IN_WORD[m[1].toLowerCase()][lang], places: m[2].split(/\s*,\s*/).filter(Boolean).map((p) => countryFromEnglish(p, lang)) };
}

/** Espacios dobles y el número de evento que EONET agrega al final ("Flood in Kenya 1103589"). */
const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/\s\d{6,}$/, '').trim();

export const MULTI_COUNTRY_MIN = 3;

/** Países del evento cuando el título los enumera (para la ficha). */
export function titlePlaces(e: DisasterEvent, lang: Lang): string[] {
  return parsePlaces(e, lang)?.places ?? [];
}

/**
 * Título en el idioma de la página. `short`: los eventos de 3 o más países se
 * resumen como "Sequía en Europa · 25 países".
 */
export function localTitle(e: DisasterEvent, lang: Lang, short = true): string {
  const title = clean(e.title);
  const p = parsePlaces(e, lang);
  if (p) {
    if (short && p.places.length >= MULTI_COUNTRY_MIN) {
      return `${p.word} ${lang === 'es' ? 'en' : 'in'} ${regionOf(e.lon, e.lat, lang)} · ${p.places.length} ${lang === 'es' ? 'países' : 'countries'}`;
    }
    const list = new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' }).format(p.places);
    return `${p.word} ${lang === 'es' ? 'en' : 'in'} ${list}`;
  }
  if (lang === 'en') return title;
  const s = STORM_RE.exec(title);
  if (s) return `${STORM[s[1].toLowerCase()].es} ${s[2]}`;
  const er = /^eruption\s+(.+)$/i.exec(title);
  if (er) return `Erupción del ${er[1]}`;
  const vo = /^(.+?) Volcano(?:,\s*(.+))?$/i.exec(title);
  if (vo) return `Volcán ${vo[1]}${vo[2] ? ', ' + countryFromEnglish(vo[2], lang) : ''}`;
  return title;
}

/* ───────────── alertas y severidades ───────────── */

const ALERT_NAME: Record<Lang, Record<AlertLevel, string>> = {
  es: { green: 'verde', yellow: 'amarilla', orange: 'naranja', red: 'roja' },
  en: { green: 'green', yellow: 'yellow', orange: 'orange', red: 'red' },
};
export const alertName = (level: AlertLevel, lang: Lang) => ALERT_NAME[lang][level] ?? level;

/** "GDACS naranja" / "PAGER verde": la alerta más relevante del evento, ya traducida. */
export function alertTag(e: DisasterEvent, lang: Lang): string {
  if (e.alert) return `GDACS ${alertName(e.alert, lang)}`;
  if (e.pager) return `PAGER ${alertName(e.pager, lang)}`;
  return '';
}

const IMPACT: Record<string, string> = { green: 'verde', orange: 'naranja', red: 'rojo', low: 'bajo', medium: 'medio', high: 'alto' };

/** Textos de severidad de GDACS en castellano; en inglés se dejan como vienen. */
export function localSeverity(text: string | undefined, lang: Lang): string | undefined {
  if (!text || lang === 'en') return text;
  let m: RegExpExecArray | null;
  if ((m = /^Magnitude ([\d.]+)M?, Depth:\s*([\d.]+)\s*km$/i.exec(text))) return `Magnitud ${m[1].replace('.', ',')}, profundidad ${m[2].replace('.', ',')} km`;
  if ((m = /^Magnitude ([\d.]+)$/i.exec(text))) return `Magnitud ${m[1].replace('.', ',')}`;
  if ((m = /^(.+?) \(maximum wind speed of (\d+) km\/h\)$/i.exec(text))) {
    const cat = m[1].toLowerCase().startsWith('hurricane/typhoon') ? 'Huracán o tifón' : STORM[m[1].toLowerCase()]?.es ?? m[1];
    return `${cat} (viento máximo de ${m[2]} km/h)`;
  }
  if ((m = /^(\w+) impact for forestfire in ([\d.]+) ha$/i.exec(text))) return `Impacto ${IMPACT[m[1].toLowerCase()] ?? m[1]} por incendio forestal en ${m[2]} ha`;
  if ((m = /^(\w+) impact for agricultural drought in ([\d.]+) km2$/i.exec(text))) return `Impacto ${IMPACT[m[1].toLowerCase()] ?? m[1]} por sequía agrícola en ${m[2]} km²`;
  return text;
}

/** Tipo singular + título, para tooltips y listas. */
export const typeAndTitle = (e: DisasterEvent, lang: Lang) => `${T[lang].T1[e.type]} · ${localTitle(e, lang)}`;
