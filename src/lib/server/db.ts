import 'server-only';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createClient, type Client, type InStatement } from '@libsql/client';
import type { DisasterEvent, SourceKey } from '../types';

/**
 * Base de datos libSQL: Turso en producción, archivo SQLite local en desarrollo.
 *
 * Credenciales de Turso: las que crea la integración de Vercel con prefijo STORAGE
 * (`STORAGE_URL` + `STORAGE_AUTH_TOKEN`); también se aceptan otros nombres habituales.
 * Sin ninguna, se usa `file:data/atlas.db` (o `/tmp/atlas.db` en Vercel, efímero y
 * propio de cada instancia: funciona, pero cada arranque en frío vuelve a pedir los
 * datos a las fuentes).
 */
const firstEnv = (names: string[]) => {
  for (const n of names) if (process.env[n]) return { name: n, value: process.env[n]! };
  return null;
};
const urlEnv = firstEnv(['STORAGE_URL', 'STORAGE_DATABASE_URL', 'STORAGE_TURSO_DATABASE_URL', 'TURSO_DATABASE_URL', 'DATABASE_URL']);
const tokenEnv = firstEnv(['STORAGE_AUTH_TOKEN', 'STORAGE_DATABASE_AUTH_TOKEN', 'STORAGE_TURSO_AUTH_TOKEN', 'TURSO_AUTH_TOKEN', 'DATABASE_AUTH_TOKEN']);
const URL = urlEnv?.value || (process.env.VERCEL ? 'file:/tmp/atlas.db' : 'file:data/atlas.db');
const AUTH_TOKEN = tokenEnv?.value;
if (process.env.VERCEL && !urlEnv) {
  console.warn('[db] Sin STORAGE_URL: usando /tmp/atlas.db (efímero). Conectar Turso para persistir los datos.');
}

/** Para diagnóstico: qué base se usa, sin exponer el token. */
export const dbInfo = () => ({
  kind: URL.startsWith('file:') ? 'archivo local' : 'Turso',
  url: URL.startsWith('file:') ? URL : URL.split('?')[0],
  urlVar: urlEnv?.name ?? null,
  tokenVar: tokenEnv?.name ?? null,
});

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    src TEXT NOT NULL,
    type TEXT NOT NULL,
    t0 INTEGER NOT NULL,          -- inicio del evento (ms)
    t1 INTEGER NOT NULL,          -- último dato / fin (ms)
    mag REAL,
    data TEXT NOT NULL,           -- DisasterEvent completo (JSON)
    updated_at INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS events_t1 ON events (t1)',
  'CREATE INDEX IF NOT EXISTS events_src_t0 ON events (src, t0)',
  // Ventanas ya ingeridas por fuente: evita volver a pedirle a la fuente lo que ya está.
  `CREATE TABLE IF NOT EXISTS coverage (
    src TEXT NOT NULL, t0 INTEGER NOT NULL, t1 INTEGER NOT NULL, floor REAL NOT NULL DEFAULT 0
  )`,
  'CREATE INDEX IF NOT EXISTS coverage_src ON coverage (src)',
  `CREATE TABLE IF NOT EXISTS ingest_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    src TEXT NOT NULL, job TEXT NOT NULL,
    started_at INTEGER NOT NULL, finished_at INTEGER,
    ok INTEGER, fetched INTEGER, error TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS ingest_runs_src ON ingest_runs (src, finished_at)',
  `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  // "¿Lo sentiste?": reportes anónimos (intensidad 0–6 y, si la persona quiere, la ubicación redondeada a 0,1°).
  `CREATE TABLE IF NOT EXISTS felt (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL, level INTEGER NOT NULL, lat REAL, lon REAL, at INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS felt_event ON felt (event_id)',
  // Sismos de INPRES y del CSN: tabla aparte de `events` para que las versiones del sitio que no los conocen
  // (la base es la misma para producción y los deploys de prueba) no los muestren duplicados.
  `CREATE TABLE IF NOT EXISTS local_quakes (
    id TEXT PRIMARY KEY, t0 INTEGER NOT NULL, mag REAL, data TEXT NOT NULL, updated_at INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS local_quakes_t0 ON local_quakes (t0)',
];

