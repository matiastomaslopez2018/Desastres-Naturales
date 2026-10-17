import { NextResponse, type NextRequest } from 'next/server';
import { getEmscMatch } from '@/lib/server/emsc';

export const dynamic = 'force-dynamic';

/** El mismo sismo en EMSC (magnitud y testimonios "lo sentí"). ?time=ms&lat&lon&mag */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const time = Number(sp.get('time')), lat = Number(sp.get('lat')), lon = Number(sp.get('lon'));
  const mag = sp.get('mag') == null ? null : Number(sp.get('mag'));
  if (![time, lat, lon].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'bad params' }, { status: 400 });
  }
  try {
    return NextResponse.json({ match: await getEmscMatch({ time, lat, lon, mag: Number.isFinite(mag) ? mag : null }) },
      { headers: { 'Cache-Control': 'public, s-maxage=600' } });
  } catch (err) {
    console.error('[emsc]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
