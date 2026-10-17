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
  whatIs: (k: string) => string;
  history: string; historyNote: string; historyNone: string; deaths: string; death: string; learnMore: string; oafIssued: (d: string) => string;
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
    whatIs: (k) => `¿Qué es una ${k}?`,
    deaths: 'muertes', death: 'muerte', learnMore: 'Aprender más', oafIssued: (d) => `Pronóstico emitido el ${d}.`,
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
    whatIs: (k) => `What is a ${k}?`,
    deaths: 'deaths', death: 'death', learnMore: 'Learn more', oafIssued: (d) => `Forecast issued ${d}.`,
  },
};

export const OAF_WINDOW: Record<Lang, Record<string, string>> = {
  es: { '1 Day': '1 día', '1 Week': '1 semana', '1 Month': '1 mes', '1 Year': '1 año' },
  en: { '1 Day': '1 day', '1 Week': '1 week', '1 Month': '1 month', '1 Year': '1 year' },
};

/* ───────────── Volcanes ───────────── */

type V = {
  setting: string; settingKind: Record<string, { name: string; text: string }>; crust: Record<string, string>;
  rock: string; rocks: Record<string, string>; rockOther: string;
  history: string; historyNote: (n: string, from: string) => string; historyOlder: (n: string, first: string) => string; noHistory: string;
  vei: string; veiNote: string; veiRows: [string, string, string][]; veiCol: [string, string, string];
  alert: string; alertLevels: Record<string, string>; colors: Record<string, string>;
  alertPre: string; alertPost: string; aviation: string; alertNone: string;
  vaac: string; vaacPre: string; vaacNote: string;
  summary: string; elevation: string; bce: string; unknownVei: string;
};

