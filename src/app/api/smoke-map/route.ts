import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Humo de incendios: espesor óptico de los aerosoles de quema de biomasa a 550 nm, del pronóstico de
 * Copernicus CAMS (ECMWF), en Web Mercator (±85,05°), 2048 px, desde el WMS público de ECMWF. Se pide el
 * paso de 3 horas más cercano a ahora y, si todavía no está, los anteriores (la corrida de las 00 UTC
 * se publica cerca de las 20 UTC).
 */
const E = 20037508.342789244;
const STEP = 3 * 3600_000;
export async function GET() {
  const t0 = Math.floor(Date.now() / STEP) * STEP;
  for (let k = 0; k < 4; k++) {
    const time = new Date(t0 - k * STEP).toISOString().replace('.000Z', 'Z');
    const url = `https://eccharts.ecmwf.int/wms/?token=public&service=WMS&version=1.1.1&request=GetMap&layers=composition_bbaod550&styles=sh_Oranges_aod&srs=EPSG:3857&bbox=${-E},${-E},${E},${E}&width=2048&height=2048&format=image/png&transparent=true&time=${time}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(45000) }).catch(() => null);
    if (!res?.ok || !/image/.test(res.headers.get('content-type') ?? '')) continue;
    return new NextResponse(await res.arrayBuffer(), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600, s-maxage=10800', 'X-Data-Time': time },
    });
  }
  return NextResponse.json({ error: 'upstream' }, { status: 502 });
}
