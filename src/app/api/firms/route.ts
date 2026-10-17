import { NextResponse } from 'next/server';
import { getHeat } from '@/lib/server/firms';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Focos de calor NASA FIRMS (24 h, agregados). Sin FIRMS_MAP_KEY responde 503 { needsKey }. */
export async function GET() {
  try {
    const heat = await getHeat();
    if (!heat) return NextResponse.json({ needsKey: 'FIRMS_MAP_KEY' }, { status: 503 });
    return NextResponse.json(heat, { headers: { 'Cache-Control': 'public, s-maxage=900' } });
  } catch (err) {
    console.error('[firms]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