let client: Client | null = null;
let ready: Promise<Client> | null = null;

export function db(): Promise<Client> {
  if (ready) return ready;
  ready = (async () => {
    if (URL.startsWith('file:')) mkdirSync(dirname(URL.slice('file:'.length)), { recursive: true });
    client = createClient({ url: URL, authToken: AUTH_TOKEN });
    if (URL.startsWith('file:')) await client.execute('PRAGMA journal_mode = WAL');
    await client.batch(SCHEMA, 'write');
    return client;
  })().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

/* ───────────── events ───────────── */

const span = (e: DisasterEvent) => {
  const t0 = e.start ?? e.time;
  return { t0, t1: Math.max(e.time, e.end ?? e.time, t0) };
};

export async function upsertEvents(events: DisasterEvent[]): Promise<void> {
  if (!events.length) return;
  const c = await db();
  const now = Date.now();
  const stmts: InStatement[] = events.map((e) => {
    const { t0, t1 } = span(e);
    return {
      sql: `INSERT INTO events (id, src, type, t0, t1, mag, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET src=excluded.src, type=excluded.type, t0=excluded.t0, t1=excluded.t1,
              mag=excluded.mag, data=excluded.data, updated_at=excluded.updated_at`,
      args: [e.id, e.src, e.type, t0, t1, e.mag ?? null, JSON.stringify(e), now],
    };
  });
  for (let i = 0; i < stmts.length; i += 500) await c.batch(stmts.slice(i, i + 500), 'write');
}

export async function deleteEvents(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const c = await db();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    await c.execute({ sql: `DELETE FROM events WHERE id IN (${chunk.map(() => '?').join(',')})`, args: chunk });
  }
}

/** Eventos activos en [s, e]; sismos solo desde `floor`. */
export async function queryEvents(s: number, e: number, floor: number): Promise<DisasterEvent[]> {
  const c = await db();
  const r = await c.execute({
    sql: `SELECT data FROM events WHERE t1 >= ? AND t0 <= ? AND (type <> 'eq' OR mag IS NULL OR mag >= ?)`,
    args: [s, e, floor],
  });
  return r.rows.map((row) => JSON.parse(String(row.data)) as DisasterEvent);
}

/* ───────────── Sismos de INPRES y del CSN ───────────── */

export async function upsertLocalQuakes(events: DisasterEvent[]): Promise<void> {
  if (!events.length) return;
  const c = await db();
  const now = Date.now();
  const stmts: InStatement[] = events.map((e) => ({
    sql: `INSERT INTO local_quakes (id, t0, mag, data, updated_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET t0=excluded.t0, mag=excluded.mag, data=excluded.data, updated_at=excluded.updated_at`,
    args: [e.id, e.time, e.mag ?? null, JSON.stringify(e), now],
  }));
  for (let i = 0; i < stmts.length; i += 500) await c.batch(stmts.slice(i, i + 500), 'write');
}

/** Sismos locales en [s, e] desde `floor`. */
export async function queryLocalQuakes(s: number, e: number, floor: number): Promise<DisasterEvent[]> {
  const c = await db();
  const r = await c.execute({ sql: 'SELECT data FROM local_quakes WHERE t0 >= ? AND t0 <= ? AND (mag IS NULL OR mag >= ?)', args: [s, e, floor] });
  return r.rows.map((row) => JSON.parse(String(row.data)) as DisasterEvent);
}

/** Recorre todos los eventos en páginas por id (para migraciones). */
export async function* allEvents(pageSize = 2000): AsyncGenerator<DisasterEvent[]> {
  const c = await db();
  let after = '';
  for (;;) {
    const r = await c.execute({ sql: 'SELECT id, data FROM events WHERE id > ? ORDER BY id LIMIT ?', args: [after, pageSize] });
    if (!r.rows.length) return;
    after = String(r.rows[r.rows.length - 1].id);
    yield r.rows.map((row) => JSON.parse(String(row.data)) as DisasterEvent);
  }
}

