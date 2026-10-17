import type { Lang } from './types';

/*
 * Sección "Aprender": textos basados en las guías oficiales que se citan al pie de cada uno
 * (USGS, Great ShakeOut, Ready.gov / FEMA, NOAA). Fecha de revisión: REVIEWED.
 */

export const REVIEWED = '2026-10-17';

type Section = { h: string; p?: string[]; list?: string[] };
type Article = { slug: string; title: string; seoTitle: string; desc: string; lead: string; sections: Section[] };
export type LearnArticle = { id: string; es: Article; en: Article; sources: { label: string; url: string }[] };

export const ARTICLES: LearnArticle[] = [
  {
    id: 'what-to-do',
    sources: [
      { label: 'Great ShakeOut · Drop, Cover, and Hold On', url: 'https://www.shakeout.org/dropcoverholdon/' },
      { label: 'Great ShakeOut · en español', url: 'https://www.shakeout.org/espanol/' },
      { label: 'Ready.gov (FEMA) · Earthquakes', url: 'https://www.ready.gov/earthquakes' },
      { label: 'NOAA · Tsunami FAQ', url: 'https://www.tsunami.gov/?page=tsunamiFAQ' },
      { label: 'SENAPRED (Chile)', url: 'https://senapred.cl/' },
      { label: 'CENAPRED (México)', url: 'https://www.gob.mx/cenapred' },
    ],
    es: {
      slug: 'que-hacer-en-un-sismo',
      title: 'Qué hacer en un sismo',
      seoTitle: 'Qué hacer en un sismo o terremoto: antes, durante y después',
      desc: 'Qué hacer antes, durante y después de un sismo según las guías oficiales: agacharse, cubrirse y sujetarse; qué hacer en la calle, en el auto y en la costa.',
      lead: 'La recomendación de los organismos de protección civil es la misma en casi todo el mundo: durante el movimiento, agacharse, cubrirse y sujetarse. Lo demás se prepara antes y se revisa después.',
      sections: [
        { h: 'Durante el sismo: agacharse, cubrirse y sujetarse', p: ['Si estás bajo techo, quedate adentro. Correr hacia afuera mientras el suelo se mueve es una de las causas más comunes de lesiones: caen vidrios, revoques y objetos de las fachadas.'], list: [
          'Agachate: ponete en el piso sobre manos y rodillas antes de que el movimiento te tire.',
          'Cubrite: protegé la cabeza y el cuello con un brazo y, si podés, metete debajo de una mesa o escritorio firme. Si no hay, acercate a una pared interior, lejos de ventanas.',
          'Sujetate: agarrate de la mesa (o de tu cabeza y cuello) hasta que el movimiento termine, moviéndote con ella si se desplaza.',
          'Alejate de ventanas, espejos, estanterías y objetos que puedan caer. No uses ascensores.',
          'Si estás en la cama, quedate ahí y cubrite la cabeza con la almohada.',
          'Si usás silla de ruedas o andador: frená las ruedas, inclinate hacia adelante y cubrite la cabeza y el cuello.',
        ] },
        { h: 'Si estás afuera o en un vehículo', list: [
          'En la calle: alejate de edificios, árboles, postes y cables, y quedate en un lugar abierto hasta que pare.',
          'Manejando: frená en un lugar seguro, lejos de puentes, pasos elevados y cables, y quedate dentro del auto con el cinturón puesto hasta que termine el movimiento.',
        ] },
        { h: 'Si estás en la costa', p: [
          'Si sentís un sismo fuerte (que dificulta mantenerse de pie) o muy largo, esa es la alerta natural de un posible tsunami: apenas termine el movimiento, andá a un lugar alto o lo más tierra adentro posible, a pie si se puede, sin esperar una alerta oficial.',
          'Un tsunami son varias olas que pueden llegar durante horas; no vuelvas a la costa hasta que las autoridades lo indiquen.',
        ] },
        { h: 'Después del sismo', list: [
          'Esperá réplicas: si vuelve a temblar, agachate, cubrite y sujetate otra vez.',
          'Revisá si hay personas heridas y prestá primeros auxilios si sabés.',
          'Si sentís olor a gas, abrí ventanas, salí y no prendas llamas ni interruptores.',
          'No entres a edificios dañados. Usá escaleras, no ascensores.',
          'Mandá mensajes de texto en lugar de llamar, para no saturar las líneas.',
          'Seguí la información oficial de protección civil de tu país.',
        ] },
        { h: 'Antes: prepararse', list: [
          'Armá un plan familiar: dónde reencontrarse y a quién avisar.',
          'Prepará una mochila de emergencia: agua, comida no perecedera, linterna, radio a pilas, botiquín, medicamentos, copias de documentos y un cargador.',
          'Fijá a la pared muebles altos y objetos pesados; no cuelgues cosas pesadas sobre las camas.',
          'Aprendé a cortar el gas, la luz y el agua.',
          'Practicá en los simulacros (por ejemplo, el Gran ShakeOut).',
        ] },
        { h: '¿Y el "triángulo de la vida" o el marco de la puerta?', p: [
          'Las guías oficiales no los recomiendan. En construcciones modernas el marco de la puerta no es más resistente que el resto de la casa y no protege de los objetos que caen; y buscar un "triángulo" junto a un mueble obliga a moverse durante el sacudón y no protege la cabeza.',
        ] },
      ],
    },
    en: {
      slug: 'what-to-do-in-an-earthquake',
      title: 'What to do in an earthquake',
      seoTitle: 'What to do in an earthquake: before, during and after',
      desc: 'What to do before, during and after an earthquake according to official guidance: drop, cover and hold on; what to do outdoors, in a car and on the coast.',
      lead: 'Civil protection agencies give almost the same advice everywhere: during the shaking, drop, cover and hold on. Everything else is prepared beforehand and checked afterwards.',
      sections: [
        { h: 'During the earthquake: drop, cover and hold on', p: ['If you are indoors, stay inside. Running outside while the ground is moving is one of the most common causes of injury: glass, plaster and objects fall from building facades.'], list: [
          'Drop: get down on your hands and knees before the shaking knocks you down.',
          'Cover: protect your head and neck with one arm and, if you can, get under a sturdy table or desk. If there is none, move next to an interior wall, away from windows.',
          'Hold on: hold on to the table (or to your head and neck) until the shaking stops, moving with it if it shifts.',
          'Stay away from windows, mirrors, shelves and anything that could fall. Do not use elevators.',
          'If you are in bed, stay there and cover your head with a pillow.',
          'If you use a wheelchair or walker: lock the wheels, bend forward and cover your head and neck.',
        ] },
        { h: 'If you are outdoors or in a vehicle', list: [
          'Outdoors: move away from buildings, trees, poles and power lines, and stay in the open until the shaking stops.',
          'Driving: pull over somewhere safe, away from bridges, overpasses and power lines, and stay in the car with your seat belt on until the shaking stops.',
        ] },
        { h: 'If you are on the coast', p: [
          'If you feel a strong earthquake (one that makes it hard to stand) or a very long one, that is the natural warning of a possible tsunami: as soon as the shaking stops, go to high ground or as far inland as possible, on foot if you can, without waiting for an official alert.',
          'A tsunami is a series of waves that can keep arriving for hours; do not return to the coast until the authorities say so.',
        ] },
        { h: 'After the earthquake', list: [
          'Expect aftershocks: if it shakes again, drop, cover and hold on again.',
          'Check for injured people and give first aid if you know how.',
          'If you smell gas, open windows, get out and do not use flames or switches.',
          'Do not enter damaged buildings. Use stairs, not elevators.',
          'Send text messages instead of calling, so lines do not get overloaded.',
          'Follow official information from your country\'s civil protection agency.',
        ] },
        { h: 'Before: get prepared', list: [
          'Make a family plan: where to meet and whom to contact.',
          'Prepare an emergency kit: water, non-perishable food, flashlight, battery radio, first-aid kit, medicines, copies of documents and a charger.',
          'Secure tall furniture and heavy objects to the wall; do not hang heavy things over beds.',
          'Learn how to shut off gas, electricity and water.',
          'Practice in drills (for example, the Great ShakeOut).',
        ] },
        { h: 'What about the "triangle of life" or the doorway?', p: [
          'Official guidance does not recommend them. In modern buildings a doorway is no stronger than the rest of the house and does not protect you from falling objects; looking for a "triangle" next to furniture means moving during the shaking and leaves your head unprotected.',
        ] },
      ],
    },
  },
  {
    id: 'magnitude-intensity',
    sources: [
      { label: 'USGS · Earthquake magnitude, energy release, and shaking intensity', url: 'https://www.usgs.gov/programs/earthquake-hazards/earthquake-magnitude-energy-release-and-shaking-intensity' },
      { label: 'USGS · The Modified Mercalli Intensity Scale', url: 'https://www.usgs.gov/programs/earthquake-hazards/modified-mercalli-intensity-scale' },
      { label: 'USGS · Moment magnitude, Richter scale: why so many scales?', url: 'https://www.usgs.gov/faqs/moment-magnitude-richter-scale-what-are-different-magnitude-scales-and-why-are-there-so-many' },
      { label: 'USGS · ShakeMap', url: 'https://earthquake.usgs.gov/data/shakemap/' },
      { label: 'USGS · Did You Feel It?', url: 'https://earthquake.usgs.gov/data/dyfi/' },
    ],
    es: {
      slug: 'magnitud-e-intensidad',
      title: 'Diferencia entre magnitud e intensidad',
      seoTitle: 'Diferencia entre magnitud e intensidad de un sismo',
      desc: 'La magnitud mide el tamaño de un sismo en su origen y es un solo número; la intensidad mide cuánto se sintió en cada lugar. Qué es la escala de Mercalli y por qué ya no se usa Richter.',
      lead: 'Un sismo tiene una sola magnitud, pero muchas intensidades: una por cada lugar donde se sintió.',
      sections: [
        { h: 'Magnitud: el tamaño del sismo', p: [
          'La magnitud mide la energía que libera la falla. Es un único número para todo el sismo y no depende de dónde estés. Se escribe con números arábigos y un decimal: M 6,8.',
          'La escala es logarítmica: cada punto entero más significa unas 10 veces más amplitud en el sismograma y unas 32 veces más energía. Un M 7 libera alrededor de 32 veces la energía de un M 6 y unas 1.000 veces la de un M 5.',
        ] },
        { h: 'Intensidad: cuánto se sacudió cada lugar', p: [
          'La intensidad describe los efectos del sismo en un lugar concreto: qué sintió la gente, qué se cayó, qué se dañó. Cambia de un lugar a otro según la distancia al epicentro, la profundidad del sismo, el tipo de suelo y las construcciones.',
          'La escala más usada en América es la de Mercalli Modificada (MMI), con números romanos del I (no se siente) al XII (destrucción casi total). En la ficha de cada sismo de este atlas, "Intensidad máx. (MMI)" es la mayor intensidad estimada por el ShakeMap del USGS.',
        ] },
        { h: 'Por qué un sismo "más chico" puede sentirse más fuerte', p: [
          'Un M 6 poco profundo debajo de una ciudad puede producir más intensidad allí que un M 7 profundo y lejano. Por eso dos sismos de igual magnitud pueden tener consecuencias muy distintas, y por eso para medir el impacto se mira la intensidad y no solo la magnitud.',
        ] },
        { h: '¿Y la escala de Richter?', p: [
          'La escala de Richter (magnitud local, ML) se creó en 1935 para sismos del sur de California. Funciona bien para sismos chicos y cercanos, pero se "satura" en los grandes: deja de crecer aunque el sismo sea mayor. Hoy las agencias informan para los sismos grandes la magnitud de momento (Mw), que no se satura. Los medios siguen diciendo "Richter", pero el número que publican casi siempre es otra escala de magnitud.',
        ] },
        { h: 'Cómo se estima la intensidad', p: [
          'Con instrumentos (acelerómetros que miden la aceleración y la velocidad del suelo) y con los reportes de la gente. El USGS combina ambos en el ShakeMap, el mapa de intensidad que se muestra en las fichas de sismos, y junta los reportes en "¿Lo sentiste?" (Did You Feel It?).',
        ] },
      ],
    },
    en: {
      slug: 'magnitude-vs-intensity',
      title: 'Magnitude vs. intensity',
      seoTitle: 'Earthquake magnitude vs. intensity: what is the difference?',
      desc: 'Magnitude measures the size of an earthquake at its source and is a single number; intensity measures how strongly it was felt at each place. The Mercalli scale and why Richter is no longer used.',
      lead: 'An earthquake has a single magnitude but many intensities: one for every place where it was felt.',
      sections: [
        { h: 'Magnitude: the size of the earthquake', p: [
          'Magnitude measures the energy released by the fault. It is a single number for the whole earthquake and does not depend on where you are. It is written with Arabic numerals and one decimal: M 6.8.',
          'The scale is logarithmic: each whole number up means about 10 times more amplitude on the seismogram and about 32 times more energy. An M 7 releases roughly 32 times the energy of an M 6 and about 1,000 times that of an M 5.',
        ] },
        { h: 'Intensity: how hard each place shook', p: [
          'Intensity describes the effects of the earthquake at a given place: what people felt, what fell, what was damaged. It changes from place to place depending on distance to the epicenter, depth, soil type and buildings.',
          'The most widely used scale in the Americas is the Modified Mercalli Intensity (MMI) scale, with Roman numerals from I (not felt) to XII (near-total destruction). On each earthquake page of this atlas, "Max intensity (MMI)" is the highest intensity estimated by the USGS ShakeMap.',
        ] },
        { h: 'Why a "smaller" earthquake can feel stronger', p: [
          'A shallow M 6 under a city can produce higher intensity there than a deep, distant M 7. That is why two earthquakes of the same magnitude can have very different consequences, and why impact is judged by intensity, not just magnitude.',
        ] },
        { h: 'What about the Richter scale?', p: [
          'The Richter scale (local magnitude, ML) was created in 1935 for southern California earthquakes. It works well for small, nearby earthquakes but "saturates" for large ones: it stops growing even when the earthquake is bigger. Today agencies report moment magnitude (Mw) for large earthquakes, which does not saturate. News outlets still say "Richter", but the number they publish is almost always a different magnitude scale.',
        ] },
        { h: 'How intensity is estimated', p: [
          'With instruments (accelerometers that measure ground acceleration and velocity) and with people\'s reports. The USGS combines both in ShakeMap, the intensity map shown on earthquake pages, and collects reports through Did You Feel It?.',
        ] },
      ],
    },
  },
  {
    id: 'how-measured',
    sources: [
      { label: 'USGS · Seismographs: keeping track of earthquakes', url: 'https://www.usgs.gov/programs/earthquake-hazards/seismographs-keeping-track-earthquakes' },
      { label: 'USGS · Why so many magnitude scales?', url: 'https://www.usgs.gov/faqs/moment-magnitude-richter-scale-what-are-different-magnitude-scales-and-why-are-there-so-many' },
      { label: 'USGS · Earthquake Hazards 201 (technical Q&A)', url: 'https://www.usgs.gov/programs/earthquake-hazards/science/earthquake-hazards-201-technical-qa' },
      { label: 'USGS · ShakeMap', url: 'https://earthquake.usgs.gov/data/shakemap/' },
      { label: 'USGS · PAGER', url: 'https://earthquake.usgs.gov/data/pager/' },
    ],
    es: {
      slug: 'como-se-mide-un-terremoto',
      title: 'Cómo se mide un terremoto',
      seoTitle: 'Cómo se mide un terremoto: sismógrafos, epicentro y magnitud',
      desc: 'Cómo se detecta y se mide un terremoto: sismógrafos, ondas P y S, cómo se calcula el epicentro y la profundidad, qué es la magnitud de momento y por qué los datos se corrigen después.',
      lead: 'Cada sismo se mide con redes de sismógrafos: con ellas se calcula dónde ocurrió, a qué profundidad y qué tan grande fue. Los primeros números son automáticos y se revisan después.',
      sections: [
        { h: 'Sismógrafos y redes', p: [
          'Un sismómetro registra el movimiento del suelo; el registro se llama sismograma. Miles de estaciones en todo el mundo envían sus datos en tiempo real a los centros sismológicos nacionales y a redes globales como la del USGS.',
        ] },
        { h: 'Ondas P y S: cómo se encuentra el epicentro', p: [
          'Un sismo emite varios tipos de ondas. Las primeras en llegar son las ondas P (de compresión), más rápidas; después llegan las ondas S (de corte). Cuanto más lejos está una estación, más tiempo pasa entre la llegada de la P y la de la S.',
          'Con esa diferencia, cada estación sabe a qué distancia ocurrió el sismo, pero no en qué dirección. Combinando muchas estaciones, un programa calcula el punto que mejor explica todos los tiempos: el hipocentro (el punto en profundidad donde empezó la ruptura) y, sobre la superficie, el epicentro. Por eso cada ubicación tiene un margen de error, que en las fichas de este atlas se muestra como "± km".',
        ] },
        { h: 'Cómo se calcula la magnitud', p: [
          'Las magnitudes clásicas (local ML, de ondas de cuerpo mb, de ondas superficiales Ms) se calculan a partir de la amplitud de ciertas ondas en los sismogramas, corregida por la distancia.',
          'Para sismos medianos y grandes se usa la magnitud de momento (Mw), que parte del momento sísmico: la rigidez de la roca, por el área de la falla que se rompió, por cuánto se deslizó. Se calcula modelando la forma completa de las ondas y no se satura en los sismos más grandes. Su fórmula es Mw = ⅔ · log₁₀(M₀) − 6,07, con el momento M₀ en newton·metro.',
        ] },
        { h: 'Por qué los datos cambian en las primeras horas', p: [
          'La primera solución sale en minutos y es automática, con pocas estaciones. A medida que llegan más datos, los sismólogos revisan la ubicación, la profundidad y la magnitud; por eso un sismo puede pasar, por ejemplo, de M 6,6 a M 6,8. En este atlas cada sismo dice si es "preliminar" (automático) o "revisado" por un sismólogo, y distintas agencias pueden publicar valores algo diferentes para el mismo sismo.',
        ] },
        { h: 'Además de la magnitud', p: [
          'Con los datos de los acelerómetros y los reportes de la gente, el USGS arma el ShakeMap (la intensidad del sacudimiento en cada lugar) y el sistema PAGER, que estima el impacto posible en personas y en la economía con una alerta verde, amarilla, naranja o roja. En la costa, los centros de alerta de tsunami usan la magnitud y la ubicación para decidir en minutos si emiten una alerta.',
        ] },
      ],
    },
    en: {
      slug: 'how-earthquakes-are-measured',
      title: 'How earthquakes are measured',
      seoTitle: 'How earthquakes are measured: seismographs, epicenter and magnitude',
      desc: 'How an earthquake is detected and measured: seismographs, P and S waves, how the epicenter and depth are computed, what moment magnitude is, and why the numbers get revised.',
      lead: 'Every earthquake is measured with networks of seismographs: they tell where it happened, how deep and how big it was. The first numbers are automatic and get reviewed later.',
      sections: [
        { h: 'Seismographs and networks', p: [
          'A seismometer records ground motion; the record is called a seismogram. Thousands of stations worldwide send their data in real time to national seismological centers and to global networks such as the USGS.',
        ] },
        { h: 'P and S waves: finding the epicenter', p: [
          'An earthquake sends out several kinds of waves. The first to arrive are P waves (compressional), which are faster; S waves (shear) come next. The farther away a station is, the more time passes between the P and the S arrival.',
          'From that difference each station knows how far away the earthquake was, but not in which direction. Combining many stations, software computes the point that best explains all the arrival times: the hypocenter (the point at depth where the rupture began) and, above it on the surface, the epicenter. That is why every location has an uncertainty, shown on this atlas\'s pages as "± km".',
        ] },
        { h: 'How magnitude is computed', p: [
          'The classic magnitudes (local ML, body-wave mb, surface-wave Ms) are computed from the amplitude of certain waves on the seismograms, corrected for distance.',
          'For medium and large earthquakes, moment magnitude (Mw) is used. It starts from the seismic moment: the rigidity of the rock, times the area of the fault that ruptured, times how far it slipped. It is computed by modeling the full waveforms and does not saturate for the largest earthquakes. The formula is Mw = ⅔ · log₁₀(M₀) − 6.07, with the moment M₀ in newton-meters.',
        ] },
        { h: 'Why the numbers change in the first hours', p: [
          'The first solution comes out within minutes and is automatic, based on few stations. As more data arrive, seismologists review the location, depth and magnitude; that is why an earthquake can go, for example, from M 6.6 to M 6.8. On this atlas every earthquake says whether it is "preliminary" (automatic) or "reviewed" by a seismologist, and different agencies may publish slightly different values for the same earthquake.',
        ] },
        { h: 'Beyond magnitude', p: [
          'With accelerometer data and people\'s reports, the USGS builds ShakeMap (shaking intensity at each place) and the PAGER system, which estimates possible impact on people and the economy with a green, yellow, orange or red alert. On the coast, tsunami warning centers use magnitude and location to decide within minutes whether to issue an alert.',
        ] },
      ],
    },
  },
];

export const articleBySlug = (lang: Lang, slug: string) => ARTICLES.find((a) => a[lang].slug === slug) ?? null;
