import { NextResponse, type NextRequest } from 'next/server';
import { getReliefReports, reliefwebSearchUrl } from '@/lib/server/reliefweb';

export const dynamic = 'force-dynamic';

/** Reportes humanitarios de ReliefWeb. Sin RELIEFWEB_APPNAME devuelve solo el enlace de búsqueda. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const glide = sp.get('glide') || undefined;
  const text = (sp.get('text') ?? '').slice(0, 120);
  const from = Number(sp.get('from')) || undefined;
  if (!glide && !text) return NextResponse.json({ error: 'bad params' }, { status: 400 });
  const searchUrl = reliefwebSearchUrl({ glide, text });
  try {
    const reports = await getReliefReports({ glide, text, from });
    return NextResponse.json({ reports, searchUrl, needsAppname: reports === null }, { headers: { 'Cache-Control': 'public, s-maxage=3600' } });
  } catch (err) {
    console.error('[reliefweb]', err);
    return NextResponse.json({ reports: null, searchUrl, error: 'upstream' }, { status: 200 });
  }
}
