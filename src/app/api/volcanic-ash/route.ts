import { NextResponse } from 'next/server';
import { getLiveAsh } from '@/lib/server/volcanicAsh';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Volcanes con ceniza en el aire ahora, según los SIGMET de ceniza (NOAA Aviation Weather Center). */
export async function GET() {
  try {
    return NextResponse.json(await getLiveAsh(), { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  } catch (err) {
    console.error('[volcanic-ash]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
