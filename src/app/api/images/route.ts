import { NextRequest, NextResponse } from 'next/server';
import { isIso3 } from '@/lib/countries';
import { isEventId } from '@/lib/server/ingest';
import { imagesForCountry, imagesForEvent, imagesForStorm, imagesForVolcano } from '@/lib/server/images';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Imágenes de una ficha. ?event=id | ?volcano=número GVP | ?storm=id NHC | ?country=ISO3 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const event = sp.get('event'), volcano = sp.get('volcano'), storm = sp.get('storm'), country = sp.get('country');
  try {
    let images = null;
    if (event && isEventId(event)) images = await imagesForEvent(event);
    else if (volcano && /^\d{6}$/.test(volcano)) images = await imagesForVolcano(+volcano);
    else if (storm && /^nhc-[a-z]{2}\d{6}$/.test(storm)) images = await imagesForStorm(storm);
    else if (country && isIso3(country)) images = await imagesForCountry(country.toUpperCase());
    else return NextResponse.json({ error: 'bad params' }, { status: 400 });
    if (!images) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ images }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
  } catch (err) {
    console.error('[images]', err);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
