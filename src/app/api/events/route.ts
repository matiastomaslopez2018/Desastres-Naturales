import { NextResponse, type NextRequest } from 'next/server';
import { getEvents } from '@/lib/server/ingest';
import { parseRange, parseYear } from '@/lib/range';

export const dynamic = 'force-dynamic';
// Un período que todavía no está en la base se trae de las fuentes en el momento.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const data = await getEvents(parseRange(sp.get('range')), parseYear(sp.get('year')));
  return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
