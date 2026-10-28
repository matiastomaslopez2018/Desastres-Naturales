/*
 * Historias de grandes desastres: pasos de texto con un mapa que acompaña (centro, radio en km y marcas).
 * Cada dato lleva su fuente en la lista del final; cuando las cifras no coinciden entre fuentes, se dan las dos.
 */
import type { Lang } from './types';

export type StoryMark =
  | { kind: 'point'; lon: number; lat: number; label: string; color?: string; big?: boolean }
  | { kind: 'line'; coords: [number, number][]; label?: string; color?: string };
export type StoryStep = { title: string; text: string; view: { lon: number; lat: number; halfKm: number }; marks: StoryMark[] };
export type StoryLink = { label: string; href: string };
export type Story = {
  slug: string; date: string; kicker: string; title: string; dek: string;
  steps: StoryStep[]; links: StoryLink[]; sources: { label: string; url: string }[];
};

const EQ = '#e8590c', TSU = '#0c8599', VOLC = '#d6336c', FLOOD = '#1c7ed6';
const VALDIVIA_EPI = { lon: -73.407, lat: -38.143 }, CAUCETE_EPI = { lon: -67.767, lat: -31.028 };
// Zona de ruptura aproximada: unos 1.000 km de costa al sur del epicentro (Britannica: 900–1.000 km).
const VALDIVIA_RUPTURE: [number, number][] = [[-73.6, -37.6], [-73.9, -40.5], [-74.4, -43.5], [-75.0, -46.5]];

