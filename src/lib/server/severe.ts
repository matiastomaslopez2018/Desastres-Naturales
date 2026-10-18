import 'server-only';
import { kvCached } from './kvCache';

/*
 * Tormentas severas y tornados en EE. UU. (Fase 3 · D): pronóstico convectivo del día y
 * reportes preliminares del Storm Prediction Center (NOAA SPC), y avisos vigentes de
 * tornado y tormenta severa del Servicio Meteorológico Nacional (api.weather.gov).
 */

export type OutlookArea = { label: string; fill: string; stroke: string; geometry: GeoJSON.Geometry };
export type SpcOutlook = { issued: number; valid: number; expires: number; areas: OutlookArea[] };
export type SpcReportKind = 'tornado' | 'wind' | 'hail';
export type SpcReportRow = { id: string; kind: SpcReportKind; time: number; mag: string; location: string; county: string; state: string; lat: number; lon: number; comments: string };
export type NwsWarning = { id: string; event: string; headline: string; area: string; expires: number; url: string; geometry: GeoJSON.Geometry };
export type SevereData = { outlook: SpcOutlook | null; reports: SpcReportRow[]; warnings: NwsWarning[] };

const UA = { 'User-Agent': 'AtlasDesastres (desastres-naturales-rho.vercel.app)', Accept: 'application/geo+json' };

async function outlook(): Promise<SpcOutlook | null> {
  const res = await fetch('https://www.spc.noaa.gov/products/outlook/day1otlk_cat.lyr.geojson', { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`SPC ${res.status}`);
  const j = (await res.json()) as { features: { properties: Record<string, string>; geometry: GeoJSON.Geometry | null }[] };
  const areas = j.features.filter((f) => f.geometry && f.properties.fill)
    .map((f) => ({ label: f.properties.LABEL, fill: f.properties.fill, stroke: f.properties.stroke, geometry: f.geometry! }));
  const p = j.features[0]?.properties;
  if (!p) return null;
  return { issued: Date.parse(p.ISSUE_ISO), valid: Date.parse(p.VALID_ISO), expires: Date.parse(p.EXPIRE_ISO), areas };
}

/**
 * Reportes preliminares (CSV de SPC): tres bloques seguidos, tornado, viento y granizo, cada uno
 * con su encabezado. El "día SPC" va de 12 UTC a 12 UTC: la hora HHMM es UTC y, si es menor a
 * 1200, corresponde al día calendario siguiente al del archivo.
 */
async function reportsFor(file: 'yesterday' | 'today', dayStartUtc: number): Promise<SpcReportRow[]> {
  const res = await fetch(`https://www.spc.noaa.gov/climo/reports/${file}_filtered.csv`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`SPC reports ${res.status}`);
  const out: SpcReportRow[] = [];
  let kind: SpcReportKind = 'tornado';
  for (const line of (await res.text()).split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.startsWith('Time,')) {
      kind = /F_Scale/.test(line) ? 'tornado' : /Speed/.test(line) ? 'wind' : 'hail';
      continue;
    }
    const m = /^(\d{4}),([^,]*),([^,]*),([^,]*),([^,]*),(-?[\d.]+),(-?[\d.]+),(.*)$/.exec(line);
    if (!m) continue;
    const hh = +m[1].slice(0, 2), mm = +m[1].slice(2);
    const time = dayStartUtc + (hh < 12 ? 864e5 : 0) + (hh * 60 + mm) * 6e4;
    out.push({ id: `spc-${kind}-${time}-${m[6]}-${m[7]}`, kind, time, mag: m[2], location: m[3], county: m[4], state: m[5], lat: +m[6], lon: +m[7], comments: m[8].replace(/^"|"$/g, '') });
  }
  return out;
}

async function warnings(): Promise<NwsWarning[]> {
  const res = await fetch('https://api.weather.gov/alerts/active?event=Tornado%20Warning,Severe%20Thunderstorm%20Warning', { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`NWS ${res.status}`);
  const j = (await res.json()) as { features: { id: string; geometry: GeoJSON.Geometry | null; properties: Record<string, string> }[] };
  return j.features.filter((f) => f.geometry).map((f) => ({
    id: f.properties.id ?? f.id, event: f.properties.event, headline: f.properties.headline ?? '', area: f.properties.areaDesc ?? '',
    expires: Date.parse(f.properties.expires), url: f.id, geometry: f.geometry!,
  }));
}

export async function getSevere(): Promise<SevereData> {
  const r = await kvCached('spc:severe1', 10 * 6e4, async () => {
    // Día SPC actual: empezó a las 12 UTC de hoy o, si todavía no son las 12 UTC, de ayer.
    const now = new Date();
    const today12 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const cur = now.getUTCHours() >= 12 ? today12 : today12 - 864e5;
    const [o, y, t, w] = await Promise.allSettled([outlook(), reportsFor('yesterday', cur - 864e5), reportsFor('today', cur), warnings()]);
    const val = <T,>(p: PromiseSettledResult<T>, d: T) => (p.status === 'fulfilled' ? p.value : d);
    if ([o, y, t, w].every((p) => p.status === 'rejected')) throw new Error('SPC/NWS');
    return { outlook: val(o, null), reports: [...val(y, []), ...val(t, [])], warnings: val(w, []) };
  });
  return r.value;
}
