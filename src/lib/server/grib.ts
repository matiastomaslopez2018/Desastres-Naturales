import 'server-only';

/*
 * Decodificador mínimo de GRIB2 para los recortes chicos que devuelve el filtro de NOMADS
 * (NOAA): grilla lat/lon (plantilla 3.0) y empaquetado simple (plantilla 5.0). Alcanza para
 * leer el viento a 10 m (UGRD/VGRD) del modelo GFS. Si llega otro formato, se descarta.
 */

export type GribField = {
  category: number; number: number;
  ni: number; nj: number; la1: number; lo1: number; di: number; dj: number; scan: number;
  values: Float64Array;
};

/** Entero con signo en "signo y magnitud" (como usa GRIB2). */
const sm16 = (b: Buffer, o: number) => { const v = b.readUInt16BE(o); return v & 0x8000 ? -(v & 0x7fff) : v; };
const sm32 = (b: Buffer, o: number) => { const v = b.readUInt32BE(o); return v & 0x80000000 ? -(v & 0x7fffffff) : v; };

export function decodeGrib2(buf: Buffer): GribField[] {
  const out: GribField[] = [];
  let p = 0;
  while (p + 16 <= buf.length) {
    if (buf.toString('ascii', p, p + 4) !== 'GRIB') { p++; continue; }
    const total = Number(buf.readBigUInt64BE(p + 8));
    const end = p + total;
    let q = p + 16;
    let grid: Omit<GribField, 'category' | 'number' | 'values'> | null = null;
    let cat = -1, num = -1, R = 0, E = 0, D = 0, nbits = 0, tmpl5 = -1, npts = 0, bitmap = 255;
    while (q + 5 <= end - 4) {
      const len = buf.readUInt32BE(q), sec = buf[q + 4];
      if (sec === 3 && buf.readUInt16BE(q + 12) === 0) {
        grid = {
          ni: buf.readUInt32BE(q + 30), nj: buf.readUInt32BE(q + 34),
          la1: sm32(buf, q + 46) / 1e6, lo1: sm32(buf, q + 50) / 1e6,
          di: buf.readUInt32BE(q + 63) / 1e6, dj: buf.readUInt32BE(q + 67) / 1e6, scan: buf[q + 71],
        };
      } else if (sec === 4) {
        cat = buf[q + 9]; num = buf[q + 10];
      } else if (sec === 5) {
        npts = buf.readUInt32BE(q + 5); tmpl5 = buf.readUInt16BE(q + 9);
        R = buf.readFloatBE(q + 11); E = sm16(buf, q + 15); D = sm16(buf, q + 17); nbits = buf[q + 19];
      } else if (sec === 6) {
        bitmap = buf[q + 5];
      } else if (sec === 7 && grid && tmpl5 === 0 && bitmap === 255) {
        const values = new Float64Array(npts);
        const scaleE = 2 ** E, scaleD = 10 ** D;
        let bit = (q + 5) * 8;
        for (let i = 0; i < npts; i++) {
          let x = 0;
          for (let k = 0; k < nbits; k++, bit++) x = x * 2 + ((buf[bit >> 3] >> (7 - (bit & 7))) & 1);
          values[i] = (R + x * scaleE) / scaleD;
        }
        out.push({ ...grid, category: cat, number: num, values });
      }
      q += len;
    }
    p = end;
  }
  return out;
}

/** Valor del punto de grilla más cercano a lon/lat (plantilla 3.0, escaneo 0 o 64). */
export function valueAt(f: GribField, lon: number, lat: number): number | null {
  const lo = ((lon - f.lo1) % 360 + 360) % 360;
  const i = Math.round(lo / f.di);
  // Escaneo 0: filas de norte a sur; 64: de sur a norte.
  const j = f.scan & 64 ? Math.round((lat - f.la1) / f.dj) : Math.round((f.la1 - lat) / f.dj);
  if (i < 0 || i >= f.ni || j < 0 || j >= f.nj) return null;
  const v = f.values[j * f.ni + i];
  return Number.isFinite(v) ? v : null;
}
