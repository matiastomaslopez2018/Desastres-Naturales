import type { Lang } from './types';

/*
 * Rutas con nombre en el idioma de cada página (URLs limpias para buscadores): la página en
 * español vive en /es/sismos/chile y su par en inglés en /en/earthquakes/chile, enlazadas
 * con hreflang. Cada carpeta de app/[lang] responde solo a su idioma y redirige el otro.
 */

export const ROUTES = {
  quakesToday: { es: 'sismo-hoy', en: 'earthquake-today' },
  quakesIn: { es: 'sismos', en: 'earthquakes' },
  volcanoesNow: { es: 'volcanes-activos', en: 'active-volcanoes' },
  volcano: { es: 'volcanes', en: 'volcanoes' },
  fires: { es: 'incendios-forestales', en: 'wildfires' },
  hurricanes: { es: 'huracanes', en: 'hurricanes' },
  tsunami: { es: 'alerta-tsunami', en: 'tsunami-alert' },
  learn: { es: 'aprender', en: 'learn' },
  simulator: { es: 'simulador-sismos', en: 'earthquake-simulator' },
  tsunamiSim: { es: 'simulador-tsunamis', en: 'tsunami-simulator' },
  volcanoSim: { es: 'simulador-volcanes', en: 'volcano-simulator' },
  myPlace: { es: 'mi-lugar', en: 'my-place' },
  whatToDo: { es: 'que-hacer', en: 'what-to-do' },
  widget: { es: 'widget-para-tu-sitio', en: 'embed-widget' },
  thisDay: { es: 'un-dia-como-hoy', en: 'on-this-day' },
  whatIf: { es: 'y-si-pasara-aca', en: 'what-if-it-happened-here' },
  floodSim: { es: 'simulador-inundaciones', en: 'flood-simulator' },
  quiz: { es: 'que-harias', en: 'what-would-you-do' },
  stories: { es: 'historias', en: 'stories' },
} as const satisfies Record<string, Record<Lang, string>>;

export type RouteKey = keyof typeof ROUTES;

/** Ruta de una sección (y sub-ruta opcional, ya con su slug en ese idioma). */
export const routePath = (lang: Lang, key: RouteKey, sub?: string) => `/${lang}/${ROUTES[key][lang]}${sub ? `/${sub}` : ''}`;

/** Sin acentos, minúsculas y guiones: "Popocatépetl" → "popocatepetl". */
export const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Países con página "Sismos hoy en …": América Latina, más España, EE. UU. y Japón. */
export const QUAKE_COUNTRIES: { iso3: string; es: string; en: string }[] = [
  { iso3: 'ARG', es: 'argentina', en: 'argentina' },
  { iso3: 'BOL', es: 'bolivia', en: 'bolivia' },
  { iso3: 'BRA', es: 'brasil', en: 'brazil' },
  { iso3: 'CHL', es: 'chile', en: 'chile' },
  { iso3: 'COL', es: 'colombia', en: 'colombia' },
  { iso3: 'CRI', es: 'costa-rica', en: 'costa-rica' },
  { iso3: 'CUB', es: 'cuba', en: 'cuba' },
  { iso3: 'ECU', es: 'ecuador', en: 'ecuador' },
  { iso3: 'SLV', es: 'el-salvador', en: 'el-salvador' },
  { iso3: 'GTM', es: 'guatemala', en: 'guatemala' },
  { iso3: 'HTI', es: 'haiti', en: 'haiti' },
  { iso3: 'HND', es: 'honduras', en: 'honduras' },
  { iso3: 'MEX', es: 'mexico', en: 'mexico' },
  { iso3: 'NIC', es: 'nicaragua', en: 'nicaragua' },
  { iso3: 'PAN', es: 'panama', en: 'panama' },
  { iso3: 'PRY', es: 'paraguay', en: 'paraguay' },
  { iso3: 'PER', es: 'peru', en: 'peru' },
  { iso3: 'PRI', es: 'puerto-rico', en: 'puerto-rico' },
  { iso3: 'DOM', es: 'republica-dominicana', en: 'dominican-republic' },
  { iso3: 'URY', es: 'uruguay', en: 'uruguay' },
  { iso3: 'VEN', es: 'venezuela', en: 'venezuela' },
  { iso3: 'ESP', es: 'espana', en: 'spain' },
  { iso3: 'USA', es: 'estados-unidos', en: 'united-states' },
  { iso3: 'JPN', es: 'japon', en: 'japan' },
];

export const quakeCountryBySlug = (lang: Lang, slug: string) => QUAKE_COUNTRIES.find((c) => c[lang] === slug) ?? null;
export const quakeCountryByIso = (iso3: string) => QUAKE_COUNTRIES.find((c) => c.iso3 === iso3) ?? null;

/** JSON-LD listo para <script type="application/ld+json"> (escapa "<" para que no cierre el script). */
export const jsonLd = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, '\\u003c') });
