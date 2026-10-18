import { NextResponse } from 'next/server';
import { decodePng, encodeIndexed } from '@/lib/png';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Pronóstico inmediato de deslizamientos de hoy (NASA LHASA) en Web Mercator, 2048 px, ya
 * pintado. La probabilidad (0 a 1) llega como gris de 0 a 255 (estiramiento lineal fijo) y se
 * convierte con una paleta: la rampa del visor oficial de NASA (azul → celeste → amarillo →
 * rojo), transparente por debajo de 5 % y más opaca cuanto mayor es la probabilidad.
 */
const E = 20037508.342789244;
const STOPS: [number, number, number][] = [[0, 0, 255], [0, 255, 255], [255, 255, 0], [255, 0, 0]];
const PALETTE = Array.from({ length: 256 }, (_, g): [number, number, number, number] => {
  const p = g / 255, x = p * 3, i = Math.min(2, Math.floor(x)), f = x - i, a = STOPS[i], b = STOPS[i + 1];
  const [r, gg, bb] = [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f));
  return [r, gg, bb, p < 0.05 ? 0 : Math.round(120 + 135 * Math.min(1, p / 0.5))];
});

export async function GET() {
  const rule = encodeURIComponent(JSON.stringify({
    rasterFunction: 'Stretch', rasterFunctionArguments: { StretchType: 5, Min: 0, Max: 255, Statistics: [[0, 1, 0, 1]], DRA: false }, outputPixelType: 'U8',
  }));
  const url = `https://gis.earthdata.nasa.gov/portal/rest/services/Landslides/LHASA_Hazard_Today/ImageServer/exportImage?bbox=${-E},${-E},${E},${E}&bboxSR=3857&imageSR=3857&size=2048,2048&format=png&renderingRule=${rule}&f=image`;
  const res = await fetch(url, { signal: AbortSignal.timeout(50000) }).catch(() => null);
  if (!res?.ok || !/image/.test(res.headers.get('content-type') ?? '')) return NextResponse.json({ error: 'upstream' }, { status: 502 });
  try {
    const { width, height, data } = decodePng(new Uint8Array(await res.arrayBuffer()));
    const idx = new Uint8Array(width * height);
    for (let i = 0; i < idx.length; i++) idx[i] = data[i * 4];
    return new NextResponse(new Uint8Array(encodeIndexed(width, height, idx, PALETTE)), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600, s-maxage=10800' } });
  } catch {
    return NextResponse.json({ error: 'decode' }, { status: 502 });
  }
}
