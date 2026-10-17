import { NextRequest, NextResponse } from 'next/server';
import { windGrid } from '@/lib/server/fireContext';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Viento GFS (NOAA) a 10 m en un recuadro: ?w&s&e&n (grados enteros; hasta 40° × 30°). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const [w, s, e, n] = ['w', 's', 'e', 'n'].map((k) => Math.round(Number(sp.get(k))));
  if (![w, s, e, n].every(Number.isFinite) || e <= w || n <= s || e - w > 40 || n - s > 30 || s < -90 || n > 90 || w < -180 || e > 180) {
    return NextResponse.json({ error: 'bad bbox' }, { status: 400 });
  }
  const g = await windGrid(w, s, e, n);
  if (!g) return NextResponse.json({ error: 'upstream' }, { status: 502 });
  return NextResponse.json(g, { headers: { 'Cache-Control': 'public, s-maxage=3600' } });
}
