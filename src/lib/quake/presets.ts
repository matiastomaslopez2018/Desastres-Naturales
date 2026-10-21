/*
 * Sismos reales para cargar en el simulador. Magnitud, profundidad y epicentro del catálogo ComCat del USGS
 * (ID de cada evento); la ciudad es el sitio donde se calcula el sacudón y su distancia al epicentro se
 * calcula con las coordenadas. El ambiente y el tipo de falla son los de la literatura de cada evento.
 * Simplificación: la ciudad se ubica en la dirección hacia la que buza la falla (ver el corte).
 */
import type { Mechanism, Setting } from './gmpe';
import type { Lang } from '../types';

export type Preset = {
  id: string; usgs: string; year: number;
  name: Record<Lang, string>; city: Record<Lang, string>;
  mag: number; depth: number; setting: Setting; mech: Mechanism;
  epi: [number, number]; site: [number, number];
  /** Vs30 representativo del suelo de la ciudad (m/s). */
  vs30: number;
  note: Record<Lang, string>;
};

/** Distancia sobre la superficie (km) entre dos puntos [lon, lat]. */
export function greatCircleKm([lo1, la1]: [number, number], [lo2, la2]: [number, number]) {
  const r = Math.PI / 180, dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

export const PRESETS: Preset[] = [
  {
    id: 'valdivia-1960', usgs: 'official19600522191120_30', year: 1960,
    name: { es: 'Valdivia, Chile (1960)', en: 'Valdivia, Chile (1960)' }, city: { es: 'Valdivia', en: 'Valdivia' },
    mag: 9.5, depth: 25, setting: 'interface', mech: 'reverse', epi: [-73.407, -38.143], site: [-73.245, -39.814], vs30: 360,
    note: { es: 'El sismo más grande registrado por instrumentos. Generó un tsunami que cruzó el Pacífico.', en: 'The largest earthquake ever recorded by instruments. Its tsunami crossed the Pacific.' },
  },
  {
    id: 'maule-2010', usgs: 'official20100227063411530_30', year: 2010,
    name: { es: 'Maule, Chile (2010)', en: 'Maule, Chile (2010)' }, city: { es: 'Concepción', en: 'Concepción' },
    mag: 8.8, depth: 22.9, setting: 'interface', mech: 'reverse', epi: [-72.898, -36.122], site: [-73.05, -36.827], vs30: 360,
    note: { es: 'Ruptura de unos 500 km bajo la costa del centro-sur de Chile, con tsunami.', en: 'A rupture of about 500 km beneath the coast of south-central Chile, with a tsunami.' },
  },
  {
    id: 'tohoku-2011', usgs: 'official20110311054624120_30', year: 2011,
    name: { es: 'Tohoku, Japón (2011)', en: 'Tohoku, Japan (2011)' }, city: { es: 'Sendai', en: 'Sendai' },
    mag: 9.1, depth: 29, setting: 'interface', mech: 'reverse', epi: [142.373, 38.297], site: [140.872, 38.268], vs30: 360,
    note: { es: 'La falla se deslizó decenas de metros cerca de la fosa; el tsunami causó la mayor parte de las víctimas.', en: 'The fault slipped tens of metres near the trench; the tsunami caused most of the deaths.' },
  },
  {
    id: 'michoacan-1985', usgs: 'usp0002jwe', year: 1985,
    name: { es: 'Michoacán, México (1985)', en: 'Michoacán, Mexico (1985)' }, city: { es: 'Ciudad de México', en: 'Mexico City' },
    mag: 8.0, depth: 27.9, setting: 'interface', mech: 'reverse', epi: [-102.533, 18.19], site: [-99.133, 19.433], vs30: 150,
    note: {
      es: 'A casi 400 km del epicentro, las arcillas del antiguo lago amplificaron ondas de unos 2 segundos y derrumbaron edificios medianos. Los modelos basados en Vs30, como este, subestiman ese efecto de cuenca.',
      en: 'Almost 400 km from the epicentre, the old lakebed clays amplified waves of about 2 seconds and brought down mid-rise buildings. Vs30-based models like this one underestimate that basin effect.',
    },
  },
  {
    id: 'puebla-2017', usgs: 'us2000ar20', year: 2017,
    name: { es: 'Puebla-Morelos, México (2017)', en: 'Puebla-Morelos, Mexico (2017)' }, city: { es: 'Ciudad de México', en: 'Mexico City' },
    mag: 7.1, depth: 48, setting: 'slab', mech: 'normal', epi: [-98.4887, 18.5499], site: [-99.133, 19.433], vs30: 150,
    note: { es: 'Sismo intraplaca, dentro de la placa de Cocos que se hunde. Ocurrió el 19 de septiembre, aniversario del de 1985.', en: 'An intraslab earthquake inside the sinking Cocos plate. It struck on 19 September, the anniversary of 1985.' },
  },
  {
    id: 'haiti-2010', usgs: 'usp000h60h', year: 2010,
    name: { es: 'Haití (2010)', en: 'Haiti (2010)' }, city: { es: 'Puerto Príncipe', en: 'Port-au-Prince' },
    mag: 7.0, depth: 13, setting: 'crustal', mech: 'strike-slip', epi: [-72.571, 18.443], site: [-72.335, 18.539], vs30: 360,
    note: { es: 'Superficial y a unos 25 km de la capital: un sismo moderado en el peor lugar.', en: 'Shallow and about 25 km from the capital: a moderate earthquake in the worst place.' },
  },
  {
    id: 'turkiye-2023', usgs: 'us6000jllz', year: 2023,
    name: { es: 'Kahramanmaraş, Turquía (2023)', en: 'Kahramanmaraş, Türkiye (2023)' }, city: { es: 'Gaziantep', en: 'Gaziantep' },
    mag: 7.8, depth: 10, setting: 'crustal', mech: 'strike-slip', epi: [37.0143, 37.2256], site: [37.383, 37.066], vs30: 360,
    note: { es: 'Rompió más de 300 km de la falla de Anatolia Oriental en pocos minutos.', en: 'It ruptured more than 300 km of the East Anatolian Fault within minutes.' },
  },
  {
    id: 'sanjuan-1944', usgs: 'iscgem899270', year: 1944,
    name: { es: 'San Juan, Argentina (1944)', en: 'San Juan, Argentina (1944)' }, city: { es: 'San Juan', en: 'San Juan' },
    mag: 6.9, depth: 15, setting: 'crustal', mech: 'reverse', epi: [-68.491, -31.496], site: [-68.536, -31.537], vs30: 360,
    note: { es: 'Casi bajo la ciudad: destruyó gran parte de San Juan y es el sismo más mortífero de la historia argentina.', en: 'Almost beneath the city: it destroyed much of San Juan and is the deadliest earthquake in Argentina’s history.' },
  },
  {
    id: 'caucete-1977', usgs: 'usp0000rp1', year: 1977,
    name: { es: 'Caucete, Argentina (1977)', en: 'Caucete, Argentina (1977)' }, city: { es: 'Caucete', en: 'Caucete' },
    mag: 7.4, depth: 13, setting: 'crustal', mech: 'reverse', epi: [-67.767, -31.028], site: [-68.281, -31.652], vs30: 270,
    note: { es: 'Suelos arenosos saturados se licuaron en la zona de Caucete. Magnitud en escala Ms del catálogo del USGS.', en: 'Saturated sandy soils liquefied around Caucete. Magnitude on the Ms scale of the USGS catalogue.' },
  },
  {
    id: 'mendoza-1985', usgs: 'usp0002bct', year: 1985,
    name: { es: 'Mendoza, Argentina (1985)', en: 'Mendoza, Argentina (1985)' }, city: { es: 'Mendoza', en: 'Mendoza' },
    mag: 6.2, depth: 5, setting: 'crustal', mech: 'reverse', epi: [-68.467, -33.053], site: [-68.845, -32.889], vs30: 360,
    note: { es: 'Muy superficial y cerca del Gran Mendoza.', en: 'Very shallow and close to Greater Mendoza.' },
  },
];

export const presetDist = (p: Preset) => Math.round(greatCircleKm(p.epi, p.site));
