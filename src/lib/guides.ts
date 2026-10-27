/*
 * "Qué hacer": resumen en tres momentos (antes, durante y después) de cada peligro, con las mismas
 * recomendaciones de los artículos de Aprender (Ready.gov/FEMA, NWS, IVHHN, OMS, SENAPRED),
 * el organismo de protección civil de cada país y la mochila de emergencia (Ready.gov, "Build a kit").
 */
import type { DisasterEvent, Lang } from './types';

export type HazardKey = 'eq' | 'tsunami' | 'volcano' | 'storm' | 'flood' | 'fire' | 'landslide' | 'heat';
export const HAZARDS: HazardKey[] = ['eq', 'tsunami', 'volcano', 'storm', 'flood', 'fire', 'landslide', 'heat'];

type Guide = { title: string; during: string[]; after: string[]; before: string[] };
/** Artículo completo de Aprender de cada peligro (id de learn.ts). */
export const GUIDE_ARTICLE: Record<HazardKey, string> = {
  eq: 'what-to-do', tsunami: 'tsunami-safety', volcano: 'volcano-safety', storm: 'hurricane-safety',
  flood: 'flood-safety', fire: 'wildfire-safety', landslide: 'landslides', heat: 'heat-cold',
};

const es: Record<HazardKey, Guide> = {
  eq: {
    title: 'Sismo',
    during: [
      'Agachate, cubrite y sujetate: al piso, protegé cabeza y cuello (debajo de una mesa firme si hay) y agarrate hasta que pare.',
      'Si estás bajo techo, quedate adentro: correr hacia afuera mientras tiembla causa muchas lesiones.',
      'Alejate de ventanas, espejos y muebles que puedan caer. No uses ascensores.',
      'En la calle, alejate de fachadas, postes y cables. Manejando, frená en un lugar seguro y quedate en el auto.',
      'En la costa, si el sismo fue fuerte o largo: apenas pare, andá a un lugar alto sin esperar aviso.',
    ],
    after: [
      'Esperá réplicas: si vuelve a temblar, agachate, cubrite y sujetate otra vez.',
      'Revisá si hay personas heridas. Si hay olor a gas, abrí ventanas, salí y no prendas nada.',
      'No entres a edificios dañados. Usá escaleras.',
      'Mandá mensajes en vez de llamar, para no saturar las líneas.',
      'Seguí la información oficial de protección civil.',
    ],
    before: [
      'Fijá a la pared muebles altos y objetos pesados; nada pesado colgado sobre las camas.',
      'Armá el plan familiar: dónde reencontrarse y a quién avisar.',
      'Prepará la mochila de emergencia y aprendé a cortar gas, luz y agua.',
      'Participá en los simulacros.',
    ],
  },
  tsunami: {
    title: 'Tsunami',
    during: [
      'Si sentís un sismo fuerte o largo en la costa, esa es la alerta: cuando pare el movimiento, evacuá.',
      'Andá a un lugar alto o lo más tierra adentro posible, a pie y siguiendo las señales de evacuación.',
      'Si no hay altura cerca, subí al tercer piso o más de un edificio firme de hormigón.',
      'Si el mar se retira de golpe, no te acerques: es la señal de que viene la ola.',
    ],
    after: [
      'Quedate en la zona segura hasta que las autoridades digan que terminó: llegan varias olas durante horas.',
      'No vuelvas a buscar cosas ni a mirar los daños.',
      'Cuidado con el agua: arrastra escombros y puede estar contaminada.',
    ],
    before: [
      'Averiguá la zona de inundación y la ruta de evacuación de tu casa, trabajo o lugar de vacaciones.',
      'Practicá el recorrido: tenés que llegar a la zona segura en pocos minutos.',
    ],
  },
  volcano: {
    title: 'Erupción y ceniza',
    during: [
      'Seguí las indicaciones del observatorio volcanológico y de protección civil; si ordenan evacuar, salí ya.',
      'Alejate de valles y cauces que bajan del volcán: por ahí bajan los lahares.',
      'Si cae ceniza, quedate adentro con puertas y ventanas cerradas.',
      'Si tenés que salir: barbijo N95 o FFP2 bien ajustado, anteojos y ropa que cubra la piel. Sin lentes de contacto.',
      'Evitá manejar: la ceniza tapa la visibilidad y la ruta queda resbaladiza.',
    ],
    after: [
      'Tapá tanques y aljibes; protegé el agua y la comida.',
      'La ceniza mojada pesa mucho: limpiá techos con cuidado, sin subirte si no es seguro.',
      'Humedecé la ceniza antes de barrer para no levantar polvo.',
    ],
    before: [
      'Averiguá si vivís en una zona de peligro volcánico y cuál es la ruta de evacuación.',
      'Tené barbijos N95 o FFP2 y anteojos de protección en la mochila de emergencia.',
    ],
  },
  storm: {
    title: 'Huracán o tormenta tropical',
    during: [
      'Si te ordenan evacuar, hacelo: la mayoría de las muertes las causa el agua, no el viento.',
      'Si te quedás, permanecé en un cuarto interior, lejos de ventanas, en el piso más bajo que no se inunde.',
      'Cuidado con el ojo: la calma puede durar minutos y después vuelve el viento del otro lado.',
    ],
    after: [
      'No camines ni manejes por zonas inundadas y alejate de cables caídos.',
      'Usá generadores solo al aire libre, lejos de puertas y ventanas (monóxido de carbono).',
      'Volvé a casa solo cuando lo indiquen las autoridades.',
    ],
    before: [
      'Averiguá si estás en zona de evacuación por marejada y cuál es tu ruta.',
      'Asegurá o guardá objetos sueltos que el viento pueda arrastrar.',
      'Prepará la mochila de emergencia con agua, comida y medicamentos para varios días.',
    ],
  },
  flood: {
    title: 'Inundación',
    during: [
      'No camines ni manejes por agua en movimiento: unos 15 cm pueden tirarte y unos 30 cm arrastrar un auto.',
      'Si el agua sube, andá a terreno alto. Nunca a un sótano.',
      'Cortá luz y gas solo si podés hacerlo sin tocar agua.',
      'Seguí los avisos oficiales: las crecidas repentinas dan muy poco tiempo.',
    ],
    after: [
      'No vuelvas hasta que lo indiquen las autoridades.',
      'Evitá el contacto con el agua: puede tener cloacas, combustibles o químicos.',
      'No toques artefactos eléctricos mojados ni cables caídos.',
    ],
    before: [
      'Averiguá si tu casa está en zona inundable.',
      'Guardá documentos y objetos de valor en alto, en bolsas impermeables.',
    ],
  },
  fire: {
    title: 'Incendio forestal',
    during: [
      'Si te dicen que evacues, salí de inmediato: el fuego puede avanzar más rápido de lo que se corre.',
      'Manejá con luces prendidas y ventanas cerradas.',
      'Si quedás atrapado, buscá un lugar sin vegetación (un claro, un camino, agua) o refugiate en una casa, lejos de las paredes exteriores.',
      'Por el humo: quedate adentro con todo cerrado; si salís, barbijo N95 o FFP2 (los de tela no filtran).',
    ],
    after: [
      'Volvé solo cuando lo indiquen las autoridades: puede haber focos que se reavivan.',
      'Cuidado con árboles y postes debilitados, y con brasas escondidas.',
    ],
    before: [
      'Si vivís cerca de vegetación, mantené limpio el entorno de la casa: pasto corto y nada seco junto a paredes y techo.',
      'Tené un plan de evacuación con dos rutas posibles.',
    ],
  },
  landslide: {
    title: 'Deslizamiento o alud',
    during: [
      'Si oís un ruido sordo que crece o ves que el suelo se mueve, alejate rápido del camino del deslizamiento, hacia los costados.',
      'No cruces arroyos que crecen de golpe o se enturbian.',
      'Si no podés escapar, hacete un ovillo y protegé la cabeza.',
    ],
    after: [
      'Alejate de la zona: puede haber más deslizamientos.',
      'Avisá si ves personas atrapadas, sin entrar en la zona del deslizamiento.',
      'Fijate si hay cables, caños de gas o agua rotos.',
    ],
    before: [
      'Aprendé las señales: grietas nuevas, árboles o postes que se inclinan, agua que brota donde no había.',
      'Con lluvias intensas, seguí los avisos y evitá dormir en zonas al pie de laderas empinadas.',
    ],
  },
  heat: {
    title: 'Ola de calor',
    during: [
      'Tomá agua seguido aunque no tengas sed; evitá el alcohol.',
      'Evitá el sol y el esfuerzo físico en las horas de más calor.',
      'Buscá lugares frescos; ventilá de noche y cerrá persianas de día.',
      'Nunca dejes a chicos, personas mayores ni mascotas dentro de un auto.',
    ],
    after: [
      'Consultá rápido si hay confusión, mareos, piel caliente y seca o temperatura alta: es una emergencia.',
      'Fijate cómo están las personas mayores o que viven solas.',
    ],
    before: [
      'Seguí los avisos del servicio meteorológico.',
      'Prepará la casa: cortinas, ventilación y un lugar fresco.',
    ],
  },
};

