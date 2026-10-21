/*
 * Tsunamis reales del simulador. Fuente: modelo de falla finita del USGS (deslizamiento invertido de datos
 * sísmicos) cuando existe; si no (1960), una falla uniforme con el tamaño de Strasser et al. (2010) para su
 * magnitud. Observaciones: base de datos mundial de tsunamis de la NOAA (NCEI).
 */
import type { Lang } from '../types';

export type OceanBox = { lonW: number; lonE: number; latS: number; latN: number };

export type TsunamiPreset = {
  id: string; usgs: string; year: number; month: number; day: number; mag: number;
  name: Record<Lang, string>;
  note: Record<Lang, string>;
  /** Cuenca simulada (longitudes 0–360 continuas). */
  box: OceanBox;
  /** Falla uniforme aproximada si no hay modelo de falla finita del USGS. */
  uniform?: { lon: number; lat: number; /** Profundidad del borde superior (km), cerca de la fosa. */ topKm: number; strike: number; dip: number; rake: number };
  /** Lugares de la costa para la escena de llegada (nombre, lon, lat). */
  coast: { name: string; lon: number; lat: number }[];
};

const PACIFIC: OceanBox = { lonW: 110, lonE: 292, latS: -64, latN: 64 };
const INDIAN: OceanBox = { lonW: 25, lonE: 125, latS: -50, latN: 28 };

export const TSUNAMI_PRESETS: TsunamiPreset[] = [
  {
    id: 'tohoku-2011', usgs: 'official20110311054624120_30', year: 2011, month: 3, day: 11, mag: 9.1,
    name: { es: 'Tohoku, Japón (2011)', en: 'Tohoku, Japan (2011)' },
    note: { es: 'Olas de más de 30 m en la costa de Iwate; cruzó el Pacífico y llegó a Chile unas 22 horas después.', en: 'Waves over 30 m on the Iwate coast; it crossed the Pacific and reached Chile about 22 hours later.' },
    box: PACIFIC, coast: [{ name: 'Sendai', lon: 141.05, lat: 38.25 }, { name: 'Hilo', lon: -155.07, lat: 19.73 }, { name: 'Talcahuano', lon: -73.1, lat: -36.7 }],
  },
  {
    id: 'maule-2010', usgs: 'official20100227063411530_30', year: 2010, month: 2, day: 27, mag: 8.8,
    name: { es: 'Maule, Chile (2010)', en: 'Maule, Chile (2010)' },
    note: { es: 'Llegó a la costa chilena en minutos; en Constitución el agua alcanzó 29 m de altura en su punto máximo.', en: 'It reached the Chilean coast within minutes; in Constitución the water reached 29 m at its highest point.' },
    box: PACIFIC, coast: [{ name: 'Constitución', lon: -72.42, lat: -35.33 }, { name: 'Hilo', lon: -155.07, lat: 19.73 }, { name: 'Sendai', lon: 141.05, lat: 38.25 }],
  },
  {
    id: 'valdivia-1960', usgs: 'official19600522191120_30', year: 1960, month: 5, day: 22, mag: 9.5,
    name: { es: 'Valdivia, Chile (1960)', en: 'Valdivia, Chile (1960)' },
    note: { es: 'El tsunami del sismo más grande registrado: 61 muertos en Hilo (Hawái) y 142 en Japón, casi un día después.', en: 'The tsunami of the largest earthquake ever recorded: 61 dead in Hilo (Hawaii) and 142 in Japan, almost a day later.' },
    box: PACIFIC,
    // Falla uniforme centrada en la zona de ruptura (~37° a 46° S), sobre la interfaz de subducción.
    uniform: { lon: -74.2, lat: -41.5, topKm: 5, strike: 7, dip: 18, rake: 90 },
    coast: [{ name: 'Corral', lon: -73.43, lat: -39.88 }, { name: 'Hilo', lon: -155.07, lat: 19.73 }, { name: 'Sendai', lon: 141.05, lat: 38.25 }],
  },
  {
    id: 'kamchatka-2025', usgs: 'us6000qw60', year: 2025, month: 7, day: 29, mag: 8.8,
    name: { es: 'Kamchatka, Rusia (2025)', en: 'Kamchatka, Russia (2025)' },
    note: { es: 'Generó alertas en todo el Pacífico; las boyas DART lo registraron en mar abierto.', en: 'It triggered warnings across the Pacific; DART buoys recorded it in the open ocean.' },
    box: PACIFIC, coast: [{ name: 'Severo-Kurilsk', lon: 156.13, lat: 50.68 }, { name: 'Hilo', lon: -155.07, lat: 19.73 }, { name: 'Talcahuano', lon: -73.1, lat: -36.7 }],
  },
  {
    id: 'illapel-2015', usgs: 'us20003k7a', year: 2015, month: 9, day: 16, mag: 8.3,
    name: { es: 'Illapel, Chile (2015)', en: 'Illapel, Chile (2015)' },
    note: { es: 'La evacuación preventiva de la costa chilena salvó muchas vidas; el agua llegó a 13,6 m al sur de Coquimbo.', en: 'Preventive evacuation of the Chilean coast saved many lives; the water reached 13.6 m south of Coquimbo.' },
    box: PACIFIC, coast: [{ name: 'Coquimbo', lon: -71.34, lat: -29.95 }, { name: 'Hilo', lon: -155.07, lat: 19.73 }, { name: 'Sendai', lon: 141.05, lat: 38.25 }],
  },
  {
    id: 'sumatra-2004', usgs: 'official20041226005853450_30', year: 2004, month: 12, day: 26, mag: 9.1,
    name: { es: 'Sumatra-Andamán (2004)', en: 'Sumatra-Andaman (2004)' },
    note: { es: 'El tsunami más mortífero de la historia: unas 230.000 víctimas en 14 países del océano Índico.', en: 'The deadliest tsunami in history: about 230,000 victims in 14 countries around the Indian Ocean.' },
    box: INDIAN, coast: [{ name: 'Banda Aceh', lon: 95.32, lat: 5.55 }, { name: 'Phuket', lon: 98.3, lat: 7.89 }, { name: 'Colombo', lon: 79.85, lat: 6.93 }],
  },
];

/** Longitud llevada al rango de la caja (0–360 continuo). */
export const boxLon = (box: OceanBox, lon: number) => { let x = ((lon % 360) + 360) % 360; if (x < box.lonW) x += 360; return x; };
