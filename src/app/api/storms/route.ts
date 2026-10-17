import { NextResponse } from 'next/server';
import { getOtherStorms } from '@/lib/server/gdacsStorms';
import { getActiveStorms } from '@/lib/server/nhc';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Ciclones activos: NHC (Atlántico y Pacífico este/central) y, para las otras cuencas,
 * GDACS con el pronóstico de la agencia que corresponda (en general JTWC). Si un ciclón
 * está en ambas, se usa el de NHC.
 */
export async function GET() {
  try {
    const [nhc, others] = await Promise.all([getActiveStorms(), getOtherStorms().catch(() => ({ storms: [], fetchedAt: 0 }))]);
    const names = new Set(nhc.storms.map((s) => s.name.toLowerCase()));
    const storms = [...nhc.storms, ...others.storms.filter((s) => !names.has(s.name.toLowerCase()))];
    return NextResponse.json({ storms, fetchedAt: Math.max(nhc.fetchedAt, others.fetchedAt) }, { headers: { 'Cache-Control': 'public, s-maxage=600' } });
  } catch (err) {
    console.error('[storms]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
