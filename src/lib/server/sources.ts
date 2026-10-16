import 'server-only';
import { geoCentroid } from 'd3-geo';
import type { Geometry } from 'geojson';
import { HttpError, fetchJson } from './cache';
import type { AlertLevel, DisasterEvent, EqDetail, EventType, GvpVolcano } from '../types';

/*
 * Clientes de las fuentes oficiales: piden y normalizan al modelo unificado.
 * No guardan nada; la escritura en la base la hace jobs.ts.
 */

const EONET_CAT: Record<string, EventType> = {
  wildfires: 'fire', severeStorms: 'storm', volcanoes: 'volcano', floods: 'flood', drought: 'drought',
};
const GDACS_CAT: Record<string, EventType> = {
  EQ: 'eq', TC: 'storm', FL: 'flood', VO: 'volcano', WF: 'fire', DR: 'drought',
};
const ALERTS: AlertLevel[] = ['green', 'yellow', 'orange', 'red'];
const asAlert = (v: unknown): AlertLevel | null => {
  const s = String(v ?? '').toLowerCase();
  return (ALERTS as string[]).includes(s) ? (s as AlertLevel) : null;
};
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
/** GDACS publica fechas UTC sin zona ("2026-10-07T15:00:00"). */
const parseUtc = (s: string) => Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z');

/* ───────────── USGS ComCat ───────────── */

type UsgsFeature = {
  id: string;
  geometry: { coordinates: [number, number, number] };
  properties: {
    mag: number | null; magType: string; place: string | null; title: string; time: number; status: string;
    tsunami: number; alert: string | null; felt: number | null; url: string; net: string;
  };
};

export const USGS_LIMIT = 20000;

/**
 * Sismos en [s, e] desde `floor`. Con `updatedAfter` trae solo lo creado o
 * modificado desde ese momento, incluidos los eliminados (status "deleted").
 */
export async function loadUsgs(s: Date, e: Date, floor: number, updatedAfter?: Date): Promise<DisasterEvent[]> {
  const extra = updatedAfter ? `&updatedafter=${updatedAfter.toISOString()}&includedeleted=true` : '';
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${s.toISOString()}&endtime=${e.toISOString()}&minmagnitude=${floor}&orderby=time&limit=${USGS_LIMIT}${extra}`;
  const j = await fetchJson<{ features?: UsgsFeature[] }>(url, 60000);
  return (j.features ?? []).filter((f) => f.geometry).map(mapUsgs);
}

export function mapUsgs(f: UsgsFeature): DisasterEvent {
  const p = f.properties;
  const [lon, lat, depth] = f.geometry.coordinates;
  return {
    id: f.id, type: 'eq', src: 'USGS', lon, lat, depth, time: p.time, mag: p.mag, magType: p.magType,
    title: p.place || p.title, status: p.status, tsunami: p.tsunami === 1, pager: asAlert(p.alert),
    felt: p.felt, url: p.url, net: p.net,
  };
}

export type UsgsDetail = UsgsFeature & {
  properties: UsgsFeature['properties'] & { products?: Record<string, { properties?: Record<string, string> }[]> };
};

export function fetchUsgsDetail(id: string): Promise<UsgsDetail> {
  return fetchJson<UsgsDetail>(`https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=${encodeURIComponent(id)}&format=geojson`);
}

export function parseEqDetail(j: UsgsDetail): EqDetail {
  const pr = j.properties.products ?? {};
  const prop = (k: string) => pr[k]?.[0]?.properties ?? {};
  const num = (x: string | undefined) => (x == null || x === '' || isNaN(+x) ? null : +x);
  const o = prop('origin');
  return {
    hErr: num(o['horizontal-error']), vErr: num(o['vertical-error']), magErr: num(o['magnitude-error']),
    nst: num(o['num-stations-used']), gap: num(o['azimuthal-gap']),
    mmi: num(prop('shakemap').maxmmi), dyfi: num(prop('dyfi')['num-responses']),
  };
}

/* ───────────── NASA EONET v3 ───────────── */

type EonetEvent = {
  id: string; title: string; closed: string | null;
  categories: { id: string }[];
  sources: { id: string; url: string }[];
  geometry: { type: string; coordinates: unknown; date: string; magnitudeValue: number | null; magnitudeUnit: string | null }[];
};

export const EONET_LIMIT = 5000;

export async function loadEonet(s: Date, e: Date): Promise<DisasterEvent[]> {
  const url = `https://eonet.gsfc.nasa.gov/api/v3/events?status=all&start=${isoDay(s)}&end=${isoDay(e)}&category=wildfires,severeStorms,volcanoes,floods,drought&limit=${EONET_LIMIT}`;
  const j = await fetchJson<{ events?: EonetEvent[] }>(url, 60000);
  if ((j.events?.length ?? 0) >= EONET_LIMIT) console.warn(`[eonet] ${isoDay(s)}…${isoDay(e)} llegó al límite de ${EONET_LIMIT}`);
  return (j.events ?? []).map(mapEonet).filter((x): x is DisasterEvent => !!x);
}

