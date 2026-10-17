import { NextResponse } from 'next/server';
import { dartStations } from '@/lib/server/tsunamiContext';

export const dynamic = 'force-dynamic';

/** Boyas DART de NOAA (lista de estaciones activas de NDBC). */
export async function GET() {
  try {
    return NextResponse.json({ buoys: await dartStations() }, { headers: { 'Cache-Control': 'public, s-maxage=3600' } });
  } catch (err) {
    console.error('[dart]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
