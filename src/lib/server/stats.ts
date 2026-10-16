import 'server-only';
import { getEvents } from './ingest';
import { ALERT_RANK, relevance } from '../symbols';
import type { DisasterEvent, EventType, RangeKey } from '../types';

/** Magnitud mínima de sismos para comparar países: el catálogo global de USGS es completo desde ~M4.5. */
export const RANK_EQ_FLOOR = 4.5;

export const RANK_TYPES: EventType[] = ['eq', 'volcano', 'fire', 'storm', 'flood', 'drought'];

export type CountryStats = {
  iso3: string;
  total: number;
  byType: Record<EventType, number>;
  /** Alertas oficiales naranja o roja (GDACS o USGS PAGER). */
  alerts: number;
  red: number;
  maxEq: DisasterEvent | null;
};

export const SORT_KEYS = ['alerts', 'total', 'eq', 'maxmag', 'volcano', 'fire', 'storm', 'flood', 'drought'] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export const parseSort = (v: string | undefined): SortKey => ((SORT_KEYS as readonly string[]).includes(v ?? '') ? (v as SortKey) : 'alerts');

const alertLvl = (e: DisasterEvent) => Math.max(e.alert ? ALERT_RANK[e.alert] : 0, e.pager ? ALERT_RANK[e.pager] : 0);

/** Eventos que cuentan para comparar: con país y, si son sismos, desde M4.5. */
export function comparable(e: DisasterEvent): boolean {
  if (!e.iso3) return false;
  return e.type !== 'eq' || (e.mag != null && e.mag >= RANK_EQ_FLOOR);
}

export function aggregate(events: DisasterEvent[]): Map<string, CountryStats> {
  const out = new Map<string, CountryStats>();
  for (const e of events) {
    if (!comparable(e)) continue;
    let s = out.get(e.iso3!);
    if (!s) {
      s = { iso3: e.iso3!, total: 0, byType: { eq: 0, volcano: 0, fire: 0, storm: 0, flood: 0, drought: 0 }, alerts: 0, red: 0, maxEq: null };
      out.set(e.iso3!, s);
    }
    s.total++;
    s.byType[e.type]++;
    const lvl = alertLvl(e);
    if (lvl >= 2) s.alerts++;
    if (lvl >= 3) s.red++;
    if (e.type === 'eq' && (s.maxEq?.mag ?? -Infinity) < (e.mag ?? -Infinity)) s.maxEq = e;
  }
  return out;
}

function metric(s: CountryStats, key: SortKey): number {
  if (key === 'alerts') return s.alerts * 1000 + s.red;
  if (key === 'total') return s.total;
  if (key === 'maxmag') return s.maxEq?.mag ?? -1;
  return s.byType[key];
}

/** Ranking ordenado por `key` (desempate: total). Solo países con al menos un evento de esa métrica. */
export function rank(stats: Iterable<CountryStats>, key: SortKey): CountryStats[] {
  return [...stats]
    .filter((s) => metric(s, key) > 0)
    .sort((a, b) => metric(b, key) - metric(a, key) || b.total - a.total || a.iso3.localeCompare(b.iso3));
}

export async function getRanking(range: RangeKey, year: number) {
  const data = await getEvents(range, year);
  return { ...data, stats: aggregate(data.events) };
}

export async function getCountry(iso3: string, range: RangeKey, year: number) {
  const data = await getRanking(range, year);
  const events = data.events.filter((e) => e.iso3 === iso3);
  const stats = data.stats.get(iso3) ?? null;
  const byAlerts = rank(data.stats.values(), 'alerts');
  const byTotal = rank(data.stats.values(), 'total');
  return {
    ...data,
    events: events.sort((a, b) => relevance(b) - relevance(a) || b.time - a.time),
    stats,
    position: {
      alerts: stats ? byAlerts.findIndex((s) => s.iso3 === iso3) + 1 || null : null,
      total: stats ? byTotal.findIndex((s) => s.iso3 === iso3) + 1 || null : null,
      of: byTotal.length,
    },
  };
}
