import { NextResponse } from 'next/server';
import { getGvp } from '@/lib/server/ingest';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const volcanoes = await getGvp();
    return NextResponse.json(volcanoes, { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
  } catch (err) {
    console.error('[gvp]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
