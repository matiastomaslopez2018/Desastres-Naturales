import { NextResponse } from 'next/server';
import { dispatchPush } from '@/lib/server/push';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Envía las notificaciones push pendientes. Lo llama una tarea programada (GitHub Actions cada 5 minutos) para que
 * los avisos salgan aunque nadie tenga la página abierta. Es seguro llamarlo de más: corre como mucho una vez por
 * minuto y cada aviso se manda una sola vez.
 */
export async function GET() {
  const t0 = Date.now();
  const r = await dispatchPush();
  return NextResponse.json({ ...r, ms: Date.now() - t0 }, { headers: { 'Cache-Control': 'no-store' } });
}
