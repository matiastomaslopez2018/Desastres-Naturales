import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Mapa global de FWI del día (Copernicus GWIS, modelo ECMWF) en Web Mercator (±85,05°), 2048 px.
 * Se sirve desde el mismo origen para que MapLibre lo use como imagen sobre el globo.
 */
const E = 20037508.342789244;
export async function GET() {
  const day = new Date().toISOString().slice(0, 10);
  const url = `https://maps.effis.emergency.copernicus.eu/gwis?service=WMS&version=1.1.1&request=GetMap&layers=ecmwf.fwi&styles=&srs=EPSG:3857&bbox=${-E},${-E},${E},${E}&width=2048&height=2048&format=image/png&transparent=true&time=${day}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(45000) }).catch(() => null);
  if (!res?.ok || !/image/.test(res.headers.get('content-type') ?? '')) return NextResponse.json({ error: 'upstream' }, { status: 502 });
  return new NextResponse(await res.arrayBuffer(), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, s-maxage=21600', 'X-Data-Date': day },
  });
}
