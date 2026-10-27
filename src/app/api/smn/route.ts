import { NextResponse } from 'next/server';
import { getSmnAlerts } from '@/lib/server/smn';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Alertas meteorológicas vigentes y próximas del Servicio Meteorológico Nacional (CAP). */
export async function GET() {
  try {
    return NextResponse.json(await getSmnAlerts(), { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  } catch (err) {
    console.error('[smn]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
