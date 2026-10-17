import 'server-only';
import { fetchJson } from './cache';
import { kvCached } from './kvCache';

/*
 * Contexto geológico de un volcán: ficha del Smithsonian GVP (ambiente tectónico, roca
 * dominante, resumen geológico), erupciones del Holoceno con su VEI, nivel de alerta
 * oficial de USGS (solo EE. UU., que publica un servicio) y el VAAC de la región.
 */

const WFS = 'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application%2Fjson';

export type VolcanoDetails = {
  setting: string | null; rock: string | null; elevation: number | null; summary: string | null; landform: string | null;
};
export type Eruption = { year: number; end: number | null; vei: number | null; type: string; number: number };

export async function volcanoDetails(vn: number): Promise<VolcanoDetails | null> {
  const r = await kvCached(`gvp1:details:${vn}`, 30 * 864e5, async () => {
    type P = { Tectonic_Setting?: string; Major_Rock_Type?: string; Elevation?: number; Geological_Summary?: string; Volcanic_Landform?: string };
    const j = await fetchJson<{ features: { properties: P }[] }>(`${WFS}&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&CQL_FILTER=Volcano_Number=${vn}`, 30000, 1);
    const p = j.features[0]?.properties;
    if (!p) return null;
    return {
      setting: p.Tectonic_Setting ?? null, rock: p.Major_Rock_Type ?? null, elevation: p.Elevation ?? null,
      summary: p.Geological_Summary ?? null, landform: p.Volcanic_Landform ?? null,
    };
  }).catch(() => null);
  return r?.value ?? null;
}

export async function volcanoEruptions(vn: number): Promise<Eruption[]> {
  const r = await kvCached(`gvp1:eruptions:${vn}`, 7 * 864e5, async () => {
    type P = { Activity_Type?: string; ExplosivityIndexMax?: number | null; StartDateYear?: number | null; EndDateYear?: number | null; Eruption_Number: number };
    const j = await fetchJson<{ features: { properties: P }[] }>(`${WFS}&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Eruptions&CQL_FILTER=Volcano_Number=${vn}&maxFeatures=2000`, 30000, 1);
    return j.features
      .map(({ properties: p }) => ({ year: p.StartDateYear ?? NaN, end: p.EndDateYear ?? null, vei: p.ExplosivityIndexMax ?? null, type: p.Activity_Type ?? '', number: p.Eruption_Number }))
      .filter((e) => Number.isFinite(e.year) && /eruption/i.test(e.type))
      .sort((a, b) => a.year - b.year);
  }).catch(() => null);
  return r?.value ?? [];
}

/** "Subduction zone / Continental crust (> 25 km)" → subducción / rift / intraplaca. */
export type Setting = 'subduction' | 'rift' | 'intraplate';
export const settingOf = (s: string | null | undefined): Setting | null =>
  !s ? null : /subduction/i.test(s) ? 'subduction' : /rift/i.test(s) ? 'rift' : /intraplate/i.test(s) ? 'intraplate' : null;
export const crustOf = (s: string | null | undefined): 'continental' | 'oceanic' | 'intermediate' | null =>
  !s ? null : /continental/i.test(s) ? 'continental' : /oceanic/i.test(s) ? 'oceanic' : /intermediate/i.test(s) ? 'intermediate' : null;

/* ───────────── Nivel de alerta oficial ───────────── */

export type Alert = { level: string; color: string; sent: number; observatory: string; url: string };

/** USGS Volcano Hazards Program: único con un servicio público de niveles (volcanes de EE. UU.). */
export async function usgsAlert(vn: number): Promise<Alert | null> {
  const r = await kvCached('usgs:vhp:monitored', 30 * 6e4, async () => {
    type V = { vnum: string; alert_level: string; color_code: string; sent_unixtime: number; obs_fullname: string; notice_url: string };
    return fetchJson<V[]>('https://volcanoes.usgs.gov/hans-public/api/volcano/getMonitoredVolcanoes', 30000, 1);
  }).catch(() => null);
  const v = r?.value.find((x) => Number(x.vnum) === vn);
  return v ? { level: v.alert_level, color: v.color_code, sent: v.sent_unixtime * 1000, observatory: v.obs_fullname, url: v.notice_url } : null;
}

