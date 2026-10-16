import { NextResponse, type NextRequest } from 'next/server';
import { runLiveIngest } from '@/lib/server/jobs';

export const dynamic = 'force-dynamic';
// 60 s entra en todos los planes de Vercel; una corrida incremental tarda 1–5 s.
export const maxDuration = 60;

/**
 * Ingesta programada (Vercel Cron u otro scheduler). Con `CRON_SECRET` exige
 * `Authorization: Bearer <CRON_SECRET>`; sin él solo responde en desarrollo.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorized = secret ? req.headers.get('authorization') === `Bearer ${secret}` : process.env.NODE_ENV !== 'production';
  if (!authorized) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const t0 = Date.now();
  const summary = await runLiveIngest();
  const ok = Object.values(summary).every((s) => s.ok);
  return NextResponse.json({ ok, ms: Date.now() - t0, summary }, { status: ok ? 200 : 207 });
}
