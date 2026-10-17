/*
 * NNR-MORVEL56: velocidades angulares de 56 placas en el marco sin rotación neta.
 * Argus, D. F., Gordon, R. G. y DeMets, C. (2011), Geochem. Geophys. Geosyst. 12, Q11001,
 * doi:10.1029/2011GC003751, Tabla 1. [latitud °N, longitud °E, ω °/Ma]
 * Minúsculas: placas de MORVEL (DeMets et al., 2010); mayúsculas: placas de Bird (2003).
 */
export const NNR_MORVEL56: Record<string, [number, number, number]> = {
  am: [63.17, -122.82, 0.297], an: [65.42, -118.11, 0.25], ar: [48.88, -8.49, 0.559], au: [33.86, 37.94, 0.632],
  cp: [44.44, 23.09, 0.608], ca: [35.2, -92.62, 0.286], co: [26.93, -124.31, 1.198], eu: [48.85, -106.5, 0.223],
  in: [50.37, -3.29, 0.544], jf: [-38.31, 60.04, 0.951], lw: [51.89, -69.52, 0.286], mq: [49.19, 11.05, 1.144],
  nz: [46.23, -101.06, 0.696], na: [-4.85, -80.64, 0.209], nb: [47.68, -68.44, 0.292], pa: [-63.58, 114.7, 0.651],
  ps: [-46.02, -31.36, 0.91], ri: [20.25, -107.29, 4.536], sw: [-29.94, -36.87, 1.362], sc: [22.52, -106.15, 0.146],
  sm: [49.95, -84.52, 0.339], sa: [-22.62, -112.83, 0.109], su: [50.06, -95.02, 0.337], sr: [-32.5, -111.32, 0.107],
  yz: [63.03, -116.62, 0.334],
  AS: [19.43, 122.87, 0.124], AP: [-6.58, -83.98, 0.488], AT: [40.11, 26.66, 1.21], BR: [-63.74, 142.06, 0.49],
  BS: [-1.49, 121.64, 2.475], BH: [-40, 100.5, 0.799], BU: [-6.13, -78.1, 2.229], CL: [-72.78, 72.05, 0.607],
  CR: [-20.4, 170.53, 3.923], EA: [24.97, 67.53, 11.334], FT: [-16.33, 178.07, 5.101], GP: [2.53, 81.18, 5.487],
  JZ: [34.25, 70.74, 22.368], KE: [39.99, 6.46, 2.347], MN: [-3.67, 150.27, 51.569], MO: [14.25, 92.67, 0.774],
  MA: [11.05, 137.84, 1.306], MS: [2.15, -56.09, 3.566], NH: [0.57, -6.6, 2.469], NI: [-3.29, -174.49, 3.314],
  ND: [17.73, -122.68, 0.116], NB: [-45.04, 127.64, 0.856], OK: [30.3, -92.28, 0.229], ON: [36.12, 137.92, 2.539],
  PM: [31.35, -113.9, 0.317], SL: [50.71, -143.47, 0.268], SS: [-2.87, 130.62, 1.703], SB: [6.88, -31.89, 8.111],
  TI: [-4.44, 113.5, 1.864], TO: [25.87, 4.48, 8.942], WL: [0.1, 128.52, 1.744],
};

/**
 * Código de placa de PB2002 → placa de NNR-MORVEL56. Los límites de PB2002 no separan
 * Lwandle, Capricornio, Macquarie ni Sur: ahí se usa la placa de PB2002 que las contiene.
 */
const PB_TO_MORVEL: Record<string, string> = {
  AM: 'am', AN: 'an', AR: 'ar', AU: 'au', CA: 'ca', CO: 'co', EU: 'eu', IN: 'in', JF: 'jf', NZ: 'nz', NA: 'na',
  AF: 'nb', PA: 'pa', PS: 'ps', RI: 'ri', SW: 'sw', SC: 'sc', SO: 'sm', SA: 'sa', SU: 'su', YA: 'yz',
};
export const morvelCode = (pb: string) => PB_TO_MORVEL[pb] ?? (NNR_MORVEL56[pb] ? pb : null);

const RAD = Math.PI / 180;
const vec = ([lat, lon, w]: [number, number, number]) => {
  const k = w * RAD; // rad/Ma
  return [k * Math.cos(lat * RAD) * Math.cos(lon * RAD), k * Math.cos(lat * RAD) * Math.sin(lon * RAD), k * Math.sin(lat * RAD)];
};

/**
 * Velocidad de la placa A respecto de la B en un punto (mm/año = km/Ma) y su rumbo (° desde el norte).
 * v = (ωA − ωB) × r, con r el radio terrestre medio (6371 km).
 */
export function relativeVelocity(pbA: string, pbB: string, lon: number, lat: number): { mmYr: number; azimuth: number } | null {
  const a = morvelCode(pbA), b = morvelCode(pbB);
  if (!a || !b || a === b) return null;
  const wa = vec(NNR_MORVEL56[a]), wb = vec(NNR_MORVEL56[b]);
  const w = [wa[0] - wb[0], wa[1] - wb[1], wa[2] - wb[2]];
  const R = 6371, la = lat * RAD, lo = lon * RAD;
  const r = [R * Math.cos(la) * Math.cos(lo), R * Math.cos(la) * Math.sin(lo), R * Math.sin(la)];
  const v = [w[1] * r[2] - w[2] * r[1], w[2] * r[0] - w[0] * r[2], w[0] * r[1] - w[1] * r[0]];
  const east = -Math.sin(lo) * v[0] + Math.cos(lo) * v[1];
  const north = -Math.sin(la) * Math.cos(lo) * v[0] - Math.sin(la) * Math.sin(lo) * v[1] + Math.cos(la) * v[2];
  return { mmYr: Math.hypot(east, north), azimuth: (Math.atan2(east, north) / RAD + 360) % 360 };
}