const es: Story[] = [
  {
    slug: 'valdivia-1960', date: '1960-05-22', kicker: 'Chile · 22 de mayo de 1960', title: 'El terremoto más grande jamás registrado',
    dek: 'Una falla de unos mil kilómetros, un tsunami que cruzó el Pacífico y un volcán que despertó dos días después.',
    steps: [
      { title: 'Un domingo a la tarde', text: 'El 22 de mayo de 1960, a las 15:11 hora de Chile (19:11 UTC), la placa de Nazca se deslizó bruscamente bajo la Sudamericana frente al sur de Chile. El USGS le asigna magnitud 9,5: es el sismo más grande registrado con instrumentos.', view: { ...VALDIVIA_EPI, halfKm: 900 }, marks: [{ kind: 'point', ...VALDIVIA_EPI, label: 'Epicentro (USGS)', color: EQ, big: true }] },
      { title: 'Una falla del largo de un país', text: 'No se rompió un punto sino una franja enorme del contacto entre las placas: entre 900 y 1.000 km de largo a lo largo de la costa. Por eso el sacudón fue tan largo y se sintió fuerte en todo el sur de Chile.', view: { lon: -73.8, lat: -42, halfKm: 900 }, marks: [{ kind: 'line', coords: VALDIVIA_RUPTURE, label: 'Ruptura (aproximada)', color: EQ }, { kind: 'point', ...VALDIVIA_EPI, label: 'Epicentro', color: EQ }] },
      { title: 'Las víctimas', text: 'El USGS estima unas 1.655 muertes en el sur de Chile; otras estimaciones van de 1.000 a 6.000, porque el número nunca se pudo establecer con precisión. En la costa chilena, el tsunami alcanzó unos 25 m de altura, según la base de tsunamis de la NOAA.', view: { lon: -73.5, lat: -40, halfKm: 500 }, marks: [{ kind: 'point', lon: -73.245, lat: -39.814, label: 'Valdivia', color: '#141414' }, { kind: 'point', lon: -72.94, lat: -41.47, label: 'Puerto Montt', color: '#141414' }] },
      { title: 'El tsunami cruzó el Pacífico', text: 'Unas 15 horas después, las olas llegaron a Hawái: en Hilo murieron 61 personas. A las 22 horas llegaron a Japón, a unos 17.000 km, donde mataron a 138 personas y destruyeron más de 1.600 casas. También hubo víctimas en Filipinas.', view: { lon: -150, lat: -5, halfKm: 9500 }, marks: [{ kind: 'point', ...VALDIVIA_EPI, label: 'Chile', color: EQ, big: true }, { kind: 'point', lon: -155.09, lat: 19.72, label: 'Hilo (Hawái)', color: TSU }, { kind: 'point', lon: 141.5, lat: 39.0, label: 'Japón', color: TSU }] },
      { title: 'Un volcán que despierta', text: 'Dos días después del terremoto, el 24 de mayo, entró en erupción el Cordón Caulle, junto al volcán Puyehue. Algunos sismólogos lo vincularon con el terremoto.', view: { lon: -72.5, lat: -40.3, halfKm: 300 }, marks: [{ kind: 'point', lon: -72.117, lat: -40.59, label: 'Cordón Caulle', color: VOLC, big: true }, { kind: 'point', lon: -73.245, lat: -39.814, label: 'Valdivia', color: '#141414' }] },
      { title: 'Lo que dejó', text: 'Valdivia 1960 es la referencia de lo que puede hacer una zona de subducción. Los terremotos de magnitud 9 son raros, pero ocurren: Alaska 1964, Sumatra 2004 y Japón 2011. Si vivís en la costa del Pacífico, la regla es la misma que entonces: si el sismo es fuerte o largo, apenas para, andá a un lugar alto.', view: { ...VALDIVIA_EPI, halfKm: 1500 }, marks: [{ kind: 'line', coords: VALDIVIA_RUPTURE, color: EQ }] },
    ],
    links: [
      { label: 'Simular cómo se sintió en Valdivia', href: '/es/simulador-sismos?sismo=valdivia-1960' },
      { label: '¿Y si pasara bajo tu ciudad?', href: '/es/y-si-pasara-aca' },
      { label: 'Qué otros desastres pasaron un 22 de mayo', href: '/es/un-dia-como-hoy?fecha=05-22' },
      { label: 'Qué hacer ante un tsunami', href: '/es/que-hacer#tsunami' },
    ],
    sources: [
      { label: 'USGS · M 9.5 Valdivia, Chile, 22 de mayo de 1960 (ComCat)', url: 'https://earthquake.usgs.gov/earthquakes/eventpage/official19600522191120_30/executive' },
      { label: 'USGS · Historic Earthquakes: Chile 1960 (archivo)', url: 'https://webarchive.library.unt.edu/eot2008/20090109060417/http://earthquake.usgs.gov/regional/world/events/1960_05_22.php' },
      { label: 'NOAA NCEI · Base de sismos y tsunamis significativos', url: 'https://www.ngdc.noaa.gov/hazel/view/hazards/earthquake/event-more-info/4227' },
      { label: 'Encyclopaedia Britannica · Chile earthquake of 1960', url: 'https://www.britannica.com/event/Chile-earthquake-of-1960' },
    ],
  },
  {
    slug: 'caucete-1977', date: '1977-11-23', kicker: 'San Juan · 23 de noviembre de 1977', title: 'El terremoto de Caucete',
    dek: 'El sismo más fuerte registrado en San Juan, que tiró la mayoría de las casas de adobe y licuó el suelo.',
    steps: [
      { title: 'Al amanecer', text: 'El 23 de noviembre de 1977, a las 6:26 hora argentina (9:26 UTC), un sismo de magnitud 7,4 sacudió San Juan. Según el USGS, el foco estuvo a unos 13 km de profundidad y a unos 90 km al noreste de la ciudad de San Juan.', view: { ...CAUCETE_EPI, halfKm: 250 }, marks: [{ kind: 'point', ...CAUCETE_EPI, label: 'Epicentro (USGS)', color: EQ, big: true }, { kind: 'point', lon: -68.536, lat: -31.537, label: 'San Juan', color: '#141414' }, { kind: 'point', lon: -68.281, lat: -31.652, label: 'Caucete', color: '#141414' }] },
      { title: 'Caucete, la más castigada', text: 'Las cifras oficiales hablan de 65 muertos y más de 300 heridos, la mayoría en Caucete. Según datos del INPRES, de las unas 1.700 casas de adobe que había en Caucete se derrumbó el 72 %.', view: { lon: -68.28, lat: -31.65, halfKm: 60 }, marks: [{ kind: 'point', lon: -68.281, lat: -31.652, label: 'Caucete', color: EQ, big: true }] },
      { title: 'El suelo se volvió líquido', text: 'En los suelos arenosos y con agua cerca de la superficie, el sacudón hizo que la arena se comportara como un líquido: la licuefacción. Se abrieron cráteres y volcanes de arena, el terreno se desplazó de costado y brotó agua a chorros de hasta tres metros de altura. Rompió caños de agua, perforaciones de riego y torres de electricidad.', view: { lon: -68.1, lat: -31.5, halfKm: 120 }, marks: [{ kind: 'point', lon: -68.281, lat: -31.652, label: 'Caucete', color: '#141414' }, { kind: 'point', ...CAUCETE_EPI, label: 'Epicentro', color: EQ }] },
      { title: 'Una zona de muy alta peligrosidad', text: 'San Juan está en la zona 4 del mapa del INPRES, la de mayor peligrosidad sísmica del país, junto con el norte de Mendoza. El terremoto de 1944, que destruyó la ciudad de San Juan, y el de 1977 son los grandes recordatorios: construir de forma sismorresistente es lo que más vidas salva.', view: { lon: -68.4, lat: -31.6, halfKm: 400 }, marks: [{ kind: 'point', ...CAUCETE_EPI, label: '1977', color: EQ, big: true }, { kind: 'point', lon: -68.536, lat: -31.537, label: 'San Juan', color: '#141414' }, { kind: 'point', lon: -68.845, lat: -32.889, label: 'Mendoza', color: '#141414' }] },
    ],
    links: [
      { label: 'Simular cómo se sintió en Caucete', href: '/es/simulador-sismos?sismo=caucete-1977' },
      { label: 'Ver la zona sísmica de San Juan en «Mi lugar»', href: '/es/mi-lugar?lugar=San%20Juan&lat=-31.54&lon=-68.54' },
      { label: 'Qué otros desastres pasaron un 23 de noviembre', href: '/es/un-dia-como-hoy?fecha=11-23' },
      { label: 'Qué hacer en un sismo', href: '/es/que-hacer#sismo' },
    ],
    sources: [
      { label: 'USGS · M 7.4 San Juan, Argentina, 23 de noviembre de 1977', url: 'https://earthquake.usgs.gov/earthquakes/eventpage/usp0000rp1' },
      { label: 'Revista de la Asociación Geológica Argentina · Efectos ambientales del sismo del 23 de noviembre de 1977 (Mw 7,4)', url: 'https://revista.geologica.org.ar/raga/article/download/1849/1833/12495' },
      { label: 'Diario de Cuyo · Crónica del terremoto de 1977 (cifras oficiales y del INPRES)', url: 'https://www.diariodecuyo.com.ar/columnasdeopinion/cronica-del-terremoto-de-1977-1801965.html' },
      { label: 'INPRES · Zonificación sísmica', url: 'http://contenidos.inpres.gob.ar/zonas' },
    ],
  },
  {
    slug: 'santa-fe-2003', date: '2003-04-29', kicker: 'Santa Fe · 29 de abril de 2003', title: 'Cuando el Salado entró a Santa Fe',
    dek: 'Un río crecido por lluvias extraordinarias y una defensa sin terminar: un tercio de la ciudad bajo el agua.',
    steps: [
      { title: 'Un río que no paraba de crecer', text: 'En abril de 2003, lluvias extraordinarias en la cuenca del río Salado lo hicieron crecer muy por encima de lo habitual. El Salado corre por el oeste de la ciudad de Santa Fe antes de desembocar en el sistema del Paraná.', view: { lon: -60.75, lat: -31.5, halfKm: 120 }, marks: [{ kind: 'point', lon: -60.7, lat: -31.63, label: 'Santa Fe', color: '#141414', big: true }] },
      { title: 'El agua entró por la defensa inconclusa', text: 'El 29 de abril el agua entró a la ciudad por un tramo sin terminar del terraplén de defensa del oeste, cerca del hipódromo. Los peritos de la causa judicial concluyeron que la orden de evacuar debió darse al menos un día antes.', view: { lon: -60.72, lat: -31.62, halfKm: 15 }, marks: [{ kind: 'point', lon: -60.7, lat: -31.63, label: 'Santa Fe', color: '#141414' }] },
      { title: 'Un tercio de la ciudad bajo el agua', text: 'El agua cubrió alrededor de un tercio de la ciudad, sobre todo los barrios del oeste, y afectó a unas 130.000 personas.', view: { lon: -60.72, lat: -31.62, halfKm: 12 }, marks: [{ kind: 'point', lon: -60.7, lat: -31.63, label: 'Santa Fe', color: FLOOD, big: true }] },
      { title: 'Las víctimas', text: 'La cifra oficial es de 23 personas muertas en los primeros días. Organizaciones de derechos humanos de Santa Fe contabilizaron 158 al sumar a quienes murieron después por causas que atribuyen a la inundación.', view: { lon: -60.72, lat: -31.62, halfKm: 12 }, marks: [{ kind: 'point', lon: -60.7, lat: -31.63, label: 'Santa Fe', color: FLOOD }] },
      { title: 'El costo', text: 'Una evaluación de la CEPAL encargada por la provincia estimó las pérdidas en unos 2.878 millones de pesos de 2003, con el sector productivo como el más afectado. Sigue siendo un caso de estudio sobre la importancia de terminar las obras de defensa y de dar la alerta a tiempo.', view: { lon: -60.75, lat: -31.55, halfKm: 80 }, marks: [{ kind: 'point', lon: -60.7, lat: -31.63, label: 'Santa Fe', color: FLOOD }] },
    ],
    links: [
      { label: 'Probá el simulador de inundaciones en Santa Fe', href: '/es/simulador-inundaciones?lugar=Santa%20Fe&lat=-31.63&lon=-60.7' },
      { label: 'Qué hacer en una inundación', href: '/es/que-hacer#inundacion' },
      { label: '¿Qué harías? Ponete a prueba', href: '/es/que-harias' },
    ],
    sources: [
      { label: 'CEPAL · Evaluación del impacto de las inundaciones y el desbordamiento del río Salado en la provincia de Santa Fe (2003)', url: 'https://www.cepal.org/es/publicaciones/28461-evaluacion-impacto-inundaciones-desbordamiento-rio-salado-la-provincia-santa-fe' },
      { label: 'El Litoral (26/6/2003) · Inundación: calculan daños en 2.878 millones de pesos', url: 'https://studylib.es/doc/192805/inundaci%C3%B3n--calculan-da%C3%B1os-en-2.878-millones-de-pesos-164-kb' },
      { label: 'La Nación (29/4/2026) · Santa Fe vuelve a marchar para recordar la inundación de 2003', url: 'https://www.lanacion.com.ar/sociedad/santa-fe-vuelve-a-marchar-para-recordar-la-tragica-inundacion-de-2003-nid29042026/' },
      { label: 'Universidad Nacional de Entre Ríos · Ciencia, Docencia y Tecnología (artículo sobre la inundación de 2003)', url: 'https://pcient.uner.edu.ar/index.php/Scdyt/article/download/282/227' },
    ],
  },
];

