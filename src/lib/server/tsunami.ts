import 'server-only';
import { geoDistance } from 'd3-geo';
import { HttpError } from './cache';
import { kvCached } from './kvCache';
import type { DisasterEvent, TsunamiMessage } from '../types';

/*
 * Centros de alerta de tsunamis de NOAA (tsunami.gov), feeds Atom:
 *   NTWC (Palmer, Alaska)  → PAAQ: costas de EE. UU. continental, Alaska y Canadá.
 *   PTWC (Honolulu, Hawái) → PHEB: Hawái, territorios de EE. UU. y avisos internacionales.
 * Son la señal oficial de tsunami; el indicador "tsunami" de USGS solo marca sismos
 * grandes en zonas oceánicas y no confirma nada.
 */

const FEEDS = [
  { center: 'NTWC' as const, url: 'https://www.tsunami.gov/events/xml/PAAQAtom.xml' },
  { center: 'PTWC' as const, url: 'https://www.tsunami.gov/events/xml/PHEBAtom.xml' },
];

const LEVELS: [RegExp, TsunamiMessage['level']][] = [
  [/warning/i, 'warning'], [/advisory/i, 'advisory'], [/watch/i, 'watch'],
  [/cancel/i, 'cancellation'], [/information/i, 'information'],
];

const tag = (xml: string, name: string) => new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(xml)?.[1]?.trim() ?? '';
const field = (html: string, label: string) =>
  new RegExp(`<strong>${label}:?\\s*</strong>\\s*([^<]*)`, 'i').exec(html)?.[1]?.trim() ?? '';

function parse(center: TsunamiMessage['center'], xml: string): TsunamiMessage[] {
  const entries = xml.split(/<entry>/i).slice(1).map((e) => e.split(/<\/entry>/i)[0]);
  return entries.map((e) => {
    const summary = tag(e, 'summary');
    const category = field(summary, 'Category');
    const level = LEVELS.find(([re]) => re.test(category))?.[1] ?? 'other';
    const mag = /([\d.]+)\s*\(/.exec(field(summary, 'Preliminary Magnitude'))?.[1];
    const lat = Number(tag(e, 'geo:lat')), lon = Number(tag(e, 'geo:long'));
    const bulletin = /<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i.exec(e)?.[1]
      ?? /href="([^"]+\.txt)"/i.exec(summary)?.[1] ?? 'https://www.tsunami.gov/';
    const issued = Date.parse(tag(e, 'updated'));
    return {
      id: `${center}-${issued}`, center, level,
      title: category || 'Tsunami message',
      region: tag(e, 'title').replace(/\s+/g, ' '),
      issued, lat: isFinite(lat) ? lat : null, lon: isFinite(lon) ? lon : null,
      magnitude: mag ? Number(mag) : null, url: bulletin.trim(),
    };
  });
}

async function load(): Promise<TsunamiMessage[]> {
  const all = await Promise.all(FEEDS.map(async (f) => {
    const res = await fetch(f.url, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new HttpError(res.status, `${res.status} ${f.url}`);
    return parse(f.center, await res.text());
  }));
  return all.flat().sort((a, b) => b.issued - a.issued);
}

/** Avisos de los dos centros (5 min de caché). */
export async function getTsunamiMessages() {
  const r = await kvCached('tsunami:messages', 5 * 6e4, load);
  const now = Date.now();
  // Activo: aviso, alerta o vigilancia emitido en las últimas 24 h (los feeds solo traen el último mensaje).
  const active = r.value.filter((m) => ['warning', 'advisory', 'watch'].includes(m.level) && now - m.issued < 24 * 36e5);
  return { messages: r.value, active, fetchedAt: r.at, stale: r.stale };
}

/** Mensajes de tsunami que corresponden a un sismo (±2 h, <300 km). */
export function tsunamiFor(e: Pick<DisasterEvent, 'lon' | 'lat' | 'time'>, messages: TsunamiMessage[]) {
  return messages.filter((m) =>
    m.lat != null && m.lon != null && Math.abs(m.issued - e.time) < 2 * 36e5
    && geoDistance([m.lon, m.lat], [e.lon, e.lat]) * 6371 < 300);
}
