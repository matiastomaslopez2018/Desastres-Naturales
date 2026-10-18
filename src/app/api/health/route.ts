import { NextResponse } from 'next/server';
import { db, dbInfo, lastRuns } from '@/lib/server/db';
import { getWeeklyStatus } from '@/lib/server/volcanoes';

export const dynamic = 'force-dynamic';

/**
 * Diagnóstico público y sin secretos: qué tipo de base usa el sitio (Turso o archivo),
 * con qué variable se configuró, cuántos registros hay y cómo salió la última ingesta.
 */
export async function GET() {
  const info = dbInfo();
  try {
    const c = await db();
    const [events, bySrc, runs, cronRuns, gvpWeekly] = await Promise.all([
      c.execute('SELECT COUNT(*) AS n FROM events'),
      c.execute('SELECT src, COUNT(*) AS n FROM events GROUP BY src'),
      lastRuns(),
      // Corridas del cron (job "live" o "live-full"): la más reciente por fuente.
      c.execute(`SELECT src, job, ok, finished_at, fetched FROM ingest_runs r
        WHERE job LIKE 'live%' AND id = (SELECT MAX(id) FROM ingest_runs x WHERE x.src = r.src AND x.job LIKE 'live%')`),
      getWeeklyStatus().catch(() => null),
    ]);
    return NextResponse.json({
      ok: true,
      db: { kind: info.kind, urlVar: info.urlVar, tokenVar: info.tokenVar },
      events: Number(events.rows[0].n),
      cron: {
        // Solo si está definido, nunca el valor.
        secretConfigured: !!process.env.CRON_SECRET,
        lastRuns: Object.fromEntries(cronRuns.rows.map((r) => [String(r.src), {
          job: String(r.job), ok: Number(r.ok) === 1, at: r.finished_at == null ? null : Number(r.finished_at), fetched: Number(r.fetched ?? 0),
        }])),
      },
      // Reporte semanal del Smithsonian GVP: ok o caído (con el código HTTP), desde cuándo lo ve este
      // sitio y alert = true si lleva más de 7 días caído.
      sources: {
        smithsonianWeekly: gvpWeekly && {
          state: gvpWeekly.state, httpCode: gvpWeekly.code, since: new Date(gvpWeekly.since).toISOString(),
          checkedAt: new Date(gvpWeekly.checkedAt).toISOString(), downDays: gvpWeekly.downDays, alert: gvpWeekly.alert,
        },
      },
      bySource: Object.fromEntries(bySrc.rows.map((r) => [String(r.src), Number(r.n)])),
      lastRuns: Object.fromEntries(Object.entries(runs).map(([k, v]) => [k, { ok: v?.last.ok, at: v?.last.at, lastOkAt: v?.lastOkAt }])),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, db: { kind: info.kind, urlVar: info.urlVar, tokenVar: info.tokenVar }, error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
