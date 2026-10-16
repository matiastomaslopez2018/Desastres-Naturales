import 'server-only';
import { geoDistance } from 'd3-geo';
import { HttpError, cached } from './cache';
import { withCountry } from './countries';
import { compactCoverage, getStoredEvent, kvGet, lastRuns, queryEvents } from './db';
import { EVENT_SOURCES, ensureCovered, migrateData, refreshReference } from './jobs';
import { fetchEonetEvent, fetchGdacsEvent, fetchUsgsDetail, mapUsgs, parseEqDetail } from './sources';
import { rangeInfo } from '../range';
import type { DisasterEvent, EqDetail, EventsResponse, GvpVolcano, RangeKey, SourceKey, SourceStatus } from '../types';

/*
 * Lectura para la web: todo sale de la base que llena la ingesta (jobs.ts).
 * Si un período todavía no está ingerido, se completa en el momento.
 */

const KM = 6371;
const SRC_LABEL: Record<string, DisasterEvent['src']> = { usgs: 'USGS', eonet: 'NASA EONET', gdacs: 'GDACS' };

/* ───────────── Merge GDACS → eventos existentes (README §3) ───────────── */

export function mergeGdacs(base: DisasterEvent[], gdacs: DisasterEvent[]): DisasterEvent[] {
  const out = base.slice();
  for (const a of gdacs) {
    const isEq = a.type === 'eq';
    const cands = base
      .filter((b) => b.type === a.type && Math.abs(b.time - a.time) < (isEq ? 2 * 36e5 : 5 * 864e5))
      .map((b) => ({
        b,
        km: geoDistance([a.lon, a.lat], [b.lon, b.lat]) * KM,
        dm: isEq && a.mag != null && b.mag != null ? Math.abs(a.mag - b.mag) : 0,
        dt: Math.abs(b.time - a.time),
      }))
      .filter((c) => c.km < (isEq ? 100 : 250) && (!isEq || a.mag == null || c.dm < 0.5))
      .sort((x, y) => (isEq ? x.dm - y.dm || x.dt - y.dt : x.km - y.km));
    const m = cands[0]?.b;
    if (m) {
      m.alert = a.alert;
      m.gdacsUrl = a.url;
      m.severity = a.severity;
      m.country = m.country || a.country;
      m.iso3 = m.iso3 || a.iso3;
    } else out.push(a);
  }
  return out;
}

const splitGdacs = (rows: DisasterEvent[]) => mergeGdacs(rows.filter((e) => e.src !== 'GDACS'), rows.filter((e) => e.src === 'GDACS'));

/* ───────────── Eventos de un período ───────────── */

export async function getEvents(range: RangeKey, year: number): Promise<EventsResponse> {
  const { s, e, floor } = rangeInfo(range, year);
  await migrateData();
  const failed = new Set<string>();
  await Promise.all(
    EVENT_SOURCES.map((src) =>
      ensureCovered(src, +s, +e, floor).catch((err) => {
        console.error(`[events] ${src}`, err instanceof Error ? err.message : err);
        failed.add(src);
      }),
    ),
  );
  compactCoverage().catch(() => {});

  const [rows, runs] = await Promise.all([queryEvents(+s, +e, floor), lastRuns()]);
  const sources: Partial<Record<SourceKey, SourceStatus>> = {};
  let fetchedAt = 0;
  for (const src of EVENT_SOURCES) {
    const run = runs[src];
    const count = rows.filter((r) => r.src === SRC_LABEL[src]).length;
    const ok = !failed.has(src) && run?.last.ok !== false;
    sources[src] = { state: ok ? 'ok' : 'err', count, at: run?.lastOkAt ?? undefined };
    if (run?.lastOkAt) fetchedAt = Math.max(fetchedAt, run.lastOkAt);
  }
  return {
    events: splitGdacs(rows), sources, fetchedAt: fetchedAt || Date.now(),
    range: { start: s.toISOString(), end: e.toISOString(), floor },
  };
}

/* ───────────── Capas de referencia ───────────── */

async function reference<T>(key: 'gvp' | 'plates'): Promise<T> {
  let hit = await kvGet<T>(key);
  if (!hit) {
    const r = await refreshReference();
    hit = await kvGet<T>(key);
    if (!hit) throw new Error(r[key]?.error ?? `${key}: sin datos`);
  }
  return hit.value;
}

export const getGvp = () => reference<GvpVolcano[]>('gvp');
export const getPlates = () => reference<unknown>('plates');

/* ───────────── Detalle de sismo (incertidumbres, en vivo) ───────────── */

const usgsDetail = (id: string) => cached('usgs:' + id, 10 * 6e4, () => fetchUsgsDetail(id));

export async function getEqDetail(id: string): Promise<EqDetail> {
  return parseEqDetail(await usgsDetail(id));
}

/* ───────────── Un evento por id (ficha permalink) ───────────── */

export const USGS_ID = /^[a-z0-9]{2,30}$/i;
const EONET_ID = /^eonet-(EONET_\d{1,9})$/;
const GDACS_ID = /^gdacs-(EQ|TC|FL|VO|WF|DR)(\d{1,10})$/;
export const isEventId = (id: string) => USGS_ID.test(id) || EONET_ID.test(id) || GDACS_ID.test(id);

const notFound = (err: unknown) => err instanceof HttpError && (err.status === 404 || err.status === 400 || err.status === 204);

/** Adjunta la alerta GDACS que corresponda, igual que en la lista. */
async function withGdacs(e: DisasterEvent): Promise<DisasterEvent> {
  if (e.src === 'GDACS') return e;
  const near = await queryEvents(e.time - 6 * 864e5, e.time + 6 * 864e5, 0);
  const copy = { ...e };
  mergeGdacs([copy], near.filter((x) => x.src === 'GDACS'));
  return copy;
}

export type EventWithDetail = { event: DisasterEvent; detail: EqDetail | null };

/** Busca un evento por id: base primero, fuente después. `null` si no existe; lanza si la fuente falla. */
export async function getEventById(id: string): Promise<EventWithDetail | null> {
  if (!isEventId(id)) return null;
  try {
    let event = await getStoredEvent(id);
    let detail: EqDetail | null = null;
    const g = GDACS_ID.exec(id);
    const n = EONET_ID.exec(id);
    if (g) {
      event ??= await cached('gdacs:' + id, 10 * 6e4, () => fetchGdacsEvent(g[1], g[2]));
    } else if (n) {
      event ??= await cached('eonet:' + id, 10 * 6e4, () => fetchEonetEvent(n[1]));
    } else {
      // Sismos: el detalle de USGS trae incertidumbres y la versión más fresca del evento.
      const j = await usgsDetail(id);
      if (!j.properties) return null;
      detail = parseEqDetail(j);
      event = { ...mapUsgs(j), country: event?.country, iso3: event?.iso3 };
    }
    if (!event) return null;
    if (!event.iso3) event = withCountry(event);
    return { event: await withGdacs(event), detail };
  } catch (err) {
    if (notFound(err)) return null;
    throw err;
  }
}