const en: Story[] = [
  {
    ...es[0], kicker: 'Chile · 22 May 1960', title: 'The largest earthquake ever recorded',
    dek: 'A fault about a thousand kilometres long, a tsunami that crossed the Pacific and a volcano that woke up two days later.',
    steps: [
      { ...es[0].steps[0], title: 'A Sunday afternoon', text: 'On 22 May 1960, at 15:11 Chile time (19:11 UTC), the Nazca plate slipped abruptly beneath the South American plate off southern Chile. The USGS assigns it magnitude 9.5: the largest earthquake ever recorded by instruments.', marks: [{ kind: 'point', ...VALDIVIA_EPI, label: 'Epicentre (USGS)', color: EQ, big: true }] },
      { ...es[0].steps[1], title: 'A fault as long as a country', text: 'It was not a single point that broke but a huge strip of the plate boundary: 900 to 1,000 km long along the coast. That is why the shaking lasted so long and was strong across southern Chile.', marks: [{ kind: 'line', coords: VALDIVIA_RUPTURE, label: 'Rupture (approximate)', color: EQ }, { kind: 'point', ...VALDIVIA_EPI, label: 'Epicentre', color: EQ }] },
      { ...es[0].steps[2], title: 'The victims', text: 'The USGS estimates about 1,655 deaths in southern Chile; other estimates range from 1,000 to 6,000, because the number was never established precisely. On the Chilean coast, the tsunami reached about 25 m, according to NOAA’s tsunami database.' },
      { ...es[0].steps[3], title: 'The tsunami crossed the Pacific', text: 'About 15 hours later the waves reached Hawaii: 61 people died in Hilo. After 22 hours they reached Japan, about 17,000 km away, killing 138 people and destroying more than 1,600 homes. There were also victims in the Philippines.', marks: [{ kind: 'point', ...VALDIVIA_EPI, label: 'Chile', color: EQ, big: true }, { kind: 'point', lon: -155.09, lat: 19.72, label: 'Hilo (Hawaii)', color: TSU }, { kind: 'point', lon: 141.5, lat: 39.0, label: 'Japan', color: TSU }] },
      { ...es[0].steps[4], title: 'A volcano wakes up', text: 'Two days after the earthquake, on 24 May, Cordón Caulle erupted, next to Puyehue volcano. Some seismologists linked it to the earthquake.' },
      { ...es[0].steps[5], title: 'Its legacy', text: 'Valdivia 1960 is the benchmark of what a subduction zone can do. Magnitude 9 earthquakes are rare, but they happen: Alaska 1964, Sumatra 2004 and Japan 2011. If you live on the Pacific coast, the rule is the same as then: if the shaking is strong or long, as soon as it stops, go to high ground.' },
    ],
    links: [
      { label: 'Simulate how it felt in Valdivia', href: '/en/earthquake-simulator?sismo=valdivia-1960' },
      { label: 'What if it happened beneath your city?', href: '/en/what-if-it-happened-here' },
      { label: 'Other disasters on a 22 May', href: '/en/on-this-day?date=05-22' },
      { label: 'What to do in a tsunami', href: '/en/what-to-do#tsunami' },
    ],
  },
  {
    ...es[1], kicker: 'San Juan, Argentina · 23 November 1977', title: 'The Caucete earthquake',
    dek: 'The strongest earthquake recorded in San Juan, which brought down most adobe houses and liquefied the ground.',
    steps: [
      { ...es[1].steps[0], title: 'At dawn', text: 'On 23 November 1977, at 6:26 Argentina time (9:26 UTC), a magnitude 7.4 earthquake shook San Juan. According to the USGS, the focus was about 13 km deep and about 90 km northeast of the city of San Juan.' },
      { ...es[1].steps[1], title: 'Caucete, the hardest hit', text: 'Official figures report 65 deaths and more than 300 injured, most of them in Caucete. According to INPRES data, 72% of the roughly 1,700 adobe houses in Caucete collapsed.' },
      { ...es[1].steps[2], title: 'The ground turned liquid', text: 'In sandy soils with water close to the surface, the shaking made the sand behave like a liquid: liquefaction. Craters and sand volcanoes opened, the ground spread sideways and water spurted up to three metres high. It broke water pipes, irrigation wells and power lines.' },
      { ...es[1].steps[3], title: 'A very high hazard area', text: 'San Juan is in zone 4 of the INPRES map, the highest seismic hazard in the country, together with northern Mendoza. The 1944 earthquake, which destroyed the city of San Juan, and the 1977 one are the great reminders: earthquake-resistant construction is what saves the most lives.' },
    ],
    links: [
      { label: 'Simulate how it felt in Caucete', href: '/en/earthquake-simulator?sismo=caucete-1977' },
      { label: 'See San Juan’s seismic zone in “My place”', href: '/en/my-place?place=San%20Juan&lat=-31.54&lon=-68.54' },
      { label: 'Other disasters on a 23 November', href: '/en/on-this-day?date=11-23' },
      { label: 'What to do in an earthquake', href: '/en/what-to-do#earthquake' },
    ],
  },
  {
    ...es[2], kicker: 'Santa Fe, Argentina · 29 April 2003', title: 'When the Salado entered Santa Fe',
    dek: 'A river swollen by extraordinary rain and an unfinished levee: a third of the city under water.',
    steps: [
      { ...es[2].steps[0], title: 'A river that kept rising', text: 'In April 2003, extraordinary rainfall in the Salado river basin made it rise far above normal. The Salado runs along the west of the city of Santa Fe before joining the Paraná system.' },
      { ...es[2].steps[1], title: 'Water came in through the unfinished levee', text: 'On 29 April the water entered the city through an unfinished section of the western levee, near the racecourse. Experts in the court case concluded that the evacuation order should have been given at least a day earlier.' },
      { ...es[2].steps[2], title: 'A third of the city under water', text: 'The water covered about a third of the city, mostly the western neighbourhoods, and affected some 130,000 people.' },
      { ...es[2].steps[3], title: 'The victims', text: 'The official figure is 23 people dead in the first days. Human-rights organizations in Santa Fe counted 158 by adding those who died later from causes they attribute to the flood.' },
      { ...es[2].steps[4], title: 'The cost', text: 'An ECLAC (CEPAL) assessment commissioned by the province estimated losses at about 2,878 million 2003 pesos, with the productive sector the hardest hit. It remains a case study in the importance of finishing flood defences and warning in time.' },
    ],
    links: [
      { label: 'Try the flood simulator in Santa Fe', href: '/en/flood-simulator?place=Santa%20Fe&lat=-31.63&lon=-60.7' },
      { label: 'What to do in a flood', href: '/en/what-to-do#flood' },
      { label: 'What would you do? Test yourself', href: '/en/what-would-you-do' },
    ],
  },
];

export const STORIES: Record<Lang, Story[]> = { es, en };
export const storyBySlug = (lang: Lang, slug: string) => STORIES[lang].find((s) => s.slug === slug) ?? null;
