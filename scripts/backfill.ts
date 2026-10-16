/**
 * Histórico (sismos desde M4.5, EONET y alertas GDACS) por años. Retomable:
 * saltea los bloques que ya están en la base.
 *
 *   npm run backfill                 # últimos 365 días
 *   npm run backfill -- 2010 2025    # años 2010 a 2025 inclusive
 *   npm run backfill -- 2011 2011 usgs,gdacs
 */
import { EVENT_SOURCES, refreshReference, runBackfill, type EventSource } from '@/lib/server/jobs';

const [a, b, srcArg] = process.argv.slice(2);
const now = new Date();
const from = a ? new Date(Date.UTC(+a, 0, 1)) : new Date(+now - 365 * 864e5);
const to = b ? new Date(Math.min(Date.UTC(+b + 1, 0, 1), +now)) : now;
const sources = srcArg ? (srcArg.split(',').filter((s) => (EVENT_SOURCES as string[]).includes(s)) as EventSource[]) : EVENT_SOURCES;

(async () => {
  const t0 = Date.now();
  console.table(await refreshReference());
  const summary = await runBackfill(from, to, sources);
  console.table(summary);
  console.log(`listo en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(Object.values(summary).every((s) => s.ok) ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
