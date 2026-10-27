import { NextRequest, NextResponse } from 'next/server';
import { windProfileNow } from '@/lib/server/volcanoWind';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Perfil de viento actual (GFS de la NOAA) sobre un punto: ?lon&lat. */
export async function GET(req: NextRequest) {
  const lon = Number(req.nextUrl.searchParams.get('lon')), lat = Number(req.nextUrl.searchParams.get('lat'));
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 89 || Math.abs(lon) > 180) return NextResponse.json({ error: 'bad point' }, { status: 400 });
  const w = await windProfileNow(lon, lat);
  if (!w) return NextResponse.json({ error: 'upstream' }, { status: 502 });
  return NextResponse.json(w, { headers: { 'Cache-Control': 'public, s-maxage=3600' } });
}
