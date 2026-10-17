import { NextResponse } from 'next/server';
import { getTsunamiMessages } from '@/lib/server/tsunami';

export const dynamic = 'force-dynamic';

/** Mensajes de los centros de alerta de tsunamis de NOAA (NTWC y PTWC). */
export async function GET() {
  try {
    return NextResponse.json(await getTsunamiMessages(), { headers: { 'Cache-Control': 'public, s-maxage=120' } });
  } catch (err) {
    console.error('[tsunami]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