const en: Record<HazardKey, Guide> = {
  eq: {
    title: 'Earthquake',
    during: [
      'Drop, cover and hold on: get down, protect your head and neck (under a sturdy table if there is one) and hold on until it stops.',
      'If you are indoors, stay inside: running out while the ground shakes causes many injuries.',
      'Stay away from windows, mirrors and furniture that can fall. Do not use elevators.',
      'Outside, move away from facades, poles and wires. Driving, pull over somewhere safe and stay in the car.',
      'On the coast, if the shaking was strong or long: as soon as it stops, go to high ground without waiting for a warning.',
    ],
    after: [
      'Expect aftershocks: if it shakes again, drop, cover and hold on.',
      'Check for injured people. If you smell gas, open windows, get out and do not light anything.',
      'Do not enter damaged buildings. Use the stairs.',
      'Text instead of calling, so lines are not overloaded.',
      'Follow official civil protection information.',
    ],
    before: [
      'Secure tall furniture and heavy objects to the wall; nothing heavy hanging over beds.',
      'Make a family plan: where to meet and whom to contact.',
      'Prepare an emergency kit and learn how to shut off gas, power and water.',
      'Take part in drills.',
    ],
  },
  tsunami: {
    title: 'Tsunami',
    during: [
      'If you feel a strong or long earthquake on the coast, that is the warning: when the shaking stops, evacuate.',
      'Go to high ground or as far inland as possible, on foot and following evacuation signs.',
      'If there is no high ground nearby, go to the third floor or higher of a sturdy concrete building.',
      'If the sea suddenly pulls back, do not go closer: it means a wave is coming.',
    ],
    after: [
      'Stay in the safe zone until officials say it is over: several waves arrive over hours.',
      'Do not go back for belongings or to look at the damage.',
      'Beware of the water: it carries debris and may be contaminated.',
    ],
    before: [
      'Find out the inundation zone and evacuation route for your home, work or holiday spot.',
      'Practice the route: you must reach safety within a few minutes.',
    ],
  },
  volcano: {
    title: 'Eruption and ash',
    during: [
      'Follow the volcano observatory and civil protection; if they order an evacuation, leave now.',
      'Stay away from valleys and channels coming down the volcano: lahars run there.',
      'If ash is falling, stay inside with doors and windows closed.',
      'If you must go out: a well-fitted N95 or FFP2 mask, goggles and clothes covering your skin. No contact lenses.',
      'Avoid driving: ash cuts visibility and makes roads slippery.',
    ],
    after: [
      'Cover water tanks; protect water and food.',
      'Wet ash is very heavy: clear roofs carefully, without climbing up if it is not safe.',
      'Dampen ash before sweeping so you do not raise dust.',
    ],
    before: [
      'Find out whether you live in a volcanic hazard zone and which evacuation route to use.',
      'Keep N95 or FFP2 masks and goggles in your emergency kit.',
    ],
  },
  storm: {
    title: 'Hurricane or tropical storm',
    during: [
      'If you are told to evacuate, do it: most deaths are caused by water, not wind.',
      'If you stay, shelter in an interior room, away from windows, on the lowest floor that will not flood.',
      'Beware of the eye: the calm can last minutes and then the wind returns from the other side.',
    ],
    after: [
      'Do not walk or drive through flooded areas and stay away from downed wires.',
      'Run generators only outdoors, away from doors and windows (carbon monoxide).',
      'Return home only when officials say so.',
    ],
    before: [
      'Find out if you are in a storm surge evacuation zone and what your route is.',
      'Secure or put away loose objects the wind can carry.',
      'Prepare an emergency kit with water, food and medicine for several days.',
    ],
  },
  flood: {
    title: 'Flood',
    during: [
      'Do not walk or drive through moving water: about 15 cm can knock you down and about 30 cm can sweep a car away.',
      'If the water rises, go to higher ground. Never to a basement.',
      'Shut off power and gas only if you can do it without touching water.',
      'Follow official warnings: flash floods give very little time.',
    ],
    after: [
      'Do not return until officials say so.',
      'Avoid contact with the water: it may carry sewage, fuel or chemicals.',
      'Do not touch wet electrical appliances or downed wires.',
    ],
    before: [
      'Find out if your home is in a flood zone.',
      'Keep documents and valuables up high, in waterproof bags.',
    ],
  },
  fire: {
    title: 'Wildfire',
    during: [
      'If you are told to evacuate, leave immediately: fire can move faster than you can run.',
      'Drive with headlights on and windows closed.',
      'If trapped, find a spot without vegetation (a clearing, a road, water) or shelter in a house, away from outside walls.',
      'For smoke: stay inside with everything closed; if you go out, wear an N95 or FFP2 mask (cloth masks do not filter it).',
    ],
    after: [
      'Return only when officials say so: hot spots can flare up again.',
      'Watch for weakened trees and poles, and hidden embers.',
    ],
    before: [
      'If you live near vegetation, keep the area around the house clear: short grass and nothing dry against walls and roof.',
      'Have an evacuation plan with two possible routes.',
    ],
  },
  landslide: {
    title: 'Landslide or debris flow',
    during: [
      'If you hear a growing rumble or see the ground moving, get out of the slide’s path quickly, to the sides.',
      'Do not cross streams that suddenly rise or turn muddy.',
      'If you cannot escape, curl into a ball and protect your head.',
    ],
    after: [
      'Stay away from the area: more slides may follow.',
      'Report trapped people without entering the slide area.',
      'Check for broken power lines and gas or water pipes.',
    ],
    before: [
      'Learn the signs: new cracks, tilting trees or poles, water seeping where there was none.',
      'During heavy rain, follow warnings and avoid sleeping at the foot of steep slopes.',
    ],
  },
  heat: {
    title: 'Heat wave',
    during: [
      'Drink water often even if you are not thirsty; avoid alcohol.',
      'Avoid the sun and physical effort in the hottest hours.',
      'Find cool places; ventilate at night and close blinds by day.',
      'Never leave children, older people or pets inside a car.',
    ],
    after: [
      'Get help quickly for confusion, dizziness, hot dry skin or high temperature: it is an emergency.',
      'Check on older people and those who live alone.',
    ],
    before: [
      'Follow your weather service’s warnings.',
      'Prepare your home: curtains, ventilation and a cool room.',
    ],
  },
};

