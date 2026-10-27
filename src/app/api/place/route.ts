import { NextResponse } from 'next/server';
import { placeNow, placeProfile } from '@/lib/server/place';
import { covers, getSmnAlerts } from '@/lib/server/smn';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Peligros naturales de un punto ("Mi lugar"): ?lat=&lon= */
export async function GET(req: Request) {
  const u = new URL(req.url), lat = Number(u.searchParams.get('lat')), lon = Number(u.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return NextResponse.json({ error: 'lat/lon' }, { status: 400 });
  try {
    // Alertas del SMN cuya zona incluye el punto (solo hay en la Argentina).
    const inArg = lon > -74 && lon < -53 && lat > -56 && lat < -21;
    const [profile, now, wx] = await Promise.all([placeProfile(lat, lon), placeNow(lat, lon).catch(() => []),
      inArg ? getSmnAlerts().then((r) => r.alerts.filter((a) => covers(a, lon, lat)).map(({ id, event, level, onset, expires, description }) => ({ id, event, level, onset, expires, description }))).catch(() => []) : []]);
    return NextResponse.json({ profile, now, wx }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  } catch (err) {
    console.error('[place]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
