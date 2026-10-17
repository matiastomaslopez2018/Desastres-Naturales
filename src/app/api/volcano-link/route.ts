import { NextRequest, NextResponse } from 'next/server';
import { isLang } from '@/lib/i18n';
import { routePath } from '@/lib/seo';
import { volcanoIndex } from '@/lib/server/landing';

export const dynamic = 'force-dynamic';

/** Lleva a la ficha de un volcán por su número GVP: ?vn=332010&lang=es → /es/volcanes/kilauea */
export async function GET(req: NextRequest) {
  const vn = Number(req.nextUrl.searchParams.get('vn'));
  const l = req.nextUrl.searchParams.get('lang') ?? 'es';
  const lang = isLang(l) ? l : 'es';
  const slug = Number.isFinite(vn) ? (await volcanoIndex()).slugOf.get(vn) : undefined;
  if (!slug) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.redirect(new URL(routePath(lang, 'volcano', slug), req.nextUrl.origin), 307);
}
