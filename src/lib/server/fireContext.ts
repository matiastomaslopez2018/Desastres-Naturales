import 'server-only';
import { decodeGrib2, valueAt } from './grib';
import { firmsKey } from './firms';
import { kvCached } from './kvCache';

/*
 * Contexto de un incendio. No existe un pronóstico oficial global del recorrido de un
 * incendio, así que no se inventa ninguno; se muestran datos oficiales relacionados:
 *  - Peligro meteorológico de incendio (FWI) de Copernicus GWIS, con pronóstico de varios días.
 *  - Viento a 10 m del modelo GFS de NOAA (filtro GRIB de NOMADS), hoy y las próximas 48 h.
 *  - Focos de calor de NASA FIRMS de los últimos 7 días, para ver hacia dónde avanzó.
 *  - En EE. UU., el perímetro oficial del incendio (NIFC, WFIGS).
 */

const DAY = 864e5;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const r2 = (x: number) => Math.round(x * 100) / 100;

/* ───────────── FWI (Copernicus GWIS, modelo ECMWF) ───────────── */

export type FwiDay = { date: string; fwi: number; level: FwiLevel };
export type FwiLevel = 'very-low' | 'low' | 'moderate' | 'high' | 'very-high' | 'extreme';
/** Clases de peligro de EFFIS/GWIS. */
export const fwiLevel = (v: number): FwiLevel =>
  v < 5.2 ? 'very-low' : v < 11.2 ? 'low' : v < 21.3 ? 'moderate' : v < 38 ? 'high' : v < 50 ? 'very-high' : 'extreme';

async function fwiOn(lon: number, lat: number, date: string): Promise<number | null> {
  const d = 0.5;
  const url = `https://maps.effis.emergency.copernicus.eu/gwis?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=ecmwf.query&query_layers=ecmwf.query&styles=&srs=EPSG:4326&bbox=${lon - d},${lat - d},${lon + d},${lat + d}&width=11&height=11&x=5&y=5&info_format=text/html&time=${date}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!res?.ok) return null;
  const m = /Fire Weather Index \(FWI\)<\/td>\s*<td>([-\d.]+)/i.exec(await res.text());
  const v = m ? Number(m[1]) : NaN;
  return Number.isFinite(v) && v > -900 ? v : null;
}

export async function fwiForecast(lon: number, lat: number): Promise<FwiDay[]> {
  const today = Date.now();
  const r = await kvCached(`fire1:fwi:${r2(lon)}:${r2(lat)}:${iso(today)}`, 6 * 36e5, async () => {
    const days = await Promise.all(Array.from({ length: 7 }, (_, k) => iso(today + k * DAY)).map(async (date) => ({ date, fwi: await fwiOn(lon, lat, date) })));
    return days.filter((d): d is { date: string; fwi: number } => d.fwi != null).map((d) => ({ ...d, fwi: Math.round(d.fwi * 10) / 10, level: fwiLevel(d.fwi) }));
  }).catch(() => null);
  return r?.value ?? [];
}

/* ───────────── Viento (NOAA GFS 0,25°, filtro GRIB de NOMADS) ───────────── */

export type WindStep = { time: number; speedKmh: number; toDeg: number };

const nomads = (ymd: string, hh: string, f: string, lon: number, lat: number) =>
  `https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?dir=%2Fgfs.${ymd}%2F${hh}%2Fatmos&file=gfs.t${hh}z.pgrb2.0p25.f${f}` +
  `&var_UGRD=on&var_VGRD=on&lev_10_m_above_ground=on&subregion=&toplat=${(lat + 0.5).toFixed(2)}&leftlon=${(lon - 0.5).toFixed(2)}&rightlon=${(lon + 0.5).toFixed(2)}&bottomlat=${(lat - 0.5).toFixed(2)}`;

async function fetchBuf(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!res?.ok) return null;
  const b = Buffer.from(await res.arrayBuffer());
  return b.length > 100 && b.toString('ascii', 0, 4) === 'GRIB' ? b : null;
}

export async function windForecast(lon: number, lat: number): Promise<{ run: number; steps: WindStep[] } | null> {
  const r = await kvCached(`fire1:wind:${r2(lon)}:${r2(lat)}:${Math.floor(Date.now() / (3 * 36e5))}`, 3 * 36e5, async () => {
    // Corrida más reciente publicada (GFS sale cada 6 h; tarda ~4 h en estar completa).
    for (const back of [4, 10, 16]) {
      const t = Date.now() - back * 36e5;
      const run = Math.floor(t / (6 * 36e5)) * 6 * 36e5;
      const d = new Date(run), ymd = iso(run).replace(/-/g, ''), hh = String(d.getUTCHours()).padStart(2, '0');
      const first = await fetchBuf(nomads(ymd, hh, '000', lon, lat));
      if (!first) continue;
      const hours = [0, 6, 12, 18, 24, 30, 36, 42, 48];
      const bufs = [first, ...(await Promise.all(hours.slice(1).map((h) => fetchBuf(nomads(ymd, hh, String(h).padStart(3, '0'), lon, lat)))))];
      const steps: WindStep[] = [];
      bufs.forEach((b, i) => {
        if (!b) return;
        const fields = decodeGrib2(b);
        const u = fields.find((f) => f.category === 2 && f.number === 2), v = fields.find((f) => f.category === 2 && f.number === 3);
        const uu = u && valueAt(u, lon, lat), vv = v && valueAt(v, lon, lat);
        if (uu == null || vv == null) return;
        // Rumbo HACIA donde sopla (u: hacia el este, v: hacia el norte).
        steps.push({ time: run + hours[i] * 36e5, speedKmh: Math.round(Math.hypot(uu, vv) * 3.6), toDeg: Math.round((Math.atan2(uu, vv) * 180 / Math.PI + 360) % 360) });
      });
      if (steps.length) return { run, steps };
    }
    return null;
  }).catch(() => null);
  return r?.value ?? null;
}

/* ───────────── Focos FIRMS de los últimos 7 días ───────────── */

export type FirePoint = [lon: number, lat: number, day: string, frp: number];

export async function firms7(lon: number, lat: number): Promise<FirePoint[] | null> {
  const key = firmsKey();
  if (!key) return null;
  const d = 0.4;
  const r = await kvCached(`fire1:firms7:${r2(lon)}:${r2(lat)}:${Math.floor(Date.now() / (3 * 36e5))}`, 3 * 36e5, async () => {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/${(lon - d).toFixed(3)},${(lat - d).toFixed(3)},${(lon + d).toFixed(3)},${(lat + d).toFixed(3)}/7`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`FIRMS ${res.status}`);
    const [head, ...rows] = (await res.text()).trim().split('\n');
    const h = head.split(',');
    const I = (n: string) => h.indexOf(n);
    return rows.map((l) => l.split(',')).map((c) => [r2(+c[I('longitude')] * 50) / 50, r2(+c[I('latitude')] * 50) / 50, c[I('acq_date')], Math.round(+c[I('frp')] * 10) / 10] as FirePoint)
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  }).catch(() => null);
  return r?.value ?? null;
}

