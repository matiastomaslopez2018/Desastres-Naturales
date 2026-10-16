import { NextResponse, type NextRequest } from 'next/server';
import { getEventById, isEventId } from '@/lib/server/ingest';

export const dynamic = 'force-dynamic';
// Si el evento no está en la base, se consulta a la fuente en el momento.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!isEventId(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  try {
    const found = await getEventById(id);
    if (!found) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(found, { headers: { 'Cache-Control': 'public, s-maxage=300' } });
  } catch (err) {
    console.error('[event]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
