/*
 * Volcanes y erupciones del simulador de volcanes.
 *
 * Volcanes: ubicación, altura y tipo del catálogo del Programa Global de Vulcanismo del Smithsonian (GVP).
 * Erupciones reales: altura de la columna, duración y masa publicadas para cada fase (fuentes en `refs`).
 * Cuando no hay una masa publicada para esa fase, se estima con la relación entre altura de la columna y
 * tasa de emisión de Mastin et al. (2009) y se aclara en la nota (massFrom: 'mastin').
 */
import type { Lang } from '../types';

export type VolcanoType = 'shield' | 'strato' | 'cone' | 'dome' | 'caldera';
export type Style = 'hawaiian' | 'strombolian' | 'vulcanian' | 'subplinian' | 'plinian';

export type Volcano = {
  id: string; gvp: number;
  name: string; country: Record<Lang, string>;
  /** Tipo para el simulador (puede afinar el "tipo principal" del GVP: ver la nota de cada uno). */
  type: VolcanoType;
  lon: number; lat: number; elev: number;
  /** Medio lado del recuadro del relieve 3D (km). */
  boxKm: number;
  /** Ciudades y pueblos para el mapa de la ceniza: nombre, lon, lat. */
  places: [string, number, number][];
  note: Record<Lang, string>;
};

export type Phase = {
  /** Inicio (UTC, ISO 8601). */
  start: string;
  hours: number;
  /** Altura de la columna (km sobre el nivel del mar). */
  topKm: number;
  /** Masa de tefra que cae (kg). */
  massKg: number;
  massFrom: 'deposit' | 'mastin';
};

export type Eruption = {
  id: string; volcano: string; year: number;
  name: Record<Lang, string>;
  style: Style; vei: number;
  phases: Phase[];
  /** Granulometría total: mediana y desvío en unidades phi (φ = −log2 del diámetro en mm). */
  gsd: { md: number; sigma: number; measured: boolean };
  /** Viento: el del reanálisis de la NOAA a la hora de cada fase, o el promedio de un mes (sin datos de ese día). */
  wind: 'reanalysis' | { month: number };
  note: Record<Lang, string>;
  refs: { label: string; url: string }[];
  /** Foto real de la erupción (Wikimedia Commons, dominio público o licencia libre) en /images/eruptions/<id>.jpg. */
  photo: { caption: Record<Lang, string>; credit: string; license: string; page: string };
  /** Espesor medido en el terreno (mm): lugar, lon, lat, mínimo y máximo, fuente. */
  obs?: { place: string; lon: number; lat: number; min: number; max: number; src: string }[];
};