export const GUIDES: Record<Lang, Record<HazardKey, Guide>> = { es, en };

/** Peligros que corresponden a un evento del mapa. */
export function hazardsOf(e: DisasterEvent): HazardKey[] {
  if (e.type === 'eq') return e.tsunami ? ['eq', 'tsunami'] : ['eq'];
  if (e.type === 'volcano') return ['volcano'];
  if (e.type === 'storm') return ['storm', 'flood'];
  if (e.type === 'flood') return ['flood', 'landslide'];
  if (e.type === 'fire') return ['fire'];
  return ['heat'];
}

/** Textos de la tarjeta "Qué hacer" y anclas de cada peligro en la página de guías. */
export const GUIDE_T = {
  es: {
    title: 'Qué hacer', recent: 'Si estás en la zona', past: 'Si vuelve a pasar', tabs: { during: 'Durante', after: 'Después', before: 'Antes' },
    agency: 'Protección civil', call: 'Teléfonos de emergencia', full: 'Guía completa', all: 'Todas las guías y la mochila de emergencia',
    official: 'Ante una emergencia, seguí siempre las indicaciones de las autoridades de tu zona.',
    anchors: { eq: 'sismo', tsunami: 'tsunami', volcano: 'volcan', storm: 'huracan', flood: 'inundacion', fire: 'incendio', landslide: 'deslizamiento', heat: 'calor' } as Record<HazardKey, string>,
  },
  en: {
    title: 'What to do', recent: 'If you are in the area', past: 'If it happens again', tabs: { during: 'During', after: 'After', before: 'Before' },
    agency: 'Civil protection', call: 'Emergency numbers', full: 'Full guide', all: 'All guides and the emergency kit',
    official: 'In an emergency, always follow the instructions of your local authorities.',
    anchors: { eq: 'earthquake', tsunami: 'tsunami', volcano: 'volcano', storm: 'hurricane', flood: 'flood', fire: 'wildfire', landslide: 'landslide', heat: 'heat' } as Record<HazardKey, string>,
  },
};

