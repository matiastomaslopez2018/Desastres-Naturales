import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader, Source_Sans_3 } from 'next/font/google';
import { LANGS, T, isLang } from '@/lib/i18n';
import { SITE_URL } from '@/lib/site';
import '../base.css';
import '../night.css';
import '../paper.css';

// 2a "Satélite nocturno" (mapa): IBM Plex. 2b "Periodístico" (editorial): Newsreader + Source Sans 3.
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-sans' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });
const newsreader = Newsreader({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-newsreader' });
const sourceSans = Source_Sans_3({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-source-sans' });

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export const viewport: Viewport = {
  themeColor: [{ color: '#06080c' }],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = T[lang];
  return {
    metadataBase: new URL(SITE_URL),
    title: t.brand,
    description: t.brandSub,
    alternates: { languages: { es: '/es', en: '/en' } },
    openGraph: { title: t.brand, description: t.brandSub, type: 'website', locale: lang === 'es' ? 'es_AR' : 'en_US' },
    // Google Search Console (método "etiqueta HTML"): el código va en GOOGLE_SITE_VERIFICATION.
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
  };
}

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang} className={`${plexSans.variable} ${plexMono.variable} ${newsreader.variable} ${sourceSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