/* ───────────── Perímetro oficial en EE. UU. (NIFC WFIGS) ───────────── */

export type Perimeter = { name: string; acres: number | null; contained: number | null; updated: number | null; geometry: GeoJSON.Geometry; url: string };

export async function nifcPerimeter(lon: number, lat: number): Promise<Perimeter | null> {
  const r = await kvCached(`fire1:nifc:${r2(lon)}:${r2(lat)}`, 3 * 36e5, async () => {
    const d = 0.25;
    const base = 'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query';
    const q = `?geometry=${lon - d},${lat - d},${lon + d},${lat + d}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=poly_IncidentName,poly_GISAcres,attr_PercentContained,poly_DateCurrent&maxAllowableOffset=0.002&outSR=4326&f=geojson`;
    const res = await fetch(base + q, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { features?: { geometry: GeoJSON.Geometry; properties: Record<string, number | string | null> }[] };
    const f = (j.features ?? []).sort((a, b) => Number(b.properties.poly_GISAcres ?? 0) - Number(a.properties.poly_GISAcres ?? 0))[0];
    if (!f) return null;
    const p = f.properties;
    return {
      name: String(p.poly_IncidentName ?? ''), acres: p.poly_GISAcres != null ? Math.round(Number(p.poly_GISAcres)) : null,
      contained: p.attr_PercentContained != null ? Number(p.attr_PercentContained) : null,
      updated: p.poly_DateCurrent != null ? Number(p.poly_DateCurrent) : null, geometry: f.geometry,
      url: 'https://data-nifc.opendata.arcgis.com/datasets/nifc::wfigs-current-interagency-fire-perimeters',
    };
  }).catch(() => null);
  return r?.value ?? null;
}
