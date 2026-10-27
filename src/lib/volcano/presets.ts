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
];

export const ERUPTIONS: Eruption[] = [
  {
    id: 'villarrica-2015', volcano: 'villarrica', year: 2015, style: 'strombolian', vei: 2,
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
    id: 'calbuco-2015', volcano: 'calbuco', year: 2015, style: 'subplinian', vei: 4,
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
    id: 'cordon-caulle-2011', volcano: 'cordon-caulle', year: 2011, style: 'subplinian', vei: 5,
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
    id: 'chaiten-2008', volcano: 'chaiten', year: 2008, style: 'plinian', vei: 4,
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
    id: 'st-helens-1980', volcano: 'st-helens', year: 1980, style: 'plinian', vei: 5,
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
    id: 'pinatubo-1991', volcano: 'pinatubo', year: 1991, style: 'plinian', vei: 6,
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
    id: 'vesuvius-79', volcano: 'vesuvius', year: 79, style: 'plinian', vei: 5,
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
