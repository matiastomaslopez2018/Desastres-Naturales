/*
 * Textos de "Mi lugar" (perfil de peligros naturales de un punto).
 */
import type { Lang } from '../types';

/** Límites de las clases del mapa de GEM (g); la clase k va de GEM_LEVELS[k-1] a GEM_LEVELS[k]. */
export const GEM_LEVELS = [0.02, 0.03, 0.05, 0.08, 0.13, 0.2, 0.35, 0.55, 0.9];
/** Agrupación nuestra de las 10 clases de GEM en 5 niveles (0 = muy baja … 4 = muy alta). */
export const gemLevel = (cls: number) => (cls === 0 ? 0 : cls <= 2 ? 1 : cls <= 4 ? 2 : cls <= 6 ? 3 : 4);

/** Intensidad de Mercalli que corresponde a una aceleración (g), según la tabla de Wald et al. (1999). */
export function mmiOf(g: number) {
  const cuts: [number, string][] = [[0.0017, 'I'], [0.014, 'II–III'], [0.039, 'IV'], [0.092, 'V'], [0.18, 'VI'], [0.34, 'VII'], [0.65, 'VIII'], [1.24, 'IX']];
  for (const [c, r] of cuts) if (g < c) return r;
  return 'X+';
}

const es = {
  kicker: 'Mi lugar',
  h1: 'Los peligros naturales de tu lugar',
  seoTitle: 'Mi lugar: sismos, volcanes, tsunamis, ciclones y deslizamientos donde vivís',
  desc: 'Buscá tu ciudad o usá tu ubicación y mirá con datos oficiales qué peligros naturales hay cerca: la amenaza sísmica, los sismos más fuertes registrados, los volcanes activos, los tsunamis medidos en la costa, los ciclones y los deslizamientos.',
  lead: 'Buscá tu ciudad o usá tu ubicación. Te mostramos, con datos oficiales y científicos, qué sismos, volcanes, tsunamis, ciclones y deslizamientos hubo y puede haber cerca, y lo que está pasando ahora.',
  search: 'Buscá una ciudad o un pueblo', searchPh: 'Por ejemplo: Mendoza, Valparaíso, Quito…', locate: 'Usar mi ubicación', locating: 'Buscando tu ubicación…',
  locDenied: 'No se pudo obtener tu ubicación. Buscá tu ciudad por nombre.', myPlace: 'Tu ubicación',
  locNote: 'Tu ubicación se redondea a ~1 km y no se guarda: solo se usa para calcular este perfil.',
  examples: 'Ejemplos', noResults: 'No encontramos ese lugar.', loading: 'Juntando los datos…', failed: 'No se pudieron leer los datos. Probá de nuevo en un rato.',
  geocoder: 'Búsqueda de lugares: Open-Meteo (GeoNames, CC BY 4.0).',
  elev: (m: string) => `${m} m sobre el nivel del mar`, coast: (km: string) => `a ${km} km de la costa`, atSea: 'en el mar o muy cerca de la costa',
  summary: 'Resumen', orLess: (m: string) => `${m} o menos`,
  tsuCard: (n: number) => (n ? `ola más alta medida (${n === 1 ? '1 medición' : `${n} mediciones`})` : 'sin mediciones cerca'), cycCard: 'desde 1980', slideCard: (r: string) => `con víctimas, a menos de ${r} km`, nowCard: 'últimos 30 días, 300 km',
  // Sismos
  quake: 'Sismos',
  levels: ['Muy baja', 'Baja', 'Moderada', 'Alta', 'Muy alta'],
  gemHead: (lvl: string) => `Amenaza sísmica ${lvl.toLowerCase()}`,
  gemText: (range: string, mmi: string) => `Con un 10 % de probabilidad en 50 años (en promedio, una vez cada 475 años), el suelo firme acá se sacudiría con una aceleración de ${range}: intensidad ${mmi} en la escala de Mercalli.`,
  gemNone: 'El mapa de amenaza de GEM no cubre este punto.',
  gemNote: 'Amenaza en roca firme del mapa global de GEM (2023). Los cinco niveles son una agrupación nuestra de sus diez clases; la intensidad sale de la tabla de Wald et al. (1999). Los suelos blandos amplifican el sacudón. Para construir valen las normas sísmicas de cada país.',
  counts: (r: string, m5: string, m6: string, m7: string) => `A menos de ${r} km, desde 1900, el USGS registró ${m5} sismos de magnitud 5 o más, ${m6} de 6 o más y ${m7} de 7 o más.`,
  biggest: 'Los más fuertes registrados cerca', km: (k: string) => `a ${k} km`, depth: (k: string) => `${k} km de profundidad`,
  simulate: 'Simular cómo se sentiría acá', simulateHelp: 'Abre el simulador de sismos con ese sismo y la distancia hasta tu lugar.',
  harmful: 'Sismos con víctimas cerca', deaths: (n: string) => `${n} muertes`, harmfulNote: 'Base de sismos significativos de NOAA NCEI (desde el año 1500).',
  plate: (here: string, other: string, km: string, kind: string) => `Estás sobre la ${here}, a ${km} km de su borde ${kind} con la ${other}.`,
  kinds: { convergent: 'convergente', divergent: 'divergente', transform: 'transformante' } as Record<string, string>,
  subduction: (d: string) => `Debajo, a unos ${d} km de profundidad, está la placa que se hunde (subducción): de ahí salen sismos profundos que se sienten en grandes áreas.`,
  // Volcanes
  volcano: 'Volcanes',
  volcHead: (n: number, name: string, km: string) => (n ? `${n === 1 ? '1 volcán' : `${n} volcanes`} a menos de 100 km. El más cercano: ${name}, a ${km} km` : `El volcán activo más cercano: ${name}, a ${km} km`),
  volcNone: 'No hay volcanes activos en los últimos 10.000 años a menos de 300 km.',
  lastErup: (y: string) => `última erupción: ${y}`, noDate: 'sin erupciones con fecha conocida', bce: (y: string) => `${y} a. C.`,
  ashSim: '¿Te llega la ceniza? Simulalo', volcNote: 'Volcanes del Holoceno (activos en los últimos ~11.700 años) del Programa Global de Vulcanismo del Smithsonian, a menos de 300 km. La ceniza puede caer a cientos de kilómetros según el viento.',
  // Tsunamis
  tsunami: 'Tsunamis',
  tsuFar: (km: string) => `Estás a ${km} km de la costa: los tsunamis no llegan tan tierra adentro.`,
  tsuHigh: (m: string) => `Estás cerca de la costa, pero a ${m} m de altura: muy por encima de lo que suben los tsunamis medidos cerca.`,
  tsuCoast: (km: string, m: string) => `Estás a ${km} km de la costa y a ${m} m de altura: en la zona donde pueden llegar los tsunamis.`,
  runups: (n: number, r: string, max: string) => `${n} mediciones de tsunamis a menos de ${r} km; la ola más alta llegó a ${max} m.`,
  runupsNone: (r: string) => `NOAA no tiene mediciones de tsunamis a menos de ${r} km.`,
  tsuNote: 'Alturas medidas de tsunamis en la costa (base de NOAA NCEI). Altura del terreno: Copernicus DEM vía Open-Meteo; costa: Natural Earth. Si sentís un sismo fuerte cerca del mar, alejate de la costa sin esperar el aviso.',
  m: (x: string) => `${x} m`,
  // Ciclones
  cyclone: 'Ciclones',
  cycHead: (n: number) => (n ? `${n === 1 ? '1 ciclón' : `${n} ciclones`} con vientos de 119 km/h o más pasaron cerca desde 1980` : 'Ningún ciclón con vientos de 119 km/h o más pasó cerca desde 1980'),
  cycNote: 'Ciclones tropicales (huracanes, tifones) que llegaron a 64 kt y pasaron a unos 300 km o menos, según IBTrACS (NOAA NCEI).', unnamed: 'Sin nombre',
  // Deslizamientos
  landslide: 'Deslizamientos',
  slideHead: (n: number, r: string, d: string) => (n ? `${n === 1 ? '1 deslizamiento' : `${n} deslizamientos`} con víctimas a menos de ${r} km (${d} muertes en total)` : `Sin deslizamientos con víctimas registrados a menos de ${r} km`),
  slideNote: 'Catálogo mundial de deslizamientos de la NASA (sobre todo 2007–2024); faltan muchos eventos, sobre todo los más antiguos.',
  // Ahora
  now: 'Ahora cerca', nowHead: (n: number) => (n ? `${n === 1 ? '1 evento' : `${n} eventos`} en los últimos 30 días a menos de 300 km` : 'Nada en los últimos 30 días a menos de 300 km'),
  nowNote: 'Sismos de magnitud 4 o más (USGS), erupciones, incendios, tormentas e inundaciones de la misma base del mapa.',
  types: { eq: 'Sismo', volcano: 'Volcán', fire: 'Incendio', storm: 'Tormenta', flood: 'Inundación', drought: 'Sequía' } as Record<string, string>,
  // Mapa
  map: 'Mapa', mapLegend: { place: 'Tu lugar', quake: 'Sismos fuertes', volc: 'Volcanes', tsu: 'Tsunamis medidos', slide: 'Deslizamientos', ring: 'Anillos cada 100 km' },
  // Cierre
  notRisk: 'Esto muestra amenazas y antecedentes, no un estudio de riesgo: el riesgo depende además de cómo están construidas las casas y de cuánta gente vive ahí. En una emergencia seguí siempre a Defensa Civil o Protección Civil de tu país.',
  sources: 'Fuentes', share: 'Copiar enlace a este lugar', copied: 'Enlace copiado',
  other: 'Buscar otro lugar',
};

