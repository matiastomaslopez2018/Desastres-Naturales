import type { LearnArticle } from './learn';

/* Aprender · ciclones, incendios, inundaciones, sequías y artículos generales. */

export const MORE_2: LearnArticle[] = [
  {
    id: 'cyclone-names', topic: 'storm',
    sources: [
      { label: 'WMO · Tropical cyclones', url: 'https://www.wmo.int/topics/tropical-cyclone' },
      { label: 'NOAA NHC · Glossary', url: 'https://www.nhc.noaa.gov/aboutgloss.shtml' },
    ],
    es: {
      slug: 'huracan-tifon-ciclon', title: 'Huracán, tifón y ciclón: qué los diferencia',
      seoTitle: 'Huracán, tifón y ciclón: ¿cuál es la diferencia?',
      desc: 'Huracán, tifón y ciclón son el mismo fenómeno con distinto nombre según el océano. Cómo se clasifican y cómo se les ponen nombres.',
      lead: 'Huracán, tifón y ciclón son lo mismo: un ciclón tropical, una tormenta giratoria que se forma sobre mares cálidos. Cambia el nombre según la región del mundo.',
      sections: [
        { h: 'El nombre depende del océano', list: [
          'Huracán: en el Atlántico norte, el Caribe y el Pacífico nordeste y central.',
          'Tifón: en el Pacífico noroeste (Japón, Filipinas, China).',
          'Ciclón: en el océano Índico y en el Pacífico sur (ciclón tropical severo en Australia).',
        ] },
        { h: 'Las etapas', list: [
          'Depresión tropical: vientos sostenidos de menos de 63 km/h (34 nudos).',
          'Tormenta tropical: de 63 a 118 km/h; desde acá recibe un nombre.',
          'Huracán o tifón: 119 km/h (64 nudos) o más. En el Atlántico y el Pacífico este se clasifica con la escala Saffir-Simpson.',
        ] },
        { h: 'Cómo se forma', p: ['Necesita agua de mar caliente (en general más de 26 °C), humedad y poco cambio del viento con la altura. Gira en sentido antihorario en el hemisferio norte y horario en el sur. Al tocar tierra o pasar a aguas frías, pierde su fuente de energía y se debilita.'] },
        { h: 'Quién les pone nombre', p: ['La Organización Meteorológica Mundial mantiene listas de nombres por región, que se repiten cada cierta cantidad de años; los nombres de los ciclones muy destructivos se retiran.'] },
      ],
    },
    en: {
      slug: 'hurricane-typhoon-cyclone', title: 'Hurricane, typhoon and cyclone: the difference',
      seoTitle: 'Hurricane, typhoon and cyclone: what is the difference?',
      desc: 'Hurricanes, typhoons and cyclones are the same phenomenon with different names depending on the ocean. How they are classified and named.',
      lead: 'Hurricanes, typhoons and cyclones are the same thing: a tropical cyclone, a rotating storm that forms over warm seas. The name changes with the region of the world.',
      sections: [
        { h: 'The name depends on the ocean', list: [
          'Hurricane: in the North Atlantic, the Caribbean and the northeast and central Pacific.',
          'Typhoon: in the northwest Pacific (Japan, the Philippines, China).',
          'Cyclone: in the Indian Ocean and the South Pacific (severe tropical cyclone in Australia).',
        ] },
        { h: 'The stages', list: [
          'Tropical depression: sustained winds below 63 km/h (34 knots).',
          'Tropical storm: 63 to 118 km/h; from here it gets a name.',
          'Hurricane or typhoon: 119 km/h (64 knots) or more. In the Atlantic and east Pacific it is rated on the Saffir-Simpson scale.',
        ] },
        { h: 'How it forms', p: ['It needs warm sea water (generally above 26 °C), moisture and little change of wind with height. It spins counterclockwise in the northern hemisphere and clockwise in the southern. Over land or cold water it loses its energy source and weakens.'] },
        { h: 'Who names them', p: ['The World Meteorological Organization maintains name lists for each region, which repeat every few years; the names of very destructive cyclones are retired.'] },
      ],
    },
  },
  {
    id: 'saffir-simpson', topic: 'storm', figures: ['saffir'],
    sources: [
      { label: 'NOAA NHC · Saffir-Simpson Hurricane Wind Scale', url: 'https://www.nhc.noaa.gov/aboutsshws.php' },
    ],
    es: {
      slug: 'escala-saffir-simpson', title: 'Escala Saffir-Simpson',
      seoTitle: 'Escala Saffir-Simpson: las 5 categorías de huracán explicadas',
      desc: 'Las cinco categorías de la escala Saffir-Simpson, con sus vientos y los daños que se esperan, y lo que la escala no mide.',
      lead: 'La escala Saffir-Simpson clasifica los huracanes del 1 al 5 según su viento máximo sostenido (promedio de 1 minuto). La usa el Centro Nacional de Huracanes de EE. UU.',
      sections: [
        { h: 'Las categorías', table: { head: ['Categoría', 'Viento sostenido', 'Daños típicos'], rows: [
          ['1', '119–153 km/h (64–82 kt)', 'Daños en techos, árboles y tendido eléctrico.'],
          ['2', '154–177 km/h (83–95 kt)', 'Daños importantes en techos y paredes; cortes de luz por días o semanas.'],
          ['3 (mayor)', '178–208 km/h (96–112 kt)', 'Daños devastadores; agua y luz pueden faltar por semanas.'],
          ['4 (mayor)', '209–251 km/h (113–136 kt)', 'Daños catastróficos; zonas inhabitables por semanas o meses.'],
          ['5 (mayor)', '252 km/h o más (137 kt o más)', 'Destrucción de gran parte de las viviendas.'],
        ] } },
        { h: 'Lo que la escala no mide', p: ['Solo mide el viento. No tiene en cuenta la marejada ciclónica (la subida del mar), la lluvia ni las inundaciones, que suelen causar la mayoría de las muertes. Un huracán de categoría 1 lento y muy lluvioso puede ser más grave que uno de categoría 4 que pasa rápido.'] },
        { h: 'En el mapa', p: ['El atlas colorea las trayectorias según esta escala, del celeste (depresión) al rojo (categoría 5), con la misma leyenda en el mapa.'] },
      ],
    },
    en: {
      slug: 'saffir-simpson-scale', title: 'The Saffir-Simpson scale',
      seoTitle: 'The Saffir-Simpson scale: the 5 hurricane categories explained',
      desc: 'The five categories of the Saffir-Simpson scale, with their winds and expected damage, and what the scale does not measure.',
      lead: 'The Saffir-Simpson scale rates hurricanes from 1 to 5 by their maximum sustained wind (1-minute average). It is used by the US National Hurricane Center.',
      sections: [
        { h: 'The categories', table: { head: ['Category', 'Sustained wind', 'Typical damage'], rows: [
          ['1', '119–153 km/h (64–82 kt)', 'Damage to roofs, trees and power lines.'],
          ['2', '154–177 km/h (83–95 kt)', 'Major roof and wall damage; power outages for days or weeks.'],
          ['3 (major)', '178–208 km/h (96–112 kt)', 'Devastating damage; water and power may be out for weeks.'],
          ['4 (major)', '209–251 km/h (113–136 kt)', 'Catastrophic damage; areas uninhabitable for weeks or months.'],
          ['5 (major)', '252 km/h or more (137 kt or more)', 'Destruction of a large share of homes.'],
        ] } },
        { h: 'What the scale does not measure', p: ['It only measures wind. It does not account for storm surge (the rise of the sea), rain or flooding, which usually cause most deaths. A slow, very rainy category 1 hurricane can be worse than a fast-moving category 4.'] },
        { h: 'On the map', p: ['The atlas colors tracks by this scale, from light blue (depression) to red (category 5), with the same legend on the map.'] },
      ],
    },
  },
  {
    id: 'forecast-cone', topic: 'storm', figures: ['cone'],
    sources: [
      { label: 'NOAA NHC · Definition of the cone of uncertainty', url: 'https://www.nhc.noaa.gov/aboutcone.shtml' },
    ],
    es: {
      slug: 'como-leer-el-cono-de-pronostico', title: 'Cómo leer el cono de pronóstico',
      seoTitle: 'Cómo leer el cono de pronóstico de un huracán',
      desc: 'Qué muestra el cono de pronóstico de un huracán, qué no muestra y por qué los efectos pueden llegar fuera de él.',
      lead: 'El cono de pronóstico es la imagen más conocida de un huracán y también la más malinterpretada. Muestra la incertidumbre sobre el camino del centro, no el tamaño de la tormenta.',
      sections: [
        { h: 'Qué muestra', p: ['El cono abarca las posiciones posibles del centro del ciclón en los próximos días. Se arma con círculos alrededor de cada punto de pronóstico, de un tamaño tal que el centro real quede adentro alrededor de dos de cada tres veces, según los errores de pronóstico de los últimos cinco años. Por eso se ensancha con el tiempo.'] },
        { h: 'Qué no muestra', list: [
          'No muestra el tamaño de la tormenta: el viento, la lluvia y la marejada pueden llegar a cientos de kilómetros del centro, fuera del cono.',
          'No muestra dónde va a haber daños: lugares lejos del centro pueden sufrir inundaciones graves.',
          'Una de cada tres veces, el centro sale del cono.',
        ] },
        { h: 'En el mapa del atlas', list: [
          'Línea continua: trayectoria observada, coloreada por intensidad.',
          'Línea punteada y puntos: pronóstico, con la letra de la categoría (D depresión, S tormenta, H huracán, M huracán mayor).',
          'Zona clara: el cono. Manchas amarillas, naranjas y rojas: áreas con vientos de 63, 93 y 119 km/h o más en este momento.',
        ] },
      ],
    },
    en: {
      slug: 'how-to-read-the-forecast-cone', title: 'How to read the forecast cone',
      seoTitle: 'How to read a hurricane forecast cone',
      desc: 'What a hurricane forecast cone shows, what it does not show, and why impacts can occur outside it.',
      lead: 'The forecast cone is the best-known image of a hurricane and also the most misunderstood. It shows the uncertainty about the path of the center, not the size of the storm.',
      sections: [
        { h: 'What it shows', p: ['The cone covers the possible positions of the cyclone center over the coming days. It is built from circles around each forecast point, sized so that the actual center falls inside about two out of three times, based on forecast errors of the past five years. That is why it widens with time.'] },
        { h: 'What it does not show', list: [
          'It does not show the size of the storm: wind, rain and storm surge can reach hundreds of kilometers from the center, outside the cone.',
          'It does not show where damage will occur: places far from the center can suffer severe flooding.',
          'One time in three, the center leaves the cone.',
        ] },
        { h: 'On the atlas map', list: [
          'Solid line: observed track, colored by intensity.',
          'Dotted line and points: forecast, with the category letter (D depression, S storm, H hurricane, M major hurricane).',
          'Light area: the cone. Yellow, orange and red patches: areas with winds of 63, 93 and 119 km/h or more right now.',
        ] },
      ],
    },
  },
  {
    id: 'hurricane-safety', topic: 'storm',
    sources: [
      { label: 'NOAA NHC · Get ready', url: 'https://www.nhc.noaa.gov/prepare/ready.php' },
      { label: 'NWS · Hurricane safety', url: 'https://www.weather.gov/safety/hurricane' },
      { label: 'Ready.gov (FEMA) · Hurricanes', url: 'https://www.ready.gov/hurricanes' },
    ],
    es: {
      slug: 'que-hacer-ante-un-huracan', title: 'Qué hacer ante un huracán',
      seoTitle: 'Qué hacer ante un huracán: antes, durante y después',
      desc: 'Cómo prepararse para un huracán, qué significan la vigilancia y el aviso, cuándo evacuar y qué riesgos quedan después.',
      lead: 'La mayoría de las muertes en un huracán las causa el agua, no el viento: la marejada ciclónica y las inundaciones. Prepararse antes y evacuar a tiempo es lo que más protege.',
      sections: [
        { h: 'Antes', list: [
          'Averiguá si vivís en una zona de evacuación por marejada y cuál es tu ruta.',
          'Prepará una mochila de emergencia con agua, comida, medicamentos, linterna, radio a pilas y documentos.',
          'Asegurá o guardá objetos sueltos que el viento pueda arrastrar.',
        ] },
        { h: 'Vigilancia y aviso', p: ['En EE. UU., una vigilancia (watch) significa que las condiciones de huracán son posibles en la zona, en general dentro de 48 horas; un aviso (warning), que se esperan, en general dentro de 36 horas. Cada país usa sus propios niveles: seguí siempre a tu servicio meteorológico nacional.'] },
        { h: 'Durante', list: [
          'Si te ordenan evacuar, hacelo.',
          'Si te quedás, permanecé en un cuarto interior, lejos de ventanas, en el piso más bajo que no se inunde.',
          'Cuidado con el ojo del huracán: la calma puede durar minutos y después vuelve el viento del lado contrario.',
        ] },
        { h: 'Después', list: [
          'No camines ni manejes por zonas inundadas.',
          'Alejate de cables caídos.',
          'Usá los generadores al aire libre, lejos de puertas y ventanas: el monóxido de carbono mata.',
        ] },
      ],
    },
    en: {
      slug: 'what-to-do-in-a-hurricane', title: 'What to do in a hurricane',
      seoTitle: 'What to do in a hurricane: before, during and after',
      desc: 'How to prepare for a hurricane, what watches and warnings mean, when to evacuate and what risks remain afterwards.',
      lead: 'Most hurricane deaths are caused by water, not wind: storm surge and flooding. Preparing ahead and evacuating in time is what protects most.',
      sections: [
        { h: 'Before', list: [
          'Find out whether you live in a storm surge evacuation zone and what your route is.',
          'Prepare an emergency kit with water, food, medicines, flashlight, battery radio and documents.',
          'Secure or store loose objects the wind could carry.',
        ] },
        { h: 'Watches and warnings', p: ['In the US, a watch means hurricane conditions are possible in the area, generally within 48 hours; a warning means they are expected, generally within 36 hours. Each country uses its own levels: always follow your national weather service.'] },
        { h: 'During', list: [
          'If you are told to evacuate, do it.',
          'If you stay, shelter in an interior room away from windows, on the lowest floor that will not flood.',
          'Beware of the eye: the calm can last minutes before the wind returns from the opposite direction.',
        ] },
        { h: 'After', list: [
          'Do not walk or drive through flooded areas.',
          'Stay away from downed power lines.',
          'Run generators outdoors, away from doors and windows: carbon monoxide kills.',
        ] },
      ],
    },
  },
  {
    id: 'satellite-fires', topic: 'fire',
    sources: [
      { label: 'NASA · FIRMS', url: 'https://www.earthdata.nasa.gov/data/tools/firms' },
      { label: 'NASA · FIRMS FAQ', url: 'https://www.earthdata.nasa.gov/data/tools/firms/faq' },
    ],
    es: {
      slug: 'como-detecta-incendios-un-satelite', title: 'Cómo detecta incendios un satélite (FIRMS, FRP)',
      seoTitle: 'Cómo detecta incendios un satélite: focos de calor, FIRMS y FRP',
      desc: 'Cómo los satélites MODIS y VIIRS detectan focos de calor, qué es la potencia radiativa del fuego (FRP) y qué limitaciones tienen estos datos.',
      lead: 'Los satélites no "ven" llamas: miden el calor que emite la superficie en el infrarrojo y marcan los puntos mucho más calientes que su entorno. Son los focos de calor.',
      sections: [
        { h: 'Cómo funciona', p: [
          'Los sensores MODIS (píxeles de 1 km) y VIIRS (375 m), a bordo de satélites en órbita polar, pasan por cada lugar unas dos veces por día y por noche. Cuando un píxel es mucho más caliente que los de alrededor, se registra un foco. Un fuego mucho más chico que el píxel puede detectarse si es suficientemente caliente.',
          'NASA publica los focos en su sistema FIRMS en unas pocas horas desde el paso del satélite.',
        ] },
        { h: 'Qué es la FRP', p: ['La potencia radiativa del fuego (FRP, en megavatios) mide cuánta energía irradia el foco. Está relacionada con la cantidad de vegetación que se quema por segundo: sirve para comparar la intensidad de distintos fuegos.'] },
        { h: 'Limitaciones', list: [
          'Las nubes y el humo espeso tapan los focos.',
          'Un foco no siempre es un incendio forestal: también se detectan quemas agrícolas, volcanes e industrias.',
          'Si el satélite no pasó en el momento de mayor actividad, el fuego puede no aparecer.',
          'Los focos no son el área quemada: para eso se usan otras imágenes, como las de Copernicus GWIS.',
        ] },
      ],
    },
    en: {
      slug: 'how-satellites-detect-fires', title: 'How satellites detect fires (FIRMS, FRP)',
      seoTitle: 'How satellites detect fires: hotspots, FIRMS and FRP',
      desc: 'How the MODIS and VIIRS satellites detect hotspots, what fire radiative power (FRP) is, and the limitations of these data.',
      lead: 'Satellites do not "see" flames: they measure the heat the surface emits in the infrared and flag points much hotter than their surroundings. These are hotspots.',
      sections: [
        { h: 'How it works', p: [
          'The MODIS (1 km pixels) and VIIRS (375 m) sensors, on polar-orbiting satellites, pass over each place about twice by day and by night. When a pixel is much hotter than those around it, a hotspot is recorded. A fire much smaller than the pixel can be detected if it is hot enough.',
          'NASA publishes the hotspots in its FIRMS system within a few hours of the satellite pass.',
        ] },
        { h: 'What FRP is', p: ['Fire radiative power (FRP, in megawatts) measures how much energy the hotspot radiates. It is related to how much vegetation burns per second: useful to compare the intensity of different fires.'] },
        { h: 'Limitations', list: [
          'Clouds and thick smoke hide hotspots.',
          'A hotspot is not always a wildfire: agricultural burns, volcanoes and industry are detected too.',
          'If the satellite did not pass at the peak of activity, the fire may not appear.',
          'Hotspots are not burned area: other imagery is used for that, such as Copernicus GWIS.',
        ] },
      ],
    },
  },
  {
    id: 'fire-triangle-fwi', topic: 'fire', figures: ['fire-triangle'],
    sources: [
      { label: 'Copernicus GWIS · Fire danger forecast', url: 'https://gwis.jrc.ec.europa.eu/about-gwis/technical-background/fire-danger-forecast' },
      { label: 'Ready.gov (FEMA) · Wildfires', url: 'https://www.ready.gov/wildfires' },
    ],
    es: {
      slug: 'triangulo-del-fuego-y-fwi', title: 'El triángulo del fuego y el índice FWI',
      seoTitle: 'El triángulo del fuego y el índice FWI de peligro de incendio',
      desc: 'Qué necesita un fuego para arder y propagarse, y cómo el índice FWI estima el peligro meteorológico de incendio.',
      lead: 'Para que haya fuego hacen falta tres cosas: calor, oxígeno y combustible. Para que un incendio forestal se propague, importan el combustible, el tiempo y el relieve.',
      sections: [
        { h: 'El triángulo del fuego', p: ['Calor, oxígeno y combustible: si falta uno, el fuego se apaga. Los bomberos atacan esos lados: enfrían con agua, sofocan con tierra o espuma y cortan el combustible con cortafuegos.'] },
        { h: 'Cómo se propaga un incendio forestal', list: [
          'Combustible: cuánto hay, qué tan seco está y de qué tipo (pasto, arbustos, bosque).',
          'Tiempo: calor, baja humedad y, sobre todo, viento, que empuja las llamas y lleva brasas lejos.',
          'Relieve: el fuego sube más rápido cuesta arriba.',
        ] },
        { h: 'El índice FWI', p: [
          'El Fire Weather Index (FWI) es un sistema canadiense que usan Copernicus y muchos países. Con temperatura, humedad, viento y lluvia calcula la humedad de distintas capas de combustible y, de ahí, qué tan fácil es que un fuego se inicie y se propague.',
          'Copernicus GWIS lo publica para todo el mundo con pronóstico de varios días, y el atlas lo muestra en la ficha de cada incendio con las clases de peligro de EFFIS: muy bajo, bajo, moderado, alto, muy alto y extremo.',
        ] },
        { h: 'Lo que el FWI no dice', p: ['Mide el peligro meteorológico: no sabe si hay fuego ni cuánta vegetación hay en el lugar. Un FWI alto en un desierto sin vegetación no implica incendios.'] },
      ],
    },
    en: {
      slug: 'fire-triangle-and-fwi', title: 'The fire triangle and the FWI',
      seoTitle: 'The fire triangle and the FWI fire danger index',
      desc: 'What a fire needs to burn and spread, and how the FWI estimates fire weather danger.',
      lead: 'Fire needs three things: heat, oxygen and fuel. For a wildfire to spread, fuel, weather and terrain matter.',
      sections: [
        { h: 'The fire triangle', p: ['Heat, oxygen and fuel: remove one and the fire goes out. Firefighters attack those sides: they cool with water, smother with soil or foam and cut off fuel with firebreaks.'] },
        { h: 'How a wildfire spreads', list: [
          'Fuel: how much there is, how dry, and what kind (grass, shrubs, forest).',
          'Weather: heat, low humidity and above all wind, which pushes flames and carries embers far.',
          'Terrain: fire runs faster uphill.',
        ] },
        { h: 'The FWI', p: [
          'The Fire Weather Index (FWI) is a Canadian system used by Copernicus and many countries. From temperature, humidity, wind and rain it computes the moisture of different fuel layers and, from that, how easily a fire can start and spread.',
          'Copernicus GWIS publishes it worldwide with a multi-day forecast, and the atlas shows it on each wildfire page with the EFFIS danger classes: very low, low, moderate, high, very high and extreme.',
        ] },
        { h: 'What the FWI does not tell you', p: ['It measures weather danger: it does not know whether there is fire or how much vegetation there is. A high FWI in a desert without vegetation does not mean fires.'] },
      ],
    },
  },
  {
    id: 'wildfire-safety', topic: 'fire',
    sources: [
      { label: 'Ready.gov (FEMA) · Wildfires', url: 'https://www.ready.gov/wildfires' },
      { label: 'IVHHN · Protección respiratoria', url: 'https://www.ivhhn.org/ash-protection' },
    ],
    es: {
      slug: 'que-hacer-ante-un-incendio-forestal', title: 'Qué hacer ante un incendio forestal',
      seoTitle: 'Qué hacer ante un incendio forestal: evacuación y humo',
      desc: 'Cómo prepararse, cuándo evacuar, qué hacer si quedás atrapado y cómo protegerse del humo de un incendio forestal.',
      lead: 'Un incendio forestal puede avanzar más rápido de lo que se corre, sobre todo con viento. La regla es salir temprano.',
      sections: [
        { h: 'Antes', list: [
          'Si vivís cerca de vegetación, limpiá el entorno de la casa: pasto corto, sin ramas ni hojas secas cerca de las paredes y el techo.',
          'Tené un plan de evacuación con dos rutas posibles.',
          'Prepará una mochila de emergencia y barbijos N95.',
        ] },
        { h: 'Durante', list: [
          'Si te dicen que evacues, salí de inmediato; no esperes a ver las llamas.',
          'Manejá con las luces prendidas y las ventanas cerradas.',
          'Si quedás atrapado, buscá un lugar sin vegetación (un claro, un camino, un cuerpo de agua) o refugiate dentro de una casa, lejos de las paredes exteriores.',
        ] },
        { h: 'El humo', list: [
          'El humo afecta aunque el fuego esté lejos: quedate adentro con puertas y ventanas cerradas.',
          'Si tenés que salir, usá un barbijo N95 o FFP2 bien ajustado; los de tela no filtran el humo.',
          'Cuidado especial con chicos, personas mayores y quienes tienen asma o problemas cardíacos.',
        ] },
      ],
    },
    en: {
      slug: 'what-to-do-in-a-wildfire', title: 'What to do in a wildfire',
      seoTitle: 'What to do in a wildfire: evacuation and smoke',
      desc: 'How to prepare, when to evacuate, what to do if you are trapped, and how to protect yourself from wildfire smoke.',
      lead: 'A wildfire can move faster than you can run, especially with wind. The rule is to leave early.',
      sections: [
        { h: 'Before', list: [
          'If you live near vegetation, clear the area around your home: short grass, no dry branches or leaves near walls and roof.',
          'Have an evacuation plan with two possible routes.',
          'Prepare an emergency kit and N95 masks.',
        ] },
        { h: 'During', list: [
          'If you are told to evacuate, leave immediately; do not wait to see flames.',
          'Drive with headlights on and windows closed.',
          'If you are trapped, find an area without vegetation (a clearing, a road, a body of water) or shelter inside a house, away from outside walls.',
        ] },
        { h: 'Smoke', list: [
          'Smoke affects you even if the fire is far away: stay indoors with doors and windows closed.',
          'If you must go out, wear a well-fitted N95 or FFP2 mask; cloth masks do not filter smoke.',
          'Take special care of children, older people and those with asthma or heart conditions.',
        ] },
      ],
    },
  },
  {
    id: 'flood-types', topic: 'flood',
    sources: [
      { label: 'NWS · Flood safety', url: 'https://www.weather.gov/safety/flood' },
      { label: 'Copernicus · GloFAS', url: 'https://global-flood.emergency.copernicus.eu/' },
    ],
    es: {
      slug: 'tipos-de-inundacion', title: 'Tipos de inundación',
      seoTitle: 'Tipos de inundación: repentina, fluvial, costera y urbana',
      desc: 'Las inundaciones repentinas, fluviales, costeras y urbanas: cómo se forman, cuánto avisan y qué es un período de retorno.',
      lead: 'No todas las inundaciones son iguales: algunas llegan en minutos y otras crecen durante días. Saber de qué tipo es ayuda a entender cuánto tiempo hay para actuar.',
      sections: [
        { h: 'Los tipos', list: [
          'Repentina (flash flood): por lluvias muy intensas en poco tiempo, en minutos u horas. Es la más peligrosa porque da poco aviso; afecta cauces secos, quebradas y ciudades. También puede deberse a la rotura de una presa.',
          'Fluvial: un río se desborda tras días de lluvia o deshielo en su cuenca. Crece más lento y puede pronosticarse con días de anticipación, como hace GloFAS.',
          'Costera: el mar entra en tierra por una marejada ciclónica, mareas muy altas con temporal o un tsunami.',
          'Urbana o pluvial: la lluvia supera la capacidad de los desagües y el agua se acumula en las calles.',
        ] },
        { h: 'Qué es un período de retorno', p: ['Una "crecida de 100 años" no ocurre una vez por siglo: es la que tiene un 1 % de probabilidad de ser superada en un año cualquiera. Puede haber dos seguidas. GloFAS usa los períodos de 2, 5 y 20 años para marcar qué tan excepcional es un caudal pronosticado.'] },
      ],
    },
    en: {
      slug: 'types-of-floods', title: 'Types of floods',
      seoTitle: 'Types of floods: flash, river, coastal and urban',
      desc: 'Flash, river, coastal and urban floods: how they form, how much warning they give, and what a return period is.',
      lead: 'Not all floods are alike: some arrive in minutes and others build over days. Knowing which kind it is helps understand how much time there is to act.',
      sections: [
        { h: 'The types', list: [
          'Flash flood: from very intense rain over a short time, within minutes or hours. The most dangerous because it gives little warning; it hits dry beds, ravines and cities. It can also come from a dam failure.',
          'River flood: a river overflows after days of rain or snowmelt in its basin. It rises more slowly and can be forecast days ahead, as GloFAS does.',
          'Coastal flood: the sea floods land through storm surge, very high tides with a storm, or a tsunami.',
          'Urban or pluvial flood: rain exceeds drainage capacity and water pools in the streets.',
        ] },
        { h: 'What a return period is', p: ['A "100-year flood" does not happen once a century: it is the flood with a 1% chance of being exceeded in any given year. Two can happen in a row. GloFAS uses 2-, 5- and 20-year return periods to show how exceptional a forecast flow is.'] },
      ],
    },
  },
  {
    id: 'flood-safety', topic: 'flood',
    sources: [
      { label: 'NWS · Turn Around Don’t Drown', url: 'https://www.weather.gov/safety/flood-turn-around-dont-drown' },
      { label: 'Ready.gov (FEMA) · Floods', url: 'https://www.ready.gov/floods' },
    ],
    es: {
      slug: 'que-hacer-ante-una-inundacion', title: 'Qué hacer ante una inundación',
      seoTitle: 'Qué hacer ante una inundación: no cruces el agua',
      desc: 'Cómo actuar ante una inundación: por qué nunca hay que cruzar agua en movimiento, adónde ir y qué cuidar después.',
      lead: 'Gran parte de las muertes por inundación ocurren en vehículos, al intentar cruzar calles o puentes con agua. La regla es simple: no cruces.',
      sections: [
        { h: 'Durante', list: [
          'No camines ni manejes por agua en movimiento: unos 15 cm pueden tirarte y unos 30 cm pueden arrastrar un auto.',
          'Andá a terreno alto si el agua sube. No te refugies en sótanos.',
          'Si el agua entra a tu casa, cortá la luz y el gas solo si podés hacerlo sin tocar agua.',
          'Seguí los avisos oficiales: las crecidas repentinas dan muy poco tiempo.',
        ] },
        { h: 'Después', list: [
          'No vuelvas hasta que las autoridades lo indiquen.',
          'El agua de inundación puede estar contaminada con cloacas, combustibles o químicos: evitá el contacto.',
          'No toques artefactos eléctricos mojados ni cables caídos.',
          'Revisá que la estructura de la casa esté sana antes de entrar.',
        ] },
        { h: 'Antes', list: [
          'Averiguá si tu casa está en zona inundable.',
          'Guardá documentos y objetos de valor en alto y en bolsas impermeables.',
        ] },
      ],
    },
    en: {
      slug: 'what-to-do-in-a-flood', title: 'What to do in a flood',
      seoTitle: 'What to do in a flood: do not cross the water',
      desc: 'How to act in a flood: why you should never cross moving water, where to go, and what to watch for afterwards.',
      lead: 'Many flood deaths happen in vehicles, when people try to cross flooded roads or bridges. The rule is simple: do not cross.',
      sections: [
        { h: 'During', list: [
          'Do not walk or drive through moving water: about 15 cm can knock you down and about 30 cm can sweep a car away.',
          'Go to higher ground if the water rises. Do not shelter in basements.',
          'If water enters your home, turn off power and gas only if you can do so without touching water.',
          'Follow official warnings: flash floods give very little time.',
        ] },
        { h: 'After', list: [
          'Do not return until authorities say so.',
          'Floodwater can be contaminated with sewage, fuel or chemicals: avoid contact.',
          'Do not touch wet electrical equipment or downed lines.',
          'Check that the structure of the house is sound before going in.',
        ] },
        { h: 'Before', list: [
          'Find out whether your home is in a flood zone.',
          'Keep documents and valuables up high and in waterproof bags.',
        ] },
      ],
    },
  },
  {
    id: 'drought-measure', topic: 'drought',
    sources: [
      { label: 'WMO/GWP IDMP · Standardized Precipitation Index (SPI)', url: 'https://droughtmanagement.info/standardized-precipitation-index-spi/' },
      { label: 'WMO/GWP IDMP · SPEI', url: 'https://www.droughtmanagement.info/standardized-precipitation-evapotranspiration-index-spei/' },
      { label: 'CSIC · SPEI Global Drought Monitor', url: 'https://spei.csic.es/' },
      { label: 'Copernicus · Global Drought Observatory', url: 'https://drought.emergency.copernicus.eu/' },
    ],
    es: {
      slug: 'como-se-mide-una-sequia', title: 'Cómo se mide una sequía (SPI, SPEI)',
      seoTitle: 'Cómo se mide una sequía: los índices SPI y SPEI explicados',
      desc: 'Cómo se mide una sequía con el índice de precipitación estandarizado (SPI) y el SPEI, y qué otros indicadores usan los observatorios.',
      lead: 'Una sequía no se mide en milímetros de lluvia: se mide en relación con lo que es normal en ese lugar. Por eso se usan índices estandarizados.',
      sections: [
        { h: 'El SPI', p: [
          'El índice de precipitación estandarizado (SPI) compara la lluvia acumulada en un período (1, 3, 6, 12 meses o más) con la historia de ese lugar y la expresa en desvíos respecto de lo normal. La Organización Meteorológica Mundial lo recomienda desde 2009 como índice básico.',
          'Un SPI de 0 es lo normal; de −1 a −1,49, moderadamente seco; de −1,5 a −1,99, severamente seco; −2 o menos, extremadamente seco.',
        ] },
        { h: 'El SPEI', p: ['El SPEI agrega la temperatura a través de la evapotranspiración: con más calor, el suelo y las plantas pierden más agua aunque llueva lo mismo. Por eso refleja mejor las sequías en un clima que se calienta.'] },
        { h: 'Otros indicadores', list: [
          'Humedad del suelo, estimada por modelos y satélites.',
          'Estado de la vegetación, con índices satelitales como el fAPAR.',
          'Índices combinados, como el del Observatorio Europeo de Sequías o el US Drought Monitor (categorías D0 a D4).',
          'El riesgo de impacto en la agricultura del Observatorio Global de Sequías, que combina la amenaza con la exposición y la vulnerabilidad; es el que muestra el atlas.',
        ] },
      ],
    },
    en: {
      slug: 'how-drought-is-measured', title: 'How drought is measured (SPI, SPEI)',
      seoTitle: 'How drought is measured: the SPI and SPEI explained',
      desc: 'How drought is measured with the Standardized Precipitation Index (SPI) and the SPEI, and what other indicators observatories use.',
      lead: 'Drought is not measured in millimeters of rain: it is measured relative to what is normal for that place. That is why standardized indices are used.',
      sections: [
        { h: 'The SPI', p: [
          'The Standardized Precipitation Index (SPI) compares the rain accumulated over a period (1, 3, 6, 12 months or more) with that place’s history and expresses it in deviations from normal. The World Meteorological Organization has recommended it as a basic index since 2009.',
          'An SPI of 0 is normal; −1 to −1.49, moderately dry; −1.5 to −1.99, severely dry; −2 or less, extremely dry.',
        ] },
        { h: 'The SPEI', p: ['The SPEI adds temperature through evapotranspiration: in hotter weather, soil and plants lose more water even with the same rain. That is why it better captures drought in a warming climate.'] },
        { h: 'Other indicators', list: [
          'Soil moisture, estimated by models and satellites.',
          'Vegetation condition, with satellite indices such as fAPAR.',
          'Combined indices, such as the European Drought Observatory’s or the US Drought Monitor (categories D0 to D4).',
          'The Global Drought Observatory’s risk of impact for agriculture, which combines hazard with exposure and vulnerability; it is the one the atlas shows.',
        ] },
      ],
    },
  },
  {
    id: 'drought-types', topic: 'drought',
    sources: [
      { label: 'NDMC · Types of drought', url: 'https://drought.unl.edu/Education/DroughtIn-depth/TypesofDrought.aspx' },
      { label: 'WHO · Drought', url: 'https://www.who.int/news-room/fact-sheets/detail/drought' },
    ],
    es: {
      slug: 'tipos-de-sequia', title: 'Tipos de sequía',
      seoTitle: 'Tipos de sequía: meteorológica, agrícola, hidrológica y socioeconómica',
      desc: 'Los cuatro tipos de sequía, cómo se encadenan y qué es una sequía repentina.',
      lead: 'Una sequía empieza con falta de lluvia y, si dura, se va extendiendo: del cielo al suelo, del suelo a los ríos y de los ríos a la economía.',
      sections: [
        { h: 'Los cuatro tipos', list: [
          'Meteorológica: llueve bastante menos de lo normal durante un período.',
          'Agrícola: falta humedad en el suelo para los cultivos y el pasto, aunque la lluvia haya vuelto a ser normal hace poco.',
          'Hidrológica: bajan los ríos, embalses, lagos y napas. Es la que más tarda en aparecer y en recuperarse.',
          'Socioeconómica: la falta de agua afecta la producción, el abastecimiento y los precios.',
        ] },
        { h: 'Sequía repentina', p: ['Algunas sequías se intensifican en pocas semanas, por calor extremo, viento y falta de lluvia juntos: se llaman sequías repentinas (flash droughts) y pueden arruinar una cosecha antes de que se note en los índices de largo plazo.'] },
        { h: 'Por qué es un desastre lento', p: ['A diferencia de un sismo, una sequía no tiene un momento de inicio claro y puede durar años. Afecta a la salud, la alimentación y el agua potable de muchas personas, según la Organización Mundial de la Salud.'] },
      ],
    },
    en: {
      slug: 'types-of-drought', title: 'Types of drought',
      seoTitle: 'Types of drought: meteorological, agricultural, hydrological and socioeconomic',
      desc: 'The four types of drought, how they chain together, and what a flash drought is.',
      lead: 'Drought begins with a lack of rain and, if it lasts, spreads: from the sky to the soil, from the soil to rivers and from rivers to the economy.',
      sections: [
        { h: 'The four types', list: [
          'Meteorological: much less rain than normal over a period.',
          'Agricultural: not enough soil moisture for crops and pasture, even if rain has recently returned to normal.',
          'Hydrological: rivers, reservoirs, lakes and groundwater drop. It takes longest to appear and to recover.',
          'Socioeconomic: water shortage affects production, supply and prices.',
        ] },
        { h: 'Flash drought', p: ['Some droughts intensify within a few weeks, from extreme heat, wind and lack of rain together: these are flash droughts, and they can ruin a harvest before long-term indices show it.'] },
        { h: 'Why it is a slow disaster', p: ['Unlike an earthquake, a drought has no clear start and can last years. It affects the health, food and drinking water of many people, according to the World Health Organization.'] },
      ],
    },
  },
  {
    id: 'not-natural', topic: 'general', figures: ['risk'],
    sources: [
      { label: 'UNDRR · Terminology', url: 'https://www.undrr.org/terminology' },
      { label: 'UNDRR · Disaster', url: 'https://www.undrr.org/terminology/disaster' },
      { label: 'UNDRR · Hazard', url: 'https://www.undrr.org/terminology/hazard' },
    ],
    es: {
      slug: 'por-que-los-desastres-no-son-naturales', title: 'Por qué los desastres no son "naturales"',
      seoTitle: 'Por qué los desastres no son naturales: amenaza, exposición y vulnerabilidad',
      desc: 'La diferencia entre una amenaza natural y un desastre, según las Naciones Unidas: amenaza, exposición, vulnerabilidad y capacidad.',
      lead: 'Un terremoto es un fenómeno natural; que derrumbe una ciudad, no. Las Naciones Unidas distinguen la amenaza del desastre, que depende de cómo vivimos y construimos.',
      sections: [
        { h: 'Amenaza y desastre', p: ['Para la Oficina de las Naciones Unidas para la Reducción del Riesgo de Desastres (UNDRR), un desastre es una alteración grave del funcionamiento de una comunidad causada por un fenómeno peligroso que se combina con la exposición, la vulnerabilidad y la capacidad de esa comunidad.'] },
        { h: 'Los componentes del riesgo', list: [
          'Amenaza: el fenómeno que puede causar daño (un sismo, un huracán).',
          'Exposición: las personas, viviendas e infraestructura que están en la zona.',
          'Vulnerabilidad: qué tan susceptibles son a sufrir daño (construcciones precarias, pobreza, falta de alerta).',
          'Capacidad: los recursos para prepararse, responder y recuperarse.',
        ] },
        { h: 'Por qué importa', p: ['Dos sismos de igual magnitud pueden tener consecuencias muy distintas según dónde ocurran y cómo se construyó. Por eso el mapa de amenaza sísmica del atlas se llama "amenaza" y no "riesgo": no tiene en cuenta la población ni los edificios. Reducir la exposición y la vulnerabilidad, con normas de construcción, alertas y planificación, es lo que convierte una amenaza en un evento sin víctimas.'] },
      ],
    },
    en: {
      slug: 'why-disasters-are-not-natural', title: 'Why disasters are not "natural"',
      seoTitle: 'Why disasters are not natural: hazard, exposure and vulnerability',
      desc: 'The difference between a natural hazard and a disaster, according to the United Nations: hazard, exposure, vulnerability and capacity.',
      lead: 'An earthquake is a natural phenomenon; a city collapsing is not. The United Nations distinguishes the hazard from the disaster, which depends on how we live and build.',
      sections: [
        { h: 'Hazard and disaster', p: ['For the UN Office for Disaster Risk Reduction (UNDRR), a disaster is a serious disruption of the functioning of a community caused by a hazardous event interacting with that community’s exposure, vulnerability and capacity.'] },
        { h: 'The components of risk', list: [
          'Hazard: the phenomenon that can cause harm (an earthquake, a hurricane).',
          'Exposure: the people, homes and infrastructure in the area.',
          'Vulnerability: how susceptible they are to harm (poor construction, poverty, lack of warning).',
          'Capacity: the resources to prepare, respond and recover.',
        ] },
        { h: 'Why it matters', p: ['Two earthquakes of the same magnitude can have very different consequences depending on where they strike and how buildings were made. That is why the atlas’s seismic hazard map is called "hazard" and not "risk": it does not account for population or buildings. Reducing exposure and vulnerability, through building codes, warnings and planning, is what turns a hazard into an event without victims.'] },
      ],
    },
  },
  {
    id: 'read-the-map', topic: 'general',
    sources: [
      { label: 'USGS · Earthquake Hazards Program', url: 'https://www.usgs.gov/programs/earthquake-hazards' },
      { label: 'NASA · EONET', url: 'https://eonet.gsfc.nasa.gov/' },
      { label: 'GDACS', url: 'https://www.gdacs.org/' },
    ],
    es: {
      slug: 'como-leer-este-mapa', title: 'Cómo leer este mapa',
      seoTitle: 'Cómo leer el mapa del Atlas de Desastres',
      desc: 'Qué significa cada símbolo, color y tamaño del mapa, de dónde vienen los datos y por qué pueden cambiar.',
      lead: 'El mapa muestra eventos publicados por organismos oficiales y científicos. Cada símbolo es un evento y cada evento enlaza su fuente.',
      sections: [
        { h: 'Símbolos', list: [
          'Círculo naranja: sismo; el tamaño crece con la magnitud.',
          'Triángulo: volcán. Rombo: incendio forestal. Cuadrado: ciclón o tormenta. Triángulo invertido: inundación. Cruz: sequía.',
          'Anillo alrededor: sismo de magnitud 6 o más, o alerta oficial naranja o roja (GDACS o USGS PAGER).',
        ] },
        { h: 'Tiempo', list: [
          'Arriba a la izquierda se elige el período (24 h, 7 días, 30 días, un año o un año calendario).',
          'La línea de tiempo de abajo muestra cuántos eventos hubo en cada tramo; se puede tocar un tramo, arrastrar o reproducir.',
        ] },
        { h: 'Capas', p: ['En "Capas de referencia" se encienden placas tectónicas, amenaza sísmica, volcanes, ciclones activos con su cono, focos de calor y trayectorias históricas. Cada capa dice su fuente debajo del nombre.'] },
        { h: 'Por qué los datos cambian', list: [
          'Los sismos tienen primero una solución automática ("preliminar") que un sismólogo revisa después.',
          'Las alertas de GDACS se actualizan con cada episodio de un evento.',
          'Algunas fuentes tardan horas en publicar: el atlas muestra la hora de la última actualización.',
        ] },
      ],
    },
    en: {
      slug: 'how-to-read-this-map', title: 'How to read this map',
      seoTitle: 'How to read the Disaster Atlas map',
      desc: 'What each symbol, color and size on the map means, where the data come from, and why they can change.',
      lead: 'The map shows events published by official and scientific agencies. Each symbol is an event and each event links to its source.',
      sections: [
        { h: 'Symbols', list: [
          'Orange circle: earthquake; size grows with magnitude.',
          'Triangle: volcano. Diamond: wildfire. Square: cyclone or storm. Inverted triangle: flood. Cross: drought.',
          'Ring around it: magnitude 6 or greater earthquake, or official orange or red alert (GDACS or USGS PAGER).',
        ] },
        { h: 'Time', list: [
          'Top left, choose the period (24 h, 7 days, 30 days, one year or a calendar year).',
          'The timeline at the bottom shows how many events occurred in each step; tap a step, drag, or press play.',
        ] },
        { h: 'Layers', p: ['Under "Reference layers" you can turn on tectonic plates, seismic hazard, volcanoes, active cyclones with their cone, hotspots and historical tracks. Each layer states its source under its name.'] },
        { h: 'Why data change', list: [
          'Earthquakes first get an automatic ("preliminary") solution that a seismologist reviews later.',
          'GDACS alerts are updated with each episode of an event.',
          'Some sources take hours to publish: the atlas shows the time of the latest update.',
        ] },
      ],
    },
  },
  {
    id: 'glossary', topic: 'general',
    sources: [
      { label: 'UNDRR · Terminology', url: 'https://www.undrr.org/terminology' },
      { label: 'NOAA NHC · Glossary', url: 'https://www.nhc.noaa.gov/aboutgloss.shtml' },
      { label: 'USGS · This Dynamic Earth', url: 'https://pubs.usgs.gov/gip/dynamic/dynamic.html' },
    ],
    es: {
      slug: 'glosario', title: 'Glosario',
      seoTitle: 'Glosario de desastres naturales: términos de sismos, volcanes, ciclones y más',
      desc: 'Definiciones breves de los términos que aparecen en el atlas: epicentro, magnitud, subducción, VEI, marejada ciclónica, FRP, período de retorno y más.',
      lead: 'Definiciones breves de los términos que aparecen en las fichas del atlas.',
      sections: [
        { h: 'Riesgo', table: { head: ['Término', 'Definición'], rows: [
          ['Amenaza', 'Fenómeno que puede causar daño a personas, bienes o al ambiente.'],
          ['Exposición', 'Personas y bienes ubicados en zonas donde puede ocurrir una amenaza.'],
          ['Vulnerabilidad', 'Condiciones que hacen más probable sufrir daño ante una amenaza.'],
          ['Riesgo', 'Daño que podría ocurrir; combina amenaza, exposición y vulnerabilidad.'],
        ] } },
        { h: 'Sismos y tsunamis', table: { head: ['Término', 'Definición'], rows: [
          ['Hipocentro', 'Punto en profundidad donde empieza la ruptura de un sismo.'],
          ['Epicentro', 'Punto de la superficie justo encima del hipocentro.'],
          ['Magnitud', 'Tamaño del sismo en su origen; un solo valor por sismo.'],
          ['Intensidad', 'Cuánto se sacudió y qué daños hubo en cada lugar (escala de Mercalli).'],
          ['Réplica', 'Sismo menor que sigue a uno mayor en la misma zona.'],
          ['Subducción', 'Hundimiento de una placa tectónica debajo de otra.'],
          ['Mecanismo focal', 'Orientación de la falla y sentido del movimiento de un sismo.'],
          ['Run-up', 'Altura máxima que alcanza el agua de un tsunami en tierra.'],
        ] } },
        { h: 'Volcanes', table: { head: ['Término', 'Definición'], rows: [
          ['VEI', 'Índice de explosividad volcánica, de 0 a 8.'],
          ['Lahar', 'Flujo de barro y rocas que baja por los valles de un volcán.'],
          ['Flujo piroclástico', 'Nube de gas, ceniza y rocas a cientos de grados que avanza a gran velocidad.'],
          ['Tefra', 'Fragmentos expulsados por una erupción: ceniza, pómez, bombas.'],
        ] } },
        { h: 'Ciclones, incendios, inundaciones y sequías', table: { head: ['Término', 'Definición'], rows: [
          ['Marejada ciclónica', 'Subida anormal del mar empujada por el viento de un ciclón.'],
          ['Cono de pronóstico', 'Zona donde probablemente estará el centro de un ciclón.'],
          ['Foco de calor', 'Punto mucho más caliente que su entorno detectado por satélite.'],
          ['FRP', 'Potencia radiativa del fuego, en megavatios.'],
          ['FWI', 'Índice meteorológico de peligro de incendio.'],
          ['Período de retorno', 'Inversa de la probabilidad anual: una crecida de 100 años tiene 1 % de chance por año.'],
          ['SPI', 'Índice de precipitación estandarizado: lluvia comparada con lo normal del lugar.'],
        ] } },
      ],
    },
    en: {
      slug: 'glossary', title: 'Glossary',
      seoTitle: 'Natural disaster glossary: earthquake, volcano, cyclone terms and more',
      desc: 'Short definitions of the terms used in the atlas: epicenter, magnitude, subduction, VEI, storm surge, FRP, return period and more.',
      lead: 'Short definitions of the terms that appear on the atlas pages.',
      sections: [
        { h: 'Risk', table: { head: ['Term', 'Definition'], rows: [
          ['Hazard', 'A phenomenon that can cause harm to people, property or the environment.'],
          ['Exposure', 'People and property located where a hazard can occur.'],
          ['Vulnerability', 'Conditions that make harm more likely when a hazard strikes.'],
          ['Risk', 'The harm that could occur; it combines hazard, exposure and vulnerability.'],
        ] } },
        { h: 'Earthquakes and tsunamis', table: { head: ['Term', 'Definition'], rows: [
          ['Hypocenter', 'The point at depth where an earthquake rupture begins.'],
          ['Epicenter', 'The point on the surface directly above the hypocenter.'],
          ['Magnitude', 'The size of the earthquake at its source; a single value per earthquake.'],
          ['Intensity', 'How strongly each place shook and what damage occurred (Mercalli scale).'],
          ['Aftershock', 'A smaller earthquake that follows a larger one in the same area.'],
          ['Subduction', 'The sinking of one tectonic plate beneath another.'],
          ['Focal mechanism', 'The orientation of the fault and direction of slip of an earthquake.'],
          ['Run-up', 'The maximum height tsunami water reaches on land.'],
        ] } },
        { h: 'Volcanoes', table: { head: ['Term', 'Definition'], rows: [
          ['VEI', 'Volcanic Explosivity Index, from 0 to 8.'],
          ['Lahar', 'A flow of mud and rock down a volcano’s valleys.'],
          ['Pyroclastic flow', 'A cloud of gas, ash and rock at hundreds of degrees moving at high speed.'],
          ['Tephra', 'Fragments ejected by an eruption: ash, pumice, bombs.'],
        ] } },
        { h: 'Cyclones, fires, floods and droughts', table: { head: ['Term', 'Definition'], rows: [
          ['Storm surge', 'An abnormal rise of the sea pushed by a cyclone’s winds.'],
          ['Forecast cone', 'The area where a cyclone’s center will probably be.'],
          ['Hotspot', 'A point much hotter than its surroundings detected by satellite.'],
          ['FRP', 'Fire radiative power, in megawatts.'],
          ['FWI', 'Fire Weather Index, a weather-based fire danger index.'],
          ['Return period', 'Inverse of annual probability: a 100-year flood has a 1% chance each year.'],
          ['SPI', 'Standardized Precipitation Index: rain compared with what is normal for the place.'],
        ] } },
      ],
    },
  },
];
