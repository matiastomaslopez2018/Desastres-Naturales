import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Mapa global de FWI del día (Copernicus GWIS, modelo ECMWF), 0,5° por píxel. Se sirve
 * desde el mismo origen para que el globo pueda leer sus píxeles y reproyectarlo.
 */
export async function GET() {
  const day = new Date().toISOString().slice(0, 10);
  const url = `https://maps.effis.emergency.copernicus.eu/gwis?service=WMS&version=1.1.1&request=GetMap&layers=ecmwf.fwi&styles=&srs=EPSG:4326&bbox=-180,-90,180,90&width=720&height=360&format=image/png&transparent=true&time=${day}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) }).catch(() => null);
  if (!res?.ok || !/image/.test(res.headers.get('content-type') ?? '')) return NextResponse.json({ error: 'upstream' }, { status: 502 });
  return new NextResponse(await res.arrayBuffer(), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, s-maxage=21600', 'X-Data-Date': day },
  });
}
