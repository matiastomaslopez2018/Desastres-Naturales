import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Pronóstico inmediato de deslizamientos de hoy (NASA LHASA), global, 0,25° por píxel. La
 * probabilidad (0 a 1) llega como gris de 0 a 255 (estiramiento lineal fijo, sin ajuste
 * dinámico), para que el globo la pinte con la rampa del visor oficial de NASA.
 */
export async function GET() {
  const rule = encodeURIComponent(JSON.stringify({
    rasterFunction: 'Stretch', rasterFunctionArguments: { StretchType: 5, Min: 0, Max: 255, Statistics: [[0, 1, 0, 1]], DRA: false }, outputPixelType: 'U8',
  }));
  const url = `https://gis.earthdata.nasa.gov/portal/rest/services/Landslides/LHASA_Hazard_Today/ImageServer/exportImage?bbox=-180,-90,180,90&bboxSR=4326&imageSR=4326&size=1440,720&format=png&renderingRule=${rule}&f=image`;
  const res = await fetch(url, { signal: AbortSignal.timeout(45000) }).catch(() => null);
  if (!res?.ok || !/image/.test(res.headers.get('content-type') ?? '')) return NextResponse.json({ error: 'upstream' }, { status: 502 });
  return new NextResponse(await res.arrayBuffer(), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, s-maxage=10800' } });
}
