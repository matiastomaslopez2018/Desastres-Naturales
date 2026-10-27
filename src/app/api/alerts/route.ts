import { NextResponse, after } from 'next/server';
import { getLiveAlerts } from '@/lib/server/liveAlerts';
import { dispatchPush } from '@/lib/server/push';
import { ALERT_RULES } from '@/lib/alerts';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/*
 * Avisos en vivo para la página (cada visitante consulta cada minuto; la CDN guarda la respuesta 60 s, así que
 * la función corre como mucho una vez por minuto). De paso, manda las notificaciones push pendientes.
 */
export async function GET() {
  const alerts = await getLiveAlerts();
  after(() => dispatchPush(alerts).catch((e) => console.warn('[push]', e instanceof Error ? e.message : e)));
  return NextResponse.json({ alerts, rules: ALERT_RULES, at: Date.now() }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } });
}