/* ───────────── Organismos y teléfonos de emergencia ───────────── */

type Phone = { n: string; es: string; en: string };
export type Agency = { name: string; url: string; phones?: Phone[] };
const p = (n: string, es: string, en: string): Phone => ({ n, es, en });
const E911 = [p('911', 'Emergencias', 'Emergencies')];

/** Protección civil de cada país (sitio oficial) y números de emergencia más conocidos. */
export const AGENCIES: Record<string, Agency> = {
  ARG: { name: 'SINAGIR · Protección Civil (Argentina)', url: 'https://www.argentina.gob.ar/sinagir', phones: [p('911', 'Emergencias (policía)', 'Emergencies (police)'), p('103', 'Defensa Civil', 'Civil Defense'), p('100', 'Bomberos', 'Fire'), p('107', 'Emergencias médicas', 'Medical emergencies')] },
  CHL: { name: 'SENAPRED (Chile)', url: 'https://senapred.cl/', phones: [p('131', 'Ambulancia (SAMU)', 'Ambulance (SAMU)'), p('132', 'Bomberos', 'Fire'), p('133', 'Carabineros', 'Police (Carabineros)')] },
  MEX: { name: 'CENAPRED · Protección Civil (México)', url: 'https://www.gob.mx/cenapred', phones: E911 },
  PER: { name: 'INDECI (Perú)', url: 'https://www.gob.pe/indeci', phones: [p('105', 'Policía', 'Police'), p('116', 'Bomberos', 'Fire'), p('106', 'Ambulancia (SAMU)', 'Ambulance (SAMU)')] },
  ECU: { name: 'Secretaría de Gestión de Riesgos (Ecuador)', url: 'https://www.gestionderiesgos.gob.ec/', phones: [p('911', 'ECU 911', 'ECU 911')] },
  COL: { name: 'UNGRD (Colombia)', url: 'https://portal.gestiondelriesgo.gov.co/', phones: [p('123', 'Emergencias', 'Emergencies')] },
  BOL: { name: 'Viceministerio de Defensa Civil (Bolivia)', url: 'https://www.defensacivil.gob.bo/' },
  URY: { name: 'SINAE (Uruguay)', url: 'https://www.gub.uy/sistema-nacional-emergencias/', phones: E911 },
  PRY: { name: 'Secretaría de Emergencia Nacional (Paraguay)', url: 'https://www.sen.gov.py/', phones: E911 },
  BRA: { name: 'Defesa Civil (Brasil)', url: 'https://www.gov.br/mdr/pt-br/assuntos/protecao-e-defesa-civil', phones: [p('199', 'Defesa Civil', 'Civil Defense'), p('193', 'Bombeiros', 'Fire'), p('192', 'SAMU', 'Ambulance (SAMU)'), p('190', 'Polícia', 'Police')] },
  GTM: { name: 'CONRED (Guatemala)', url: 'https://conred.gob.gt/' },
  SLV: { name: 'Protección Civil (El Salvador)', url: 'https://www.proteccioncivil.gob.sv/', phones: E911 },
  HND: { name: 'COPECO (Honduras)', url: 'https://copeco.gob.hn/', phones: E911 },
  NIC: { name: 'SINAPRED (Nicaragua)', url: 'https://www.sinapred.gob.ni/' },
  CRI: { name: 'CNE (Costa Rica)', url: 'https://www.cne.go.cr/', phones: E911 },
  PAN: { name: 'SINAPROC (Panamá)', url: 'https://www.sinaproc.gob.pa/', phones: E911 },
  DOM: { name: 'COE (República Dominicana)', url: 'https://coe.gob.do/', phones: E911 },
  USA: { name: 'Ready.gov (FEMA)', url: 'https://www.ready.gov/', phones: E911 },
  PRI: { name: 'Ready.gov (FEMA)', url: 'https://www.ready.gov/', phones: E911 },
  ESP: { name: 'Protección Civil (España)', url: 'https://www.proteccioncivil.es/', phones: [p('112', 'Emergencias', 'Emergencies')] },
  JPN: { name: 'Cabinet Office · Disaster Management (Japón)', url: 'https://www.bousai.go.jp/', phones: [p('110', 'Policía', 'Police'), p('119', 'Bomberos y ambulancia', 'Fire and ambulance')] },
};

