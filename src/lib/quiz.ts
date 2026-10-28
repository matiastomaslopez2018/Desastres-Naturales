/*
 * «¿Qué harías?»: situaciones con tres opciones. Las respuestas correctas y las explicaciones salen de las mismas
 * recomendaciones de "Qué hacer" (lib/guides.ts): Ready.gov (FEMA), el NWS, IVHHN y la OMS.
 */
import type { HazardKey } from './guides';
import type { Lang } from './types';

export type QuizItem = {
  hazard: HazardKey;
  q: string;
  /** La primera es la correcta; la página las mezcla. */
  options: { text: string; why: string }[];
  /** Fuente: índice en GUIDE_SOURCES. */
  src: number;
};

const es: QuizItem[] = [
  {
    hazard: 'eq', src: 2,
    q: 'Estás en una oficina en un quinto piso y empieza a temblar fuerte. ¿Qué hacés?',
    options: [
      { text: 'Me agacho, me cubro debajo de un escritorio firme y me sujeto hasta que pare.', why: 'Es la recomendación de Ready.gov: «agachate, cubrite y sujetate» protege de lo que cae, que es lo que más lastima.' },
      { text: 'Corro a la escalera para salir del edificio.', why: 'Moverse mientras tiembla causa muchas lesiones: hay que quedarse adentro hasta que pare, y después bajar por la escalera.' },
      { text: 'Me paro debajo del marco de la puerta.', why: 'Ready.gov pide no ir a los marcos de las puertas: en las construcciones modernas no son más resistentes y la puerta puede golpearte.' },
    ],
  },
  {
    hazard: 'eq', src: 2,
    q: 'Estás manejando por la ciudad y empieza un sismo fuerte. ¿Qué hacés?',
    options: [
      { text: 'Freno en un lugar seguro, lejos de puentes, postes y cables, y me quedo en el auto.', why: 'Es lo indicado: el auto protege de lo que cae, siempre que no estés debajo de algo que se pueda derrumbar.' },
      { text: 'Acelero para llegar rápido a casa.', why: 'Manejar mientras tiembla es muy peligroso: el auto se descontrola y puede haber calles dañadas.' },
      { text: 'Me bajo del auto y corro a un edificio.', why: 'En la calle el peligro son las fachadas, los vidrios y los cables que caen: correr hacia un edificio te acerca a eso.' },
    ],
  },
  {
    hazard: 'tsunami', src: 3,
    q: 'Estás en la playa y sentís un sismo tan fuerte que cuesta estar parado. No suena ninguna alarma. ¿Qué hacés?',
    options: [
      { text: 'Apenas para el movimiento, voy a pie a un lugar alto o tierra adentro.', why: 'Un sismo fuerte o largo en la costa ES la alerta: la ola puede llegar en minutos, antes que cualquier aviso oficial.' },
      { text: 'Espero el aviso oficial para no evacuar de más.', why: 'El aviso puede tardar más de lo que tarda la ola en llegar. En la costa, el propio sismo es la señal para evacuar.' },
      { text: 'Me acerco a la orilla para ver si el mar hace algo raro.', why: 'Es exactamente lo que no hay que hacer: cuando se ve la ola, ya no hay tiempo para escapar.' },
    ],
  },
  {
    hazard: 'tsunami', src: 3,
    q: 'Estás en la costa y ves que el mar se retira de golpe, dejando el fondo al descubierto. ¿Qué hacés?',
    options: [
      { text: 'Me alejo enseguida hacia un lugar alto.', why: 'El retiro brusco del mar es una señal natural de que viene un tsunami: hay que ir a lo alto sin esperar.' },
      { text: 'Aprovecho para juntar caracoles y peces.', why: 'Muchas víctimas de tsunamis estaban mirando o caminando sobre el fondo descubierto cuando volvió el agua.' },
      { text: 'Me quedo a filmarlo desde la orilla.', why: 'La ola llega a una velocidad que no se puede correr: hay que irse apenas se ve la señal.' },
    ],
  },
  {
    hazard: 'flood', src: 3,
    q: 'Venís en auto y la calle está cubierta de agua que corre. No sabés qué tan profunda es. ¿Qué hacés?',
    options: [
      { text: 'Doy la vuelta y busco otro camino.', why: 'Según el Servicio Meteorológico de EE. UU., unos 30 cm de agua en movimiento pueden arrastrar un auto. No se cruza.' },
      { text: 'La cruzo despacio, que el auto es alto.', why: 'El agua que corre empuja el auto y lo puede hacer flotar; además puede haber pozos o la calle hundida debajo.' },
      { text: 'Dejo el auto y cruzo caminando.', why: 'Unos 15 cm de agua en movimiento alcanzan para tirar a una persona.' },
    ],
  },
  {
    hazard: 'volcano', src: 4,
    q: 'Empieza a caer ceniza volcánica sobre tu ciudad. ¿Qué hacés?',
    options: [
      { text: 'Me quedo adentro con puertas y ventanas cerradas; si salgo, uso barbijo N95 o FFP2 bien ajustado y anteojos.', why: 'Es lo que recomienda la red de salud volcánica IVHHN: la ceniza irrita los pulmones y los ojos, y los barbijos de tela no la filtran.' },
      { text: 'Salgo a barrer la vereda en seco antes de que se junte más.', why: 'Barrer en seco levanta el polvo fino: hay que humedecer la ceniza antes, y hacerlo con protección.' },
      { text: 'Me subo al auto y me voy por la ruta.', why: 'La ceniza tapa la visibilidad y vuelve la ruta resbaladiza: hay que evitar manejar, salvo que ordenen evacuar.' },
    ],
  },
  {
    hazard: 'fire', src: 3,
    q: 'Hay un incendio forestal en las sierras y te avisan que evacues tu barrio. Todavía no ves llamas. ¿Qué hacés?',
    options: [
      { text: 'Salgo de inmediato por la ruta indicada.', why: 'El fuego puede avanzar más rápido de lo que se corre y cortar los caminos: hay que irse apenas lo piden.' },
      { text: 'Me quedo mojando el techo con la manguera.', why: 'Quedarse a defender la casa es muy peligroso y, además, ocupa agua y caminos que necesitan los bomberos.' },
      { text: 'Espero a ver si el humo se acerca.', why: 'Cuando el humo está encima puede ser tarde: la visibilidad cae y las rutas se cierran.' },
    ],
  },
  {
    hazard: 'eq', src: 2,
    q: 'Pasó un sismo fuerte. Al volver a la cocina sentís olor a gas. ¿Qué hacés?',
    options: [
      { text: 'Abro las ventanas, salgo y no prendo ni apago nada.', why: 'Cualquier chispa, incluso la de un interruptor, puede provocar una explosión. Hay que ventilar, salir y avisar.' },
      { text: 'Prendo la luz para ver de dónde viene.', why: 'El interruptor hace una chispa que puede encender el gas acumulado.' },
      { text: 'Enciendo un fósforo para revisar la cocina.', why: 'Es la forma más directa de provocar una explosión.' },
    ],
  },
  {
    hazard: 'storm', src: 3,
    q: 'Pasa un huracán. De repente el viento para y sale el sol. ¿Qué hacés?',
    options: [
      { text: 'Me quedo adentro: puede ser el ojo y el viento va a volver del otro lado.', why: 'La calma del ojo puede durar minutos; después vuelve el viento, a veces más fuerte y desde la dirección contraria.' },
      { text: 'Salgo a revisar los daños.', why: 'Si es el ojo, el viento vuelve en minutos y te encuentra afuera, con escombros volando.' },
      { text: 'Aprovecho para ir en auto a lo de un familiar.', why: 'Además del viento que vuelve, la mayoría de las muertes por huracanes las causa el agua: calles inundadas y marejada.' },
    ],
  },
  {
    hazard: 'heat', src: 3,
    q: 'Hay una ola de calor y tenés que hacer una compra rápida. Vas con un chico pequeño. ¿Qué hacés?',
    options: [
      { text: 'Lo llevo conmigo: nunca lo dejo solo en el auto, ni por unos minutos.', why: 'El interior de un auto al sol se calienta muy rápido y puede ser mortal, sobre todo para chicos, personas mayores y mascotas.' },
      { text: 'Lo dejo en el auto con la ventanilla un poco abierta.', why: 'Abrir un poco la ventanilla casi no baja la temperatura adentro del auto.' },
      { text: 'Lo dejo en el auto con el motor y el aire prendidos.', why: 'El motor puede apagarse o el chico puede quedar encerrado; nunca hay que dejarlo solo en el auto.' },
    ],
  },
];