function mapEonet(ev: EonetEvent): DisasterEvent | null {
  const type = EONET_CAT[ev.categories[0]?.id];
  const gs = ev.geometry ?? [];
  if (!type || !gs.length) return null;
  const pts = gs.map((g) =>
    g.type === 'Point' ? (g.coordinates as [number, number]) : (geoCentroid({ type: g.type, coordinates: g.coordinates } as Geometry) as [number, number]),
  );
  const last = pts[pts.length - 1];
  const lg = gs[gs.length - 1];
  return {
    id: 'eonet-' + ev.id, type, src: 'NASA EONET', lon: last[0], lat: last[1],
    time: Date.parse(lg.date), start: Date.parse(gs[0].date), title: ev.title, closed: !!ev.closed,
    mag: lg.magnitudeValue, magUnit: lg.magnitudeUnit ?? undefined,
    track: type === 'storm' && pts.length > 1 ? pts : null,
    links: (ev.sources ?? []).map((x) => ({ label: x.id, url: x.url })),
    apiUrl: `https://eonet.gsfc.nasa.gov/api/v3/events/${ev.id}`,
  };
}

/** Un evento EONET. EONET responde 500 (no 404) ante ids inexistentes: si la API está viva, es 404. */
export async function fetchEonetEvent(eonetId: string): Promise<DisasterEvent | null> {
  try {
    return mapEonet(await fetchJson<EonetEvent>(`https://eonet.gsfc.nasa.gov/api/v3/events/${eonetId}`));
  } catch (err) {
    if (err instanceof HttpError && err.status === 500) {
      await fetchJson('https://eonet.gsfc.nasa.gov/api/v3/events?limit=1');
      throw new HttpError(404, err.message);
    }
    throw err;
  }
}

/* ───────────── GDACS ───────────── */

type GdacsFeature = {
  geometry?: { type: string; coordinates: [number, number] };
  properties: {
    eventtype: string; eventid: number; name?: string; description?: string; country?: string;
    fromdate: string; todate: string; alertlevel?: string; url?: { report?: string }; iso3?: string;
    severitydata?: { severity?: number | string; severitytext?: string };
  };
};

function gdacsEqMag(sd: GdacsFeature['properties']['severitydata']): number | null {
  const n = parseFloat(String(sd?.severity ?? ''));
  if (!isNaN(n)) return n;
  const m = /([0-9]+(?:\.[0-9]+)?)\s*M/i.exec(sd?.severitytext ?? '');
  return m ? +m[1] : null;
}

export async function loadGdacs(s: Date, e: Date): Promise<DisasterEvent[]> {
  const url = `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;TC;FL;VO;WF;DR&fromDate=${isoDay(s)}&toDate=${isoDay(e)}&alertlevel=Orange;Red`;
  const j = await fetchJson<{ features?: GdacsFeature[] }>(url, 60000);
  return (j.features ?? []).map(mapGdacs).filter((x): x is DisasterEvent => !!x);
}

function mapGdacs(f: GdacsFeature): DisasterEvent | null {
  const p = f.properties;
  const type = GDACS_CAT[p?.eventtype];
  if (!type || f.geometry?.type !== 'Point') return null;
  const [lon, lat] = f.geometry.coordinates;
  return {
    id: 'gdacs-' + p.eventtype + p.eventid, type, src: 'GDACS', lon, lat,
    time: parseUtc(p.fromdate), end: parseUtc(p.todate), title: p.name || p.description || p.eventtype,
    country: p.country || undefined, iso3: /^[A-Z]{3}$/.test(p.iso3 ?? '') ? p.iso3 : undefined,
    alert: asAlert(p.alertlevel), severity: p.severitydata?.severitytext,
    url: p.url?.report, mag: type === 'eq' ? gdacsEqMag(p.severitydata) : null,
  };
}

export async function fetchGdacsEvent(eventType: string, eventId: string): Promise<DisasterEvent | null> {
  return mapGdacs(await fetchJson<GdacsFeature>(`https://www.gdacs.org/gdacsapi/api/events/geteventdata?eventtype=${eventType}&eventid=${eventId}`));
}

/* ───────────── Capas de referencia ───────────── */

type GvpFeature = {
  geometry: { coordinates: [number, number] } | null;
  properties: { Volcano_Number: number; Volcano_Name: string; Country: string; Primary_Volcano_Type: string; Last_Eruption_Year: number | null };
};

export async function fetchGvp(): Promise<GvpVolcano[]> {
  const url = 'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application%2Fjson';
  const j = await fetchJson<{ features?: GvpFeature[] }>(url, 60000);
  return (j.features ?? [])
    .filter((f) => f.geometry)
    .map((f) => {
      const p = f.properties;
      const [lon, lat] = f.geometry!.coordinates;
      return {
        id: 'gvp-' + p.Volcano_Number, type: 'gvp', src: 'GVP', lon, lat, title: p.Volcano_Name,
        country: p.Country, vtype: p.Primary_Volcano_Type, lastErup: p.Last_Eruption_Year, num: p.Volcano_Number,
      } satisfies GvpVolcano;
    });
}

export function fetchPlates(): Promise<unknown> {
  return fetchJson('https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json', 60000);
}
