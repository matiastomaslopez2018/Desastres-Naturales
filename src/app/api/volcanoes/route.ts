import { NextResponse } from 'next/server';
import { getVolcanoActivity } from '@/lib/server/volcanoes';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Volcanes con actividad: reporte semanal GVP/USGS o erupciones en curso de la base GVP. */
export async function GET() {
  try {
    return NextResponse.json(await getVolcanoActivity(), { headers: { 'Cache-Control': 'public, s-maxage=3600' } });
  } catch (err) {
    console.error('[volcanoes]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
