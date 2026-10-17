import type { Lang } from './types';

/* Textos de "Contexto geológico" (sismos, volcanes, tsunamis). */

export const PLATE_ES: Record<string, string> = {
  PA: 'del Pacífico', NA: 'Norteamericana', SA: 'Sudamericana', NZ: 'de Nazca', CO: 'de Cocos', CA: 'del Caribe', AF: 'Africana (Nubia)',
  SO: 'Somalí', EU: 'Euroasiática', AN: 'Antártica', AU: 'Australiana', IN: 'India', AR: 'Arábiga', PS: 'Filipina',
  JF: 'de Juan de Fuca', RI: 'de Rivera', SC: 'de Scotia', OK: 'de Ojotsk', AM: 'de Amur', YA: 'del Yangtsé', SU: 'de la Sonda',
  ND: 'de los Andes del Norte', AP: 'del Altiplano', PM: 'de Panamá', SW: 'Sandwich', AT: 'de Anatolia', AS: 'del Egeo',
  MA: 'de las Marianas', ON: 'de Okinawa', BU: 'de Birmania', TO: 'de Tonga', KE: 'de Kermadec', NH: 'de Nuevas Hébridas',
  BS: 'del Mar de Banda', TI: 'de Timor', BH: 'de Cabeza de Pájaro', MS: 'del Mar de las Molucas', SS: 'del Mar de Salomón',
  NB: 'de Bismarck Norte', SB: 'de Bismarck Sur', WL: 'de Woodlark', MN: 'de Manus', CL: 'de las Carolinas', FT: 'de Futuna',
  NI: 'de Niuafo’ou', CR: 'de Conway Reef', BR: 'de Balmoral Reef', EA: 'de Pascua', JZ: 'de Juan Fernández', GP: 'de Galápagos',
  SL: 'de Shetland', MO: 'de Maoke',
};

export const plateLabel = (lang: Lang, code: string, en: string) =>
  lang === 'es' ? `Placa ${PLATE_ES[code] ?? en}` : `${en} plate`;

const COMPASS = {
  es: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'],
  en: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'],
};
export const compass = (lang: Lang, az: number) => COMPASS[lang][Math.round(((az % 360) + 360) % 360 / 22.5) % 16];

type G = {
  title: string; interp: string; source: string;
  mech: string; noMech: string; planes: string; plane: (n: number) => string;
  kind: Record<string, { name: string; text: string }>;
  plates: string; epicenterIn: string; boundaryNear: (kind: string, km: string) => string;
  boundary: Record<string, string>; subduction: string;
  velocity: (of: string, rel: string, cm: string, dir: string, az: string) => string; velocityNote: string;
  slab: string; slabDepth: (d: string, region: string) => string; slabEq: (d: string) => string;
  relation: Record<string, { name: string; text: string }>; slabCriteria: string; noSlab: string;
  summary: string; summaryAuto: string; summaryOriginal: string; summaryTranslate: string;
  section: string; sectionNote: (az: string) => string; sectionAxis: { dist: string; depth: string }; sectionLegend: { slab: string; quake: string; aft: (n: string) => string };
  oaf: string; oafNote: string; oafWindow: string; oafMag: (m: string) => string; oafRange: (lo: string, hi: string) => string; oafModel: string;
  history: string; historyNote: string; historyNone: string; deaths: string; learnMore: string;
};