/** Observatorios oficiales por país (nombre de país de GVP). Solo enlaces: sin servicio público de niveles. */
export const OBSERVATORIES: Record<string, { name: string; url: string }> = {
  'United States': { name: 'USGS Volcano Hazards Program', url: 'https://www.usgs.gov/programs/VHP' },
  Chile: { name: 'SERNAGEOMIN · Red Nacional de Vigilancia Volcánica', url: 'https://www.sernageomin.cl/' },
  'Chile-Argentina': { name: 'SERNAGEOMIN (Chile) · OAVV SEGEMAR (Argentina)', url: 'https://www.sernageomin.cl/' },
  Argentina: { name: 'OAVV · SEGEMAR', url: 'https://oavv.segemar.gob.ar/' },
  Peru: { name: 'INGEMMET · Observatorio Vulcanológico', url: 'https://www.gob.pe/ingemmet' },
  Mexico: { name: 'CENAPRED', url: 'https://www.gob.mx/cenapred' },
  Italy: { name: 'INGV', url: 'https://www.ingv.it/' },
  Japan: { name: 'JMA · actividad volcánica', url: 'https://www.data.jma.go.jp/vois/data/tokyo/STOCK/activity_info/map_0.html' },
  Indonesia: { name: 'MAGMA Indonesia · PVMBG', url: 'https://magma.esdm.go.id/' },
  Philippines: { name: 'PHIVOLCS', url: 'https://www.phivolcs.dost.gov.ph/' },
  'New Zealand': { name: 'GeoNet', url: 'https://www.geonet.org.nz/volcano' },
  Ecuador: { name: 'IG-EPN', url: 'https://www.igepn.edu.ec/' },
  Colombia: { name: 'Servicio Geológico Colombiano', url: 'https://www.sgc.gov.co/volcanes' },
  Guatemala: { name: 'INSIVUMEH', url: 'https://insivumeh.gob.gt/' },
  'Costa Rica': { name: 'OVSICORI', url: 'https://www.ovsicori.una.ac.cr/' },
  Nicaragua: { name: 'INETER', url: 'https://www.ineter.gob.ni/' },
  'El Salvador': { name: 'MARN', url: 'https://www.marn.gob.sv/' },
  Iceland: { name: 'Icelandic Meteorological Office', url: 'https://en.vedur.is/' },
  Russia: { name: 'KVERT (Kamchatka)', url: 'http://www.kscnet.ru/ivs/kvert/' },
};

/* ───────────── VAAC ───────────── */

const VAAC = {
  buenosaires: { name: 'VAAC Buenos Aires (SMN)', url: 'https://www.smn.gob.ar/vaac/buenosaires/inicio.php' },
  washington: { name: 'VAAC Washington (NOAA)', url: 'https://www.ospo.noaa.gov/products/atmosphere/vaac/' },
  anchorage: { name: 'VAAC Anchorage (NOAA)', url: 'https://www.weather.gov/vaac/' },
  montreal: { name: 'VAAC Montreal', url: 'https://weather.gc.ca/eer/vaac/index_e.html' },
  london: { name: 'VAAC London (Met Office)', url: 'https://www.metoffice.gov.uk/aviation/vaac/' },
  toulouse: { name: 'VAAC Toulouse (Météo-France)', url: 'https://vaac.meteo.fr/' },
  tokyo: { name: 'VAAC Tokyo (JMA)', url: 'https://www.data.jma.go.jp/vaac/data/index.html' },
  darwin: { name: 'VAAC Darwin (BoM)', url: 'http://www.bom.gov.au/aviation/volcanic-ash/' },
  wellington: { name: 'VAAC Wellington (MetService)', url: 'https://www.metservice.com/warnings/vaac' },
};

/** VAAC por región, aproximado: los límites exactos los fija la OACI. */
export function vaacFor(lon: number, lat: number) {
  if (lon < -25 || lon > 170) {
    if (lat > 50 && (lon < -130 || lon > 160)) return VAAC.anchorage;
    // Pacífico central: Hawái es del VAAC Washington; el Pacífico sur, de Wellington.
    if (lon > 160 || lon < -150) return lat < 0 ? VAAC.wellington : VAAC.washington;
    if (lat > 50) return VAAC.montreal;
    return lat < -10 ? VAAC.buenosaires : VAAC.washington;
  }
  if (lon < 60) return lat > 55 && lon < -10 ? VAAC.london : VAAC.toulouse;
  // Islas Marianas: VAAC Washington.
  if (lon > 140 && lon < 150 && lat > 12 && lat < 22) return VAAC.washington;
  if (lat >= 20) return VAAC.tokyo;
  if (lat < -25 && lon > 150) return VAAC.wellington;
  return VAAC.darwin;
}
