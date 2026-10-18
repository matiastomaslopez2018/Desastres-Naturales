import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { LOGO_PATH } from '@/components/Logo';
import { T, isLang } from '@/lib/i18n';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Mapa de Desastres';

const font = (pkg: string, file: string) => readFile(path.join(process.cwd(), 'node_modules', '@fontsource', pkg, 'files', file));

/** Imagen OG del sitio (home y páginas sin imagen propia): logo, nombre y qué muestra. */
export default async function SiteOg({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params;
  const lang = isLang(l) ? l : 'es';
  const t = T[lang];
  const [serif, sans400, sans600] = await Promise.all([
    font('instrument-serif', 'instrument-serif-latin-400-normal.woff'),
    font('instrument-sans', 'instrument-sans-latin-400-normal.woff'),
    font('instrument-sans', 'instrument-sans-latin-600-normal.woff'),
  ]);
  const sub = t.homeTitle.split(' — ')[1] ?? t.brandSub;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 90px', background: '#fafaf8', color: '#141414', fontFamily: 'Instrument Sans' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
          <svg width="150" height="150" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14.75" fill="#ffffff" stroke="#141414" strokeWidth="1.2" /><path d={LOGO_PATH} fill="none" stroke="#e8590c" strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round" /></svg>
          <span style={{ fontFamily: 'Instrument Serif', fontSize: 104, lineHeight: 1 }}>{t.brand}</span>
        </div>
        <div style={{ display: 'flex', marginTop: 40, fontSize: 38, lineHeight: 1.25, maxWidth: 1000 }}>{sub.charAt(0).toUpperCase() + sub.slice(1)}</div>
        <div style={{ display: 'flex', marginTop: 34, fontSize: 24, fontWeight: 600, color: '#5a5a5a', letterSpacing: 1 }}>{t.brandSub}</div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Instrument Serif', data: serif, weight: 400 as const, style: 'normal' as const },
        { name: 'Instrument Sans', data: sans400, weight: 400 as const, style: 'normal' as const },
        { name: 'Instrument Sans', data: sans600, weight: 600 as const, style: 'normal' as const },
      ],
    },
  );
}