/* ───────────── Mochila de emergencia (Ready.gov, "Build a kit") ───────────── */

export const KIT: Record<Lang, { title: string; items: string[] }[]> = {
  es: [
    { title: 'Lo básico', items: [
      'Agua: unos 4 litros por persona y por día, para varios días (para tomar y para higiene)',
      'Comida no perecedera para al menos 3 días, y abrelatas manual',
      'Linterna y pilas de repuesto',
      'Radio a pilas o a manivela',
      'Botiquín de primeros auxilios',
      'Silbato para pedir ayuda',
      'Barbijos (N95 o FFP2 si hay ceniza o humo)',
      'Celular, cargador y batería portátil',
      'Toallitas húmedas, bolsas de residuos y precintos',
      'Llave o pinza para cortar gas y agua',
    ] },
    { title: 'Para tu familia', items: [
      'Medicamentos recetados y receta',
      'Anteojos de repuesto',
      'Copias de documentos en una bolsa impermeable',
      'Algo de dinero en efectivo',
      'Ropa de abrigo y una manta por persona',
      'Lo que necesiten bebés, personas mayores o con discapacidad',
      'Comida y agua para las mascotas',
    ] },
  ],
  en: [
    { title: 'The basics', items: [
      'Water: about 4 liters (1 gallon) per person per day, for several days (drinking and sanitation)',
      'Non-perishable food for at least 3 days, and a manual can opener',
      'Flashlight and spare batteries',
      'Battery-powered or hand-crank radio',
      'First aid kit',
      'Whistle to signal for help',
      'Masks (N95 or FFP2 if there is ash or smoke)',
      'Phone, charger and power bank',
      'Moist towelettes, garbage bags and plastic ties',
      'Wrench or pliers to turn off gas and water',
    ] },
    { title: 'For your family', items: [
      'Prescription medicines and prescriptions',
      'Spare glasses',
      'Copies of documents in a waterproof bag',
      'Some cash',
      'Warm clothes and a blanket per person',
      'Whatever babies, older people or people with disabilities need',
      'Food and water for pets',
    ] },
  ],
};

export const GUIDE_SOURCES = [
  { label: 'Ready.gov (FEMA) · Arme un kit', url: 'https://www.ready.gov/es/kit' },
  { label: 'Ready.gov (FEMA) · Haga un plan', url: 'https://www.ready.gov/es/plan' },
  { label: 'Ready.gov (FEMA) · Terremotos', url: 'https://www.ready.gov/es/terremotos' },
  { label: 'NWS · Seguridad ante tsunamis, huracanes e inundaciones', url: 'https://www.weather.gov/safety/' },
  { label: 'IVHHN · Protección contra la ceniza', url: 'https://www.ivhhn.org/ash-protection' },
  { label: 'OMS · Calor y salud', url: 'https://www.who.int/es/news-room/fact-sheets/detail/climate-change-heat-and-health' },
  { label: 'SENAPRED (Chile)', url: 'https://senapred.cl/' },
  { label: 'SINAGIR · Protección Civil (Argentina)', url: 'https://www.argentina.gob.ar/sinagir' },
];
