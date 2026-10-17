import { NextResponse, type NextRequest } from 'next/server';
import { isIso3 } from '@/lib/countries';
import { getCountryHistory, getNearbyHistory } from '@/lib/server/ncei';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Sismos/tsunamis históricos significativos (NOAA NCEI). ?iso3=CHL o ?lat&lon[&deg] */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    const iso3 = sp.get('iso3');
    if (iso3) {
      if (!isIso3(iso3)) return NextResponse.json({ error: 'bad iso3' }, { status: 400 });
      return NextResponse.json(await getCountryHistory(iso3.toUpperCase()), { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
    }
    const lat = Number(sp.get('lat')), lon = Number(sp.get('lon')), deg = Math.min(10, Math.max(0.5, Number(sp.get('deg') ?? 3)));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return NextResponse.json({ error: 'bad params' }, { status: 400 });
    return NextResponse.json(await getNearbyHistory(lat, lon, deg), { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
  } catch (err) {
    console.error('[ncei]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