export const VOLCANOES: Volcano[] = [
  {
    id: 'villarrica', gvp: 357120, name: 'Villarrica', country: { es: 'Chile', en: 'Chile' }, type: 'strato',
    lon: -71.93, lat: -39.42, elev: 2847, boxKm: 16,
    places: [['Pucón', -71.954, -39.282], ['Villarrica', -72.228, -39.285], ['Coñaripe', -71.966, -39.564], ['Curarrehue', -71.588, -39.359], ['Licán Ray', -72.149, -39.49], ['Temuco', -72.598, -38.739], ['Junín de los Andes', -71.069, -39.951], ['San Martín de los Andes', -71.353, -40.157], ['Aluminé', -70.92, -39.24]],
    note: { es: 'Uno de los volcanes más activos de Sudamérica, con un lago de lava en el cráter.', en: 'One of the most active volcanoes in South America, with a lava lake in its crater.' },
  },
  {
    id: 'calbuco', gvp: 358020, name: 'Calbuco', country: { es: 'Chile', en: 'Chile' }, type: 'strato',
    lon: -72.618, lat: -41.33, elev: 1974, boxKm: 16,
    places: [['Ensenada', -72.535, -41.208], ['Puerto Varas', -72.985, -41.318], ['Puerto Montt', -72.942, -41.469], ['Frutillar', -73.059, -41.127], ['Cochamó', -72.304, -41.49], ['Villa La Angostura', -71.646, -40.763], ['Bariloche', -71.31, -41.133], ['San Martín de los Andes', -71.353, -40.157], ['Junín de los Andes', -71.069, -39.951], ['Ingeniero Jacobacci', -69.55, -41.33], ['Neuquén', -68.06, -38.95]],
    note: { es: 'Estratovolcán andesítico frente al lago Llanquihue; casi sin aviso, en 2015 tuvo dos fases explosivas en una noche.', en: 'Andesitic stratovolcano facing Lake Llanquihue; with almost no warning, in 2015 it had two explosive phases in one night.' },
  },
  {
    id: 'cordon-caulle', gvp: 357150, name: 'Puyehue-Cordón Caulle', country: { es: 'Chile', en: 'Chile' }, type: 'caldera',
    lon: -72.117, lat: -40.59, elev: 2236, boxKm: 20,
    places: [['Villa La Angostura', -71.646, -40.763], ['Bariloche', -71.31, -41.133], ['Entre Lagos', -72.6, -40.676], ['Osorno', -73.133, -40.574], ['Pilcaniyeu', -70.72, -41.12], ['Comallo', -70.27, -41.03], ['Ingeniero Jacobacci', -69.55, -41.33], ['Maquinchao', -68.7, -41.25], ['San Martín de los Andes', -71.353, -40.157], ['Neuquén', -68.06, -38.95]],
    note: { es: 'Complejo volcánico con un graben (fosa tectónica) y fisuras; en 2011 erupcionó desde una fisura en el Cordón Caulle. El GVP lo clasifica como estratovolcán por el Puyehue.', en: 'Volcanic complex with a graben and fissures; in 2011 it erupted from a fissure on the Cordón Caulle. The GVP classifies it as a stratovolcano because of Puyehue.' },
  },
  {
    id: 'chaiten', gvp: 358041, name: 'Chaitén', country: { es: 'Chile', en: 'Chile' }, type: 'dome',
    lon: -72.6514, lat: -42.8349, elev: 1122, boxKm: 14,
    places: [['Chaitén', -72.709, -42.915], ['Futaleufú', -71.867, -43.185], ['Esquel', -71.319, -42.911], ['Trevelin', -71.465, -43.085], ['El Bolsón', -71.534, -41.964], ['Tecka', -70.81, -43.49], ['Gobernador Costa', -70.05, -44.05], ['Puerto Montt', -72.942, -41.469], ['Trelew', -65.31, -43.25]],
    note: { es: 'Caldera pequeña con un domo de lava riolítica. En 2008 despertó tras unos 9.000 años y obligó a evacuar el pueblo de Chaitén.', en: 'Small caldera with a rhyolitic lava dome. In 2008 it awoke after about 9,000 years and forced the evacuation of the town of Chaitén.' },
  },
  {
    id: 'st-helens', gvp: 321050, name: 'Mount St. Helens', country: { es: 'Estados Unidos', en: 'United States' }, type: 'strato',
    lon: -122.18, lat: 46.2, elev: 2549, boxKm: 16,
    places: [['Yakima', -120.505, 46.602], ['Ellensburg', -120.548, 46.997], ['Moses Lake', -119.278, 47.13], ['Ritzville', -118.38, 47.127], ['Spokane', -117.426, 47.659], ['Pullman', -117.18, 46.731], ['Missoula', -113.99, 46.87], ['Morton', -122.275, 46.558], ['Portland', -122.678, 45.515], ['Seattle', -122.332, 47.606]],
    note: { es: 'El 18 de mayo de 1980 colapsó su flanco norte y siguió una erupción pliniana de unas 9 horas. El GVP hoy lo mide en 2.549 m (antes medía 2.950 m).', en: 'On 18 May 1980 its north flank collapsed, followed by a Plinian eruption lasting about 9 hours. Today the GVP gives 2,549 m (it was 2,950 m before).' },
  },
  {
    id: 'pinatubo', gvp: 273083, name: 'Pinatubo', country: { es: 'Filipinas', en: 'Philippines' }, type: 'strato',
    lon: 120.35, lat: 15.13, elev: 1486, boxKm: 18,
    places: [['Ángeles', 120.584, 15.145], ['Base Aérea Clark', 120.55, 15.18], ['San Fernando', 120.69, 15.03], ['Tarlac', 120.59, 15.48], ['Olongapo', 120.28, 14.83], ['Iba', 119.98, 15.33], ['Manila', 120.984, 14.599], ['Baguio', 120.6, 16.41]],
    note: { es: 'Después de 1991 la cima se hundió y formó una caldera de unos 2,5 km, hoy con un lago.', en: 'After 1991 the summit collapsed into a caldera about 2.5 km across, now holding a lake.' },
  },
  {
    id: 'vesuvius', gvp: 211020, name: 'Vesubio', country: { es: 'Italia', en: 'Italy' }, type: 'strato',
    lon: 14.426, lat: 40.821, elev: 1281, boxKm: 12,
    places: [['Nápoles', 14.268, 40.852], ['Herculano', 14.348, 40.806], ['Torre del Greco', 14.37, 40.79], ['Pompeya', 14.485, 40.749], ['Estabia', 14.48, 40.7], ['Salerno', 14.77, 40.68], ['Avellino', 14.79, 40.91], ['Caserta', 14.33, 41.07]],
    note: { es: 'Estratovolcán dentro de la caldera del monte Somma, con unos 3 millones de personas alrededor.', en: 'Stratovolcano inside the Somma caldera, with about 3 million people around it.' },
  },
  {
    id: 'lanin', gvp: 357122, name: 'Lanín', country: { es: 'Argentina y Chile', en: 'Argentina and Chile' }, type: 'strato',
    lon: -71.502, lat: -39.637, elev: 3776, boxKm: 16,
    places: [['Junín de los Andes', -71.069, -39.951], ['San Martín de los Andes', -71.353, -40.157], ['Aluminé', -70.92, -39.24], ['Pucón', -71.954, -39.282], ['Curarrehue', -71.588, -39.359], ['Zapala', -70.06, -38.9], ['Neuquén', -68.06, -38.95]],
    note: { es: 'Estratovolcán sin erupciones registradas en tiempos históricos; su última actividad conocida fue hace unos miles de años.', en: 'Stratovolcano with no eruptions in historical times; its last known activity was a few thousand years ago.' },
  },
  {
    id: 'copahue', gvp: 357090, name: 'Copahue', country: { es: 'Argentina y Chile', en: 'Argentina and Chile' }, type: 'strato',
    lon: -71.183, lat: -37.856, elev: 2953, boxKm: 14,
    places: [['Caviahue', -71.05, -37.87], ['Copahue', -71.09, -37.82], ['Loncopué', -70.61, -38.07], ['Chos Malal', -70.27, -37.38], ['Zapala', -70.06, -38.9], ['Lonquimay', -71.24, -38.43], ['Neuquén', -68.06, -38.95]],
    note: { es: 'Activo con frecuencia (erupciones chicas en 2000, 2012 y desde 2016); tiene un lago ácido en el cráter.', en: 'Frequently active (small eruptions in 2000, 2012 and since 2016); it has an acid crater lake.' },
  },
  {
    id: 'popocatepetl', gvp: 341090, name: 'Popocatépetl', country: { es: 'México', en: 'Mexico' }, type: 'strato',
    lon: -98.622, lat: 19.023, elev: 5393, boxKm: 16,
    places: [['Amecameca', -98.766, 19.124], ['Atlixco', -98.44, 18.91], ['Cholula', -98.303, 19.064], ['Puebla', -98.206, 19.041], ['Tlaxcala', -98.237, 19.318], ['Cuernavaca', -99.23, 18.92], ['Ciudad de México', -99.133, 19.432]],
    note: { es: 'Activo desde 1994, con explosiones que a menudo cierran los aeropuertos de Puebla y Ciudad de México.', en: 'Active since 1994, with explosions that often close the Puebla and Mexico City airports.' },
  },
  {
    id: 'fuego', gvp: 342090, name: 'Fuego', country: { es: 'Guatemala', en: 'Guatemala' }, type: 'strato',
    lon: -90.8806, lat: 14.4748, elev: 3799, boxKm: 14,
    places: [['Alotenango', -90.81, 14.48], ['Antigua Guatemala', -90.734, 14.557], ['Escuintla', -90.785, 14.3], ['Ciudad de Guatemala', -90.507, 14.634], ['Chimaltenango', -90.82, 14.66]],
    note: { es: 'Uno de los volcanes más activos del mundo; en 2018 sus flujos piroclásticos arrasaron San Miguel Los Lotes.', en: 'One of the most active volcanoes in the world; in 2018 its pyroclastic flows destroyed San Miguel Los Lotes.' },
  },
  {
    id: 'etna', gvp: 211060, name: 'Etna', country: { es: 'Italia', en: 'Italy' }, type: 'strato',
    lon: 14.999, lat: 37.748, elev: 3357, boxKm: 18,
    places: [['Catania', 15.083, 37.507], ['Acireale', 15.166, 37.61], ['Zafferana Etnea', 15.104, 37.692], ['Taormina', 15.287, 37.852], ['Bronte', 14.83, 37.79], ['Messina', 15.55, 38.19]],
    note: { es: 'El volcán más alto de Europa occidental: fuentes de lava, columnas de ceniza y coladas casi todos los años.', en: 'The tallest volcano in western Europe: lava fountains, ash columns and lava flows almost every year.' },
  },
  {
    id: 'stromboli', gvp: 211040, name: 'Stromboli', country: { es: 'Italia', en: 'Italy' }, type: 'cone',
    lon: 15.213, lat: 38.789, elev: 924, boxKm: 7,
    places: [['Stromboli', 15.23, 38.80], ['Ginostra', 15.19, 38.785], ['Lipari', 14.955, 38.467], ['Milazzo', 15.24, 38.22]],
    note: { es: 'Le da nombre al estilo estromboliano: pequeñas explosiones cada pocos minutos desde hace unos 2.000 años. Es un estratovolcán; acá se usa como ejemplo de actividad de los conos de escoria.', en: 'It gives its name to the Strombolian style: small explosions every few minutes for about 2,000 years. It is a stratovolcano; here it stands in for the activity of scoria cones.' },
  },
  {
    id: 'kilauea', gvp: 332010, name: 'Kīlauea', country: { es: 'Estados Unidos (Hawái)', en: 'United States (Hawaii)' }, type: 'shield',
    lon: -155.287, lat: 19.421, elev: 1222, boxKm: 20,
    places: [['Volcano', -155.24, 19.43], ['Hilo', -155.082, 19.707], ['Pāhoa', -154.946, 19.494], ['Nāʻālehu', -155.586, 19.06], ['Kailua-Kona', -155.996, 19.64]],
    note: { es: 'Volcán en escudo: lava muy fluida y erupciones casi siempre efusivas. En 2018 sus coladas destruyeron más de 700 casas.', en: 'Shield volcano: very fluid lava and mostly effusive eruptions. In 2018 its lava flows destroyed more than 700 homes.' },
  },
  // Volcanes que aparecen seguido en los avisos de ceniza (datos del GVP; ciudades de Natural Earth).
  {
    id: 'nevados-chillan', gvp: 357070, name: 'Nevados de Chillán', country: { es: 'Chile', en: 'Chile' }, type: 'strato',
    lon: -71.378, lat: -36.868, elev: 3180, boxKm: 14,
    places: [['Chillán', -72.111, -36.607], ['Los Ángeles', -72.347, -37.48], ['Chos Malal', -70.267, -37.383], ['Concepción', -73.05, -36.83], ['Talca', -71.666, -35.43], ['Malargüe', -69.583, -35.466], ['Temuco', -72.58, -38.73], ['Zapala', -70.067, -38.9], ['Neuquén', -68.06, -38.95], ['Santiago', -70.651, -33.44]],
    note: { es: 'Complejo de volcanes en la región de Ñuble, junto a las termas de Chillán. Desde 2016 tuvo varios años de explosiones y domos de lava.', en: 'Volcanic complex in Chile’s Ñuble region, next to the Chillán hot springs. From 2016 it had several years of explosions and lava domes.' },
  },
  {
    id: 'planchon-peteroa', gvp: 357040, name: 'Planchón-Peteroa', country: { es: 'Argentina y Chile', en: 'Argentina and Chile' }, type: 'strato',
    lon: -70.568, lat: -35.223, elev: 3977, boxKm: 14,
    places: [['Curicó', -71.24, -34.98], ['Malargüe', -69.583, -35.466], ['Talca', -71.666, -35.43], ['Linares', -71.591, -35.851], ['Rancagua', -70.74, -34.17], ['Santiago', -70.651, -33.44], ['San Rafael', -68.333, -34.6], ['Tunuyán', -69.017, -33.566], ['Valparaíso', -71.617, -33.048], ['Concepción', -73.05, -36.83], ['Mendoza', -68.819, -32.881]],
    note: { es: 'En el límite entre Mendoza y la región del Maule. Sus emisiones de ceniza llegan a Malargüe y al sur de Mendoza.', en: 'On the border between Mendoza (Argentina) and Chile’s Maule region. Its ash emissions reach Malargüe and southern Mendoza.' },
  },
  {
    id: 'llaima', gvp: 357110, name: 'Llaima', country: { es: 'Chile', en: 'Chile' }, type: 'strato',
    lon: -71.729, lat: -38.692, elev: 3125, boxKm: 16,
    places: [['Lonquimay', -71.233, -38.433], ['Victoria', -72.34, -38.24], ['Temuco', -72.58, -38.73], ['Villarrica', -72.23, -39.28], ['Las Lajas', -70.367, -38.516], ['Angol', -72.705, -37.802], ['Los Ángeles', -72.347, -37.48], ['Zapala', -70.067, -38.9], ['Valdivia', -73.233, -39.822], ['Cutral Có', -69.24, -38.94], ['Concepción', -73.05, -36.83]],
    note: { es: 'Uno de los volcanes más activos de Chile, en el Parque Nacional Conguillío. Sus últimas erupciones fueron en 2008 y 2009.', en: 'One of Chile’s most active volcanoes, in Conguillío National Park. Its latest eruptions were in 2008 and 2009.' },
  },
  {
    id: 'hudson', gvp: 358057, name: 'Hudson', country: { es: 'Chile', en: 'Chile' }, type: 'strato',
    lon: -72.97, lat: -45.9, elev: 1905, boxKm: 18,
    places: [['Puerto Aisén', -72.7, -45.4], ['Coyhaique', -72.07, -45.57], ['Cochrane', -72.55, -47.266], ['Perito Moreno', -70.933, -46.6], ['Alto Río Senguer', -70.833, -45.033], ['Paso Río Mayo', -70.267, -45.683], ['Sarmiento', -69.083, -45.6], ['Quellón', -73.6, -43.1], ['Esquel', -71.317, -42.9], ['Gobernador Gregores', -70.25, -48.767], ['Castro', -73.762, -42.481]],
    note: { es: 'Volcán cubierto de hielo en Aysén. En 1991 tuvo una de las mayores erupciones del siglo XX en Sudamérica: la ceniza cubrió buena parte de Santa Cruz.', en: 'Ice-covered volcano in Chile’s Aysén region. In 1991 it had one of the largest eruptions of the 20th century in South America: ash covered much of Santa Cruz, Argentina.' },
  },
  {
    id: 'lascar', gvp: 355100, name: 'Láscar', country: { es: 'Chile', en: 'Chile' }, type: 'strato',
    lon: -67.73, lat: -23.37, elev: 5592, boxKm: 14,
    places: [['Toconao', -68.017, -23.183], ['Susques', -66.483, -23.417], ['Calama', -68.92, -22.45], ['San Antonio de los Cobres', -66.35, -24.183], ['Rinconada', -66.167, -22.433], ['Humahuaca', -65.35, -23.2], ['San Salvador de Jujuy', -65.3, -24.183], ['Antofagasta', -70.4, -23.65], ['Salta', -65.417, -24.783]],
    note: { es: 'El volcán más activo del norte de Chile, en la Puna de Atacama. En 1993 su columna llegó a unos 25 km y la ceniza cayó en el norte argentino.', en: 'The most active volcano in northern Chile, on the Atacama Puna. In 1993 its column reached about 25 km and ash fell in northern Argentina.' },
  },
  {
    id: 'sabancaya', gvp: 354006, name: 'Sabancaya', country: { es: 'Perú', en: 'Peru' }, type: 'strato',
    lon: -71.857, lat: -15.787, elev: 5960, boxKm: 16,
    places: [['Arequipa', -71.532, -16.418], ['Mollendo', -72.02, -17.02], ['Sicuani', -71.23, -14.29], ['Moquegua', -70.94, -17.19], ['Juliaca', -70.14, -15.5], ['Puno', -70.033, -15.833], ['Cusco', -71.972, -13.525], ['Tacna', -70.25, -18], ['Arica', -70.29, -18.5]],
    note: { es: 'Cerca de Arequipa, en el valle del Colca. Desde 2016 tiene explosiones casi todos los días.', en: 'Near Arequipa, by the Colca valley. Since 2016 it has had explosions almost every day.' },
  },
  {
    id: 'ubinas', gvp: 354020, name: 'Ubinas', country: { es: 'Perú', en: 'Peru' }, type: 'strato',
    lon: -70.8972, lat: -16.345, elev: 5608, boxKm: 14,
    places: [['Arequipa', -71.532, -16.418], ['Moquegua', -70.94, -17.19], ['Puno', -70.033, -15.833], ['Juliaca', -70.14, -15.5], ['Ilo', -71.34, -17.64], ['Tacna', -70.25, -18], ['Arica', -70.29, -18.5], ['La Paz', -68.152, -16.496], ['Cusco', -71.972, -13.525]],
    note: { es: 'El volcán más activo del Perú, en Moquegua. Su ceniza obliga a veces a evacuar los pueblos del valle.', en: 'Peru’s most active volcano, in Moquegua. Its ash sometimes forces the evacuation of the villages in the valley.' },
  },
  {
    id: 'sangay', gvp: 352090, name: 'Sangay', country: { es: 'Ecuador', en: 'Ecuador' }, type: 'strato',
    lon: -78.341, lat: -2.005, elev: 5286, boxKm: 16,
    places: [['Macas', -78.12, -2.31], ['Riobamba', -78.65, -1.67], ['Alausí', -78.85, -2.19], ['Puyo', -77.987, -1.483], ['Ambato', -78.62, -1.27], ['Cuenca', -79, -2.9], ['Milagro', -79.6, -2.18], ['Guayaquil', -79.922, -2.218], ['Sangolquí', -78.46, -0.31]],
    note: { es: 'Uno de los volcanes más activos de los Andes, con actividad casi continua. Cuando el viento sopla al oeste, la ceniza llega a Guayaquil.', en: 'One of the most active volcanoes in the Andes, almost continuously erupting. When the wind blows west, ash reaches Guayaquil.' },
  },
  {
    id: 'reventador', gvp: 352010, name: 'Reventador', country: { es: 'Ecuador', en: 'Ecuador' }, type: 'strato',
    lon: -77.656, lat: -0.077, elev: 3562, boxKm: 14,
    places: [['Cayambe', -78.16, 0.05], ['Ibarra', -78.13, 0.36], ['San Gabriel', -77.84, 0.61], ['Sangolquí', -78.46, -0.31], ['Quito', -78.502, -0.213], ['Ipiales', -77.65, 0.83], ['Pasto', -77.281, 1.214], ['Ambato', -78.62, -1.27], ['Guayaquil', -79.922, -2.218]],
    note: { es: 'En la selva al este de Quito. En 2002 tuvo una gran erupción cuya ceniza cayó en Quito; desde entonces está activo casi sin pausa.', en: 'In the rainforest east of Quito. In 2002 a large eruption dropped ash on Quito; it has been active almost without a break since.' },
  },
  {
    id: 'tungurahua', gvp: 352080, name: 'Tungurahua', country: { es: 'Ecuador', en: 'Ecuador' }, type: 'strato',
    lon: -78.442, lat: -1.467, elev: 5023, boxKm: 14,
    places: [['Ambato', -78.62, -1.27], ['Riobamba', -78.65, -1.67], ['Puyo', -77.987, -1.483], ['Latacunga', -78.61, -0.93], ['Sangolquí', -78.46, -0.31], ['Quito', -78.502, -0.213], ['Cuenca', -79, -2.9], ['Guayaquil', -79.922, -2.218], ['Pasto', -77.281, 1.214]],
    note: { es: 'Sobre la ciudad de Baños. Estuvo en erupción entre 1999 y 2016, con flujos piroclásticos y lluvias de ceniza.', en: 'Above the town of Baños. It erupted from 1999 to 2016, with pyroclastic flows and ashfall.' },
  },
  {
    id: 'cotopaxi', gvp: 352050, name: 'Cotopaxi', country: { es: 'Ecuador', en: 'Ecuador' }, type: 'strato',
    lon: -78.436, lat: -0.677, elev: 5911, boxKm: 16,
    places: [['Latacunga', -78.61, -0.93], ['Sangolquí', -78.46, -0.31], ['Quito', -78.502, -0.213], ['Ambato', -78.62, -1.27], ['Riobamba', -78.65, -1.67], ['Ibarra', -78.13, 0.36], ['Ipiales', -77.65, 0.83], ['Guayaquil', -79.922, -2.218], ['Pasto', -77.281, 1.214]],
    note: { es: 'Uno de los volcanes activos más altos del mundo, cubierto de glaciares. Su mayor peligro son los lahares, como los de 1877.', en: 'One of the highest active volcanoes in the world, covered by glaciers. Its main hazard is lahars, like those of 1877.' },
  },
  {
    id: 'nevado-ruiz', gvp: 351020, name: 'Nevado del Ruiz', country: { es: 'Colombia', en: 'Colombia' }, type: 'strato',
    lon: -75.324, lat: 4.892, elev: 5279, boxKm: 16,
    places: [['Manizales', -75.52, 5.06], ['Pereira', -75.68, 4.81], ['Ibagué', -75.232, 4.439], ['Armenia', -75.681, 4.534], ['Bogotá', -74.085, 4.598], ['Medellín', -75.577, 6.277], ['Cali', -76.502, 3.402], ['Bucaramanga', -73.128, 7.132]],
    note: { es: 'En 1985 una erupción chica derritió parte del glaciar y los lahares destruyeron Armero: murieron unas 23.000 personas.', en: 'In 1985 a small eruption melted part of its glacier and lahars destroyed the town of Armero: about 23,000 people died.' },
  },
  {
    id: 'purace', gvp: 351060, name: 'Puracé', country: { es: 'Colombia', en: 'Colombia' }, type: 'strato',
    lon: -76.3948, lat: 2.3095, elev: 4650, boxKm: 14,
    places: [['Popayán', -76.61, 2.42], ['Cali', -76.502, 3.402], ['Neiva', -75.33, 2.931], ['Pasto', -77.281, 1.214], ['Buenaventura', -77.05, 3.872], ['Tuluá', -76.21, 4.09], ['Pereira', -75.68, 4.81], ['Bogotá', -74.085, 4.598], ['Quito', -78.502, -0.213]],
    note: { es: 'En el Cauca, cerca de Popayán. Tiene emisiones de gas y ceniza frecuentes.', en: 'In Cauca, near Popayán. It has frequent gas and ash emissions.' },
  },
  {
    id: 'santa-maria', gvp: 342030, name: 'Santa María (Santiaguito)', country: { es: 'Guatemala', en: 'Guatemala' }, type: 'dome',
    lon: -91.552, lat: 14.757, elev: 3745, boxKm: 14,
    places: [['Quetzaltenango', -91.52, 14.83], ['Mazatenango', -91.51, 14.53], ['Totonicapán', -91.358, 14.914], ['Retalhuleu', -91.677, 14.537], ['Tapachula', -92.27, 14.9], ['Escuintla', -90.78, 14.3], ['Ciudad de Guatemala', -90.529, 14.623], ['El Progreso', -90.016, 14.922], ['San Salvador', -89.216, 13.703]],
    note: { es: 'Su erupción de 1902 fue una de las mayores del siglo XX. Desde 1922 crece a su lado el domo Santiaguito, con explosiones casi diarias.', en: 'Its 1902 eruption was one of the largest of the 20th century. Since 1922 the Santiaguito dome has been growing beside it, with near-daily explosions.' },
  },
  {
    id: 'pacaya', gvp: 342110, name: 'Pacaya', country: { es: 'Guatemala', en: 'Guatemala' }, type: 'strato',
    lon: -90.601, lat: 14.382, elev: 2569, boxKm: 12,
    places: [['Escuintla', -90.78, 14.3], ['Antigua Guatemala', -90.733, 14.567], ['Ciudad de Guatemala', -90.529, 14.623], ['Cuilapa', -90.298, 14.279], ['Quetzaltenango', -91.52, 14.83], ['Sonsonate', -89.73, 13.72], ['Santa Ana', -89.56, 13.995], ['San Salvador', -89.216, 13.703], ['Tapachula', -92.27, 14.9]],
    note: { es: 'Cerca de la Ciudad de Guatemala. Tiene erupciones estrombolianas frecuentes y coladas de lava.', en: 'Near Guatemala City. It has frequent Strombolian eruptions and lava flows.' },
  },
  {
    id: 'colima', gvp: 341040, name: 'Colima', country: { es: 'México', en: 'Mexico' }, type: 'strato',
    lon: -103.62, lat: 19.514, elev: 3850, boxKm: 14,
    places: [['Ciudad Guzmán', -103.46, 19.71], ['Colima', -103.72, 19.23], ['Tecomán', -103.88, 18.92], ['Manzanillo', -104.323, 19.05], ['Guadalajara', -103.332, 20.672], ['Apatzingán', -102.35, 19.08], ['Zamora', -102.28, 19.98], ['Uruapan', -102.07, 19.42], ['León', -101.702, 21.152]],
    note: { es: 'Uno de los volcanes más activos de México, entre Colima y Jalisco. En 2015 sus flujos piroclásticos llegaron a unos 10 km.', en: 'One of Mexico’s most active volcanoes, between Colima and Jalisco. In 2015 its pyroclastic flows reached about 10 km.' },
  },
  {
    id: 'sakurajima', gvp: 282080, name: 'Sakurajima (Aira)', country: { es: 'Japón', en: 'Japan' }, type: 'strato',
    lon: 130.6589, lat: 31.5772, elev: 1117, boxKm: 14,
    places: [['Kagoshima', 130.561, 31.586], ['Kanoya', 130.85, 31.383], ['Miyazaki', 131.418, 31.918], ['Kumamoto', 130.701, 32.801], ['Nagasaki', 129.885, 32.765], ['Sasebo', 129.718, 33.163], ['Fukuoka', 130.408, 33.597], ['Kitakyūshū', 130.82, 33.87], ['Hiroshima', 132.441, 34.39]],
    note: { es: 'Volcán dentro de la caldera de Aira, frente a la ciudad de Kagoshima. Explota cientos de veces por año.', en: 'A volcano inside the Aira caldera, facing the city of Kagoshima. It explodes hundreds of times a year.' },
  },
  {
    id: 'suwanosejima', gvp: 282030, name: 'Suwanosejima', country: { es: 'Japón', en: 'Japan' }, type: 'strato',
    lon: 129.714, lat: 29.638, elev: 796, boxKm: 10,
    places: [['Kanoya', 130.85, 31.383], ['Kagoshima', 130.561, 31.586], ['Miyazaki', 131.418, 31.918], ['Nagasaki', 129.885, 32.765], ['Kumamoto', 130.701, 32.801], ['Sasebo', 129.718, 33.163]],
    note: { es: 'Isla volcánica al sur de Japón, con explosiones estrombolianas y vulcanianas casi continuas.', en: 'Volcanic island in southern Japan, with almost continuous Strombolian and Vulcanian explosions.' },
  },
  {
    id: 'semeru', gvp: 263300, name: 'Semeru', country: { es: 'Indonesia', en: 'Indonesia' }, type: 'strato',
    lon: 112.922, lat: -8.108, elev: 3657, boxKm: 16,
    places: [['Malang', 112.608, -7.978], ['Probolinggo', 113.15, -7.75], ['Pasuruan', 112.9, -7.63], ['Jember', 113.687, -8.173], ['Surabaya', 112.749, -7.247], ['Kediri', 112, -7.79], ['Madiun', 111.515, -7.635], ['Denpasar', 115.22, -8.65], ['Semarang', 110.418, -6.965]],
    note: { es: 'El volcán más alto de Java. En diciembre de 2021 un colapso del domo provocó flujos piroclásticos que mataron a más de 50 personas.', en: 'The highest volcano on Java. In December 2021 a dome collapse caused pyroclastic flows that killed more than 50 people.' },
  },
  {
    id: 'merapi', gvp: 263250, name: 'Merapi', country: { es: 'Indonesia', en: 'Indonesia' }, type: 'strato',
    lon: 110.446, lat: -7.54, elev: 2910, boxKm: 14,
    places: [['Salatiga', 110.49, -7.31], ['Yogyakarta', 110.375, -7.78], ['Magelang', 110.18, -7.47], ['Surakarta', 110.825, -7.565], ['Semarang', 110.418, -6.965], ['Pekalongan', 109.67, -6.88], ['Cilacap', 109.015, -7.719], ['Tegal', 109.12, -6.87], ['Surabaya', 112.749, -7.247]],
    note: { es: 'Uno de los volcanes más peligrosos de Indonesia, junto a Yogyakarta. En 2010 sus flujos piroclásticos mataron a más de 300 personas.', en: 'One of Indonesia’s most dangerous volcanoes, next to Yogyakarta. In 2010 its pyroclastic flows killed more than 300 people.' },
  },
  {
    id: 'marapi', gvp: 261140, name: 'Marapi', country: { es: 'Indonesia', en: 'Indonesia' }, type: 'strato',
    lon: 100.474, lat: -0.38, elev: 2885, boxKm: 14,
    places: [['Padangpanjang', 100.417, -0.45], ['Bukittinggi', 100.361, -0.303], ['Sawahlunto', 100.783, -0.666], ['Padang', 100.358, -0.958], ['Pekanbaru', 101.423, 0.567], ['Malacca', 102.246, 2.206], ['Jambi', 103.61, -1.59], ['Seremban', 101.94, 2.71], ['Kelang', 101.447, 3.043]],
    note: { es: 'En Sumatra occidental. En diciembre de 2023 una explosión sin aviso mató a 24 montañistas.', en: 'In West Sumatra. In December 2023 an explosion without warning killed 24 climbers.' },
  },
  {
    id: 'krakatau', gvp: 262000, name: 'Krakatau (Anak Krakatau)', country: { es: 'Indonesia', en: 'Indonesia' }, type: 'caldera',
    lon: 105.4233, lat: -6.1009, elev: 285, boxKm: 10,
    places: [['Bandar Lampung', 105.3, -5.45], ['Bogor', 106.748, -6.568], ['Jakarta', 106.827, -6.172], ['Bekasi', 106.972, -6.217], ['Sukabumi', 106.9, -6.91], ['Bandung', 107.568, -6.948], ['Tasikmalaya', 108.215, -7.325], ['Cirebon', 108.567, -6.733], ['Palembang', 104.748, -2.978]],
    note: { es: 'La erupción de 1883 fue una de las más mortíferas de la historia. En 2018 un derrumbe del flanco de Anak Krakatau causó un tsunami que mató a más de 400 personas.', en: 'The 1883 eruption was one of the deadliest in history. In 2018 a flank collapse of Anak Krakatau caused a tsunami that killed more than 400 people.' },
  },
  {
    id: 'lewotobi', gvp: 264180, name: 'Lewotobi Laki-laki', country: { es: 'Indonesia', en: 'Indonesia' }, type: 'strato',
    lon: 122.775, lat: -8.542, elev: 1703, boxKm: 12,
    places: [['Maumere', 122.212, -8.619], ['Ende', 121.649, -8.862], ['Kupang', 123.583, -10.179], ['Ruteng', 120.47, -8.612], ['Waingapu', 120.253, -9.658], ['Dili', 125.579, -8.559], ['Baubau', 122.616, -5.47]],
    note: { es: 'En la isla de Flores. En noviembre de 2024 una erupción de noche mató al menos a 9 personas, y en 2025 sus columnas superaron los 10 km.', en: 'On the island of Flores. In November 2024 a night-time eruption killed at least 9 people, and in 2025 its columns topped 10 km.' },
  },
  {
    id: 'dukono', gvp: 268010, name: 'Dukono', country: { es: 'Indonesia', en: 'Indonesia' }, type: 'strato',
    lon: 127.8783, lat: 1.6992, elev: 1273, boxKm: 12,
    places: [['Ternate', 127.363, 0.793], ['Tidore', 127.436, 0.696], ['Manado', 124.85, 1.48]],
    note: { es: 'En la isla de Halmahera. Está en erupción casi continua desde 1933.', en: 'On the island of Halmahera. It has been erupting almost continuously since 1933.' },
  },
  {
    id: 'ibu', gvp: 268030, name: 'Ibu', country: { es: 'Indonesia', en: 'Indonesia' }, type: 'strato',
    lon: 127.6324, lat: 1.4941, elev: 1357, boxKm: 12,
    places: [['Ternate', 127.363, 0.793], ['Tidore', 127.436, 0.696], ['Manado', 124.85, 1.48]],
    note: { es: 'En la isla de Halmahera, con explosiones frecuentes desde 2008.', en: 'On the island of Halmahera, with frequent explosions since 2008.' },
  },
  {
    id: 'karangetang', gvp: 267020, name: 'Karangetang', country: { es: 'Indonesia', en: 'Indonesia' }, type: 'strato',
    lon: 125.407, lat: 2.781, elev: 1797, boxKm: 10,
    places: [['Manado', 124.85, 1.48], ['Ternate', 127.363, 0.793], ['Tidore', 127.436, 0.696], ['Gorontalo', 123.07, 0.55], ['General Santos', 125.175, 6.111]],
    note: { es: 'En la isla de Siau, uno de los volcanes más activos de Indonesia, con coladas de lava y flujos piroclásticos.', en: 'On Siau island, one of Indonesia’s most active volcanoes, with lava flows and pyroclastic flows.' },
  },
  {
    id: 'kanlaon', gvp: 272020, name: 'Kanlaon', country: { es: 'Filipinas', en: 'Philippines' }, type: 'strato',
    lon: 123.13, lat: 10.4096, elev: 2422, boxKm: 14,
    places: [['Bacolod', 122.982, 10.632], ['San Carlos', 123.38, 10.55], ['Cadiz', 123.309, 10.959], ['Iloilo', 122.545, 10.705], ['Cebu', 123.898, 10.322], ['Roxas', 122.751, 11.585], ['Ormoc', 124.608, 11.064], ['Cagayan de Oro', 124.685, 8.451], ['Naga', 123.181, 13.619]],
    note: { es: 'En la isla de Negros. Desde diciembre de 2024 tuvo varias explosiones que obligaron a evacuar a miles de personas.', en: 'On Negros island. Since December 2024 several explosions have forced thousands of people to evacuate.' },
  },
  {
    id: 'whakaari', gvp: 241040, name: 'Whakaari / White Island', country: { es: 'Nueva Zelanda', en: 'New Zealand' }, type: 'strato',
    lon: 177.18, lat: -37.52, elev: 294, boxKm: 8,
    places: [['Whakatane', 176.983, -37.957], ['Tauranga', 176.154, -37.696], ['Rotorua', 176.248, -38.132], ['Gisborne', 178.018, -38.663], ['Taupo', 176.077, -38.693], ['Hamilton', 175.29, -37.778], ['Auckland', 174.763, -36.848]],
    note: { es: 'Isla volcánica frente a la costa de Nueva Zelanda. En 2019 una explosión mató a 22 personas que la visitaban.', en: 'Volcanic island off New Zealand. In 2019 an explosion killed 22 people who were visiting it.' },
  },
  {
    id: 'sheveluch', gvp: 300270, name: 'Sheveluch', country: { es: 'Rusia', en: 'Russia' }, type: 'strato',
    lon: 161.36, lat: 56.653, elev: 3283, boxKm: 18,
    places: [['Klyuchi', 160.85, 56.3], ['Ust-Kamchatsk', 162.435, 56.214], ['Palana', 159.95, 59.084]],
    note: { es: 'Uno de los volcanes más activos de Kamchatka. En abril de 2023 una gran explosión llevó la ceniza a unos 20 km de altura.', en: 'One of Kamchatka’s most active volcanoes. In April 2023 a large explosion sent ash to about 20 km.' },
  },
  {
    id: 'klyuchevskoy', gvp: 300260, name: 'Kliuchevskoi', country: { es: 'Rusia', en: 'Russia' }, type: 'strato',
    lon: 160.642, lat: 56.056, elev: 4754, boxKm: 18,
    places: [['Klyuchi', 160.85, 56.3], ['Ust-Kamchatsk', 162.435, 56.214], ['Palana', 159.95, 59.084], ['Petropavlovsk-Kamchatsky', 158.623, 53.062]],
    note: { es: 'El volcán activo más alto de Eurasia, en Kamchatka. Sus erupciones mezclan coladas de lava y columnas de ceniza.', en: 'The highest active volcano in Eurasia, in Kamchatka. Its eruptions combine lava flows and ash columns.' },
  },
  {
    id: 'bezymianny', gvp: 300250, name: 'Bezimianni', country: { es: 'Rusia', en: 'Russia' }, type: 'dome',
    lon: 160.595, lat: 55.972, elev: 2882, boxKm: 14,
    places: [['Klyuchi', 160.85, 56.3], ['Ust-Kamchatsk', 162.435, 56.214], ['Petropavlovsk-Kamchatsky', 158.623, 53.062], ['Palana', 159.95, 59.084]],
    note: { es: 'Junto al Kliuchevskoi. En 1956 tuvo una explosión lateral como la del Santa Helena; hoy crece un domo con explosiones esporádicas.', en: 'Next to Klyuchevskoy. In 1956 it had a lateral blast like Mount St. Helens’; today a dome grows with occasional explosions.' },
  },
  {
    id: 'ebeko', gvp: 290380, name: 'Ebeko', country: { es: 'Rusia', en: 'Russia' }, type: 'strato',
    lon: 156.014, lat: 50.686, elev: 1103, boxKm: 10,
    places: [['Severo-Kurilsk', 156.085, 50.69], ['Oktyabrsky', 156.239, 52.664], ['Petropavlovsk-Kamchatsky', 158.623, 53.062]],
    note: { es: 'En la isla Paramushir (Kuriles), a 7 km de Severo-Kurilsk. Tiene explosiones chicas muy frecuentes.', en: 'On Paramushir island (Kurils), 7 km from Severo-Kurilsk. It has very frequent small explosions.' },
  },
];

