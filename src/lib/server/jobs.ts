import 'server-only';
import { withCountry } from './countries';
import {
  addCoverage, allEvents, compactCoverage, coverageReach, deleteEvents, finishRun, isCovered, kvGet, kvSet, startRun, tryLock, unlock, upsertEvents,
} from './db';
import { USGS_LIMIT, fetchGvp, fetchPlates, loadEonet, loadGdacs, loadUsgs } from './sources';
import type { DisasterEvent } from '../types';

/*
 * Ingesta: trae ventanas de tiempo de cada fuente y las guarda en la base.
 * - runLiveIngest: lo dispara el cron cada 5–15 min (últimos 30 días, incremental).
 * - runBackfill:   histórico, una vez (scripts/backfill.ts).
 * - ensureCovered: si alguien pide un período que todavía no está en la base,
 *                  se trae en ese momento y queda guardado (write-through).
 */

export type EventSource = 'usgs' | 'eonet' | 'gdacs';
export const EVENT_SOURCES: EventSource[] = ['usgs', 'eonet', 'gdacs'];

const DAY = 864e5;
const MIN = 6e4;
/** Una ventana se considera al día si le faltan menos de esto para llegar a "ahora". */
export const STALE_MS = 30 * MIN;
const LIVE_WINDOW = 30 * DAY;
export const LIVE_FLOOR = 2.5;
export const HISTORIC_FLOOR = 4.5;

/** Tamaño de cada pedido para no chocar con los límites de las APIs (USGS 20.000, EONET 5.000). */
function chunkMs(src: EventSource, floor: number) {
  if (src === 'usgs') return floor < HISTORIC_FLOOR ? 7 * DAY : 120 * DAY;
  return 31 * DAY;
}

function load(src: EventSource, s: number, e: number, floor: number, updatedAfter?: number) {
  const S = new Date(s), E = new Date(e);
  if (src === 'usgs') return loadUsgs(S, E, floor, updatedAfter ? new Date(updatedAfter) : undefined);
  if (src === 'eonet') return loadEonet(S, E);
  return loadGdacs(S, E);
}

async function store(events: DisasterEvent[]) {
  const deleted = events.filter((e) => e.status === 'deleted').map((e) => e.id);
  const live = events.filter((e) => e.status !== 'deleted');
  const located = live.map(withCountry);
  await deleteEvents(deleted);
  await upsertEvents(located);
  return live.length + deleted.length;
}

type WindowOpts = { floor?: number; job: string; updatedAfter?: number; skipCovered?: boolean };

