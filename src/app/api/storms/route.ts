import { NextResponse } from 'next/server';
import { getActiveStorms } from '@/lib/server/nhc';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Ciclones activos de NOAA NHC con cono y trayectorias. */
export async function GET() {
  try {
    return NextResponse.json(await getActiveStorms(), { headers: { 'Cache-Control': 'public, s-maxage=600' } });
  } catch (err) {
    console.error('[storms]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