export const ERUPTIONS: Eruption[] = [
  {
    id: 'villarrica-2015',
    photo: { caption: { es: 'Villarrica en erupción, 2015', en: 'Villarrica erupting, 2015' }, credit: 'Francisco Barrera Martínez', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Erupci%C3%B3n_volc%C3%A1n_Villarrica_2015.jpg' }, volcano: 'villarrica', year: 2015, style: 'strombolian', vei: 2,
    name: { es: 'Villarrica (2015)', en: 'Villarrica (2015)' },
    // 03:08–03:26 hora de Chile (UTC−3); columna sostenida de unos 16 minutos.
    phases: [{ start: '2015-03-03T06:10:00Z', hours: 16 / 60, topKm: 9.7, massKg: 1.4e9, massFrom: 'deposit' }],
    gsd: { md: 0.5, sigma: 1.5, measured: false },
    wind: 'reanalysis',
    note: {
      es: 'Una fuente de lava de 1,5 km alimentó una columna de 8,6 a 10,8 km durante unos 16 minutos. La ceniza cayó hacia el sudeste: hasta 11,5 kg por m² a 7–9 km del cráter.',
      en: 'A 1.5 km lava fountain fed an 8.6–10.8 km column for about 16 minutes. The ash fell to the southeast: up to 11.5 kg per m² at 7–9 km from the crater.',
    },
    refs: [{ label: 'Romero et al. (2018), Frontiers in Earth Science', url: 'https://doi.org/10.3389/feart.2018.00098' }],
  },
  {
    id: 'calbuco-2015',
    photo: { caption: { es: 'Calbuco el 22 de abril de 2015, a las 19:13', en: 'Calbuco on 22 April 2015 at 19:13' }, credit: 'Jorge Pacheco', license: 'CC BY-SA 2.0', page: 'https://commons.wikimedia.org/wiki/File:Erupci%C3%B3n_Volc%C3%A1n_Calbuco_(17241322101).jpg' }, volcano: 'calbuco', year: 2015, style: 'subplinian', vei: 4,
    name: { es: 'Calbuco (2015)', en: 'Calbuco (2015)' },
    // Romero et al. (2016): 0,27 km³ de tefra (0,11–0,13 km³ DRE ≈ 3·10¹¹ kg), 38 % en la primera fase y 62 % en la segunda.
    phases: [
      { start: '2015-04-22T21:04:00Z', hours: 1.5, topKm: 15, massKg: 1.14e11, massFrom: 'deposit' },
      { start: '2015-04-23T04:00:00Z', hours: 6, topKm: 15, massKg: 1.86e11, massFrom: 'deposit' },
    ],
    gsd: { md: 1, sigma: 2, measured: false },
    wind: 'reanalysis',
    note: {
      es: 'Dos fases subplinianas con columnas de más de 15 km. La ceniza cruzó a la Argentina y cayó sobre Villa La Angostura, San Martín de los Andes y Junín de los Andes.',
      en: 'Two sub-Plinian phases with columns over 15 km high. The ash crossed into Argentina and fell on Villa La Angostura, San Martín de los Andes and Junín de los Andes.',
    },
    // Hayes et al. (2019), tabla 1: espesor medido en cada comunidad.
    obs: [
      { place: 'Ensenada', lon: -72.535, lat: -41.208, min: 110, max: 170, src: 'Hayes et al. (2019)' },
      { place: 'Villa La Angostura', lon: -71.646, lat: -40.763, min: 2, max: 3, src: 'Hayes et al. (2019)' },
      { place: 'San Martín de los Andes', lon: -71.353, lat: -40.157, min: 5, max: 30, src: 'Hayes et al. (2019)' },
      { place: 'Junín de los Andes', lon: -71.069, lat: -39.951, min: 9, max: 30, src: 'Hayes et al. (2019)' },
    ],
    refs: [
      { label: 'Romero et al. (2016), Journal of Volcanology and Geothermal Research', url: 'https://doi.org/10.1016/j.jvolgeores.2016.02.027' },
      { label: 'Hayes et al. (2019), Journal of Applied Volcanology', url: 'https://doi.org/10.1186/s13617-019-0087-3' },
      { label: 'Castruccio et al. (2016), Bulletin of Volcanology', url: 'https://doi.org/10.1007/s00445-016-1058-8' },
    ],
  },
  {
    id: 'cordon-caulle-2011',
    photo: { caption: { es: 'La columna del Cordón Caulle vista desde un avión, 5 de junio de 2011', en: 'The Cordón Caulle column seen from a plane, 5 June 2011' }, credit: 'Pedro Rebolledo', license: 'CC BY-SA 3.0', page: 'https://commons.wikimedia.org/wiki/File:ErupcionCaulle.jpg' }, volcano: 'cordon-caulle', year: 2011, style: 'subplinian', vei: 5,
    name: { es: 'Cordón Caulle (2011)', en: 'Cordón Caulle (2011)' },
    phases: [{ start: '2011-06-04T18:45:00Z', hours: 27, topKm: 12.5, massKg: 2.9e11, massFrom: 'mastin' }],
    gsd: { md: 2, sigma: 2.2, measured: false },
    wind: 'reanalysis',
    note: {
      es: 'La fase más intensa duró unas 24–30 horas con columnas de 11 a 14 km, y llevó la ceniza hacia el este, a Villa La Angostura, Bariloche y la meseta patagónica. La capa de esa fase suma unos 0,75 km³.',
      en: 'The most intense phase lasted about 24–30 hours with 11–14 km columns and carried the ash east, to Villa La Angostura, Bariloche and the Patagonian plateau. The layer from that phase adds up to about 0.75 km³.',
    },
    refs: [{ label: 'Pistolesi et al. (2015), Bulletin of Volcanology', url: 'https://doi.org/10.1007/s00445-014-0898-3' }],
  },
  {
    id: 'chaiten-2008',
    photo: { caption: { es: 'Chaitén en octubre de 2008, desde un avión de línea', en: 'Chaitén in October 2008, from an airliner' }, credit: 'Gerard Prins', license: 'CC BY-SA 3.0', page: 'https://commons.wikimedia.org/wiki/File:Chaiten_volcano_in_eruption.jpg' }, volcano: 'chaiten', year: 2008, style: 'plinian', vei: 4,
    name: { es: 'Chaitén (2008)', en: 'Chaitén (2008)' },
    phases: [{ start: '2008-05-02T08:00:00Z', hours: 6, topKm: 19, massKg: 4.9e11, massFrom: 'mastin' }],
    gsd: { md: 2, sigma: 2.2, measured: false },
    wind: 'reanalysis',
    note: {
      es: 'La fase pliniana empezó el 2 de mayo hacia las 4 de la mañana y duró unas 6 horas, con una columna de unos 19 km según los satélites. Todas las fases juntas dejaron 0,5 a 1 km³ de tefra.',
      en: 'The Plinian phase started on 2 May at about 4 a.m. and lasted about 6 hours, with a column of about 19 km according to satellites. All phases together left 0.5–1 km³ of tephra.',
    },
    refs: [
      { label: 'Lara (2009), Andean Geology', url: 'https://doi.org/10.5027/andgeoV36n1-a09' },
      { label: 'Alfano et al. (2011), Bulletin of Volcanology', url: 'https://doi.org/10.1007/s00445-010-0428-x' },
    ],
  },
  {
    id: 'st-helens-1980',
    photo: { caption: { es: 'St. Helens el 18 de mayo de 1980', en: 'St. Helens on 18 May 1980' }, credit: 'Austin Post, USGS', license: 'dominio público', page: 'https://commons.wikimedia.org/wiki/File:MSH80_eruption_mount_st_helens_05-18-80-dramatic-edit.jpg' }, volcano: 'st-helens', year: 1980, style: 'plinian', vei: 5,
    name: { es: 'St. Helens (1980)', en: 'St. Helens (1980)' },
    // Masa total de la caída (incluye la ceniza que se elevó de los flujos piroclásticos): 4,9·10¹¹ kg.
    phases: [{ start: '1980-05-18T15:32:00Z', hours: 9, topKm: 20, massKg: 4.9e11, massFrom: 'deposit' }],
    gsd: { md: 3.5, sigma: 2.5, measured: false },
    wind: 'reanalysis',
    note: {
      es: 'Columna de 19 a 24 km durante unas 9 horas; el viento llevó la ceniza al este y noreste, sobre Yakima, Ritzville y Spokane. Tres cuartos de la ceniza vinieron de los flujos piroclásticos, no de la columna pliniana.',
      en: 'A 19–24 km column for about 9 hours; the wind carried the ash east and northeast, over Yakima, Ritzville and Spokane. Three quarters of the ash came from the pyroclastic flows, not from the Plinian column.',
    },
    refs: [
      { label: 'Sarna-Wojcicki et al. (1981), en USGS Professional Paper 1250', url: 'https://pubs.usgs.gov/pp/1250/report.pdf' },
      { label: 'Carey et al. (1990), Journal of Volcanology and Geothermal Research', url: 'https://doi.org/10.1016/0377-0273(90)90047-J' },
    ],
  },
  {
    id: 'pinatubo-1991',
    photo: { caption: { es: 'La columna del 12 de junio de 1991, tres días antes de la fase principal, desde la base aérea Clark', en: 'The 12 June 1991 column, three days before the main phase, from Clark Air Base' }, credit: 'Dave Harlow, USGS', license: 'dominio público', page: 'https://commons.wikimedia.org/wiki/File:Pinatubo_1991-06-12_(USGS).jpg' }, volcano: 'pinatubo', year: 1991, style: 'plinian', vei: 6,
    name: { es: 'Pinatubo (1991)', en: 'Pinatubo (1991)' },
    // 15 de junio, 13:42 hora local (UTC+8), unas 9 horas. Caída: hasta 2 km³ DRE (≈ 5·10¹² kg) según el USGS.
    phases: [{ start: '1991-06-15T05:42:00Z', hours: 9, topKm: 35, massKg: 5e12, massFrom: 'deposit' }],
    gsd: { md: 1.5, sigma: 2.3, measured: false },
    wind: 'reanalysis',
    note: {
      es: 'La erupción más grande desde 1912. La columna llegó a unos 35 km y el tifón Yunya, que pasaba al mismo tiempo, mojó la ceniza: el peso derrumbó techos en toda la región.',
      en: 'The largest eruption since 1912. The column reached about 35 km and Typhoon Yunya, passing at the same time, soaked the ash: its weight collapsed roofs across the region.',
    },
    refs: [
      { label: 'Paladio-Melosantos et al. (1996), USGS: Fire and Mud', url: 'https://pubs.usgs.gov/pinatubo/paladio/' },
      { label: 'USGS: Fire and Mud, resumen', url: 'https://pubs.usgs.gov/pinatubo/section5.html' },
    ],
  },
  {
    id: 'vesuvius-79',
    photo: { caption: { es: 'La erupción del año 79 según Pierre-Henri de Valenciennes (1813)', en: 'The AD 79 eruption as painted by Pierre-Henri de Valenciennes (1813)' }, credit: 'Didier Descouens (foto de la pintura)', license: 'dominio público', page: 'https://commons.wikimedia.org/wiki/File:Augustins_-_Eruption_du_Vesuve_-_Pierre-Henri_de_Valenciennes_78_1_1.jpg' }, volcano: 'vesuvius', year: 79, style: 'plinian', vei: 5,
    name: { es: 'Vesubio (79 d. C.)', en: 'Vesuvius (AD 79)' },
    // Carey y Sigurdsson (1987): unos 4 km³ de magma en ~19 h; columna de 26 km en la fase blanca y 33 km en la gris
    // (volúmenes por fase de Sigurdsson et al., 1985: ~1,0 y ~2,6 km³ DRE).
    phases: [
      { start: '0079-08-24T05:00:00Z', hours: 7, topKm: 26, massKg: 2.5e12, massFrom: 'deposit' },
      { start: '0079-08-24T12:00:00Z', hours: 12, topKm: 33, massKg: 6.5e12, massFrom: 'deposit' },
    ],
    gsd: { md: 0, sigma: 2, measured: false },
    wind: { month: 8 },
    note: {
      es: 'Sepultó Pompeya bajo casi 3 m de pómez. No hay datos del viento de ese día: se usa el viento promedio de agosto, que no tiene por qué coincidir con el de ese día.',
      en: 'It buried Pompeii under almost 3 m of pumice. There is no wind data for that day: the average August wind is used, which need not match that day’s wind.',
    },
    refs: [
      { label: 'Carey y Sigurdsson (1987), GSA Bulletin', url: 'https://doi.org/10.1130/0016-7606(1987)99%3C303:TVICHA%3E2.0.CO;2' },
    ],
  },
];

export const volcanoById = (id: string) => VOLCANOES.find((v) => v.id === id);