export const GEO: Record<Lang, G> = {
  es: {
    title: 'Contexto geológico', interp: 'Interpretación', source: 'Fuente',
    mech: 'Tipo de falla (mecanismo focal)', noMech: 'USGS no publicó un mecanismo focal para este sismo (suele hacerlo desde M5 aprox.).',
    planes: 'Planos nodales (rumbo / buzamiento / deslizamiento)', plane: (n) => `Plano ${n}`,
    kind: {
      reverse: { name: 'Falla inversa', text: 'Compresión: un bloque sube sobre el otro. Es el movimiento típico de las zonas de subducción, donde una placa se mete debajo de otra.' },
      normal: { name: 'Falla normal', text: 'Extensión: un bloque baja respecto del otro porque la corteza se estira. Es típica de los rifts, y también ocurre dentro de la placa que se hunde.' },
      'strike-slip': { name: 'Falla de rumbo (transcurrente)', text: 'Los bloques se deslizan de costado, uno al lado del otro, casi sin subir ni bajar. Es típica de los bordes transformantes, como la falla de San Andrés.' },
      oblique: { name: 'Falla oblicua', text: 'Combina movimientos: el bloque se desliza de costado y a la vez sube o baja. Ninguno de los ejes de esfuerzo es claramente vertical.' },
    },
    plates: 'Placas tectónicas', epicenterIn: 'El epicentro está en la', boundaryNear: (k, km) => `Borde más cercano: ${k}, a ${km} km`,
    boundary: { convergent: 'convergente (las placas se acercan)', divergent: 'divergente (las placas se separan)', transform: 'transformante (las placas se deslizan de costado)' },
    subduction: 'zona de subducción',
    velocity: (of, rel, cm, dir, az) => `La ${of} se mueve respecto de la ${rel} a unos ${cm} cm/año hacia el ${dir} (${az}°).`,
    velocityNote: 'Velocidad calculada con el modelo NNR-MORVEL56 (Argus, Gordon y DeMets, 2011) en el epicentro.',
    slab: 'Losa subducida (Slab2)', slabDepth: (d, r) => `En este punto, la placa que se hunde está a unos ${d} km de profundidad (zona ${r}, modelo Slab2 del USGS).`,
    slabEq: (d) => `El sismo ocurrió a ${d} km.`,
    relation: {
      interface: { name: 'Interplaca', text: 'En el contacto entre las dos placas, donde ocurren los sismos de subducción más grandes.' },
      intraslab: { name: 'Intraplaca (dentro de la losa)', text: 'Dentro de la placa que se hunde, debajo del contacto.' },
      crustal: { name: 'Cortical', text: 'En la placa de arriba, a poca profundidad.' },
      unclear: { name: 'Sin clasificar', text: 'La profundidad no permite ubicarlo con claridad respecto de la losa.' },
    },
    slabCriteria: 'Criterio: si la profundidad del sismo está a 15 km o menos de la losa y no supera los 70 km, interplaca; más de 15 km por debajo, intraplaca; más de 15 km por encima y hasta 40 km, cortical. Las profundidades tienen incertidumbre.',
    noSlab: 'El epicentro no está sobre una zona de subducción del modelo Slab2.',
    summary: 'Resumen tectónico del USGS', summaryAuto: 'Traducción automática (IA) del texto oficial del USGS. Ante cualquier duda, vale el original.',
    summaryOriginal: 'Texto original (USGS)', summaryTranslate: 'Traducir con Google',
    section: 'Corte transversal', sectionNote: (az) => `Perfil de la losa en la dirección en que se hunde (rumbo ${az}°), con el sismo y las réplicas de USGS a menos de 100 km del perfil. Distancias desde el epicentro.`,
    sectionAxis: { dist: 'Distancia (km)', depth: 'Profundidad (km)' },
    sectionLegend: { slab: 'Losa (Slab2)', quake: 'Este sismo', aft: (n) => `Réplicas (${n})` },
    oaf: 'Pronóstico de réplicas (USGS)', oafNote: 'Probabilidad de que haya al menos una réplica de esa magnitud o mayor en cada período, según el pronóstico operativo del USGS. Se muestra tal como lo publica el USGS.',
    oafWindow: 'Período', oafMag: (m) => `M ${m}+`, oafRange: (lo, hi) => `${lo}–${hi} sismos`, oafModel: 'Modelo',
    history: 'Sismos grandes en la zona (300 km)', historyNote: 'Sismos significativos desde 1900 según NOAA NCEI, ordenados por víctimas.', historyNone: 'NCEI no registra sismos significativos a menos de 300 km desde 1900.',
    deaths: 'muertes', learnMore: 'Aprender más',
  },
  en: {
    title: 'Geological context', interp: 'Interpretation', source: 'Source',
    mech: 'Fault type (focal mechanism)', noMech: 'USGS has not published a focal mechanism for this earthquake (usually done from about M5).',
    planes: 'Nodal planes (strike / dip / rake)', plane: (n) => `Plane ${n}`,
    kind: {
      reverse: { name: 'Reverse fault', text: 'Compression: one block rides up over the other. This is the typical motion of subduction zones, where one plate dives beneath another.' },
      normal: { name: 'Normal fault', text: 'Extension: one block drops relative to the other as the crust stretches. Typical of rifts, and also common inside the sinking plate.' },
      'strike-slip': { name: 'Strike-slip fault', text: 'The blocks slide sideways past each other, with little up or down motion. Typical of transform boundaries such as the San Andreas fault.' },
      oblique: { name: 'Oblique fault', text: 'A mix of motions: the block slides sideways while also moving up or down. None of the stress axes is clearly vertical.' },
    },
    plates: 'Tectonic plates', epicenterIn: 'The epicenter is on the', boundaryNear: (k, km) => `Nearest boundary: ${k}, ${km} km away`,
    boundary: { convergent: 'convergent (plates move together)', divergent: 'divergent (plates move apart)', transform: 'transform (plates slide past each other)' },
    subduction: 'subduction zone',
    velocity: (of, rel, cm, dir, az) => `The ${of} moves relative to the ${rel} at about ${cm} cm/yr toward the ${dir} (${az}°).`,
    velocityNote: 'Velocity computed with the NNR-MORVEL56 model (Argus, Gordon and DeMets, 2011) at the epicenter.',
    slab: 'Subducted slab (Slab2)', slabDepth: (d, r) => `At this point the sinking plate is about ${d} km deep (${r} zone, USGS Slab2 model).`,
    slabEq: (d) => `The earthquake occurred at ${d} km.`,
    relation: {
      interface: { name: 'Interface (interplate)', text: 'On the contact between the two plates, where the largest subduction earthquakes happen.' },
      intraslab: { name: 'Intraslab', text: 'Inside the sinking plate, below the contact.' },
      crustal: { name: 'Crustal', text: 'In the overriding plate, at shallow depth.' },
      unclear: { name: 'Unclassified', text: 'The depth does not clearly place it relative to the slab.' },
    },
    slabCriteria: 'Criteria: within 15 km of the slab and no deeper than 70 km, interface; more than 15 km below, intraslab; more than 15 km above and down to 40 km, crustal. Depths are uncertain.',
    noSlab: 'The epicenter is not over a subduction zone in the Slab2 model.',
    summary: 'USGS tectonic summary', summaryAuto: 'Machine translation (AI) of the official USGS text. When in doubt, the original prevails.',
    summaryOriginal: 'Original text (USGS)', summaryTranslate: 'Translate with Google',
    section: 'Cross-section', sectionNote: (az) => `Slab profile along its dip direction (azimuth ${az}°), with the earthquake and USGS aftershocks within 100 km of the profile. Distances from the epicenter.`,
    sectionAxis: { dist: 'Distance (km)', depth: 'Depth (km)' },
    sectionLegend: { slab: 'Slab (Slab2)', quake: 'This earthquake', aft: (n) => `Aftershocks (${n})` },
    oaf: 'Aftershock forecast (USGS)', oafNote: 'Probability of at least one aftershock of that magnitude or larger in each period, according to the USGS operational forecast. Shown as published by the USGS.',
    oafWindow: 'Period', oafMag: (m) => `M ${m}+`, oafRange: (lo, hi) => `${lo}–${hi} quakes`, oafModel: 'Model',
    history: 'Large earthquakes in the area (300 km)', historyNote: 'Significant earthquakes since 1900 according to NOAA NCEI, sorted by deaths.', historyNone: 'NCEI records no significant earthquakes within 300 km since 1900.',
    deaths: 'deaths', learnMore: 'Learn more',
  },
};

export const OAF_WINDOW: Record<Lang, Record<string, string>> = {
  es: { '1 Day': '1 día', '1 Week': '1 semana', '1 Month': '1 mes', '1 Year': '1 año' },
  en: { '1 Day': '1 day', '1 Week': '1 week', '1 Month': '1 month', '1 Year': '1 year' },
};