export const VOLC: Record<Lang, V> = {
  es: {
    setting: 'Por qué hay un volcán acá',
    settingKind: {
      subduction: { name: 'Zona de subducción', text: 'Una placa oceánica se hunde debajo de otra. Al bajar libera agua, que hace fundir el manto que tiene encima. Ese magma, con más sílice y gases, da volcanes explosivos como los de los Andes, Japón o Indonesia.' },
      rift: { name: 'Rift o dorsal (las placas se separan)', text: 'Las placas se alejan y el manto sube y se funde al bajar la presión. Da lava basáltica fluida, como en Islandia, las dorsales oceánicas o el valle del Rift en África.' },
      intraplate: { name: 'Intraplaca (lejos de los bordes)', text: 'El volcán está lejos de los bordes de placa. Muchos se explican por un punto caliente: una pluma de manto muy caliente que funde la placa que se mueve por encima, como en Hawái, donde se forma una cadena de islas cada vez más vieja.' },
    },
    crust: { continental: 'corteza continental (más de 25 km de espesor)', oceanic: 'corteza oceánica (menos de 15 km)', intermediate: 'corteza intermedia (15–25 km)' },
    rock: 'Roca dominante',
    rocks: {
      basalt: 'Basalto: poca sílice, lava fluida. Las erupciones suelen ser efusivas, con coladas y fuentes de lava.',
      andesite: 'Andesita: sílice intermedia, magma más viscoso que retiene gases. Erupciones explosivas moderadas a grandes.',
      dacite: 'Dacita: magma viscoso. Forma domos de lava y puede dar erupciones muy explosivas.',
      rhyolite: 'Riolita: muy viscosa y rica en gases. Da las erupciones más explosivas y calderas.',
      trachyte: 'Traquita o fonolita (alcalinas): magmas viscosos, con erupciones explosivas variables.',
    },
    rockOther: 'Tipo de roca según el GVP.',
    history: 'Historial de erupciones (VEI)',
    historyNote: (n, from) => `${n} erupciones confirmadas desde ${from} según el Smithsonian GVP. La altura de cada barra es su VEI (índice de explosividad); gris = sin VEI asignado.`,
    historyOlder: (n, first) => `Además, ${n} erupciones anteriores, la más antigua en ${first}`.replace(/\.?$/, '.'),
    noHistory: 'El GVP no registra erupciones confirmadas en el Holoceno para este volcán.',
    vei: 'Escala VEI (índice de explosividad volcánica)',
    veiNote: 'Desde el VEI 2, cada punto multiplica por 10 el volumen de material expulsado. Newhall y Self (1982), usada por el Smithsonian GVP.',
    veiCol: ['VEI', 'Material expulsado', 'Ejemplo'],
    veiRows: [
      ['0', 'menos de 10.000 m³', 'Kīlauea (efusiva, coladas de lava)'], ['1', '10.000 m³ – 1 millón de m³', 'Stromboli'],
      ['2', '1 – 10 millones de m³', 'Galeras, Colombia (1993)'], ['3', '10 – 100 millones de m³', 'Nevado del Ruiz, Colombia (1985)'],
      ['4', '0,1 – 1 km³', 'Eyjafjallajökull, Islandia (2010)'], ['5', '1 – 10 km³', 'Monte Santa Helena, EE. UU. (1980)'],
      ['6', '10 – 100 km³', 'Pinatubo, Filipinas (1991)'], ['7', '100 – 1.000 km³', 'Tambora, Indonesia (1815)'],
      ['8', 'más de 1.000 km³', 'Yellowstone, EE. UU. (hace unos 640.000 años)'],
    ],
    alert: 'Nivel de alerta oficial',
    alertLevels: { NORMAL: 'Normal', ADVISORY: 'Advertencia', WATCH: 'Vigilancia', WARNING: 'Alerta', UNASSIGNED: 'Sin asignar' },
    colors: { GREEN: 'verde', YELLOW: 'amarillo', ORANGE: 'naranja', RED: 'rojo', UNASSIGNED: 'sin asignar' },
    alertPre: 'El nivel de alerta lo fija el observatorio local: ', alertPost: 'No publica un servicio de datos que podamos leer, así que acá va solo el enlace.', aviation: 'código de aviación',
    alertNone: 'No tenemos registrado el observatorio oficial de este país. Consultá a la autoridad de protección civil local.',
    vaac: 'Ceniza volcánica y aviación',
    vaacPre: 'Los avisos de nubes de ceniza para la aviación de esta región los emite el ',
    vaacNote: 'Asignación aproximada por región; los límites exactos de cada VAAC los fija la OACI.',
    summary: 'Resumen geológico (Smithsonian GVP)', elevation: 'Altura', bce: 'a. C.', unknownVei: 'sin VEI',
  },
  en: {
    setting: 'Why there is a volcano here',
    settingKind: {
      subduction: { name: 'Subduction zone', text: 'An oceanic plate sinks beneath another. As it goes down it releases water, which melts the mantle above. That magma, richer in silica and gas, feeds explosive volcanoes such as those of the Andes, Japan or Indonesia.' },
      rift: { name: 'Rift or ridge (plates move apart)', text: 'The plates move apart and the mantle rises and melts as pressure drops. It produces fluid basaltic lava, as in Iceland, mid-ocean ridges or the African Rift Valley.' },
      intraplate: { name: 'Intraplate (away from plate boundaries)', text: 'The volcano is far from plate boundaries. Many are explained by a hotspot: a plume of very hot mantle that melts the plate moving above it, as in Hawaii, where a chain of ever-older islands forms.' },
    },
    crust: { continental: 'continental crust (over 25 km thick)', oceanic: 'oceanic crust (under 15 km)', intermediate: 'intermediate crust (15–25 km)' },
    rock: 'Dominant rock',
    rocks: {
      basalt: 'Basalt: low silica, fluid lava. Eruptions are usually effusive, with lava flows and fountains.',
      andesite: 'Andesite: intermediate silica, a more viscous magma that traps gas. Moderate to large explosive eruptions.',
      dacite: 'Dacite: viscous magma. Builds lava domes and can produce very explosive eruptions.',
      rhyolite: 'Rhyolite: very viscous and gas-rich. Produces the most explosive eruptions and calderas.',
      trachyte: 'Trachyte or phonolite (alkaline): viscous magmas with variably explosive eruptions.',
    },
    rockOther: 'Rock type according to GVP.',
    history: 'Eruption history (VEI)',
    historyNote: (n, from) => `${n} confirmed eruptions since ${from} according to the Smithsonian GVP. Bar height is the VEI (explosivity index); gray = no VEI assigned.`,
    historyOlder: (n, first) => `Plus ${n} earlier eruptions, the oldest in ${first}.`,
    noHistory: 'GVP records no confirmed Holocene eruptions for this volcano.',
    vei: 'VEI scale (Volcanic Explosivity Index)',
    veiNote: 'From VEI 2 on, each step multiplies the erupted volume by 10. Newhall and Self (1982), used by the Smithsonian GVP.',
    veiCol: ['VEI', 'Erupted material', 'Example'],
    veiRows: [
      ['0', 'under 10,000 m³', 'Kīlauea (effusive, lava flows)'], ['1', '10,000 m³ – 1 million m³', 'Stromboli'],
      ['2', '1 – 10 million m³', 'Galeras, Colombia (1993)'], ['3', '10 – 100 million m³', 'Nevado del Ruiz, Colombia (1985)'],
      ['4', '0.1 – 1 km³', 'Eyjafjallajökull, Iceland (2010)'], ['5', '1 – 10 km³', 'Mount St. Helens, USA (1980)'],
      ['6', '10 – 100 km³', 'Pinatubo, Philippines (1991)'], ['7', '100 – 1,000 km³', 'Tambora, Indonesia (1815)'],
      ['8', 'over 1,000 km³', 'Yellowstone, USA (about 640,000 years ago)'],
    ],
    alert: 'Official alert level',
    alertLevels: { NORMAL: 'Normal', ADVISORY: 'Advisory', WATCH: 'Watch', WARNING: 'Warning', UNASSIGNED: 'Unassigned' },
    colors: { GREEN: 'green', YELLOW: 'yellow', ORANGE: 'orange', RED: 'red', UNASSIGNED: 'unassigned' },
    alertPre: 'The alert level is set by the local observatory: ', alertPost: 'It publishes no data service we can read, so only the link is shown here.', aviation: 'aviation color code',
    alertNone: 'We do not have this country’s official observatory on file. Check your local civil protection authority.',
    vaac: 'Volcanic ash and aviation',
    vaacPre: 'Ash cloud advisories for aviation in this region are issued by ',
    vaacNote: 'Approximate assignment by region; the exact boundaries of each VAAC are set by ICAO.',
    summary: 'Geological summary (Smithsonian GVP)', elevation: 'Elevation', bce: 'BCE', unknownVei: 'no VEI',
  },
};

