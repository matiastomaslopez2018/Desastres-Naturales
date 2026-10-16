import { NextResponse, type NextRequest } from 'next/server';

/** `/` → `/es` o `/en` según Accept-Language (por defecto español). */
export function middleware(req: NextRequest) {
  const accept = req.headers.get('accept-language') ?? '';
  const lang = /^en\b/i.test(accept.trim()) ? 'en' : 'es';
  const url = req.nextUrl.clone();
  url.pathname = `/${lang}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/'] };
