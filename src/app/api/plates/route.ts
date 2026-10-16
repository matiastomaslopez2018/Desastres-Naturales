import { NextResponse } from 'next/server';
import { getPlates } from '@/lib/server/ingest';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getPlates(), { headers: { 'Cache-Control': 'public, s-maxage=604800' } });
  } catch (err) {
    console.error('[plates]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
