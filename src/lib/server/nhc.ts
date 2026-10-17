import 'server-only';
import { fetchJson } from './cache';
import { kvCached } from './kvCache';
import type { NhcStorm } from '../types';

/*
 * NOAA National Hurricane Center: ciclones activos del Atlántico y del Pacífico
 * este/central. Posición e intensidad de CurrentStorms.json; cono, trayectoria pasada
 * y pronosticada del servicio GIS de NOAA (mapservices.weather.noaa.gov), que publica
 * las mismas capas que los shapefiles del aviso pero en GeoJSON.
 * Otras cuencas (Pacífico oeste, Índico, hemisferio sur) no las cubre NHC.
 */

const CURRENT = 'https://www.nhc.noaa.gov/CurrentStorms.json';
const MAPSERVER = 'https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer';

type Current = {
  activeStorms?: {
    id: string; binNumber: string; name: string; classification: string;
    intensity: string; pressure: string; latitudeNumeric: number; longitudeNumeric: number;
    movementDir: number; movementSpeed: number; lastUpdate: string;
    publicAdvisory?: { url: string }; forecastDiscussion?: { url: string };
  }[];
};
type Layer = { id: number; name: string };
type GeoJsonFC = { features?: { geometry: GeoJSON.Geometry; properties: Record<string, unknown> }[] };

/** Ids de capa por nombre ("EP1 Forecast Cone"), que cambian si NOAA reordena el servicio. */
async function layerIds(): Promise<Map<string, number>> {
  const r = await kvCached('nhc:layers', 24 * 36e5, async () => {
    const j = await fetchJson<{ layers?: Layer[] }>(`${MAPSERVER}?f=json`, 30000);
    return (j.layers ?? []).map((l) => [l.name, l.id] as [string, number]);
  });
  return new Map(r.value);
}

async function layer(ids: Map<string, number>, name: string): Promise<GeoJsonFC['features']> {
  const id = ids.get(name);
  if (id == null) return [];
  const j = await fetchJson<GeoJsonFC>(`${MAPSERVER}/${id}/query?where=1%3D1&outFields=*&f=geojson`, 30000).catch(() => ({}) as GeoJsonFC);
  return j.features ?? [];
}

const num = (v: unknown) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));

async function loadStorms(): Promise<NhcStorm[]> {
  const cur = await fetchJson<Current>(CURRENT, 30000);
  const active = cur.activeStorms ?? [];
  if (!active.length) return [];
  const ids = await layerIds();
  return Promise.all(active.map(async (s) => {
    const bin = s.binNumber;
    const [cone, past, fTrack, fPoints] = await Promise.all([
      layer(ids, `${bin} Forecast Cone`), layer(ids, `${bin} Past Track`),
      layer(ids, `${bin} Forecast Track`), layer(ids, `${bin} Forecast Points`),
    ]);
    const lines = (g: GeoJSON.Geometry): [number, number][][] =>
      g.type === 'LineString' ? [g.coordinates as [number, number][]]
        : g.type === 'MultiLineString' ? (g.coordinates as [number, number][][]) : [];
    return {
      id: `nhc-${s.id}`, type: 'nhc', src: 'NOAA NHC', title: s.name, name: s.name, classification: s.classification,
      lon: s.longitudeNumeric, lat: s.latitudeNumeric,
      windKt: num(s.intensity), pressureMb: num(s.pressure),
      movementDir: num(s.movementDir), movementSpeedMph: num(s.movementSpeed),
      lastUpdate: Date.parse(s.lastUpdate),
      advisoryUrl: s.publicAdvisory?.url, discussionUrl: s.forecastDiscussion?.url,
      cone: cone?.[0]?.geometry ?? null,
      pastTrack: (past ?? []).flatMap((f) => lines(f.geometry)),
      forecastTrack: (fTrack ?? []).flatMap((f) => lines(f.geometry))[0] ?? [],
      forecastPoints: (fPoints ?? []).filter((f) => f.geometry.type === 'Point').map((f) => {
        const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
        return { lon, lat, label: String(f.properties.datelbl ?? ''), windKt: num(f.properties.maxwind), cat: String(f.properties.dvlbl ?? '') };
      }),
    } satisfies NhcStorm;
  }));
}

/** Ciclones activos (15 min de caché; NHC actualiza los avisos cada 3–6 h). */
export async function getActiveStorms() {
  const r = await kvCached('nhc:storms', 15 * 6e4, loadStorms);
  return { storms: r.value, fetchedAt: r.at, stale: r.stale };
}
