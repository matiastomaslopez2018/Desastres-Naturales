import 'server-only';
import { decodeGrib2, valueAt } from './grib';
import { kvCached } from './kvCache';

/*
 * Perfil de viento actual sobre un volcán: modelo GFS de la NOAA (0,25°, análisis de la corrida más
 * reciente) en 17 niveles de presión, de 1000 a 10 hPa, por el filtro GRIB de NOMADS. Cada nivel trae su
 * altura geopotencial (m), así el modelo de ceniza recibe el viento por altura.
 */

const LEVELS = [1000, 925, 850, 700, 600, 500, 400, 300, 250, 200, 150, 100, 70, 50, 30, 20, 10];
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const url = (ymd: string, hh: string, lon: number, lat: number) =>
  `https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?dir=%2Fgfs.${ymd}%2F${hh}%2Fatmos&file=gfs.t${hh}z.pgrb2.0p25.f000` +
  `&var_UGRD=on&var_VGRD=on&var_HGT=on${LEVELS.map((p) => `&lev_${p}_mb=on`).join('')}` +
  `&subregion=&toplat=${(lat + 0.5).toFixed(2)}&leftlon=${(lon - 0.5).toFixed(2)}&rightlon=${(lon + 0.5).toFixed(2)}&bottomlat=${(lat - 0.5).toFixed(2)}`;

export type WindNow = { run: number; levels: { p: number; h: number; u: number; v: number }[] };

export async function windProfileNow(lon: number, lat: number): Promise<WindNow | null> {
  const key = `volcano:wind:${lon.toFixed(2)}:${lat.toFixed(2)}:${Math.floor(Date.now() / (3 * 36e5))}`;
  const r = await kvCached(key, 3 * 36e5, async () => {
    // Corrida más reciente publicada (GFS sale cada 6 h y tarda unas 4 h en estar completa).
    for (const back of [4, 10, 16]) {
      const run = Math.floor((Date.now() - back * 36e5) / (6 * 36e5)) * 6 * 36e5;
      const hh = String(new Date(run).getUTCHours()).padStart(2, '0');
      const res = await fetch(url(iso(run).replace(/-/g, ''), hh, lon, lat), { signal: AbortSignal.timeout(25000) }).catch(() => null);
      if (!res?.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.toString('ascii', 0, 4) !== 'GRIB') continue;
      const fields = decodeGrib2(buf).filter((f) => f.surface === 100);
      const get = (cat: number, num: number, p: number) => {
        const f = fields.find((x) => x.category === cat && x.number === num && Math.abs(x.level - p * 100) < 1);
        return f ? valueAt(f, lon, lat) : null;
      };
      // Viento: categoría 2 (u = 2, v = 3); altura geopotencial: categoría 3, número 5.
      const levels = LEVELS.map((p) => ({ p, h: get(3, 5, p), u: get(2, 2, p), v: get(2, 3, p) }))
        .filter((l): l is { p: number; h: number; u: number; v: number } => l.h != null && l.u != null && l.v != null)
        .map((l) => ({ p: l.p, h: Math.round(l.h), u: +l.u.toFixed(2), v: +l.v.toFixed(2) }));
      if (levels.length >= 10) return { run, levels };
    }
    return null;
  }).catch(() => null);
  return r?.value ?? null;
}