const en: typeof es = {
  kicker: 'My place',
  h1: 'The natural hazards where you live',
  seoTitle: 'My place: earthquakes, volcanoes, tsunamis, cyclones and landslides where you live',
  desc: 'Search for your city or use your location and see, with official data, which natural hazards are nearby: seismic hazard, the strongest recorded earthquakes, active volcanoes, tsunamis measured on the coast, cyclones and landslides.',
  lead: 'Search for your city or use your location. We show you, with official and scientific data, which earthquakes, volcanoes, tsunamis, cyclones and landslides have happened and may happen nearby, and what is going on right now.',
  search: 'Search for a city or town', searchPh: 'For example: Mendoza, Valparaíso, Quito…', locate: 'Use my location', locating: 'Finding your location…',
  locDenied: 'Your location could not be obtained. Search for your city by name.', myPlace: 'Your location',
  locNote: 'Your location is rounded to ~1 km and not stored: it is only used to compute this profile.',
  examples: 'Examples', noResults: 'We could not find that place.', loading: 'Gathering the data…', failed: 'The data could not be read. Try again in a while.',
  geocoder: 'Place search: Open-Meteo (GeoNames, CC BY 4.0).',
  elev: (m: string) => `${m} m above sea level`, coast: (km: string) => `${km} km from the coast`, atSea: 'at sea or right on the coast',
  summary: 'Summary', orLess: (m: string) => `${m} or less`,
  tsuCard: (n: number) => (n ? `highest measured wave (${n === 1 ? '1 measurement' : `${n} measurements`})` : 'no measurements nearby'), cycCard: 'since 1980', slideCard: (r: string) => `deadly, within ${r} km`, nowCard: 'last 30 days, 300 km',
  quake: 'Earthquakes',
  levels: ['Very low', 'Low', 'Moderate', 'High', 'Very high'],
  gemHead: (lvl: string) => `${lvl} seismic hazard`,
  gemText: (range: string, mmi: string) => `With a 10% chance in 50 years (on average, once every 475 years), firm ground here would shake with an acceleration of ${range}: Mercalli intensity ${mmi}.`,
  gemNone: 'GEM’s hazard map does not cover this point.',
  gemNote: 'Hazard on firm rock from GEM’s global map (2023). The five levels are our grouping of its ten classes; intensity follows the table of Wald et al. (1999). Soft soils amplify shaking. Building design follows each country’s seismic codes.',
  counts: (r: string, m5: string, m6: string, m7: string) => `Within ${r} km, since 1900, the USGS recorded ${m5} earthquakes of magnitude 5 or more, ${m6} of 6 or more and ${m7} of 7 or more.`,
  biggest: 'The strongest recorded nearby', km: (k: string) => `${k} km away`, depth: (k: string) => `${k} km deep`,
  simulate: 'Simulate how it would feel here', simulateHelp: 'Opens the earthquake simulator with that earthquake and the distance to your place.',
  harmful: 'Deadly earthquakes nearby', deaths: (n: string) => `${n} deaths`, harmfulNote: 'NOAA NCEI significant earthquake database (since 1500).',
  plate: (here: string, other: string, km: string, kind: string) => `You are on the ${here}, ${km} km from its ${kind} boundary with the ${other}.`,
  kinds: { convergent: 'convergent', divergent: 'divergent', transform: 'transform' },
  subduction: (d: string) => `Below, about ${d} km deep, lies the sinking plate (subduction): it produces deep earthquakes felt over large areas.`,
  volcano: 'Volcanoes',
  volcHead: (n: number, name: string, km: string) => (n ? `${n === 1 ? '1 volcano' : `${n} volcanoes`} within 100 km. The nearest: ${name}, ${km} km away` : `The nearest active volcano: ${name}, ${km} km away`),
  volcNone: 'There are no volcanoes active in the last 10,000 years within 300 km.',
  lastErup: (y: string) => `last eruption: ${y}`, noDate: 'no dated eruptions', bce: (y: string) => `${y} BCE`,
  ashSim: 'Would the ash reach you? Simulate it', volcNote: 'Holocene volcanoes (active in the last ~11,700 years) from the Smithsonian Global Volcanism Program, within 300 km. Ash can fall hundreds of kilometers away depending on the wind.',
  tsunami: 'Tsunamis',
  tsuFar: (km: string) => `You are ${km} km from the coast: tsunamis do not reach that far inland.`,
  tsuHigh: (m: string) => `You are near the coast, but ${m} m above sea level: well above how high the tsunamis measured nearby rose.`,
  tsuCoast: (km: string, m: string) => `You are ${km} km from the coast and ${m} m above sea level: in the zone tsunamis can reach.`,
  runups: (n: number, r: string, max: string) => `${n} tsunami measurements within ${r} km; the highest wave reached ${max} m.`,
  runupsNone: (r: string) => `NOAA has no tsunami measurements within ${r} km.`,
  tsuNote: 'Measured tsunami heights on the coast (NOAA NCEI database). Ground elevation: Copernicus DEM via Open-Meteo; coastline: Natural Earth. If you feel a strong earthquake near the sea, move away from the coast without waiting for a warning.',
  m: (x: string) => `${x} m`,
  cyclone: 'Cyclones',
  cycHead: (n: number) => (n ? `${n === 1 ? '1 cyclone' : `${n} cyclones`} with winds of 119 km/h or more passed nearby since 1980` : 'No cyclone with winds of 119 km/h or more passed nearby since 1980'),
  cycNote: 'Tropical cyclones (hurricanes, typhoons) that reached 64 kt and passed within about 300 km, according to IBTrACS (NOAA NCEI).', unnamed: 'Unnamed',
  landslide: 'Landslides',
  slideHead: (n: number, r: string, d: string) => (n ? `${n === 1 ? '1 deadly landslide' : `${n} deadly landslides`} within ${r} km (${d} deaths in total)` : `No deadly landslides recorded within ${r} km`),
  slideNote: 'NASA global landslide catalog (mostly 2007–2024); many events are missing, especially older ones.',
  now: 'Nearby now', nowHead: (n: number) => (n ? `${n === 1 ? '1 event' : `${n} events`} in the last 30 days within 300 km` : 'Nothing in the last 30 days within 300 km'),
  nowNote: 'Earthquakes of magnitude 4 or more (USGS), eruptions, fires, storms and floods from the same database as the map.',
  types: { eq: 'Earthquake', volcano: 'Volcano', fire: 'Fire', storm: 'Storm', flood: 'Flood', drought: 'Drought' },
  map: 'Map', mapLegend: { place: 'Your place', quake: 'Strong earthquakes', volc: 'Volcanoes', tsu: 'Measured tsunamis', slide: 'Landslides', ring: 'Rings every 100 km' },
  notRisk: 'This shows hazards and history, not a risk study: risk also depends on how houses are built and how many people live there. In an emergency always follow your country’s civil protection agency.',
  sources: 'Sources', share: 'Copy link to this place', copied: 'Link copied',
  other: 'Search another place',
};

