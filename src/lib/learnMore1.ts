import type { LearnArticle } from './learn';

/* Aprender · sismos (3 más), volcanes y tsunamis. Fuentes oficiales al pie de cada uno. */

export const MORE_1: LearnArticle[] = [
  {
    id: 'plate-tectonics', topic: 'eq', figures: ['volc-subduction', 'volc-rift'],
    sources: [
      { label: 'USGS · This Dynamic Earth: The Story of Plate Tectonics', url: 'https://pubs.usgs.gov/gip/dynamic/dynamic.html' },
      { label: 'Bird (2003) · PB2002, modelo de bordes de placa', url: 'https://doi.org/10.1029/2001GC000252' },
      { label: 'Argus, Gordon y DeMets (2011) · NNR-MORVEL56', url: 'https://doi.org/10.1029/2011GC003751' },
    ],
    es: {
      slug: 'tectonica-de-placas', title: 'Tectónica de placas',
      seoTitle: 'Tectónica de placas: por qué tiembla y hay volcanes donde los hay',
      desc: 'Qué son las placas tectónicas, cómo se mueven y por qué casi todos los sismos y volcanes están en sus bordes.',
      lead: 'La capa externa y rígida de la Tierra, la litosfera, está partida en placas que se mueven unos centímetros por año. Donde chocan, se separan o se deslizan, la Tierra tiembla y nacen volcanes.',
      sections: [
        { h: 'Placas que se mueven', p: [
          'La litosfera tiene unos 100 km de espesor y está dividida en una docena de placas grandes y varias decenas de placas chicas: el modelo PB2002 que usa este atlas distingue 52. Flotan sobre el manto, más caliente y plástico, y se mueven entre 1 y 10 centímetros por año, más o menos lo que crecen las uñas.',
          'Hoy ese movimiento se mide con GPS y se resume en modelos como NNR-MORVEL56, con el que el atlas calcula, en la ficha de cada sismo, a qué velocidad se acercan o se separan las placas.',
        ] },
        { h: 'Tres tipos de borde', list: [
          'Convergente: las placas se acercan. Si una es oceánica, se hunde debajo de la otra (subducción), como Nazca bajo Sudamérica; si las dos son continentales, chocan y levantan cordilleras, como el Himalaya.',
          'Divergente: las placas se separan y el manto sube a rellenar el hueco. Pasa en las dorsales del fondo del mar y en los rifts continentales, como el de África oriental.',
          'Transformante: las placas se deslizan de costado, una al lado de la otra, como en la falla de San Andrés.',
        ] },
        { h: 'Por qué importa', p: [
          'Casi todos los sismos y volcanes están en los bordes de placa. El Cinturón de Fuego del Pacífico, una cadena de zonas de subducción alrededor de ese océano, concentra alrededor del 80 % de los sismos más grandes del planeta según el USGS.',
          'Los sismos más grandes registrados, como el de Valdivia (Chile, 1960, M 9,5), ocurrieron en el contacto entre dos placas en una zona de subducción.',
        ] },
      ],
    },
    en: {
      slug: 'plate-tectonics', title: 'Plate tectonics',
      seoTitle: 'Plate tectonics: why earthquakes and volcanoes happen where they do',
      desc: 'What tectonic plates are, how they move, and why almost all earthquakes and volcanoes are at their boundaries.',
      lead: 'Earth’s rigid outer shell, the lithosphere, is broken into plates that move a few centimeters a year. Where they collide, pull apart or slide past each other, the ground shakes and volcanoes form.',
      sections: [
        { h: 'Moving plates', p: [
          'The lithosphere is about 100 km thick and divided into a dozen large plates and several dozen small ones: the PB2002 model this atlas uses distinguishes 52. They ride on the hotter, plastic mantle and move between 1 and 10 centimeters a year, roughly as fast as fingernails grow.',
          'That motion is now measured with GPS and summarized in models such as NNR-MORVEL56, which the atlas uses on each earthquake page to compute how fast the plates are converging or separating.',
        ] },
        { h: 'Three kinds of boundary', list: [
          'Convergent: plates move together. If one is oceanic, it sinks beneath the other (subduction), like Nazca under South America; if both are continental, they collide and raise mountains, like the Himalaya.',
          'Divergent: plates move apart and the mantle rises to fill the gap. This happens at mid-ocean ridges and continental rifts such as East Africa’s.',
          'Transform: plates slide sideways past each other, as on the San Andreas fault.',
        ] },
        { h: 'Why it matters', p: [
          'Almost all earthquakes and volcanoes are at plate boundaries. The Pacific Ring of Fire, a chain of subduction zones around that ocean, hosts about 80% of the planet’s largest earthquakes according to the USGS.',
          'The largest earthquakes on record, such as Valdivia (Chile, 1960, M 9.5), happened on the contact between two plates in a subduction zone.',
        ] },
      ],
    },
  },
  {
    id: 'fault-types', topic: 'eq', figures: ['fault-reverse', 'fault-normal', 'fault-ss'],
    sources: [
      { label: 'USGS · Faults', url: 'https://www.usgs.gov/programs/earthquake-hazards/faults' },
      { label: 'USGS · This Dynamic Earth', url: 'https://pubs.usgs.gov/gip/dynamic/dynamic.html' },
    ],
    es: {
      slug: 'tipos-de-falla', title: 'Tipos de falla',
      seoTitle: 'Tipos de falla: inversa, normal y de rumbo (y cómo leer la "pelota de playa")',
      desc: 'Qué es una falla inversa, una normal y una de rumbo, qué movimiento produce cada una y cómo se leen en el mecanismo focal de un sismo.',
      lead: 'Una falla es una fractura en la roca donde los dos lados se mueven uno respecto del otro. Según hacia dónde se muevan, hay tres tipos básicos.',
      sections: [
        { h: 'Falla inversa (compresión)', p: ['La roca se acorta: un bloque sube sobre el otro. Es el tipo de falla de las zonas de subducción, donde se producen los sismos más grandes y los que generan tsunamis, porque levantan el fondo del mar.'] },
        { h: 'Falla normal (extensión)', p: ['La corteza se estira y un bloque baja respecto del otro. Es típica de los rifts y de las dorsales, y también aparece dentro de la placa que se hunde en una subducción, a mayor profundidad.'] },
        { h: 'Falla de rumbo o transcurrente', p: ['Los bloques se deslizan de costado, casi sin subir ni bajar. Si mirás la falla y el otro lado se movió hacia la derecha, es "dextral"; hacia la izquierda, "sinestral". La de San Andrés, en California, es dextral.'] },
        { h: 'Cómo leer la "pelota de playa"', p: [
          'Para los sismos medianos y grandes, el USGS calcula el mecanismo focal: la orientación de la falla y el sentido del movimiento. Se dibuja como un círculo con zonas sombreadas (donde el terreno se comprimió al paso de las ondas) y blancas.',
          'Si el centro está sombreado, la falla es inversa; si el centro está en blanco y las zonas sombreadas en los costados, es normal; si se ve una cruz de cuatro cuadrantes, es de rumbo. Muchos sismos combinan movimientos (falla oblicua).',
        ] },
      ],
    },
    en: {
      slug: 'fault-types', title: 'Types of faults',
      seoTitle: 'Types of faults: reverse, normal and strike-slip (and how to read the "beach ball")',
      desc: 'What reverse, normal and strike-slip faults are, what motion each produces, and how to read them in an earthquake’s focal mechanism.',
      lead: 'A fault is a fracture in rock where the two sides move relative to each other. Depending on the direction of motion, there are three basic types.',
      sections: [
        { h: 'Reverse fault (compression)', p: ['The rock shortens: one block rides up over the other. This is the fault type of subduction zones, which produce the largest earthquakes and those that generate tsunamis, because they lift the seafloor.'] },
        { h: 'Normal fault (extension)', p: ['The crust stretches and one block drops relative to the other. Typical of rifts and ridges, and also found inside the sinking plate in a subduction zone, at greater depth.'] },
        { h: 'Strike-slip fault', p: ['The blocks slide sideways with little up or down motion. If you face the fault and the other side moved to the right, it is "right-lateral"; to the left, "left-lateral". California’s San Andreas is right-lateral.'] },
        { h: 'How to read the "beach ball"', p: [
          'For medium and large earthquakes the USGS computes the focal mechanism: the orientation of the fault and the direction of slip. It is drawn as a circle with shaded areas (where the ground was compressed as the waves passed) and white areas.',
          'If the center is shaded, the fault is reverse; if the center is white with shaded sides, it is normal; if you see a four-quadrant cross, it is strike-slip. Many earthquakes mix motions (oblique fault).',
        ] },
      ],
    },
  },
  {
    id: 'aftershocks', topic: 'eq',
    sources: [
      { label: 'USGS · Aftershock Forecasts', url: 'https://earthquake.usgs.gov/data/oaf/' },
      { label: 'USGS · Aftershock forecast overview', url: 'https://earthquake.usgs.gov/data/oaf/overview.php' },
      { label: 'Great ShakeOut · Drop, Cover, and Hold On', url: 'https://www.shakeout.org/dropcoverholdon/' },
    ],
    es: {
      slug: 'por-que-hay-replicas', title: 'Por qué hay réplicas',
      seoTitle: 'Réplicas: por qué siguen temblando después de un terremoto',
      desc: 'Qué son las réplicas, por qué ocurren, cuánto duran y cómo se pronostican.',
      lead: 'Después de un sismo grande, la zona sigue temblando durante días, meses o incluso años. Son las réplicas: la corteza se reacomoda al cambio que produjo la ruptura.',
      sections: [
        { h: 'Por qué ocurren', p: ['Cuando una falla se rompe, cambian los esfuerzos en la roca de alrededor. Algunas partes quedan más cargadas y terminan rompiéndose también, en general cerca de la ruptura principal y en las primeras horas o días.'] },
        { h: 'Cuántas y por cuánto tiempo', list: [
          'Son más frecuentes al principio y se vuelven cada vez más raras: el número de réplicas cae aproximadamente en proporción inversa al tiempo transcurrido (ley de Omori).',
          'La réplica más grande suele ser alrededor de 1 punto de magnitud menor que el sismo principal, aunque hay excepciones.',
          'En sismos muy grandes, las réplicas fuertes pueden seguir durante años.',
        ] },
        { h: '¿Puede venir uno más grande?', p: ['Sí, en una minoría de los casos el sismo resulta ser el anticipo de otro mayor. Por eso el USGS publica pronósticos de réplicas con probabilidades para el próximo día, semana, mes y año; en la ficha de los sismos grandes del atlas se muestran tal como los publica.'] },
        { h: 'Qué hacer', list: [
          'Ante cada réplica fuerte: agacharse, cubrirse y sujetarse.',
          'No volver a edificios dañados: una réplica puede terminar de derribarlos.',
          'Seguir la información oficial: los pronósticos se actualizan a medida que llegan datos.',
        ] },
      ],
    },
    en: {
      slug: 'why-aftershocks', title: 'Why aftershocks happen',
      seoTitle: 'Aftershocks: why the ground keeps shaking after a big earthquake',
      desc: 'What aftershocks are, why they happen, how long they last and how they are forecast.',
      lead: 'After a large earthquake the area keeps shaking for days, months or even years. These are aftershocks: the crust readjusting to the change caused by the rupture.',
      sections: [
        { h: 'Why they happen', p: ['When a fault ruptures, the stresses in the surrounding rock change. Some parts become more loaded and eventually break too, usually close to the main rupture and in the first hours or days.'] },
        { h: 'How many and for how long', list: [
          'They are most frequent at first and become rarer over time: the number of aftershocks falls roughly in inverse proportion to elapsed time (Omori’s law).',
          'The largest aftershock is usually about 1 magnitude unit smaller than the mainshock, though there are exceptions.',
          'After very large earthquakes, strong aftershocks can continue for years.',
        ] },
        { h: 'Can a bigger one follow?', p: ['Yes: in a minority of cases the earthquake turns out to be a foreshock of a larger one. That is why the USGS publishes aftershock forecasts with probabilities for the next day, week, month and year; the atlas shows them on large-earthquake pages exactly as published.'] },
        { h: 'What to do', list: [
          'During each strong aftershock: drop, cover and hold on.',
          'Do not go back into damaged buildings: an aftershock can bring them down.',
          'Follow official information: forecasts are updated as data come in.',
        ] },
      ],
    },
  },
  {
    id: 'volcano-types', topic: 'volcano', figures: ['volc-subduction', 'volc-rift', 'volc-intraplate'],
    sources: [
      { label: 'USGS Volcano Hazards Program', url: 'https://www.usgs.gov/programs/VHP' },
      { label: 'Smithsonian Global Volcanism Program', url: 'https://volcano.si.edu/' },
      { label: 'USGS · This Dynamic Earth', url: 'https://pubs.usgs.gov/gip/dynamic/dynamic.html' },
    ],
    es: {
      slug: 'tipos-de-volcanes', title: 'Tipos de volcanes y de vulcanismo',
      seoTitle: 'Tipos de volcanes y de vulcanismo: subducción, rift y punto caliente',
      desc: 'Por qué hay volcanes donde los hay (subducción, rift y punto caliente) y qué forma toman: estratovolcanes, escudos, calderas y domos.',
      lead: 'Hay volcanes donde el magma encuentra camino hacia la superficie. Eso pasa sobre todo en tres ambientes, y cada uno produce un tipo de magma y de erupción distinto.',
      sections: [
        { h: 'Subducción', p: ['Una placa oceánica se hunde bajo otra y, al bajar, libera agua que hace fundir el manto. El magma es rico en sílice y gases, viscoso, y da erupciones explosivas: son los volcanes de los Andes, Centroamérica, Japón, Indonesia o Alaska.'] },
        { h: 'Rift o dorsal', p: ['Donde las placas se separan, el manto sube y se funde al bajar la presión. El magma es basáltico y fluido. La mayor parte del magma que sale a la superficie de la Tierra lo hace en las dorsales del fondo del mar, sin que lo veamos; en tierra, Islandia y el Rift de África oriental son ejemplos.'] },
        { h: 'Punto caliente (intraplaca)', p: ['Lejos de los bordes, una pluma de manto muy caliente funde la placa que pasa por encima. Como la placa se mueve y el punto caliente casi no, se forma una cadena de volcanes cada vez más viejos, como las islas de Hawái.'] },
        { h: 'Formas de volcán', list: [
          'Estratovolcán: cono alto y empinado de capas de lava y ceniza (Villarrica, Fuji, Popocatépetl).',
          'Volcán en escudo: amplio y de pendiente suave, hecho de coladas de lava fluida (Mauna Loa, Kīlauea).',
          'Caldera: depresión que se forma cuando el techo del volcán se hunde tras vaciarse la cámara de magma.',
          'Domo de lava: montículo de lava muy viscosa que se acumula sobre la boca.',
          'Campo volcánico y conos de escoria: muchos conos chicos, cada uno de una sola erupción.',
        ] },
      ],
    },
    en: {
      slug: 'types-of-volcanoes', title: 'Types of volcanoes and volcanism',
      seoTitle: 'Types of volcanoes and volcanism: subduction, rift and hotspot',
      desc: 'Why volcanoes are where they are (subduction, rift and hotspot) and the shapes they take: stratovolcanoes, shields, calderas and domes.',
      lead: 'Volcanoes form where magma finds a way to the surface. That happens mostly in three settings, each producing a different kind of magma and eruption.',
      sections: [
        { h: 'Subduction', p: ['An oceanic plate sinks beneath another and, as it goes down, releases water that melts the mantle. The magma is rich in silica and gas, viscous, and erupts explosively: these are the volcanoes of the Andes, Central America, Japan, Indonesia or Alaska.'] },
        { h: 'Rift or ridge', p: ['Where plates pull apart, the mantle rises and melts as pressure drops. The magma is basaltic and fluid. Most of the magma reaching Earth’s surface comes out at mid-ocean ridges, unseen; on land, Iceland and the East African Rift are examples.'] },
        { h: 'Hotspot (intraplate)', p: ['Far from plate boundaries, a plume of very hot mantle melts the plate moving above it. Because the plate moves and the hotspot barely does, a chain of ever-older volcanoes forms, like the Hawaiian Islands.'] },
        { h: 'Volcano shapes', list: [
          'Stratovolcano: a tall, steep cone of lava and ash layers (Villarrica, Fuji, Popocatépetl).',
          'Shield volcano: broad and gently sloping, built from fluid lava flows (Mauna Loa, Kīlauea).',
          'Caldera: a depression formed when the volcano’s roof collapses after the magma chamber empties.',
          'Lava dome: a mound of very viscous lava piled over the vent.',
          'Volcanic field and cinder cones: many small cones, each from a single eruption.',
        ] },
      ],
    },
  },
  {
    id: 'vei', topic: 'volcano',
    sources: [
      { label: 'Newhall y Self (1982) · The Volcanic Explosivity Index', url: 'https://doi.org/10.1029/JC087iC02p01231' },
      { label: 'Smithsonian Global Volcanism Program', url: 'https://volcano.si.edu/' },
    ],
    es: {
      slug: 'escala-vei', title: 'Escala VEI',
      seoTitle: 'Escala VEI: cómo se mide el tamaño de una erupción volcánica',
      desc: 'Qué es el índice de explosividad volcánica (VEI), del 0 al 8, con ejemplos reales de cada nivel.',
      lead: 'El índice de explosividad volcánica (VEI, por sus siglas en inglés) mide el tamaño de una erupción explosiva, sobre todo por el volumen de material que expulsa. Va de 0 a 8.',
      sections: [
        { h: 'Cómo funciona', p: [
          'Se basa en el volumen de tefra (ceniza, pómez y fragmentos) y en la altura de la columna eruptiva. Desde el VEI 2, cada punto significa unas 10 veces más material que el anterior: un VEI 6 expulsa unas 100 veces más que un VEI 4.',
          'Las erupciones efusivas, que derraman lava sin explotar, tienen VEI 0 o 1 aunque cubran grandes áreas: la escala mide la explosividad, no el daño.',
        ] },
        { h: 'Niveles y ejemplos', table: { head: ['VEI', 'Material expulsado', 'Ejemplo'], rows: [
          ['0', 'menos de 10.000 m³', 'Kīlauea (coladas de lava)'], ['1', '10.000 m³ – 1 millón de m³', 'Stromboli'],
          ['2', '1 – 10 millones de m³', 'Galeras, Colombia (1993)'], ['3', '10 – 100 millones de m³', 'Nevado del Ruiz, Colombia (1985)'],
          ['4', '0,1 – 1 km³', 'Eyjafjallajökull, Islandia (2010)'], ['5', '1 – 10 km³', 'Monte Santa Helena, EE. UU. (1980)'],
          ['6', '10 – 100 km³', 'Pinatubo, Filipinas (1991)'], ['7', '100 – 1.000 km³', 'Tambora, Indonesia (1815)'],
          ['8', 'más de 1.000 km³', 'Yellowstone, EE. UU. (hace unos 640.000 años)'],
        ] } },
        { h: 'Qué tan frecuentes son', p: ['Las erupciones chicas son muy comunes y las grandes, raras: hay erupciones de VEI 2 casi todas las semanas en algún lugar del mundo, mientras que las de VEI 7 ocurren pocas veces por milenio. Las de VEI 8 son tan raras que no hubo ninguna en la historia escrita.'] },
        { h: 'Un dato con matices', p: ['Una erupción chica también puede ser letal: en 1985, una erupción de VEI 3 del Nevado del Ruiz derritió parte del glaciar y produjo lahares que arrasaron la ciudad de Armero.'] },
      ],
    },
    en: {
      slug: 'vei-scale', title: 'The VEI scale',
      seoTitle: 'The VEI scale: how the size of a volcanic eruption is measured',
      desc: 'What the Volcanic Explosivity Index (VEI) is, from 0 to 8, with real examples of each level.',
      lead: 'The Volcanic Explosivity Index (VEI) measures the size of an explosive eruption, mainly by the volume of material it ejects. It runs from 0 to 8.',
      sections: [
        { h: 'How it works', p: [
          'It is based on the volume of tephra (ash, pumice and fragments) and the height of the eruption column. From VEI 2 on, each step means about 10 times more material than the one before: a VEI 6 ejects about 100 times more than a VEI 4.',
          'Effusive eruptions, which pour out lava without exploding, rate VEI 0 or 1 even when they cover large areas: the scale measures explosivity, not damage.',
        ] },
        { h: 'Levels and examples', table: { head: ['VEI', 'Erupted material', 'Example'], rows: [
          ['0', 'under 10,000 m³', 'Kīlauea (lava flows)'], ['1', '10,000 m³ – 1 million m³', 'Stromboli'],
          ['2', '1 – 10 million m³', 'Galeras, Colombia (1993)'], ['3', '10 – 100 million m³', 'Nevado del Ruiz, Colombia (1985)'],
          ['4', '0.1 – 1 km³', 'Eyjafjallajökull, Iceland (2010)'], ['5', '1 – 10 km³', 'Mount St. Helens, USA (1980)'],
          ['6', '10 – 100 km³', 'Pinatubo, Philippines (1991)'], ['7', '100 – 1,000 km³', 'Tambora, Indonesia (1815)'],
          ['8', 'over 1,000 km³', 'Yellowstone, USA (about 640,000 years ago)'],
        ] } },
        { h: 'How often they happen', p: ['Small eruptions are very common and large ones rare: there are VEI 2 eruptions almost every week somewhere in the world, while VEI 7 eruptions occur a few times per millennium. VEI 8 eruptions are so rare that none has happened in written history.'] },
        { h: 'A caveat', p: ['A small eruption can still be deadly: in 1985 a VEI 3 eruption of Nevado del Ruiz melted part of its glacier and produced lahars that buried the town of Armero.'] },
      ],
    },
  },
  {
    id: 'volcano-safety', topic: 'volcano',
    sources: [
      { label: 'Ready.gov (FEMA) · Volcanoes', url: 'https://www.ready.gov/volcanoes' },
      { label: 'USGS · Volcanic Ash', url: 'https://volcanoes.usgs.gov/volcanic_ash/' },
      { label: 'IVHHN · Protección contra la ceniza', url: 'https://www.ivhhn.org/ash-protection' },
    ],
    es: {
      slug: 'que-hacer-ante-una-erupcion', title: 'Qué hacer ante una erupción o caída de ceniza',
      seoTitle: 'Qué hacer ante una erupción volcánica o caída de ceniza',
      desc: 'Cómo actuar ante una erupción: evacuación, lahares y cómo protegerse de la ceniza volcánica en casa y en la calle.',
      lead: 'Lo más importante ante una erupción es seguir las indicaciones del observatorio volcanológico y de protección civil: ellos saben qué zonas están en peligro.',
      sections: [
        { h: 'Si hay orden de evacuación', list: [
          'Salí cuanto antes y por las rutas indicadas; no te acerques al volcán para mirar.',
          'Alejate de los valles y cauces de ríos que bajan del volcán: por ahí pueden bajar lahares (flujos de barro y rocas) muy rápido y lejos.',
          'Los flujos piroclásticos (nubes de gas y ceniza a cientos de grados) son imposibles de esquivar: la única protección es no estar en su camino.',
        ] },
        { h: 'Si cae ceniza', list: [
          'Quedate adentro, con puertas y ventanas cerradas.',
          'Si tenés que salir, usá un barbijo N95 o FFP2 bien ajustado (o al menos un paño húmedo), anteojos de protección y ropa que cubra la piel. No uses lentes de contacto.',
          'Evitá manejar: la ceniza reduce la visibilidad, vuelve resbaladiza la ruta y daña los motores.',
          'Protegé el agua y la comida. Tapá tanques y aljibes.',
          'La ceniza pesa, sobre todo mojada: limpiá los techos con cuidado y sin subirte si no es seguro, porque pueden derrumbarse.',
        ] },
        { h: 'Antes', list: [
          'Averiguá si vivís en una zona de riesgo volcánico y cuáles son las rutas de evacuación.',
          'Prepará una mochila de emergencia con barbijos y anteojos de protección.',
          'Conocé los niveles de alerta del observatorio local (en el atlas, cada ficha de volcán enlaza al observatorio que corresponde).',
        ] },
      ],
    },
    en: {
      slug: 'what-to-do-in-an-eruption', title: 'What to do in an eruption or ashfall',
      seoTitle: 'What to do in a volcanic eruption or ashfall',
      desc: 'How to act in an eruption: evacuation, lahars and how to protect yourself from volcanic ash at home and outdoors.',
      lead: 'The most important thing in an eruption is to follow the instructions of the volcano observatory and civil protection: they know which areas are in danger.',
      sections: [
        { h: 'If an evacuation is ordered', list: [
          'Leave as soon as possible along the indicated routes; do not approach the volcano to watch.',
          'Stay away from valleys and riverbeds coming down from the volcano: lahars (mud and rock flows) can travel down them fast and far.',
          'Pyroclastic flows (clouds of gas and ash at hundreds of degrees) cannot be outrun: the only protection is not being in their path.',
        ] },
        { h: 'If ash is falling', list: [
          'Stay indoors with doors and windows closed.',
          'If you must go out, wear a well-fitted N95 or FFP2 mask (or at least a damp cloth), goggles and clothing that covers your skin. Do not wear contact lenses.',
          'Avoid driving: ash reduces visibility, makes roads slippery and damages engines.',
          'Protect water and food. Cover tanks and cisterns.',
          'Ash is heavy, especially when wet: clear roofs carefully and only if it is safe, because they can collapse.',
        ] },
        { h: 'Before', list: [
          'Find out whether you live in a volcanic hazard zone and what the evacuation routes are.',
          'Prepare an emergency kit with masks and goggles.',
          'Learn the local observatory’s alert levels (on the atlas, each volcano page links to the relevant observatory).',
        ] },
      ],
    },
  },
  {
    id: 'tsunami-formation', topic: 'tsunami', figures: ['tsunami-wave'],
    sources: [
      { label: 'NOAA · Tsunami FAQ', url: 'https://tsunami.gov/?page=tsunamiFAQ' },
      { label: 'NWS · Tsunami safety', url: 'https://www.weather.gov/safety/tsunami' },
    ],
    es: {
      slug: 'como-se-forma-un-tsunami', title: 'Cómo se forma un tsunami',
      seoTitle: 'Cómo se forma un tsunami y por qué no todo sismo lo genera',
      desc: 'Qué es un tsunami, cómo lo genera un sismo, a qué velocidad viaja y por qué no todos los terremotos en el mar producen uno.',
      lead: 'Un tsunami es una serie de olas muy largas que se producen cuando se desplaza de golpe una gran masa de agua, casi siempre por un sismo que levanta o hunde el fondo del mar.',
      sections: [
        { h: 'Qué lo genera', list: [
          'Sismos grandes y poco profundos en zonas de subducción, que mueven verticalmente el fondo marino: son la causa de la gran mayoría.',
          'Deslizamientos submarinos o de laderas que caen al mar.',
          'Erupciones volcánicas y, muy raramente, impactos de meteoritos.',
        ] },
        { h: 'Por qué no todo sismo genera un tsunami', p: ['Tiene que moverse mucho el fondo del mar. Por eso hace falta, en general, un sismo en el mar, poco profundo (menos de unos 70 km), grande (magnitud 7 o más; los tsunamis destructivos lejanos suelen venir de M 8 o más) y con falla inversa, que levanta el fondo. Un sismo de rumbo mueve el fondo de costado y empuja poca agua. En la ficha de cada sismo grande, el atlas muestra cuáles de estas condiciones se cumplen.'] },
        { h: 'Cómo viaja', p: [
          'En mar abierto, un tsunami viaja tan rápido como un avión: en un océano de 4.000 m de profundidad, unos 700 km/h. Allí la ola mide poco de alto y un barco casi no la nota.',
          'Al llegar a la costa, el agua más baja la frena y la ola crece. No es una ola que rompe: es una subida del mar que puede entrar cientos de metros tierra adentro. Llegan varias olas durante horas y la primera no siempre es la más grande; a veces el mar primero se retira.',
        ] },
        { h: 'Cómo se detecta', p: ['Los centros de alerta (PTWC y NTWC de NOAA, y los de cada país) estiman en minutos si un sismo puede generar un tsunami y lo confirman con mareógrafos y boyas DART, que miden desde el fondo del mar el paso de la ola.'] },
      ],
    },
    en: {
      slug: 'how-tsunamis-form', title: 'How a tsunami forms',
      seoTitle: 'How a tsunami forms and why not every earthquake causes one',
      desc: 'What a tsunami is, how an earthquake generates it, how fast it travels, and why not every undersea earthquake produces one.',
      lead: 'A tsunami is a series of very long waves produced when a large mass of water is suddenly displaced, almost always by an earthquake that lifts or drops the seafloor.',
      sections: [
        { h: 'What causes it', list: [
          'Large, shallow earthquakes in subduction zones that move the seafloor vertically: the cause of the vast majority.',
          'Submarine landslides or slopes collapsing into the sea.',
          'Volcanic eruptions and, very rarely, meteorite impacts.',
        ] },
        { h: 'Why not every earthquake causes a tsunami', p: ['The seafloor has to move a lot. That generally takes an earthquake at sea, shallow (less than about 70 km), large (magnitude 7 or more; distant destructive tsunamis usually come from M 8 or more) and on a reverse fault, which lifts the seafloor. A strike-slip earthquake moves the seafloor sideways and pushes little water. On each large earthquake page, the atlas shows which of these conditions are met.'] },
        { h: 'How it travels', p: [
          'In the open ocean a tsunami travels as fast as a jet: in a 4,000 m deep ocean, about 700 km/h. There the wave is low and a ship barely notices it.',
          'Near the coast, shallower water slows it down and the wave grows. It is not a breaking wave: it is a rise of the sea that can run hundreds of meters inland. Several waves arrive over hours and the first is not always the largest; sometimes the sea first recedes.',
        ] },
        { h: 'How it is detected', p: ['Warning centers (NOAA’s PTWC and NTWC, and each country’s own) estimate within minutes whether an earthquake may cause a tsunami and confirm it with tide gauges and DART buoys, which measure the passing wave from the seafloor.'] },
      ],
    },
  },
  {
    id: 'tsunami-signs', topic: 'tsunami',
    sources: [
      { label: 'NWS · Tsunami safety', url: 'https://www.weather.gov/safety/tsunami' },
      { label: 'NOAA · Tsunami FAQ', url: 'https://tsunami.gov/?page=tsunamiFAQ' },
    ],
    es: {
      slug: 'senales-naturales-de-tsunami', title: 'Señales naturales de alerta de tsunami',
      seoTitle: 'Señales naturales de un tsunami: cuándo evacuar sin esperar la alerta',
      desc: 'Las tres señales naturales de un tsunami y por qué hay que actuar apenas se notan, sin esperar una alerta oficial.',
      lead: 'Si el tsunami se genera cerca de la costa, puede llegar en minutos, antes que cualquier alerta. Por eso hay que reconocer las señales naturales y actuar en el momento.',
      sections: [
        { h: 'Las tres señales', list: [
          'Un sismo fuerte (que cuesta mantenerse de pie) o muy largo mientras estás en la costa.',
          'El mar se retira de golpe y deja ver el fondo, o sube de forma anormal.',
          'Un ruido fuerte que viene del mar, como un tren o un avión.',
        ] },
        { h: 'Qué hacer', p: ['Ante cualquiera de las tres, andá de inmediato a un lugar alto o tierra adentro, a pie si se puede. No esperes la alerta oficial ni te acerques a mirar el mar: cuando se ve la ola, ya es tarde para escapar.'] },
        { h: 'La alerta oficial también importa', p: ['Si el sismo fue lejos, no lo vas a sentir, pero el tsunami igual puede llegar horas después. Por eso hay que seguir también las alertas de los centros de tsunami y de las autoridades de cada país.'] },
      ],
    },
    en: {
      slug: 'tsunami-natural-warnings', title: 'Natural tsunami warning signs',
      seoTitle: 'Natural signs of a tsunami: when to evacuate without waiting for an alert',
      desc: 'The three natural signs of a tsunami and why you must act as soon as you notice them, without waiting for an official alert.',
      lead: 'If a tsunami is generated near the coast it can arrive within minutes, before any alert. That is why you need to recognize the natural signs and act right away.',
      sections: [
        { h: 'The three signs', list: [
          'A strong earthquake (hard to stand) or a very long one while you are on the coast.',
          'The sea suddenly withdraws, exposing the seafloor, or rises abnormally.',
          'A loud roar coming from the sea, like a train or an airplane.',
        ] },
        { h: 'What to do', p: ['With any of the three, go immediately to high ground or inland, on foot if possible. Do not wait for an official alert or go to look at the sea: when you can see the wave, it is too late to escape.'] },
        { h: 'Official alerts matter too', p: ['If the earthquake was far away you will not feel it, but the tsunami can still arrive hours later. That is why you must also follow alerts from tsunami warning centers and national authorities.'] },
      ],
    },
  },
  {
    id: 'tsunami-safety', topic: 'tsunami',
    sources: [
      { label: 'NWS · Tsunami safety', url: 'https://www.weather.gov/safety/tsunami' },
      { label: 'Great ShakeOut · en español', url: 'https://www.shakeout.org/espanol/' },
      { label: 'SENAPRED (Chile)', url: 'https://senapred.cl/' },
    ],
    es: {
      slug: 'que-hacer-en-la-costa', title: 'Qué hacer en la costa ante un tsunami',
      seoTitle: 'Qué hacer ante un tsunami en la costa: evacuación paso a paso',
      desc: 'Cómo evacuar ante un tsunami, adónde ir, qué hacer si no hay altura cerca y cuándo volver.',
      lead: 'Evacuar rápido y hacia arriba salva vidas. Estos son los pasos que recomiendan los servicios oficiales.',
      sections: [
        { h: 'Durante', list: [
          'Si sentís un sismo fuerte en la costa: primero protegete del movimiento; cuando pare, evacuá.',
          'Andá a un lugar alto o lo más tierra adentro posible, siguiendo las señales de evacuación. A pie, para no quedar atrapado en el tránsito.',
          'Si no hay altura cerca, subí a los pisos altos (tercero o más) de un edificio firme de hormigón: es la "evacuación vertical".',
          'Si estás en un barco y hay tiempo, alejate mar adentro, a aguas profundas, según indiquen las autoridades del puerto.',
        ] },
        { h: 'Después', list: [
          'Quedate en la zona segura hasta que las autoridades digan que terminó: llegan varias olas durante horas.',
          'No vuelvas a buscar cosas ni a mirar los daños.',
          'Cuidado con el agua: arrastra escombros y puede estar contaminada.',
        ] },
        { h: 'Antes', list: [
          'Si vivís, trabajás o vacacionás en la costa, averiguá cuál es la zona de inundación y la ruta de evacuación.',
          'Practicá el recorrido: tenés que poder llegar a la zona segura en pocos minutos.',
        ] },
      ],
    },
    en: {
      slug: 'what-to-do-on-the-coast', title: 'What to do on the coast during a tsunami',
      seoTitle: 'What to do during a tsunami on the coast: evacuation step by step',
      desc: 'How to evacuate from a tsunami, where to go, what to do if there is no high ground nearby, and when to return.',
      lead: 'Evacuating quickly and upward saves lives. These are the steps official services recommend.',
      sections: [
        { h: 'During', list: [
          'If you feel a strong earthquake on the coast: first protect yourself from the shaking; when it stops, evacuate.',
          'Go to high ground or as far inland as possible, following evacuation signs. On foot, so you do not get stuck in traffic.',
          'If there is no high ground nearby, go to the upper floors (third or higher) of a sturdy concrete building: "vertical evacuation".',
          'If you are on a boat and there is time, head out to deep water, as port authorities indicate.',
        ] },
        { h: 'After', list: [
          'Stay in the safe area until authorities say it is over: several waves arrive over hours.',
          'Do not go back for belongings or to look at the damage.',
          'Beware of the water: it carries debris and may be contaminated.',
        ] },
        { h: 'Before', list: [
          'If you live, work or vacation on the coast, find out the inundation zone and the evacuation route.',
          'Practice the route: you need to be able to reach safety within a few minutes.',
        ] },
      ],
    },
  },
];