const en: QuizItem[] = [
  {
    hazard: 'eq', src: 2,
    q: 'You are in an office on the fifth floor and strong shaking starts. What do you do?',
    options: [
      { text: 'Drop, take cover under a sturdy desk and hold on until it stops.', why: 'This is Ready.gov’s advice: “drop, cover and hold on” protects you from falling objects, which cause most injuries.' },
      { text: 'Run to the stairs to get out of the building.', why: 'Moving while the ground shakes causes many injuries: stay inside until it stops, then use the stairs.' },
      { text: 'Stand in a doorway.', why: 'Ready.gov says not to get in a doorway: in modern buildings it is no stronger, and the door can hit you.' },
    ],
  },
  {
    hazard: 'eq', src: 2,
    q: 'You are driving through the city and a strong earthquake starts. What do you do?',
    options: [
      { text: 'Pull over somewhere safe, away from bridges, poles and wires, and stay in the car.', why: 'That is the advice: the car protects you from falling objects, as long as you are not under something that can collapse.' },
      { text: 'Speed up to get home quickly.', why: 'Driving while the ground shakes is very dangerous: you can lose control and streets may be damaged.' },
      { text: 'Get out and run into a building.', why: 'In the street the danger is facades, glass and falling wires: running towards a building brings you closer to them.' },
    ],
  },
  {
    hazard: 'tsunami', src: 3,
    q: 'You are on the beach and feel an earthquake so strong it is hard to stand. No siren goes off. What do you do?',
    options: [
      { text: 'As soon as the shaking stops, I walk to high ground or inland.', why: 'A strong or long earthquake on the coast IS the warning: the wave can arrive in minutes, before any official alert.' },
      { text: 'I wait for the official alert so I don’t evacuate for nothing.', why: 'The alert may take longer than the wave. On the coast, the earthquake itself is the signal to evacuate.' },
      { text: 'I go to the shore to see if the sea does anything strange.', why: 'That is exactly what not to do: when you see the wave, there is no time left to escape.' },
    ],
  },
  {
    hazard: 'tsunami', src: 3,
    q: 'You are on the coast and the sea suddenly pulls back, exposing the seabed. What do you do?',
    options: [
      { text: 'I move to high ground right away.', why: 'A sudden withdrawal of the sea is a natural warning of a tsunami: go to high ground without waiting.' },
      { text: 'I pick up shells and stranded fish.', why: 'Many tsunami victims were watching or walking on the exposed seabed when the water came back.' },
      { text: 'I stay on the shore to film it.', why: 'The wave comes faster than anyone can run: leave as soon as you see the sign.' },
    ],
  },
  {
    hazard: 'flood', src: 3,
    q: 'You are driving and the street is covered by flowing water. You don’t know how deep it is. What do you do?',
    options: [
      { text: 'Turn around and find another route.', why: 'According to the US National Weather Service, about 30 cm (12 in) of moving water can sweep a car away. Don’t cross.' },
      { text: 'Cross slowly, my car is tall.', why: 'Moving water pushes the car and can make it float; there may also be holes or a collapsed road underneath.' },
      { text: 'Leave the car and walk across.', why: 'About 15 cm (6 in) of moving water is enough to knock a person down.' },
    ],
  },
  {
    hazard: 'volcano', src: 4,
    q: 'Volcanic ash starts falling on your city. What do you do?',
    options: [
      { text: 'Stay indoors with doors and windows closed; if I go out, wear a well-fitted N95/FFP2 mask and goggles.', why: 'This is the advice of the volcanic health network IVHHN: ash irritates lungs and eyes, and cloth masks don’t filter it.' },
      { text: 'Go out and dry-sweep the pavement before more piles up.', why: 'Dry sweeping lifts the fine dust: dampen the ash first, and wear protection.' },
      { text: 'Get in the car and drive away.', why: 'Ash cuts visibility and makes roads slippery: avoid driving unless an evacuation is ordered.' },
    ],
  },
  {
    hazard: 'fire', src: 3,
    q: 'A wildfire is burning in the hills and you are told to evacuate your neighbourhood. You can’t see flames yet. What do you do?',
    options: [
      { text: 'Leave right away by the indicated route.', why: 'Fire can spread faster than you can run and cut off roads: leave as soon as you are asked to.' },
      { text: 'Stay and hose down the roof.', why: 'Staying to defend the house is very dangerous and uses water and roads the firefighters need.' },
      { text: 'Wait to see whether the smoke gets closer.', why: 'By the time the smoke is overhead it may be too late: visibility drops and roads close.' },
    ],
  },
  {
    hazard: 'eq', src: 2,
    q: 'A strong earthquake has just happened. Back in the kitchen, you smell gas. What do you do?',
    options: [
      { text: 'Open the windows, get out and don’t switch anything on or off.', why: 'Any spark, even from a light switch, can cause an explosion. Ventilate, get out and report it.' },
      { text: 'Turn on the light to see where it comes from.', why: 'The switch makes a spark that can ignite the gas.' },
      { text: 'Strike a match to check the stove.', why: 'That is the most direct way to cause an explosion.' },
    ],
  },
  {
    hazard: 'storm', src: 3,
    q: 'A hurricane is passing. Suddenly the wind stops and the sun comes out. What do you do?',
    options: [
      { text: 'Stay inside: it may be the eye, and the wind will return from the other side.', why: 'The calm of the eye can last minutes; then the wind returns, sometimes stronger and from the opposite direction.' },
      { text: 'Go out to check the damage.', why: 'If it is the eye, the wind returns within minutes and catches you outside, with debris flying.' },
      { text: 'Drive to a relative’s house while it is calm.', why: 'Besides the returning wind, most hurricane deaths are caused by water: flooded streets and storm surge.' },
    ],
  },
  {
    hazard: 'heat', src: 3,
    q: 'There is a heat wave and you need to make a quick stop at a shop. You have a small child with you. What do you do?',
    options: [
      { text: 'Take the child with me: never leave them alone in the car, not even for a few minutes.', why: 'A car in the sun heats up very fast and can be deadly, especially for children, older people and pets.' },
      { text: 'Leave the child in the car with the window slightly open.', why: 'Opening the window a little barely lowers the temperature inside the car.' },
      { text: 'Leave the child in the car with the engine and air conditioning on.', why: 'The engine may stop or the child may get locked in; never leave a child alone in a car.' },
    ],
  },
];

export const QUIZ: Record<Lang, QuizItem[]> = { es, en };