export async function getStoredEvent(id: string): Promise<DisasterEvent | null> {
  const c = await db();
  const table = /^(inpres|csn)-/.test(id) ? 'local_quakes' : 'events';
  const r = await c.execute({ sql: `SELECT data FROM ${table} WHERE id = ?`, args: [id] });
  return r.rows[0] ? (JSON.parse(String(r.rows[0].data)) as DisasterEvent) : null;
}

/* ───────────── coverage ───────────── */

export async function addCoverage(src: SourceKey, t0: number, t1: number, floor = 0): Promise<void> {
  const c = await db();
  await c.execute({ sql: 'INSERT INTO coverage (src, t0, t1, floor) VALUES (?, ?, ?, ?)', args: [src, t0, t1, floor] });
}

/** ¿Está [s, e] cubierto por ventanas ya ingeridas (con magnitud mínima ≤ floor)? */
export async function isCovered(src: SourceKey, s: number, e: number, floor = 0): Promise<boolean> {
  const c = await db();
  const r = await c.execute({
    sql: 'SELECT t0, t1 FROM coverage WHERE src = ? AND floor <= ? AND t1 >= ? AND t0 <= ? ORDER BY t0',
    args: [src, floor, s, e],
  });
  let reach = s;
  for (const row of r.rows) {
    const t0 = Number(row.t0), t1 = Number(row.t1);
    if (t0 > reach) return false;
    reach = Math.max(reach, t1);
    if (reach >= e) return true;
  }
  return reach >= e;
}

/** Hasta dónde llega la cobertura continua que arranca en `s` (devuelve `s` si no hay). */
export async function coverageReach(src: SourceKey, s: number, floor = 0): Promise<number> {
  const c = await db();
  const r = await c.execute({
    sql: 'SELECT t0, t1 FROM coverage WHERE src = ? AND floor <= ? AND t1 >= ? ORDER BY t0',
    args: [src, floor, s],
  });
  let reach = s;
  for (const row of r.rows) {
    if (Number(row.t0) > reach) break;
    reach = Math.max(reach, Number(row.t1));
  }
  return reach;
}

/** Junta ventanas solapadas para que la tabla no crezca con cada corrida del cron. */
export async function compactCoverage(): Promise<void> {
  const c = await db();
  const r = await c.execute('SELECT src, floor, t0, t1 FROM coverage ORDER BY src, floor, t0');
  const merged: { src: string; floor: number; t0: number; t1: number }[] = [];
  for (const row of r.rows) {
    const cur = { src: String(row.src), floor: Number(row.floor), t0: Number(row.t0), t1: Number(row.t1) };
    const last = merged[merged.length - 1];
    if (last && last.src === cur.src && last.floor === cur.floor && cur.t0 <= last.t1) last.t1 = Math.max(last.t1, cur.t1);
    else merged.push(cur);
  }
  if (merged.length === r.rows.length) return;
  await c.batch([
    'DELETE FROM coverage',
    ...merged.map((m) => ({ sql: 'INSERT INTO coverage (src, t0, t1, floor) VALUES (?, ?, ?, ?)', args: [m.src, m.t0, m.t1, m.floor] })),
  ], 'write');
}

/* ───────────── ingest_runs ───────────── */

export async function startRun(src: SourceKey, job: string): Promise<number> {
  const c = await db();
  const r = await c.execute({ sql: 'INSERT INTO ingest_runs (src, job, started_at) VALUES (?, ?, ?)', args: [src, job, Date.now()] });
  return Number(r.lastInsertRowid);
}

export async function finishRun(id: number, ok: boolean, fetched: number, error?: string): Promise<void> {
  const c = await db();
  await c.execute({
    sql: 'UPDATE ingest_runs SET finished_at = ?, ok = ?, fetched = ?, error = ? WHERE id = ?',
    args: [Date.now(), ok ? 1 : 0, fetched, error?.slice(0, 500) ?? null, id],
  });
}

export type LastRun = { ok: boolean; at: number; fetched: number; error: string | null };

