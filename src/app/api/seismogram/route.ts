import { NextResponse, type NextRequest } from 'next/server';
import { getEventById, isEventId } from '@/lib/server/ingest';
import { getSeismogram } from '@/lib/server/seismogram';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Sismograma real de un sismo (?id=): estación más cercana de las redes abiertas de EarthScope. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!isEventId(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  try {
    const found = await getEventById(id);
    const e = found?.event;
    if (!e || e.type !== 'eq') return NextResponse.json({ error: 'not found' }, { status: 404 });
    const s = await getSeismogram(id, { lat: e.lat, lon: e.lon, time: e.time, depth: e.depth ?? 10 });
    return NextResponse.json({ seismogram: s }, { headers: { 'Cache-Control': s ? 'public, s-maxage=86400' : 'public, s-maxage=600' } });
  } catch (err) {
    console.error('[seismogram]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