export const PLACE_TEXT: Record<Lang, typeof es> = { es, en };

export const PLACE_SOURCES = [
  { label: 'GEM Foundation: Global Seismic Hazard Map v2023.1 (CC BY-NC-SA 4.0)', url: 'https://doi.org/10.5281/zenodo.8409647' },
  { label: 'Wald et al. (1999), Earthquake Spectra (aceleración e intensidad)', url: 'https://doi.org/10.1193/1.1586058' },
  { label: 'USGS: catálogo de sismos ComCat', url: 'https://earthquake.usgs.gov/earthquakes/search/' },
  { label: 'NOAA NCEI: bases de sismos y tsunamis significativos (HazEL)', url: 'https://www.ngdc.noaa.gov/hazel/view/hazards' },
  { label: 'Smithsonian Institution, Global Volcanism Program', url: 'https://volcano.si.edu/' },
  { label: 'IBTrACS (NOAA NCEI)', url: 'https://www.ncei.noaa.gov/products/international-best-track-archive' },
  { label: 'NASA: Global Landslide Catalog (COOLR)', url: 'https://landslides.nasa.gov/' },
  { label: 'Bird (2003), PB2002 (placas tectónicas)', url: 'https://doi.org/10.1029/2001GC000252' },
  { label: 'Hayes et al. (2018), Slab2, Science', url: 'https://doi.org/10.1126/science.aat4723' },
  { label: 'Open-Meteo: búsqueda de lugares y altura del terreno (Copernicus DEM)', url: 'https://open-meteo.com/' },
  { label: 'Natural Earth (dominio público)', url: 'https://www.naturalearthdata.com/' },
];
