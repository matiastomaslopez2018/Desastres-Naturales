/*
 * Deformación vertical del fondo marino por una falla rectangular en un semiespacio elástico:
 * Okada (1985), BSSA 75(4):1135–1154. Coeficiente de Poisson 0,25.
 *
 * Sigue la implementación de GeoClaw (Clawpack, licencia BSD; src/python/geoclaw/dtopotools.py), la que se
 * usa en los modelos de tsunami del USGS y de la NOAA, y se verifica contra sus datos de prueba
 * (scripts/verify-okada.ts): el sismo de Alaska de 1964 en 12 subfallas.
 */

const POISSON = 0.25;
/** Radio terrestre que usa GeoClaw (promedio polar-ecuatorial) para pasar de grados a metros. */
const REARTH = 6367.5e3, D2R = Math.PI / 180, LAT2M = REARTH * D2R;

export type Subfault = {
  lon: number; lat: number;
  /** Profundidad (m) según `spec`. */
  depth: number;
  length: number; width: number; // m
  strike: number; dip: number; rake: number; // grados
  slip: number; // m
  /** Qué punto de la subfalla dan lon/lat/depth (convenciones de GeoClaw). */
  spec: 'top center' | 'centroid' | 'bottom center' | 'noaa sift';
};

/** Centro del borde inferior (lon, lat) y su profundidad (m): el punto de referencia de las fórmulas. */
export function bottomCenter(f: Subfault) {
  const sd = Math.sin(f.dip * D2R), w = f.width;
  const depthBottom = f.spec === 'centroid' ? f.depth + 0.5 * w * sd : f.spec === 'bottom center' ? f.depth : f.depth + w * sd;
  // Vector desde el borde inferior al superior, en grados.
  const upDip = [
    (-w * Math.cos(f.dip * D2R) * Math.cos(f.strike * D2R)) / (LAT2M * Math.cos(f.lat * D2R)),
    (w * Math.cos(f.dip * D2R) * Math.sin(f.strike * D2R)) / LAT2M,
  ];
  const [lon, lat] =
    f.spec === 'top center' ? [f.lon - upDip[0], f.lat - upDip[1]]
    : f.spec === 'centroid' ? [f.lon - 0.5 * upDip[0], f.lat - 0.5 * upDip[1]]
    : [f.lon, f.lat]; // 'bottom center' y 'noaa sift' (lon/lat en el borde inferior)
  return { lon, lat, depth: depthBottom };
}

function strikeSlip(y1: number, y2: number, dip: number, q: number) {
  const sn = Math.sin(dip), cs = Math.cos(dip);
  const dBar = y2 * sn - q * cs, r = Math.sqrt(y1 * y1 + y2 * y2 + q * q);
  const a4 = ((2 * POISSON) / cs) * (Math.log(r + dBar) - sn * Math.log(r + y2));
  return -((dBar * q) / r / (r + y2) + (q * sn) / (r + y2) + a4 * sn) / (2 * Math.PI);
}
function dipSlip(y1: number, y2: number, dip: number, q: number) {
  const sn = Math.sin(dip), cs = Math.cos(dip);
  const dBar = y2 * sn - q * cs, r = Math.sqrt(y1 * y1 + y2 * y2 + q * q), xx = Math.sqrt(y1 * y1 + q * q);
  const a5 = ((4 * POISSON) / cs) * Math.atan((y2 * (xx + q * cs) + xx * (r + xx) * sn) / y1 / (r + xx) / cs);
  return -((dBar * q) / r / (r + y1) + sn * Math.atan((y1 * y2) / q / r) - a5 * sn * cs) / (2 * Math.PI);
}

/** Subfalla preparada para evaluar muchos puntos. */
export function prepare(f: Subfault) {
  const b = bottomCenter(f);
  const dip = f.dip * D2R, st = f.strike * D2R, rk = f.rake * D2R;
  return { b, dip, sinSt: Math.sin(st), cosSt: Math.cos(st), halfL: 0.5 * f.length, w: f.width, ds: f.slip * Math.cos(rk), dd: f.slip * Math.sin(rk) };
}
export type Prepared = ReturnType<typeof prepare>;

/** Desplazamiento vertical (m, positivo hacia arriba) en (lon, lat) por una subfalla preparada. */
export function dzAt(P: Prepared, lon: number, lat: number) {
  const xx = LAT2M * Math.cos(D2R * lat) * (lon - P.b.lon), yy = LAT2M * (lat - P.b.lat);
  const x1 = xx * P.sinSt + yy * P.cosSt;
  const x2 = -(xx * P.cosSt - yy * P.sinSt);
  const p = x2 * Math.cos(P.dip) + P.b.depth * Math.sin(P.dip), q = x2 * Math.sin(P.dip) - P.b.depth * Math.cos(P.dip);
  const us = (strikeSlip(x1 + P.halfL, p, P.dip, q) - strikeSlip(x1 + P.halfL, p - P.w, P.dip, q) - strikeSlip(x1 - P.halfL, p, P.dip, q) + strikeSlip(x1 - P.halfL, p - P.w, P.dip, q)) * P.ds;
  const ud = (dipSlip(x1 + P.halfL, p, P.dip, q) - dipSlip(x1 + P.halfL, p - P.w, P.dip, q) - dipSlip(x1 - P.halfL, p, P.dip, q) + dipSlip(x1 - P.halfL, p - P.w, P.dip, q)) * P.dd;
  return us + ud;
}

/** Suma de varias subfallas en una grilla lon/lat (filas de sur a norte). */
export function dzGrid(faults: Subfault[], lons: number[], lats: number[]) {
  const ps = faults.map(prepare);
  const out = new Float32Array(lons.length * lats.length);
  lats.forEach((lat, j) => lons.forEach((lon, i) => { let s = 0; for (const P of ps) s += dzAt(P, lon, lat); out[j * lons.length + i] = s; }));
  return out;
}
