import { NextResponse } from 'next/server';
import { db, dbInfo, lastRuns } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

/**
 * Diagnóstico público y sin secretos: qué tipo de base usa el sitio (Turso o archivo),
 * con qué variable se configuró, cuántos registros hay y cómo salió la última ingesta.
 */
export async function GET() {
  const info = dbInfo();
  try {
    const c = await db();
    const [events, bySrc, runs] = await Promise.all([
      c.execute('SELECT COUNT(*) AS n FROM events'),
      c.execute('SELECT src, COUNT(*) AS n FROM events GROUP BY src'),
      lastRuns(),
    ]);
    return NextResponse.json({
      ok: true,
      db: { kind: info.kind, urlVar: info.urlVar, tokenVar: info.tokenVar },
      events: Number(events.rows[0].n),
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