/** Última corrida terminada por fuente, y la última exitosa. */
export async function lastRuns(): Promise<Partial<Record<SourceKey, { last: LastRun; lastOkAt: number | null }>>> {
  const c = await db();
  const r = await c.execute(`
    SELECT r.src, r.ok, r.finished_at, r.fetched, r.error,
      (SELECT MAX(finished_at) FROM ingest_runs o WHERE o.src = r.src AND o.ok = 1) AS last_ok
    FROM ingest_runs r
    WHERE r.id = (SELECT id FROM ingest_runs x WHERE x.src = r.src AND x.finished_at IS NOT NULL ORDER BY x.finished_at DESC LIMIT 1)`);
  const out: Partial<Record<SourceKey, { last: LastRun; lastOkAt: number | null }>> = {};
  for (const row of r.rows) {
    out[String(row.src) as SourceKey] = {
      last: { ok: Number(row.ok) === 1, at: Number(row.finished_at), fetched: Number(row.fetched ?? 0), error: row.error == null ? null : String(row.error) },
      lastOkAt: row.last_ok == null ? null : Number(row.last_ok),
    };
  }
  return out;
}

/* ───────────── kv (capas de referencia, locks) ───────────── */

export async function kvGet<T>(key: string): Promise<{ value: T; updatedAt: number } | null> {
  const c = await db();
  const r = await c.execute({ sql: 'SELECT value, updated_at FROM kv WHERE key = ?', args: [key] });
  const row = r.rows[0];
  return row ? { value: JSON.parse(String(row.value)) as T, updatedAt: Number(row.updated_at) } : null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const c = await db();
  await c.execute({
    sql: 'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    args: [key, JSON.stringify(value), Date.now()],
  });
}

/** Lock simple con vencimiento: true si se obtuvo. */
export async function tryLock(key: string, ttlMs: number): Promise<boolean> {
  const c = await db();
  const now = Date.now();
  const r = await c.execute({
    sql: `INSERT INTO kv (key, value, updated_at) VALUES (?, '1', ?)
          ON CONFLICT(key) DO UPDATE SET updated_at = excluded.updated_at WHERE kv.updated_at < ?`,
    args: [key, now, now - ttlMs],
  });
  return r.rowsAffected > 0;
}

export async function unlock(key: string): Promise<void> {
  const c = await db();
  await c.execute({ sql: 'DELETE FROM kv WHERE key = ?', args: [key] });
}

/** Suma 1 a un contador guardado en kv (atómico en la base) y devuelve el valor nuevo. */
export async function kvIncr(key: string): Promise<number> {
  const c = await db();
  const r = await c.execute({
    sql: `INSERT INTO kv (key, value, updated_at) VALUES (?, '1', ?)
          ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = excluded.updated_at
          RETURNING value`,
    args: [key, Date.now()],
  });
  return Number(r.rows[0]?.value ?? 0);
}

/* ───────────── "¿Lo sentiste?" ───────────── */

export async function addFelt(eventId: string, level: number, lat: number | null, lon: number | null): Promise<void> {
  const c = await db();
  await c.execute({ sql: 'INSERT INTO felt (event_id, level, lat, lon, at) VALUES (?, ?, ?, ?, ?)', args: [eventId, level, lat, lon, Date.now()] });
}

export async function feltReports(eventId: string): Promise<{ level: number; lat: number | null; lon: number | null }[]> {
  const c = await db();
  const r = await c.execute({ sql: 'SELECT level, lat, lon FROM felt WHERE event_id = ? LIMIT 50000', args: [eventId] });
  return r.rows.map((x) => ({ level: Number(x.level), lat: x.lat == null ? null : Number(x.lat), lon: x.lon == null ? null : Number(x.lon) }));
}

/** Borra claves de kv con un prefijo, más viejas que `before` (ms). */
export async function kvDeleteOlder(prefix: string, before: number): Promise<void> {
  const c = await db();
  await c.execute({ sql: 'DELETE FROM kv WHERE key LIKE ? AND updated_at < ?', args: [prefix.replace(/[%_]/g, '') + '%', before] });
}
