import 'server-only';
import { fetchJson } from './cache';
import { kvCached } from './kvCache';
import { kvGet, kvSet } from './db';
import { getGvp } from './ingest';
import type { VolcanoActivity } from '../types';

/*
 * Actividad volcánica, dos fuentes del Smithsonian Global Volcanism Program:
 *  1. Reporte semanal Smithsonian/USGS (RSS, se publica los miércoles): volcanes con
 *     actividad nueva o en curso esta semana, con el texto del reporte. El sitio
 *     volcano.si.edu puede exigir una verificación anti-bot; si no responde, se usa
 *  2. la base de erupciones desde 1960 (GeoServer de GVP, sin esa verificación):
 *     erupciones marcadas como "ContinuingEruption", con fecha de inicio y VEI máximo.
 */

const WEEKLY_RSS = 'https://volcano.si.edu/news/WeeklyVolcanoRSS.xml';
const ERUPTIONS = 'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=GVP-VOTW:E3WebApp_Eruptions1960&outputFormat=application%2Fjson&CQL_FILTER=ContinuingEruption%3D%27True%27';
const gvpUrl = (vn: number | string) => `https://volcano.si.edu/volcano.cfm?vn=${vn}`;

type Eruption = { properties: { VolcanoNumber: number; VolcanoName: string; ExplosivityIndexMax: number | null; StartDate: string; LatitudeDecimal: number; LongitudeDecimal: number } };

async function loadEruptions(): Promise<VolcanoActivity[]> {
  const j = await fetchJson<{ features?: Eruption[] }>(ERUPTIONS, 60000);
  const gvp = await getGvp().catch(() => []);
  const country = new Map(gvp.map((v) => [v.num, v.country]));
  return (j.features ?? []).map(({ properties: p }) => ({
    id: `erupt-${p.VolcanoNumber}`, type: 'wvolc', src: 'GVP', title: p.VolcanoName,
    lon: p.LongitudeDecimal, lat: p.LatitudeDecimal, country: country.get(p.VolcanoNumber),
    status: 'ongoing', since: p.StartDate, vei: p.ExplosivityIndexMax ?? null,
    gvpUrl: gvpUrl(p.VolcanoNumber), origin: 'eruptions',
  }) satisfies VolcanoActivity);
}

const strip = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** Reporte semanal. Lanza si el sitio no deja leer el RSS (p. ej. verificación anti-bot). */
async function loadWeekly(): Promise<VolcanoActivity[]> {
  const res = await fetch(WEEKLY_RSS, { cache: 'no-store', signal: AbortSignal.timeout(20000), headers: { Accept: 'application/rss+xml, application/xml' } });
  const xml = await res.text();
  if (!res.ok || !/<rss|<item>/i.test(xml)) throw new Error(`GVP weekly RSS no disponible (${res.status})`);
  const gvp = await getGvp().catch(() => []);
  const byName = new Map(gvp.map((v) => [v.title.toLowerCase(), v]));
  const items = xml.split(/<item>/i).slice(1).map((i) => i.split(/<\/item>/i)[0]);
  const out: VolcanoActivity[] = [];
  for (const it of items) {
    const title = strip(/<title>([\s\S]*?)<\/title>/i.exec(it)?.[1] ?? '');
    const desc = strip(/<description>([\s\S]*?)<\/description>/i.exec(it)?.[1] ?? '');
    const link = strip(/<link>([\s\S]*?)<\/link>/i.exec(it)?.[1] ?? '');
    const name = /^(.+?)\s*\(/.exec(title)?.[1]?.trim() ?? title;
    const v = byName.get(name.toLowerCase());
    const point = /<georss:point>\s*([-\d.]+)\s+([-\d.]+)/i.exec(it);
    const lat = point ? Number(point[1]) : v?.lat, lon = point ? Number(point[2]) : v?.lon;
    if (lat == null || lon == null) continue;
    out.push({
      id: `weekly-${v?.num ?? name}`, type: 'wvolc', src: 'GVP', title: name, lon, lat, country: v?.country,
      status: /new activity|unrest/i.test(title + ' ' + it) ? 'new' : 'ongoing',
      report: desc, reportPeriod: /Report for ([^-<]+)/i.exec(title)?.[1]?.trim(),
      gvpUrl: v ? gvpUrl(v.num) : link || 'https://volcano.si.edu/reports_weekly.cfm', origin: 'weekly',
    });
  }
  return out;
}

/**
 * Volcanes con actividad: el reporte semanal si está disponible; si no, las erupciones en
 * curso de la base GVP. Devuelve también de qué fuente salió y si el semanal falló.
 */
export async function getVolcanoActivity() {
  const weekly = await kvCached('gvp:weekly', 6 * 36e5, loadWeekly).catch((err) => ({ error: String(err instanceof Error ? err.message : err) }));
  // Un reporte guardado de hace más de 10 días (el sitio cayó después) ya no vale como "esta semana".
  const fresh = 'value' in weekly && weekly.value.length > 0 && Date.now() - weekly.at < 10 * 864e5;
  const status = await recordWeeklyStatus(fresh, 'error' in weekly ? weekly.error : fresh ? null : 'reporte viejo o sin ítems').catch(() => null);
  if (fresh && 'value' in weekly) {
    return { volcanoes: weekly.value, origin: 'weekly' as const, fetchedAt: weekly.at, weeklyError: null, weeklyDownSince: null };
  }
  const er = await kvCached('gvp:eruptions', 24 * 36e5, loadEruptions);
  return { volcanoes: er.value, origin: 'eruptions' as const, fetchedAt: er.at, weeklyError: 'error' in weekly ? weekly.error : 'sin ítems', weeklyDownSince: status?.since ?? null };
}

/* ───────────── Estado del reporte semanal del Smithsonian (para /api/health) ───────────── */

export type WeeklyStatus = { state: 'ok' | 'down'; code: number | null; error: string | null; since: number; checkedAt: number };
const STATUS_KEY = 'status:gvp-weekly';

/**
 * Guarda si el RSS semanal responde y desde cuándo está en ese estado. "since" es la primera vez
 * que este sitio vio el cambio (no la hora real del corte en el Smithsonian). Se escribe solo al
 * cambiar de estado o, como mucho, una vez por hora.
 */
async function recordWeeklyStatus(ok: boolean, error: string | null): Promise<WeeklyStatus> {
  const prev = (await kvGet<WeeklyStatus>(STATUS_KEY))?.value ?? null;
  const state = ok ? 'ok' : 'down';
  const now = Date.now();
  const code = error ? Number(/\((\d{3})\)/.exec(error)?.[1]) || null : null;
  const next: WeeklyStatus = { state, code, error, since: prev && prev.state === state ? prev.since : now, checkedAt: now };
  if (!prev || prev.state !== state || now - prev.checkedAt > 36e5) await kvSet(STATUS_KEY, next);
  return next;
}

export async function getWeeklyStatus(): Promise<(WeeklyStatus & { downDays: number; alert: boolean }) | null> {
  await getVolcanoActivity().catch(() => null);
  const s = (await kvGet<WeeklyStatus>(STATUS_KEY))?.value;
  if (!s) return null;
  const downDays = s.state === 'down' ? Math.floor((Date.now() - s.since) / 864e5) : 0;
  return { ...s, downDays, alert: downDays > 7 };
}