/** Ingiere [s, e] de una fuente en bloques; cada bloque guardado suma cobertura aunque otro falle. */
export async function ingestWindow(src: EventSource, s: number, e: number, opts: WindowOpts): Promise<number> {
  const floor = src === 'usgs' ? (opts.floor ?? LIVE_FLOOR) : 0;
  const run = await startRun(src, opts.job);
  let fetched = 0;
  try {
    if (opts.updatedAfter) {
      // Incremental: un solo pedido con lo modificado desde `updatedAfter`.
      fetched += await store(await load(src, s, e, floor, opts.updatedAfter));
      await addCoverage(src, s, e, floor);
    } else {
      const step = chunkMs(src, floor);
      for (let a = s; a < e; a += step) {
        const b = Math.min(e, a + step);
        if (opts.skipCovered && (await isCovered(src, a, b, floor))) continue;
        const events = await load(src, a, b, floor);
        if (src === 'usgs' && events.length >= USGS_LIMIT) throw new Error(`USGS: ${new Date(a).toISOString()} llegó al límite de ${USGS_LIMIT}; achicar el bloque`);
        fetched += await store(events);
        await addCoverage(src, a, b, floor);
      }
    }
    await finishRun(run, true, fetched);
    return fetched;
  } catch (err) {
    await finishRun(run, false, fetched, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/* ───────────── Cron: últimos 30 días ───────────── */

export type JobSummary = Record<string, { ok: boolean; fetched?: number; error?: string; skipped?: string }>;

export async function runLiveIngest(): Promise<JobSummary> {
  await migrateData();
  if (!(await tryLock('lock:live', 15 * MIN))) return { live: { ok: true, skipped: 'otra ingesta en curso' } };
  const out: JobSummary = {};
  try {
    const now = Date.now();
    const s = now - LIVE_WINDOW;
    await Promise.all(
      EVENT_SOURCES.map(async (src) => {
        try {
          const floor = src === 'usgs' ? LIVE_FLOOR : 0;
          const reach = await coverageReach(src, s, floor);
          let fetched: number;
          if (reach <= s) {
            fetched = await ingestWindow(src, s, now, { floor, job: 'live-full' });
          } else if (src === 'usgs') {
            // Lo nuevo y lo revisado/eliminado desde la última corrida, en todo el mes.
            fetched = await ingestWindow(src, s, now, { floor, job: 'live', updatedAfter: reach - 15 * MIN });
          } else {
            // EONET/GDACS devuelven eventos que siguen activos en la ventana pedida.
            fetched = await ingestWindow(src, Math.max(s, reach - 2 * DAY), now, { job: 'live' });
          }
          out[src] = { ok: true, fetched };
        } catch (err) {
          out[src] = { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      }),
    );
    Object.assign(out, await refreshReference());
    await compactCoverage();
    return out;
  } finally {
    await unlock('lock:live');
  }
}

/* ───────────── Capas de referencia (cambian poco) ───────────── */

const REF_TTL = { gvp: 7 * DAY, plates: 30 * DAY };

export async function refreshReference(force = false): Promise<JobSummary> {
  const out: JobSummary = {};
  const jobs: [key: 'gvp' | 'plates', fetcher: () => Promise<unknown>][] = [['gvp', fetchGvp], ['plates', fetchPlates]];
  for (const [key, fetcher] of jobs) {
    const cur = await kvGet(key);
    if (!force && cur && Date.now() - cur.updatedAt < REF_TTL[key]) continue;
    const run = await startRun(key === 'gvp' ? 'gvp' : 'carto', 'reference');
    try {
      const value = await fetcher();
      await kvSet(key, value);
      const n = Array.isArray(value) ? value.length : 1;
      await finishRun(run, true, n);
      out[key] = { ok: true, fetched: n };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await finishRun(run, false, 0, msg);
      out[key] = { ok: false, error: msg };
    }
  }
  return out;
}

/* ───────────── Histórico ───────────── */

export async function runBackfill(from: Date, to: Date, sources: EventSource[] = EVENT_SOURCES, log = console.log): Promise<JobSummary> {
  const out: JobSummary = {};
  for (const src of sources) {
    log(`[backfill] ${src} ${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`);
    try {
      const fetched = await ingestWindow(src, +from, +to, { floor: HISTORIC_FLOOR, job: 'backfill', skipCovered: true });
      out[src] = { ok: true, fetched };
      log(`[backfill] ${src}: ${fetched} eventos`);
    } catch (err) {
      out[src] = { ok: false, error: err instanceof Error ? err.message : String(err) };
      log(`[backfill] ${src}: ERROR ${out[src].error}`);
    }
  }
  await compactCoverage();
  return out;
}

/* ───────────── Migraciones de datos ───────────── */

let migrated: Promise<void> | null = null;

/** v1: agrega ISO-3 a los eventos guardados antes de que existiera el campo. Corre una vez por base. */
export function migrateData(): Promise<void> {
  migrated ??= (async () => {
    if (await kvGet('migr:iso3:v1')) return;
    let n = 0;
    for await (const page of allEvents()) {
      const fixed = page.filter((e) => !e.iso3).map(withCountry).filter((e) => e.iso3);
      await upsertEvents(fixed);
      n += fixed.length;
    }
    await kvSet('migr:iso3:v1', { n });
    console.log(`[migr] iso3: ${n} eventos actualizados`);
  })().then(async () => {
    // v2: inundaciones de EONET guardadas en el antípoda (polígono con el sentido invertido).
    if (await kvGet('migr:eonet-antipode:v1')) return;
    let n = 0;
    for await (const page of allEvents()) {
      const fixed = page
        .filter((e) => e.src === 'NASA EONET' && e.type === 'flood' && !e.iso3)
        .map((e) => ({ ...e, lat: -e.lat, lon: e.lon > 0 ? e.lon - 180 : e.lon + 180, country: undefined }))
        .map(withCountry)
        .filter((e) => e.iso3);
      await upsertEvents(fixed);
      n += fixed.length;
    }
    await kvSet('migr:eonet-antipode:v1', { n });
    console.log(`[migr] eonet antípoda: ${n} inundaciones corregidas`);
  }).catch((err) => {
    migrated = null;
    throw err;
  });
  return migrated;
}

/* ───────────── Lectura: completar huecos al vuelo ───────────── */

const pending = new Map<string, Promise<unknown>>();

/** Garantiza que [s, e] esté en la base para una fuente; si no, lo trae. Deduplica pedidos simultáneos. */
export async function ensureCovered(src: EventSource, s: number, e: number, floor: number): Promise<void> {
  const f = src === 'usgs' ? floor : 0;
  if (await isCovered(src, s, Math.max(s, e - STALE_MS), f)) return;
  const key = `${src}:${s}:${e}:${f}`;
  let p = pending.get(key);
  if (!p) {
    p = ingestWindow(src, s, e, { floor: f, job: 'on-demand', skipCovered: true }).finally(() => pending.delete(key));
    pending.set(key, p);
  }
  await p;
}
