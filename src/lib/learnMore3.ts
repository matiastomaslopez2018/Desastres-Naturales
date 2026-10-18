import type { LearnArticle } from './learn';

/* Aprender · deslizamientos, tornados y tormentas severas, calor y frío extremos (Fase 3 · D). */

export const MORE_3: LearnArticle[] = [
  {
    id: 'landslides', topic: 'landslide',
    sources: [
      { label: 'USGS · Landslide Hazards Program', url: 'https://www.usgs.gov/programs/landslide-hazards' },
      { label: 'Ready.gov (FEMA) · Landslides and debris flows', url: 'https://www.ready.gov/landslides-debris-flow' },
      { label: 'NASA · Landslides (LHASA y catálogo)', url: 'https://landslides.nasa.gov/' },
      { label: 'USGS · Ground Failure', url: 'https://earthquake.usgs.gov/data/ground-failure/' },
    ],
    es: {
      slug: 'deslizamientos', title: 'Deslizamientos: por qué ocurren y qué hacer',
      seoTitle: 'Deslizamientos de tierra y aludes de barro: causas, señales y qué hacer',
      desc: 'Qué es un deslizamiento, qué lo desencadena (lluvia, sismos, deshielo, obras), las señales de aviso y qué hacer según las guías oficiales.',
      lead: 'Un deslizamiento es el movimiento de roca, tierra o barro pendiente abajo. Puede ser lento, de centímetros por año, o un alud de barro que baja a decenas de kilómetros por hora. La mayoría los desencadena la lluvia.',
      sections: [
        { h: 'Qué los desencadena', list: [
          'Lluvia intensa o muy prolongada: el agua satura el suelo y le quita resistencia. Es la causa más común.',
          'Terremotos: la sacudida puede soltar miles de deslizamientos en las laderas cercanas.',
          'Deshielo rápido, erupciones volcánicas (lahares) y crecidas que socavan la base de una ladera.',
          'Obras humanas: cortes de rutas, excavaciones, deforestación, minería y pérdidas de agua.',
        ] },
        { h: 'Señales de aviso', list: [
          'Grietas nuevas o abultamientos en el suelo, el asfalto o las veredas.',
          'Postes, árboles, muros o cercas que se inclinan; puertas y ventanas que de pronto se traban.',
          'Agua que brota donde antes no había, o arroyos que crecen de golpe y se enturbian (o bajan aunque siga lloviendo).',
          'Un ruido sordo que aumenta, como un rumor de piedras.',
        ] },
        { h: 'Qué hacer', list: [
          'Si las autoridades piden evacuar, salí enseguida.',
          'Durante lluvias intensas, mantenete informado y alejate de cauces, quebradas y pies de laderas.',
          'Si notás las señales de aviso, salí del camino del deslizamiento hacia un lugar alto y lateral, no pendiente abajo.',
          'Si no hay forma de escapar, hacete un ovillo y protegé la cabeza.',
          'Después, no vuelvas a la zona: puede haber nuevos deslizamientos, cables cortados y caños rotos.',
        ] },
        { h: 'Qué muestra este sitio', p: [
          'En el mapa, la capa "Peligro de deslizamientos hoy" es el modelo LHASA de NASA, que combina la lluvia de las últimas horas, la humedad del suelo y la susceptibilidad del terreno. La capa "Deslizamientos con víctimas" son registros del catálogo de NASA armado a partir de noticias. En la ficha de un sismo grande aparece además el producto Ground Failure de USGS, que estima deslizamientos y licuefacción a partir del ShakeMap.',
          'Son modelos y registros, no avisos: los avisos los emite el organismo de cada país.',
        ] },
      ],
    },
    en: {
      slug: 'landslides', title: 'Landslides: why they happen and what to do',
      seoTitle: 'Landslides and mudslides: causes, warning signs and what to do',
      desc: 'What a landslide is, what triggers it (rain, earthquakes, snowmelt, construction), the warning signs and what to do according to official guidance.',
      lead: 'A landslide is rock, earth or mud moving downslope. It can be slow, a few centimeters a year, or a debris flow rushing down at tens of kilometers per hour. Most are triggered by rain.',
      sections: [
        { h: 'What triggers them', list: [
          'Intense or prolonged rain: water saturates the ground and weakens it. It is the most common cause.',
          'Earthquakes: shaking can release thousands of landslides on nearby slopes.',
          'Rapid snowmelt, volcanic eruptions (lahars) and floods that undercut the base of a slope.',
          'Human works: road cuts, excavation, deforestation, mining and leaking water.',
        ] },
        { h: 'Warning signs', list: [
          'New cracks or bulges in the ground, pavement or sidewalks.',
          'Poles, trees, walls or fences that tilt; doors and windows that suddenly stick.',
          'Water appearing where there was none, or creeks rising suddenly and turning muddy (or dropping while rain continues).',
          'A faint rumbling that grows louder.',
        ] },
        { h: 'What to do', list: [
          'If authorities order an evacuation, leave right away.',
          'During heavy rain, stay informed and keep away from channels, ravines and the foot of slopes.',
          'If you notice warning signs, move out of the landslide’s path to high ground off to the side, not downslope.',
          'If escape is impossible, curl into a tight ball and protect your head.',
          'Afterwards, stay away from the area: more slides, downed lines and broken pipes are possible.',
        ] },
        { h: 'What this site shows', p: [
          'On the map, the "Landslide hazard today" layer is NASA’s LHASA model, which combines recent rainfall, soil moisture and terrain susceptibility. The "Deadly landslides" layer shows records from the NASA catalog compiled from news. Pages of large earthquakes also show the USGS Ground Failure product, which estimates landslides and liquefaction from the ShakeMap.',
          'These are models and records, not warnings: warnings are issued by each country’s agency.',
        ] },
      ],
    },
  },
  {
    id: 'tornadoes', topic: 'severe',
    sources: [
      { label: 'NOAA SPC · Tornado FAQ', url: 'https://www.spc.noaa.gov/faq/tornado/' },
      { label: 'NOAA SPC · Enhanced Fujita scale', url: 'https://www.spc.noaa.gov/efscale/' },
      { label: 'NOAA SPC · Outlook categories', url: 'https://www.spc.noaa.gov/misc/about.html' },
      { label: 'NWS · Tornado safety', url: 'https://www.weather.gov/safety/tornado' },
      { label: 'Ready.gov (FEMA) · Tornadoes', url: 'https://www.ready.gov/tornadoes' },
    ],
    es: {
      slug: 'tornados-y-tormentas-severas', title: 'Tornados y tormentas severas',
      seoTitle: 'Tornados: escala EF, aviso y alerta, y qué hacer',
      desc: 'Qué es un tornado, cómo se mide con la escala EF, la diferencia entre vigilancia y aviso, cómo leer el pronóstico del Storm Prediction Center y qué hacer.',
      lead: 'Un tornado es una columna de aire que gira violentamente y toca el suelo desde la base de una tormenta. Se forman sobre todo en tormentas de gran desarrollo (supercelulares) y pueden tener vientos de más de 300 km/h.',
      sections: [
        { h: 'La escala EF', p: ['Los tornados se clasifican después de que pasan, por el daño que dejaron: el Servicio Meteorológico de EE. UU. releva los destrozos y estima la ráfaga de 3 segundos. Por eso los reportes de las primeras horas no tienen categoría.'], table: {
          head: ['Categoría', 'Ráfaga estimada', 'Daño típico'],
          rows: [
            ['EF0', '105–137 km/h', 'Tejas y ramas'], ['EF1', '138–177 km/h', 'Techos dañados, casas rodantes volcadas'],
            ['EF2', '178–217 km/h', 'Techos arrancados, árboles grandes quebrados'], ['EF3', '218–266 km/h', 'Pisos enteros destruidos'],
            ['EF4', '267–322 km/h', 'Casas bien construidas arrasadas'], ['EF5', 'más de 322 km/h', 'Destrucción total'],
          ] } },
        { h: 'Vigilancia y aviso', list: [
          'Vigilancia de tornado (tornado watch): el Storm Prediction Center indica que las condiciones son favorables en una región durante varias horas. Hay que estar atento.',
          'Aviso de tornado (tornado warning): la oficina local del Servicio Meteorológico detectó un tornado o el radar lo indica. Hay que refugiarse ya.',
        ] },
        { h: 'El pronóstico del Storm Prediction Center', p: ['Cada día, el SPC publica un mapa del riesgo de tormentas severas (tornados, granizo de 2,5 cm o más y ráfagas de 93 km/h o más) en una escala de 1 a 5: marginal, leve, mejorado, moderado y alto. Además marca las zonas con tormentas comunes, sin riesgo severo.'] },
        { h: 'Qué hacer ante un aviso', list: [
          'Andá al subsuelo o a una habitación interior del piso más bajo, sin ventanas (un baño o un placard), y cubrite la cabeza.',
          'Las casas rodantes no son seguras: salí hacia un edificio firme.',
          'En un auto, si no podés llegar a un refugio: quedate con el cinturón puesto, agachá la cabeza por debajo de las ventanas y cubrila; o, si hay un lugar claramente más bajo que el camino, salí y acostate ahí cubriéndote la cabeza.',
          'No te refugies bajo un puente o un paso elevado.',
        ] },
        { h: 'Qué muestra este sitio', p: ['La capa "Tormentas severas y tornados" muestra el pronóstico del día del SPC, los avisos vigentes del Servicio Meteorológico de EE. UU. y los reportes preliminares de las últimas horas. Hay tornados en muchos otros lugares, como la llanura pampeana, Europa o Bangladés, pero solo EE. UU. publica estos datos de forma abierta y en tiempo real.'] },
      ],
    },
    en: {
      slug: 'tornadoes-and-severe-storms', title: 'Tornadoes and severe storms',
      seoTitle: 'Tornadoes: EF scale, watch vs warning, and what to do',
      desc: 'What a tornado is, how the EF scale rates it, the difference between a watch and a warning, how to read the Storm Prediction Center outlook and what to do.',
      lead: 'A tornado is a violently rotating column of air that touches the ground from the base of a thunderstorm. Most form in supercell storms, and winds can exceed 300 km/h.',
      sections: [
        { h: 'The EF scale', p: ['Tornadoes are rated after they pass, by the damage they leave: the US National Weather Service surveys it and estimates the 3-second gust. That is why reports from the first hours have no rating.'], table: {
          head: ['Rating', 'Estimated gust', 'Typical damage'],
          rows: [
            ['EF0', '65–85 mph (105–137 km/h)', 'Shingles and branches'], ['EF1', '86–110 mph (138–177 km/h)', 'Roofs damaged, mobile homes overturned'],
            ['EF2', '111–135 mph (178–217 km/h)', 'Roofs torn off, large trees snapped'], ['EF3', '136–165 mph (218–266 km/h)', 'Entire stories destroyed'],
            ['EF4', '166–200 mph (267–322 km/h)', 'Well-built houses leveled'], ['EF5', 'over 200 mph (322 km/h)', 'Total destruction'],
          ] } },
        { h: 'Watch and warning', list: [
          'Tornado watch: the Storm Prediction Center says conditions are favorable in a region for several hours. Stay alert.',
          'Tornado warning: the local Weather Service office has a tornado sighted or indicated by radar. Take shelter now.',
        ] },
        { h: 'The Storm Prediction Center outlook', p: ['Every day the SPC publishes a map of severe thunderstorm risk (tornadoes, hail of 1 inch or more and gusts of 58 mph or more) on a 1-to-5 scale: marginal, slight, enhanced, moderate and high. It also marks areas with general, non-severe thunderstorms.'] },
        { h: 'What to do in a warning', list: [
          'Go to a basement or an interior room on the lowest floor with no windows (a bathroom or closet) and cover your head.',
          'Mobile homes are not safe: go to a sturdy building.',
          'In a car, if you cannot reach shelter: stay buckled, put your head below the windows and cover it; or, if there is an area clearly lower than the road, get out and lie there covering your head.',
          'Do not shelter under a bridge or overpass.',
        ] },
        { h: 'What this site shows', p: ['The "Severe storms and tornadoes" layer shows the SPC day-1 outlook, active US National Weather Service warnings and preliminary reports from the last hours. Tornadoes happen in many other places, such as the Argentine Pampas, Europe or Bangladesh, but only the US publishes this data openly and in real time.'] },
      ],
    },
  },
  {
    id: 'heat-cold', topic: 'heat',
    sources: [
      { label: 'WMO · Severe Weather Information Centre', url: 'https://severeweather.wmo.int/' },
      { label: 'Meteoalarm (Europa)', url: 'https://meteoalarm.org/' },
      { label: 'NWS · HeatRisk (EE. UU.)', url: 'https://www.wpc.ncep.noaa.gov/heatrisk/' },
      { label: 'OMS · Calor y salud', url: 'https://www.who.int/es/news-room/fact-sheets/detail/climate-change-heat-and-health' },
      { label: 'Copernicus · Climate Pulse', url: 'https://pulse.climate.copernicus.eu/' },
      { label: 'SMN Argentina · Alertas', url: 'https://www.smn.gob.ar/alertas' },
      { label: 'AEMET (España) · Avisos', url: 'https://www.aemet.es/es/eltiempo/prediccion/avisos' },
      { label: 'SMN México', url: 'https://smn.conagua.gob.mx/' },
    ],
    es: {
      slug: 'calor-y-frio-extremos', title: 'Calor y frío extremos: dónde consultar',
      seoTitle: 'Olas de calor y de frío: dónde ver las alertas oficiales',
      desc: 'Por qué este sitio no muestra olas de calor ni de frío en el mapa, dónde consultar las alertas oficiales de cada país y qué recomiendan los organismos de salud.',
      lead: 'Las olas de calor son uno de los fenómenos que más muertes causan, pero no hay una fuente oficial única y abierta con las alertas de todo el mundo: cada país define sus propios umbrales. Por eso este sitio no las muestra en el mapa y enlaza a quienes las emiten.',
      sections: [
        { h: 'Dónde consultar', list: [
          'Todo el mundo: el Centro de Información de Tiempo Severo de la Organización Meteorológica Mundial reúne los avisos de los servicios nacionales.',
          'Europa: Meteoalarm, con los avisos oficiales de cada país.',
          'Estados Unidos: HeatRisk del Servicio Meteorológico Nacional.',
          'Cada país: su servicio meteorológico nacional (por ejemplo, SMN en Argentina y México, AEMET en España).',
        ] },
        { h: 'Con calor extremo', list: [
          'Tomá agua aunque no tengas sed y evitá el alcohol.',
          'Evitá el sol y la actividad física en las horas de más calor.',
          'Buscá lugares frescos o con aire acondicionado y ventilá de noche.',
          'Prestá atención a personas mayores, bebés, enfermos crónicos y quienes viven solos.',
          'Mareo, confusión, piel caliente y seca o desmayo pueden ser un golpe de calor: es una emergencia.',
        ] },
        { h: 'Con frío extremo', list: [
          'Abrigate en capas y cubrí cabeza, manos y pies.',
          'Usá estufas y braseros solo con buena ventilación: el monóxido de carbono no se ve ni se huele y puede ser mortal.',
          'Prestá atención a personas mayores y en situación de calle.',
        ] },
      ],
    },
    en: {
      slug: 'extreme-heat-and-cold', title: 'Extreme heat and cold: where to check',
      seoTitle: 'Heat waves and cold waves: where to find official warnings',
      desc: 'Why this site does not map heat or cold waves, where to check each country’s official warnings and what health agencies recommend.',
      lead: 'Heat waves are among the deadliest hazards, but there is no single open official source with warnings for the whole world: each country sets its own thresholds. That is why this site does not map them and links to those who issue them.',
      sections: [
        { h: 'Where to check', list: [
          'Worldwide: the World Meteorological Organization’s Severe Weather Information Centre gathers national warnings.',
          'Europe: Meteoalarm, with each country’s official warnings.',
          'United States: the National Weather Service HeatRisk.',
          'Each country: its national weather service (for example SMN in Argentina and Mexico, AEMET in Spain).',
        ] },
        { h: 'In extreme heat', list: [
          'Drink water even if you are not thirsty and avoid alcohol.',
          'Avoid the sun and physical activity in the hottest hours.',
          'Look for cool or air-conditioned places and ventilate at night.',
          'Check on older people, babies, the chronically ill and people who live alone.',
          'Dizziness, confusion, hot dry skin or fainting may be heatstroke: it is an emergency.',
        ] },
        { h: 'In extreme cold', list: [
          'Dress in layers and cover your head, hands and feet.',
          'Use heaters and stoves only with good ventilation: carbon monoxide cannot be seen or smelled and can kill.',
          'Check on older people and people experiencing homelessness.',
        ] },
      ],
    },
  },
];
