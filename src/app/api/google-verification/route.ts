import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Archivo de verificación de Google Search Console (método "archivo HTML").
 * GOOGLE_SITE_VERIFICATION_FILE = nombre del archivo que da Google, por ejemplo
 * "google1234567890abcdef.html". next.config.ts reescribe /google….html hacia acá.
 */
export function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get('file') ?? '';
  const expected = process.env.GOOGLE_SITE_VERIFICATION_FILE?.trim();
  if (!expected || file !== expected || !/^google[0-9a-f]+\.html$/.test(file)) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(`google-site-verification: ${file}`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
