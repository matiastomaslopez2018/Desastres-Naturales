import { NextRequest, NextResponse } from 'next/server';
import { getEventById, isEventId } from '@/lib/server/ingest';
import { quakeGeology } from '@/lib/server/geology';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Contexto geológico de un sismo de USGS. ?id= */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!isEventId(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  try {
    const found = await getEventById(id);
    if (!found) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const geo = await quakeGeology(found.event);
    return NextResponse.json({ geology: geo }, { headers: { 'Cache-Control': 'public, s-maxage=1800' } });
  } catch (err) {
    console.error('[geology]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
