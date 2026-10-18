import 'server-only';
import { cleanGlcTitle } from '../landslideText';
import { kvCached } from './kvCache';

/*
 * Deslizamientos (Fase 3 · D): pronóstico inmediato LHASA y catálogo histórico GLC/COOLR,
 * ambos de NASA Goddard (servicios ArcGIS de Earthdata GIS, sin clave).
 */

const BASE = 'https://gis.earthdata.nasa.gov/portal/rest/services/Landslides';
export const LHASA_VIEWER = 'https://gis.earthdata.nasa.gov/portal/apps/experiencebuilder/experience?id=a7b17eff544a4ce5ae045c32dbb99f7b';
export const LANDSLIDES_HOME = 'https://landslides.nasa.gov/';

/**
 * Probabilidad de deslizamiento por lluvia (0 a 1) que da LHASA hoy en el punto.
 * LHASA cubre de 60° S a 60° N; fuera de eso o en el mar devuelve null.
 */
export async function lhasaAt(lon: number, lat: number): Promise<number | null> {
  if (Math.abs(lat) > 60) return null;
  const day = new Date().toISOString().slice(0, 10);
  const r = await kvCached(`lhasa1:${lon.toFixed(2)}:${lat.toFixed(2)}:${day}`, 6 * 36e5, async () => {
    const geom = encodeURIComponent(JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } }));
    const res = await fetch(`${BASE}/LHASA_Hazard_Today/ImageServer/identify?geometry=${geom}&geometryType=esriGeometryPoint&returnGeometry=false&returnCatalogItems=false&f=json`,
      { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`LHASA ${res.status}`);
    const v = Number(((await res.json()) as { value?: string }).value);
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
  }).catch(() => null);
  return r?.value ?? null;
}

export type GlcRecord = { id: string; title: string; time: number | null; deaths: number | null; trigger: string | null; size: string | null; category: string | null; link: string | null; km: number };

/** Deslizamientos del catálogo de NASA (GLC y otros inventarios de COOLR) a `radiusKm` o menos. */
export async function glcNear(lon: number, lat: number, radiusKm = 50): Promise<GlcRecord[] | null> {
  const r = await kvCached(`glc3:${lon.toFixed(1)}:${lat.toFixed(1)}:${radiusKm}`, 30 * 864e5, async () => {
    const geom = encodeURIComponent(JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } }));
    const fields = 'objectid,event_title,event_date,fatality_count,landslide_trigger,landslide_size,landslide_category,source_link,latitude,longitude';
    const res = await fetch(`${BASE}/COOLR_Reports_Points/FeatureServer/0/query?where=1%3D1&geometry=${geom}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=${radiusKm}&units=esriSRUnit_Kilometer&outFields=${fields}&orderByFields=event_date%20DESC&resultRecordCount=200&returnGeometry=false&f=json`,
      { signal: AbortSignal.timeout(25000) });
    if (!res.ok) throw new Error(`COOLR ${res.status}`);
    const j = (await res.json()) as { error?: unknown; features?: { attributes: Record<string, string | number | null> }[] };
    if (j.error || !j.features) throw new Error('COOLR');
    const R = 6371, rad = Math.PI / 180;
    return j.features.map(({ attributes: a }) => {
      const la = Number(a.latitude), lo = Number(a.longitude);
      const d = 2 * R * Math.asin(Math.sqrt(Math.sin(((la - lat) * rad) / 2) ** 2 + Math.cos(lat * rad) * Math.cos(la * rad) * Math.sin(((lo - lon) * rad) / 2) ** 2));
      return {
        id: String(a.objectid), title: cleanGlcTitle(String(a.event_title ?? '')), time: a.event_date != null ? Number(a.event_date) : null,
        deaths: a.fatality_count != null ? Number(a.fatality_count) : null, trigger: (a.landslide_trigger as string | null)?.toLowerCase() ?? null,
        size: (a.landslide_size as string | null)?.toLowerCase() ?? null, category: (a.landslide_category as string | null) ?? null, link: (a.source_link as string | null) || null, km: Math.round(d),
      };
    });
  }).catch(() => null);
  return r?.value ?? null;
}

/* ───────────── USGS Ground Failure (deslizamientos y licuefacción por sismos) ───────────── */

type Alert = 'green' | 'yellow' | 'orange' | 'red';
export type GroundFailure = {
  landslideAlert: Alert | null; liquefactionAlert: Alert | null;
  landslidePop: number | null; liquefactionPop: number | null; landslideAreaKm2: number | null;
  overlay: { url: string; bbox: [number, number, number, number] } | null; url: string;
};

const alertOf = (x: string | undefined): Alert | null => (x === 'green' || x === 'yellow' || x === 'orange' || x === 'red' ? x : null);
const num = (x: string | undefined) => (x == null || x === '' || !Number.isFinite(+x) ? null : +x);

/** Producto "ground-failure" de USGS: solo existe para sismos con ShakeMap y potencial de daño. */
export async function usgsGroundFailure(id: string, young: boolean): Promise<GroundFailure | null> {
  const r = await kvCached(`gf1:${id}`, young ? 36e5 : 30 * 864e5, async () => {
    const res = await fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=${encodeURIComponent(id)}&format=geojson`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`USGS ${res.status}`);
    type P = { properties: Record<string, string>; contents: Record<string, { url: string }> };
    const j = (await res.json()) as { properties: { url?: string; products?: Record<string, P[]> } };
    const g = j.properties.products?.['ground-failure']?.[0];
    if (!g) return null;
    const p = g.properties;
    const png = g.contents['jessee_2018.png']?.url;
    const bb = [num(p['landslide-minimum-longitude']), num(p['landslide-minimum-latitude']), num(p['landslide-maximum-longitude']), num(p['landslide-maximum-latitude'])];
    return {
      landslideAlert: alertOf(p['landslide-alert']), liquefactionAlert: alertOf(p['liquefaction-alert']),
      landslidePop: num(p['landslide-population-alert-value']), liquefactionPop: num(p['liquefaction-population-alert-value']),
      landslideAreaKm2: num(p['landslide-hazard-alert-value']),
      overlay: png && bb.every((v) => v != null) ? { url: png, bbox: bb as [number, number, number, number] } : null,
      url: `${j.properties.url ?? `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`}/ground-failure`,
    };
  }).catch(() => null);
  return r?.value ?? null;
}
