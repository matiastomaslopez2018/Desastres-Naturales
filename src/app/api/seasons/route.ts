import { NextResponse } from 'next/server';
import { placeSeasons } from '@/lib/server/place';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Qué esperar cada mes en un punto (?lat=&lon=): clima de ERA5 y registros de ciclones y deslizamientos. */
export async function GET(req: Request) {
  const u = new URL(req.url), lat = Number(u.searchParams.get('lat')), lon = Number(u.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return NextResponse.json({ error: 'lat/lon' }, { status: 400 });
  try {
    return NextResponse.json(await placeSeasons(lat, lon), { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
  } catch (err) {
    console.error('[seasons]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