/* ───────────── Tsunamis ───────────── */

type TS = {
  title: string; why: string; whyNote: string;
  checks: { sea: [string, string]; shallow: [string, string]; big: [string, string]; thrust: [string, string] };
  yes: string; no: string; unknown: string;
  maps: string; buoys: string; buoysNote: string; reporting: string; notReporting: string; last: (d: string) => string; km: (k: string) => string;
  history: string; historyNote: string; historyNone: string; wave: (m: string) => string; deaths: (n: string) => string;
};

export const TSU: Record<Lang, TS> = {
  es: {
    title: 'Tsunami',
    why: '¿Podía generar un tsunami?',
    whyNote: 'Son las condiciones que suelen tener los sismos que generan tsunamis grandes; no es un pronóstico. La señal oficial son los mensajes de los centros de alerta.',
    checks: {
      sea: ['Epicentro en el mar', 'El fondo marino tiene que moverse para empujar el agua.'],
      shallow: ['Poco profundo (70 km o menos)', 'Si la ruptura es muy profunda, casi no deforma el fondo marino.'],
      big: ['Magnitud 7 o más', 'Hace falta mucha energía para mover grandes volúmenes de agua; los tsunamis destructivos lejanos suelen venir de M8+.'],
      thrust: ['Falla inversa (movimiento vertical)', 'Las fallas inversas de subducción levantan el fondo marino; las de rumbo lo mueven de costado y empujan poca agua.'],
    },
    yes: 'Sí', no: 'No', unknown: 'Sin dato',
    maps: 'Mapas de los centros de alerta',
    buoys: 'Boyas DART cercanas (NOAA)',
    buoysNote: 'Las boyas DART miden desde el fondo del mar el paso de un tsunami. Estado según la lista de estaciones activas de NDBC (NOAA).',
    reporting: 'transmitiendo', notReporting: 'sin datos recientes', last: (d) => `último dato: ${d}`, km: (k) => `a ${k} km`,
    history: 'Tsunamis históricos en la zona (400 km)', historyNote: 'Tsunamis desde 1900 según la base de NOAA NCEI, ordenados por altura máxima de ola.',
    historyNone: 'NCEI no registra tsunamis a menos de 400 km desde 1900.',
    wave: (m) => `ola máxima ${m} m`, deaths: (n) => (n === '1' ? '1 muerte' : `${n} muertes`),
  },
  en: {
    title: 'Tsunami',
    why: 'Could it generate a tsunami?',
    whyNote: 'These are the conditions earthquakes that generate large tsunamis usually have; this is not a forecast. The official signal is the warning centers’ messages.',
    checks: {
      sea: ['Epicenter at sea', 'The seafloor has to move to push the water.'],
      shallow: ['Shallow (70 km or less)', 'A very deep rupture barely deforms the seafloor.'],
      big: ['Magnitude 7 or greater', 'Moving large volumes of water takes a lot of energy; distant destructive tsunamis usually come from M8+.'],
      thrust: ['Reverse fault (vertical motion)', 'Subduction reverse faults lift the seafloor; strike-slip faults move it sideways and push little water.'],
    },
    yes: 'Yes', no: 'No', unknown: 'No data',
    maps: 'Warning center maps',
    buoys: 'Nearby DART buoys (NOAA)',
    buoysNote: 'DART buoys detect a passing tsunami from the seafloor. Status from the NDBC (NOAA) active stations list.',
    reporting: 'reporting', notReporting: 'no recent data', last: (d) => `latest data: ${d}`, km: (k) => `${k} km away`,
    history: 'Historical tsunamis in the area (400 km)', historyNote: 'Tsunamis since 1900 from the NOAA NCEI database, sorted by maximum wave height.',
    historyNone: 'NCEI records no tsunamis within 400 km since 1900.',
    wave: (m) => `max wave ${m} m`, deaths: (n) => (n === '1' ? '1 death' : `${n} deaths`),
  },
};
