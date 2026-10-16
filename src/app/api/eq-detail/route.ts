import { NextResponse, type NextRequest } from 'next/server';
import { USGS_ID, getEqDetail } from '@/lib/server/ingest';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!USGS_ID.test(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  try {
    return NextResponse.json(await getEqDetail(id), { headers: { 'Cache-Control': 'public, s-maxage=600' } });
  } catch (err) {
    console.error('[eq-detail]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
